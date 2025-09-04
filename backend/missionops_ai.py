"""
MissionOps AI Integration Module
Handles LLM-based analysis of missions, tasks, and relationships
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import httpx
from openai import OpenAI

logger = logging.getLogger(__name__)

# AI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
AI_PROVIDER = os.getenv("MISSIONOPS_AI_PROVIDER", "openai")  # "openai" or "groq"
AI_MODEL = os.getenv("MISSIONOPS_AI_MODEL", "gpt-4o-mini")  # default fast, cheap JSON-capable

# LLM System Prompt
SYSTEM_PROMPT = """You are the AI Agent for a planning system called **MissionOps**. Your job is to evaluate an entire user-defined planning system composed of missions, tasks, and interlinked deadlines. You will generate actionable insights that help the user move forward, remove blockers, and reduce ambiguity in their plan.

You will be passed a structured JSON blob with:
- Multiple missions
- Each with nested tasks, milestones, and risks
- A list of links showing dependencies between items

---

### Your Goals:

1. **Break Down Vague Tasks**
   - If a task is vague or ambiguous, generate 2–5 SMART subtasks

2. **Identify Risks**
   - If a task or mission is behind, risky, or overly ambitious, return a risk entry
   - Rate risks by `likelihood` and `impact` and suggest mitigations

3. **Cross-Mission Analysis**
   - Identify bottlenecks between missions (e.g., "Mission B is blocked by Task X in Mission A")
   - Suggest sequencing or priority fixes

4. **Daily Prioritization**
   - Return up to 5 top-priority tasks that the user should focus on today, with reasoning

---

### Output Format (Strict JSON):

```json
{
  "taskBreakdowns": [
    {
      "parentTaskId": "string",
      "smartTasks": [
        {
          "title": "string",
          "description": "string",
          "dueDate": "optional date",
          "priority": 1-5
        }
      ]
    }
  ],
  "riskInsights": [
    {
      "targetId": "string",
      "targetType": "task|mission",
      "risk": "string",
      "likelihood": "low|medium|high",
      "impact": "low|medium|high",
      "suggestedMitigation": "string"
    }
  ],
  "crossMissionFlags": [
    {
      "sourceMissionId": "string",
      "targetMissionId": "string",
      "issue": "string",
      "suggestedAction": "string"
    }
  ],
  "todayFocus": [
    {
      "taskId": "string",
      "reason": "deadline|priority|blocked|overdue"
    }
  ]
}
```

