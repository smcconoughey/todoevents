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
AI_MODEL = os.getenv("MISSIONOPS_AI_MODEL", "gpt-3.5-turbo")  # or "mixtral-8x7b-32768" for Groq

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