Requirements:
- Do not return conversational text — output must be valid JSON
- Never fabricate IDs or change structure
- Focus on accuracy, decomposability, and relevance to near-term execution"""


class MissionOpsAI:
    def __init__(self):
        if AI_PROVIDER == "openai" and OPENAI_API_KEY:
            self.client = OpenAI(api_key=OPENAI_API_KEY)
        elif AI_PROVIDER == "groq" and GROQ_API_KEY:
            # Groq uses OpenAI-compatible API
            self.client = OpenAI(
                api_key=GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1"
            )
        else:
            logger.warning("No AI provider configured for MissionOps")
            self.client = None
    
    def _pick_model(self, override: Optional[str] = None) -> str:
        if override and isinstance(override, str) and override.strip():
            return override
        return AI_MODEL

    def trim_messages_by_char_budget(self, messages: List[Dict[str, str]], max_chars: int) -> List[Dict[str, str]]:
        if max_chars <= 0:
            return messages[-2:] if len(messages) >= 2 else messages
        running = []
        total = 0
        # Always try to keep the last assistant/user exchange; iterate from end
        for msg in reversed(messages):
            chunk = (msg.get("content") or "")
            add_len = len(chunk)
            if total + add_len <= max_chars or not running:
                running.append(msg)
                total += add_len
            else:
                break
        return list(reversed(running))

    def build_system_prompt(self, baseline_prompt: Optional[str]) -> str:
        default_prompt = (
            "You are MissionOps, a text-only planning agent. Be concise, output plain ASCII. "
            "Maintain context about the user's missions, tasks, responsibilities, and priorities. "
            "When listing actions, number them. Avoid emojis and markdown unless code or JSON is explicitly requested."
        )
        if baseline_prompt and baseline_prompt.strip():
            return baseline_prompt
        return default_prompt

    def chat(self, messages: List[Dict[str, str]], model_name: Optional[str] = None,
             temperature: float = 0.3, max_tokens: int = 800, json_response: bool = False) -> Optional[str]:
        if not self.client:
            return None
        try:
            params = {
                "model": self._pick_model(model_name),
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if json_response:
                params["response_format"] = {"type": "json_object"}
            resp = self.client.chat.completions.create(**params)
            return resp.choices[0].message.content
        except Exception as e:
            logger.error(f"MissionOps chat error: {e}")
            return None

    def summarize_context_to_json(self, raw_text: str, model_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            system = (
                "You compress life/context text into a compact JSON with keys: areas, projects, tasks, deadlines, stakeholders, risks, notes. "
                "Each key is an array of objects with fields you infer (title/desc/date/importance/etc.). Keep under 1200 words total."
            )
            user = raw_text[:120000]
            content = self.chat([
                {"role": "system", "content": system},
                {"role": "user", "content": user}
            ], model_name=model_name, temperature=0.1, max_tokens=1200, json_response=True)
            if not content:
                return None
            return json.loads(content)
        except Exception as e:
            logger.error(f"summarize_context_to_json error: {e}")
            return None

    def compose_mission_network(self, missions: List[Dict], tasks: List[Dict], 
                               relationships: List[Dict], dependencies: List[Dict]) -> Dict:
        """
        Compose the mission network data structure for LLM analysis
        """
        # Create lookup maps
        task_map = {task['id']: task for task in tasks}
        mission_map = {mission['id']: mission for mission in missions}
        
        # Group tasks by mission
        tasks_by_mission = {}
        for task in tasks:
            mission_id = task.get('mission_id')
            if mission_id not in tasks_by_mission:
                tasks_by_mission[mission_id] = []
            tasks_by_mission[mission_id].append(task)
        
        # Build the network structure
        network = {
            "missions": [],
            "relationships": relationships,
            "dependencies": dependencies,
            "metadata": {
                "timestamp": datetime.utcnow().isoformat(),
                "total_missions": len(missions),
                "total_tasks": len(tasks),
                "total_relationships": len(relationships),
                "total_dependencies": len(dependencies)
            }
        }
        
        # Enrich mission data with tasks
        for mission in missions:
            mission_data = {
                **mission,
                "tasks": tasks_by_mission.get(mission['id'], [])
            }
            network["missions"].append(mission_data)
        
        return network
    
    def analyze_mission_network(self, network: Dict) -> Optional[Dict]:
        """
        Send mission network to LLM for analysis
        """
        if not self.client:
            logger.error("No AI client configured")
            return None
        
        try:
            # Prepare the user message
            user_message = json.dumps(network, indent=2)
            
            # Make the API call
            response = self.client.chat.completions.create(
                model=AI_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.7,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )
            
            # Parse the response
            content = response.choices[0].message.content
            analysis = json.loads(content)
            
            # Validate the response structure
            required_keys = ["taskBreakdowns", "riskInsights", "crossMissionFlags", "todayFocus"]
            if not all(key in analysis for key in required_keys):
                logger.error(f"Invalid LLM response structure: missing keys")
                return None
            
            return analysis
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            return None
        except Exception as e:
            logger.error(f"Error calling LLM API: {e}")
            return None
    
    def convert_analysis_to_insights(self, analysis: Dict, mission_id: int) -> List[Dict]:
        """
        Convert LLM analysis to MissionOps AI insights format
        """
        insights = []
        
        # Convert task breakdowns to insights
        for breakdown in analysis.get("taskBreakdowns", []):
            smart_tasks = breakdown.get("smartTasks", [])
            if smart_tasks:
                insights.append({
                    "mission_id": mission_id,
                    "insight_type": "task_breakdown",
                    "title": f"Task Breakdown Suggestions",
                    "content": f"Identified vague task that can be broken down into {len(smart_tasks)} SMART subtasks",
                    "confidence_score": 0.85,
                    "action_items": json.dumps([{
                        "parentTaskId": breakdown["parentTaskId"],
                        "subtasks": smart_tasks
                    }]),
                    "priority_level": "medium"
                })
        
        # Convert risk insights
        for risk in analysis.get("riskInsights", []):
            priority_map = {
                ("high", "high"): "critical",
                ("high", "medium"): "high",
                ("medium", "high"): "high",
                ("medium", "medium"): "medium",
                ("low", "high"): "medium",
                ("high", "low"): "medium"
            }
            priority = priority_map.get(
                (risk["likelihood"], risk["impact"]), 
                "low"
            )
            
            insights.append({
                "mission_id": mission_id,
                "insight_type": "risk_analysis",
                "title": f"Risk Identified: {risk['risk'][:50]}...",
                "content": f"Risk analysis for {risk['targetType']} {risk['targetId']}: {risk['risk']}. Likelihood: {risk['likelihood']}, Impact: {risk['impact']}",
                "confidence_score": 0.9,
                "action_items": json.dumps([{
                    "type": "mitigation",
                    "action": risk["suggestedMitigation"]
                }]),
                "priority_level": priority
            })
        
        # Convert cross-mission flags
        for flag in analysis.get("crossMissionFlags", []):
            insights.append({
                "mission_id": mission_id,
                "insight_type": "bottleneck_detection",
                "title": "Cross-Mission Bottleneck",
                "content": f"{flag['issue']}. This affects the relationship between missions.",
                "confidence_score": 0.8,
                "action_items": json.dumps([{
                    "type": "cross_mission",
                    "action": flag["suggestedAction"],
                    "source": flag["sourceMissionId"],
                    "target": flag["targetMissionId"]
                }]),
                "priority_level": "high"
            })
        
        # Convert today's focus
        if analysis.get("todayFocus"):
            focus_tasks = analysis["todayFocus"][:5]  # Top 5
            insights.append({
                "mission_id": mission_id,
                "insight_type": "priority_optimization",
                "title": "Today's Priority Tasks",
                "content": f"AI identified {len(focus_tasks)} critical tasks for today based on deadlines, dependencies, and priority levels",
                "confidence_score": 0.85,
                "action_items": json.dumps([{
                    "taskId": task["taskId"],
                    "reason": task["reason"]
                } for task in focus_tasks]),
                "priority_level": "high"
            })
        
        return insights
    
    def generate_insights_for_mission(self, mission_id: int, missions: List[Dict], 
                                    tasks: List[Dict], relationships: List[Dict], 
                                    dependencies: List[Dict]) -> List[Dict]:
        """
        Generate AI insights for a specific mission
        """
        # Compose the network
        network = self.compose_mission_network(missions, tasks, relationships, dependencies)
        
        # Analyze with LLM
        analysis = self.analyze_mission_network(network)
        
        if not analysis:
            logger.warning(f"No analysis returned for mission {mission_id}")
            return []
        
        # Convert to insights
        insights = self.convert_analysis_to_insights(analysis, mission_id)
        
        return insights


# Singleton instance
missionops_ai = MissionOpsAI()

# Export configuration for use in endpoints
__all__ = ['missionops_ai', 'AI_PROVIDER', 'AI_MODEL']