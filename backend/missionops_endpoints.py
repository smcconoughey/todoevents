"""
MissionOps API Endpoints
All endpoints are prefixed with /missionops to avoid conflicts with existing todo-events endpoints.
"""

import json
import logging
from datetime import datetime, date
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse

# Import existing auth and database utilities
from shared_utils import get_current_user, get_db, get_placeholder, IS_PRODUCTION, DB_URL

# Import MissionOps models and utilities
from missionops_models import (
    MissionCreate, MissionUpdate, MissionResponse,
    MissionRelationshipCreate, MissionRelationshipResponse,
    TaskCreate, TaskUpdate, TaskResponse,
    TaskCreateEnhanced, TaskUpdateEnhanced, TaskResponseEnhanced,
    TaskDependencyCreate, TaskDependencyResponse,
    ResourceCreate, ResourceResponse,
    TaskResourceCreate, TaskResourceResponse,
    RiskCreate, RiskUpdate, RiskResponse,
    RiskCreateEnhanced, RiskResponseEnhanced,
    DecisionWorkflowCreate, DecisionWorkflowResponse,
    DecisionNodeCreate, DecisionNodeUpdate, DecisionNodeResponse,
    DecisionConnectionCreate, DecisionConnectionResponse,
    AIInsightCreate, AIInsightResponse,
    DecisionLogCreate, DecisionLogResponse,
    DecisionLogCreateEnhanced, DecisionLogResponseEnhanced,
    MissionShareCreate, MissionShareResponse,
    init_missionops_db, dict_from_row, get_user_missions_access, has_mission_access,
    get_mission_tasks_with_subtasks, get_task_by_id, get_mission_by_id
)

logger = logging.getLogger(__name__)

# Create router for MissionOps endpoints
missionops_router = APIRouter(prefix="/missionops", tags=["MissionOps"])

# Initialize database on import
init_missionops_db()

def convert_datetime_to_string(obj):
    """Convert datetime and date objects to ISO format strings"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, date):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: convert_datetime_to_string(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_datetime_to_string(item) for item in obj]
    else:
        return obj

def normalize_tags(tags_input):
    """Normalize tags input to JSON array format"""
    if not tags_input or tags_input.strip() == '':
        return '[]'
    
    try:
        # Try to parse as JSON first
        parsed = json.loads(tags_input)
        if isinstance(parsed, list):
            return json.dumps(parsed)
        else:
            return json.dumps([parsed])
    except (json.JSONDecodeError, TypeError):
        # If JSON parsing fails, treat as comma-separated plain text
        tags_list = [tag.strip() for tag in tags_input.split(',') if tag.strip()]
        return json.dumps(tags_list)

# MISSION ENDPOINTS

@missionops_router.get("/missions", response_model=List[MissionResponse])
async def list_missions(current_user: dict = Depends(get_current_user)):
    """Get all missions for the current user (owned or shared)"""
    try:
        logger.info(f"Listing missions for user {current_user['id']}")
        missions = get_user_missions_access(current_user["id"])
        logger.info(f"Retrieved {len(missions) if missions else 0} missions from database")
        
        if not missions:
            logger.info("No missions found, returning empty list")
            return []
        
        result = []
        for i, mission in enumerate(missions):
            try:
                logger.info(f"Processing mission {i+1}/{len(missions)}: {mission}")
                
                # Convert mission row to dictionary more reliably
                if hasattr(mission, '_asdict'):
                    # Named tuple
                    mission_dict = mission._asdict()
                elif hasattr(mission, 'keys'):
                    # Dict-like object
                    mission_dict = dict(mission)
                else:
                    # Fallback: assume it's a sequence and we know the column order
                    mission_dict = {
                        'id': mission[0],
                        'title': mission[1],
                        'description': mission[2],
                        'start_date': mission[3],
                        'end_date': mission[4],
                        'priority': mission[5],
                        'status': mission[6],
                        'tags': mission[7],
                        'grid_x': mission[8],
                        'grid_y': mission[9],
                        'owner_id': mission[10],
                        'created_at': mission[11],
                        'updated_at': mission[12]
                    }
                
                # Convert datetime objects to strings
                mission_dict = convert_datetime_to_string(mission_dict)
                
                # Remove access_level field if it exists (not part of MissionResponse model)
                if 'access_level' in mission_dict:
                    del mission_dict['access_level']
                
                # Get tasks and risks count
                with get_db() as conn:
                    c = conn.cursor()
                    placeholder = get_placeholder()
                    
                    # Count tasks
                    c.execute(f"SELECT COUNT(*) FROM missionops_tasks WHERE mission_id = {placeholder}", (mission_dict['id'],))
                    tasks_result = c.fetchone()
                    if tasks_result:
                        if hasattr(tasks_result, 'keys'):
                            # Dict-like object (RealDictRow)
                            tasks_count = list(tasks_result.values())[0]
                        else:
                            # Tuple-like object
                            tasks_count = tasks_result[0]
                    else:
                        tasks_count = 0
                    
                    # Count risks
                    c.execute(f"SELECT COUNT(*) FROM missionops_risks WHERE mission_id = {placeholder}", (mission_dict['id'],))
                    risks_result = c.fetchone()
                    if risks_result:
                        if hasattr(risks_result, 'keys'):
                            # Dict-like object (RealDictRow)
                            risks_count = list(risks_result.values())[0]
                        else:
                            # Tuple-like object
                            risks_count = risks_result[0]
                    else:
                        risks_count = 0
                    
                    # Get shared users
                    c.execute(f'''
                        SELECT s.shared_with_id, u.email, s.access_level
                        FROM missionops_mission_shares s
                        JOIN users u ON s.shared_with_id = u.id
                        WHERE s.mission_id = {placeholder}
                    ''', (mission_dict['id'],))
                    shared_users = [
                        {"user_id": row[0], "email": row[1], "access_level": row[2]}
                        for row in c.fetchall()
                    ]
                
                mission_dict.update({
                    'tasks_count': tasks_count,
                    'risks_count': risks_count,
                    'shared_with': shared_users
                })
                
                result.append(mission_dict)
                logger.info(f"Successfully processed mission {mission_dict['id']}: {mission_dict['title']}")
                
            except Exception as mission_error:
                logger.error(f"Error processing individual mission {i}: {str(mission_error)}")
                import traceback
                logger.error(f"Mission processing traceback: {traceback.format_exc()}")
                continue  # Skip this mission but continue with others
        
        logger.info(f"Returning {len(result)} missions")
        return result
        
    except Exception as e:
        logger.error(f"Error listing missions: {str(e)}")
        logger.error(f"Exception type: {type(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to list missions")

@missionops_router.post("/missions", response_model=MissionResponse)
async def create_mission(mission: MissionCreate, current_user: dict = Depends(get_current_user)):
    """Create a new mission"""
    try:
        placeholder = get_placeholder()
        
        # Convert empty strings to None for date fields
        start_date = mission.start_date if mission.start_date and mission.start_date.strip() else None
        end_date = mission.end_date if mission.end_date and mission.end_date.strip() else None
        
        # Normalize tags to JSON format
        normalized_tags = normalize_tags(mission.tags)
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Insert mission
            if IS_PRODUCTION and DB_URL:
                c.execute(f'''
                    INSERT INTO missionops_missions 
                    (title, description, start_date, end_date, priority, status, tags, grid_x, grid_y, owner_id)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                ''', (mission.title, mission.description, start_date, end_date, 
                      mission.priority, mission.status, normalized_tags, mission.grid_x, mission.grid_y, current_user["id"]))
                mission_id = c.fetchone()['id']
            else:
                c.execute(f'''
                    INSERT INTO missionops_missions 
                    (title, description, start_date, end_date, priority, status, tags, grid_x, grid_y, owner_id)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                ''', (mission.title, mission.description, start_date, end_date, 
                      mission.priority, mission.status, normalized_tags, mission.grid_x, mission.grid_y, current_user["id"]))
                mission_id = c.lastrowid
            
            conn.commit()
            
            # Get the created mission
            c.execute(f"SELECT * FROM missionops_missions WHERE id = {placeholder}", (mission_id,))
            mission_data = dict(c.fetchone())
            
            # Convert datetime objects to strings
            mission_data = convert_datetime_to_string(mission_data)
            
            # Remove access_level field if it exists (not part of MissionResponse model)
            if 'access_level' in mission_data:
                del mission_data['access_level']
            
            mission_data.update({
                'tasks_count': 0,
                'risks_count': 0,
                'shared_with': []
            })
            
            return mission_data
            
    except Exception as e:
        logger.error(f"Error creating mission: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create mission")

@missionops_router.get("/missions/{mission_id}", response_model=MissionResponse)
async def get_mission(mission_id: int, current_user: dict = Depends(get_current_user)):
    """Get a specific mission"""
    if not has_mission_access(mission_id, current_user["id"], "view"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            c.execute(f"SELECT * FROM missionops_missions WHERE id = {placeholder}", (mission_id,))
            mission = c.fetchone()
            
            if not mission:
                raise HTTPException(status_code=404, detail="Mission not found")
            
            mission_dict = dict(mission)
            
            # Convert datetime objects to strings
            mission_dict = convert_datetime_to_string(mission_dict)
            
            # Remove access_level field if it exists (not part of MissionResponse model)
            if 'access_level' in mission_dict:
                del mission_dict['access_level']
            
            # Get tasks and risks count
            c.execute(f"SELECT COUNT(*) FROM missionops_tasks WHERE mission_id = {placeholder}", (mission_id,))
            tasks_result = c.fetchone()
            tasks_count = tasks_result[0] if tasks_result else 0
            
            c.execute(f"SELECT COUNT(*) FROM missionops_risks WHERE mission_id = {placeholder}", (mission_id,))
            risks_result = c.fetchone()
            risks_count = risks_result[0] if risks_result else 0
            
            # Get shared users
            c.execute(f'''
                SELECT s.shared_with_id, u.email, s.access_level
                FROM missionops_mission_shares s
                JOIN users u ON s.shared_with_id = u.id
                WHERE s.mission_id = {placeholder}
            ''', (mission_id,))
            shared_users = [
                {"user_id": row[0], "email": row[1], "access_level": row[2]}
                for row in c.fetchall()
            ]
            
            mission_dict.update({
                'tasks_count': tasks_count,
                'risks_count': risks_count,
                'shared_with': shared_users
            })
            
            return mission_dict
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting mission: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get mission")

@missionops_router.put("/missions/{mission_id}", response_model=MissionResponse)
async def update_mission(mission_id: int, mission: MissionUpdate, current_user: dict = Depends(get_current_user)):
    """Update a mission"""
    if not has_mission_access(mission_id, current_user["id"], "edit"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Build update query dynamically
            update_fields = []
            update_values = []
            
            for field, value in mission.dict(exclude_unset=True).items():
                if value is not None:
                    # Convert empty strings to None for date fields
                    if field in ['start_date', 'end_date'] and isinstance(value, str) and not value.strip():
                        value = None
                    # Normalize tags to JSON format
                    elif field == 'tags':
                        value = normalize_tags(value)
                    update_fields.append(f"{field} = {placeholder}")
                    update_values.append(value)
            
            if not update_fields:
                raise HTTPException(status_code=400, detail="No fields to update")
            
            update_fields.append(f"updated_at = {placeholder}")
            update_values.append(datetime.utcnow())
            update_values.append(mission_id)
            
            update_query = f'''
                UPDATE missionops_missions 
                SET {', '.join(update_fields)}
                WHERE id = {placeholder}
            '''
            
            c.execute(update_query, update_values)
            conn.commit()
            
            # Return updated mission
            return await get_mission(mission_id, current_user)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating mission: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update mission")

@missionops_router.delete("/missions/{mission_id}")
async def delete_mission(mission_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a mission (only owner can delete)"""
    if not has_mission_access(mission_id, current_user["id"], "owner"):
        raise HTTPException(status_code=403, detail="Only mission owner can delete")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            c.execute(f"DELETE FROM missionops_missions WHERE id = {placeholder}", (mission_id,))
            
            if c.rowcount == 0:
                raise HTTPException(status_code=404, detail="Mission not found")
            
            conn.commit()
            
            return {"detail": "Mission deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting mission: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete mission")

# TASK ENDPOINTS

@missionops_router.get("/missions/{mission_id}/tasks", response_model=List[dict])
async def get_mission_tasks(mission_id: int, current_user: dict = Depends(get_current_user)):
    """Get all tasks for a mission"""
    try:
        logger.info(f"Getting tasks for mission {mission_id} for user {current_user['id']}")
        
        # Verify user has access to the mission
        mission = get_mission_by_id(mission_id, current_user["id"])
        if not mission:
            raise HTTPException(status_code=404, detail="Mission not found or access denied")
        
        tasks = get_mission_tasks_with_subtasks(mission_id)
        logger.info(f"Retrieved {len(tasks) if tasks else 0} tasks for mission {mission_id}")
        
        return tasks or []
        
    except Exception as e:
        logger.error(f"Error getting tasks for mission {mission_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get tasks: {str(e)}")

@missionops_router.post("/tasks", response_model=dict)
async def create_task(task: dict, current_user: dict = Depends(get_current_user)):
    """Create a new task"""
    try:
        logger.info(f"Creating task for user {current_user['id']}: {task}")
        
        # Verify user has access to the mission
        mission = get_mission_by_id(task["mission_id"], current_user["id"])
        if not mission:
            raise HTTPException(status_code=404, detail="Mission not found or access denied")
        
        # Convert empty strings to None for date fields
        due_date = task.get("due_date") if task.get("due_date") and str(task.get("due_date")).strip() else None
        
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Insert task
            if IS_PRODUCTION and DB_URL:
                c.execute(f'''
                    INSERT INTO missionops_tasks 
                    (mission_id, parent_task_id, title, description, priority, status, due_date, assigned_to, created_by, created_at)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, NOW())
                    RETURNING *
                ''', (
                    task["mission_id"],
                    task.get("parent_task_id"),
                    task["title"],
                    task.get("description", ""),
                    task.get("priority", "medium"),
                    task.get("status", "todo"),
                    due_date,
                    task.get("assigned_to"),
                    current_user["id"]
                ))
            else:
                c.execute('''
                    INSERT INTO missionops_tasks 
                    (mission_id, parent_task_id, title, description, priority, status, due_date, assigned_to, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    RETURNING *
                ''', (
                    task["mission_id"],
                    task.get("parent_task_id"),
                    task["title"],
                    task.get("description", ""),
                    task.get("priority", "medium"),
                    task.get("status", "todo"),
                    due_date,
                    task.get("assigned_to"),
                    current_user["id"]
                ))
            
            new_task = c.fetchone()
            if new_task:
                task_dict = dict(zip([col[0] for col in c.description], new_task))
                task_dict = convert_datetime_to_string(task_dict)
                logger.info(f"Created task: {task_dict}")
                return task_dict
            else:
                raise HTTPException(status_code=500, detail="Failed to create task")
                
    except Exception as e:
        logger.error(f"Error creating task: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")

@missionops_router.put("/tasks/{task_id}", response_model=dict)
async def update_task(task_id: int, task_updates: dict, current_user: dict = Depends(get_current_user)):
    """Update a task"""
    try:
        logger.info(f"Updating task {task_id} for user {current_user['id']}: {task_updates}")
        
        # Verify user has access to the task
        existing_task = get_task_by_id(task_id, current_user["id"])
        if not existing_task:
            raise HTTPException(status_code=404, detail="Task not found or access denied")
        
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Build update query
            update_fields = []
            update_values = []
            
            for field, value in task_updates.items():
                if field in ['title', 'description', 'priority', 'status', 'due_date', 'assigned_to']:
                    # Convert empty strings to None for date fields
                    if field == 'due_date' and isinstance(value, str) and not value.strip():
                        value = None
                    update_fields.append(f"{field} = {placeholder}")
                    update_values.append(value)
            
            if not update_fields:
                return existing_task
            
            update_values.append(task_id)
            
            if IS_PRODUCTION and DB_URL:
                c.execute(f'''
                    UPDATE missionops_tasks 
                    SET {", ".join(update_fields)}, updated_at = NOW()
                    WHERE id = {placeholder}
                    RETURNING *
                ''', update_values)
            else:
                c.execute(f'''
                    UPDATE missionops_tasks 
                    SET {", ".join(update_fields)}, updated_at = datetime('now')
                    WHERE id = {placeholder}
                    RETURNING *
                ''', update_values)
            
            updated_task = c.fetchone()
            if updated_task:
                task_dict = dict(zip([col[0] for col in c.description], updated_task))
                task_dict = convert_datetime_to_string(task_dict)
                logger.info(f"Updated task: {task_dict}")
                return task_dict
            else:
                raise HTTPException(status_code=404, detail="Task not found")
                
    except Exception as e:
        logger.error(f"Error updating task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update task: {str(e)}")

@missionops_router.delete("/tasks/{task_id}")
async def delete_task(task_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a task and all its subtasks"""
    try:
        logger.info(f"Deleting task {task_id} for user {current_user['id']}")
        
        # Verify user has access to the task
        existing_task = get_task_by_id(task_id, current_user["id"])
        if not existing_task:
            raise HTTPException(status_code=404, detail="Task not found or access denied")
        
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Delete task and all subtasks (cascade)
            if IS_PRODUCTION and DB_URL:
                # First delete all subtasks recursively
                c.execute(f'''
                    WITH RECURSIVE task_tree AS (
                        SELECT id FROM missionops_tasks WHERE id = {placeholder}
                        UNION ALL
                        SELECT t.id FROM missionops_tasks t
                        INNER JOIN task_tree tt ON t.parent_task_id = tt.id
                    )
                    DELETE FROM missionops_tasks WHERE id IN (SELECT id FROM task_tree)
                ''', (task_id,))
            else:
                # For SQLite, we need to handle this differently
                # First get all subtask IDs recursively
                def get_all_subtask_ids(parent_id):
                    c.execute('SELECT id FROM missionops_tasks WHERE parent_task_id = ?', (parent_id,))
                    subtasks = c.fetchall()
                    all_ids = [parent_id]
                    for subtask in subtasks:
                        all_ids.extend(get_all_subtask_ids(subtask[0]))
                    return all_ids
                
                all_task_ids = get_all_subtask_ids(task_id)
                placeholders = ','.join(['?' for _ in all_task_ids])
                c.execute(f'DELETE FROM missionops_tasks WHERE id IN ({placeholders})', all_task_ids)
            
            deleted_count = c.rowcount
            logger.info(f"Deleted {deleted_count} tasks (including subtasks)")
            
            return {"message": f"Deleted task and {deleted_count - 1} subtasks"}
                
    except Exception as e:
        logger.error(f"Error deleting task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete task: {str(e)}")

# RISK ENDPOINTS

@missionops_router.get("/missions/{mission_id}/risks", response_model=List[RiskResponse])
async def list_risks(mission_id: int, current_user: dict = Depends(get_current_user)):
    """Get all risks for a mission"""
    if not has_mission_access(mission_id, current_user["id"], "view"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            c.execute(f'''
                SELECT r.*, t.title as task_title
                FROM missionops_risks r
                LEFT JOIN missionops_tasks t ON r.task_id = t.id
                WHERE r.mission_id = {placeholder}
                ORDER BY r.created_at DESC
            ''', (mission_id,))
            
            risks = c.fetchall()
            result = []
            
            for risk in risks:
                risk_data = dict_from_row(risk, [
                    'id', 'mission_id', 'task_id', 'title', 'description',
                    'probability', 'impact', 'mitigation', 'status',
                    'created_by', 'created_at', 'updated_at', 'task_title'
                ])
                result.append(risk_data)
            
            return result
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing risks: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list risks")

@missionops_router.post("/risks", response_model=RiskResponse)
async def create_risk(risk: RiskCreate, current_user: dict = Depends(get_current_user)):
    """Create a new risk"""
    if not has_mission_access(risk.mission_id, current_user["id"], "edit"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Insert risk
            if IS_PRODUCTION and DB_URL:
                c.execute(f'''
                    INSERT INTO missionops_risks 
                    (mission_id, task_id, title, description, probability, impact, mitigation, status, created_by)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                ''', (risk.mission_id, risk.task_id, risk.title, risk.description, 
                      risk.probability, risk.impact, risk.mitigation, risk.status, current_user["id"]))
                risk_id = c.fetchone()['id']
            else:
                c.execute(f'''
                    INSERT INTO missionops_risks 
                    (mission_id, task_id, title, description, probability, impact, mitigation, status, created_by)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                ''', (risk.mission_id, risk.task_id, risk.title, risk.description, 
                      risk.probability, risk.impact, risk.mitigation, risk.status, current_user["id"]))
                risk_id = c.lastrowid
            
            conn.commit()
            
            # Get the created risk
            c.execute(f"SELECT * FROM missionops_risks WHERE id = {placeholder}", (risk_id,))
            risk_data = dict(c.fetchone())
            
            return risk_data
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating risk: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create risk")

# DECISION LOG ENDPOINTS

@missionops_router.get("/missions/{mission_id}/decisions", response_model=List[DecisionLogResponse])
async def list_decisions(mission_id: int, current_user: dict = Depends(get_current_user)):
    """Get all decision logs for a mission"""
    if not has_mission_access(mission_id, current_user["id"], "view"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            c.execute(f'''
                SELECT d.*, u.email as creator_email
                FROM missionops_decision_logs d
                LEFT JOIN users u ON d.created_by = u.id
                WHERE d.mission_id = {placeholder}
                ORDER BY d.created_at DESC
            ''', (mission_id,))
            
            decisions = c.fetchall()
            result = []
            
            for decision in decisions:
                decision_data = dict_from_row(decision, [
                    'id', 'mission_id', 'title', 'description', 'decision',
                    'rationale', 'alternatives', 'created_by', 'created_at', 'creator_email'
                ])
                result.append(decision_data)
            
            return result
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing decisions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list decisions")

@missionops_router.post("/decisions", response_model=DecisionLogResponse)
async def create_decision(decision: DecisionLogCreate, current_user: dict = Depends(get_current_user)):
    """Create a new decision log"""
    if not has_mission_access(decision.mission_id, current_user["id"], "edit"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Insert decision log
            if IS_PRODUCTION and DB_URL:
                c.execute(f'''
                    INSERT INTO missionops_decision_logs 
                    (mission_id, title, description, decision, rationale, alternatives, created_by)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                ''', (decision.mission_id, decision.title, decision.description, decision.decision, 
                      decision.rationale, decision.alternatives, current_user["id"]))
                decision_id = c.fetchone()['id']
            else:
                c.execute(f'''
                    INSERT INTO missionops_decision_logs 
                    (mission_id, title, description, decision, rationale, alternatives, created_by)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                ''', (decision.mission_id, decision.title, decision.description, decision.decision, 
                      decision.rationale, decision.alternatives, current_user["id"]))
                decision_id = c.lastrowid
            
            conn.commit()
            
            # Get the created decision log
            c.execute(f"SELECT * FROM missionops_decision_logs WHERE id = {placeholder}", (decision_id,))
            decision_data = dict(c.fetchone())
            
            return decision_data
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating decision log: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create decision log")

# SHARING ENDPOINTS

@missionops_router.post("/missions/{mission_id}/share", response_model=MissionShareResponse)
async def share_mission(mission_id: int, share: MissionShareCreate, current_user: dict = Depends(get_current_user)):
    """Share a mission with another user"""
    if not has_mission_access(mission_id, current_user["id"], "admin"):
        raise HTTPException(status_code=403, detail="Only mission admin can share")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Find user by email
            c.execute(f"SELECT id FROM users WHERE email = {placeholder}", (share.shared_with_email,))
            user = c.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            shared_with_id = user[0] if isinstance(user, (tuple, list)) else user['id']
            
            # Insert share record
            try:
                if IS_PRODUCTION and DB_URL:
                    c.execute(f'''
                        INSERT INTO missionops_mission_shares 
                        (mission_id, shared_with_id, access_level, shared_by)
                        VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})
                        RETURNING id
                    ''', (mission_id, shared_with_id, share.access_level, current_user["id"]))
                    share_id = c.fetchone()['id']
                else:
                    c.execute(f'''
                        INSERT INTO missionops_mission_shares 
                        (mission_id, shared_with_id, access_level, shared_by)
                        VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})
                    ''', (mission_id, shared_with_id, share.access_level, current_user["id"]))
                    share_id = c.lastrowid
                
                conn.commit()
                
                # Return share info
                return {
                    "id": share_id,
                    "mission_id": mission_id,
                    "shared_with_id": shared_with_id,
                    "shared_with_email": share.shared_with_email,
                    "access_level": share.access_level,
                    "shared_by": current_user["id"],
                    "created_at": datetime.utcnow().isoformat()
                }
                
            except Exception as e:
                if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                    # Update existing share
                    c.execute(f'''
                        UPDATE missionops_mission_shares 
                        SET access_level = {placeholder}
                        WHERE mission_id = {placeholder} AND shared_with_id = {placeholder}
                    ''', (share.access_level, mission_id, shared_with_id))
                    conn.commit()
                    
                    return {
                        "id": 0,  # Updated record
                        "mission_id": mission_id,
                        "shared_with_id": shared_with_id,
                        "shared_with_email": share.shared_with_email,
                        "access_level": share.access_level,
                        "shared_by": current_user["id"],
                        "created_at": datetime.utcnow().isoformat()
                    }
                else:
                    raise e
                    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sharing mission: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to share mission")

@missionops_router.delete("/missions/{mission_id}/share/{shared_with_id}")
async def unshare_mission(mission_id: int, shared_with_id: int, current_user: dict = Depends(get_current_user)):
    """Remove share access from a mission"""
    if not has_mission_access(mission_id, current_user["id"], "admin"):
        raise HTTPException(status_code=403, detail="Only mission admin can unshare")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            c.execute(f'''
                DELETE FROM missionops_mission_shares 
                WHERE mission_id = {placeholder} AND shared_with_id = {placeholder}
            ''', (mission_id, shared_with_id))
            
            if c.rowcount == 0:
                raise HTTPException(status_code=404, detail="Share not found")
            
            conn.commit()
            
            return {"detail": "Mission unshared successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unsharing mission: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to unshare mission")

# GRID LAYOUT ENDPOINTS

@missionops_router.put("/missions/{mission_id}/position")
async def update_mission_position(
    mission_id: int, 
    position: dict,  # {"grid_x": float, "grid_y": float}
    current_user: dict = Depends(get_current_user)
):
    """Update mission position on the grid"""
    if not has_mission_access(mission_id, current_user["id"], "edit"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            c.execute(f'''
                UPDATE missionops_missions 
                SET grid_x = {placeholder}, grid_y = {placeholder}, updated_at = {placeholder}
                WHERE id = {placeholder}
            ''', (position.get("grid_x", 0.0), position.get("grid_y", 0.0), datetime.utcnow(), mission_id))
            
            if c.rowcount == 0:
                raise HTTPException(status_code=404, detail="Mission not found")
            
            conn.commit()
            
            return {"detail": "Mission position updated successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating mission position: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update mission position")

# MISSION RELATIONSHIP ENDPOINTS

@missionops_router.get("/missions/{mission_id}/relationships", response_model=List[MissionRelationshipResponse])
async def get_mission_relationships(mission_id: int, current_user: dict = Depends(get_current_user)):
    """Get all relationships for a mission"""
    if not has_mission_access(mission_id, current_user["id"], "view"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Get relationships where this mission is the source
            c.execute(f'''
                SELECT r.*, m1.title as from_mission_title, m2.title as to_mission_title
                FROM missionops_mission_relationships r
                JOIN missionops_missions m1 ON r.from_mission_id = m1.id
                JOIN missionops_missions m2 ON r.to_mission_id = m2.id
                WHERE r.from_mission_id = {placeholder} OR r.to_mission_id = {placeholder}
                ORDER BY r.created_at DESC
            ''', (mission_id, mission_id))
            
            relationships = c.fetchall()
            result = []
            
            for rel in relationships:
                rel_data = dict(rel)
                rel_data = convert_datetime_to_string(rel_data)
                result.append(rel_data)
            
            return result
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting mission relationships: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get mission relationships")

@missionops_router.post("/mission-relationships", response_model=MissionRelationshipResponse)
async def create_mission_relationship(relationship: MissionRelationshipCreate, current_user: dict = Depends(get_current_user)):
    """Create a relationship between two missions"""
    # Check access to both missions
    if not has_mission_access(relationship.from_mission_id, current_user["id"], "edit"):
        raise HTTPException(status_code=403, detail="Access denied to source mission")
    if not has_mission_access(relationship.to_mission_id, current_user["id"], "view"):
        raise HTTPException(status_code=403, detail="Access denied to target mission")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Insert relationship
            if IS_PRODUCTION and DB_URL:
                c.execute(f'''
                    INSERT INTO missionops_mission_relationships 
                    (from_mission_id, to_mission_id, relationship_type, dependency_type, strength, notes)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                ''', (relationship.from_mission_id, relationship.to_mission_id, relationship.relationship_type,
                      relationship.dependency_type, relationship.strength, relationship.notes))
                rel_id = c.fetchone()['id']
            else:
                c.execute(f'''
                    INSERT INTO missionops_mission_relationships 
                    (from_mission_id, to_mission_id, relationship_type, dependency_type, strength, notes)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                ''', (relationship.from_mission_id, relationship.to_mission_id, relationship.relationship_type,
                      relationship.dependency_type, relationship.strength, relationship.notes))
                rel_id = c.lastrowid
            
            conn.commit()
            
            # Get the created relationship with mission titles
            c.execute(f'''
                SELECT r.*, m1.title as from_mission_title, m2.title as to_mission_title
                FROM missionops_mission_relationships r
                JOIN missionops_missions m1 ON r.from_mission_id = m1.id
                JOIN missionops_missions m2 ON r.to_mission_id = m2.id
                WHERE r.id = {placeholder}
            ''', (rel_id,))
            
            rel_data = dict(c.fetchone())
            rel_data = convert_datetime_to_string(rel_data)
            
            return rel_data
            
    except Exception as e:
        logger.error(f"Error creating mission relationship: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create mission relationship")

@missionops_router.delete("/mission-relationships/{relationship_id}")
async def delete_mission_relationship(relationship_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a mission relationship"""
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user has access to the relationship
            c.execute(f'''
                SELECT r.from_mission_id, r.to_mission_id
                FROM missionops_mission_relationships r
                WHERE r.id = {placeholder}
            ''', (relationship_id,))
            
            rel = c.fetchone()
            if not rel:
                raise HTTPException(status_code=404, detail="Relationship not found")
            
            # Check access to source mission
            if not has_mission_access(rel[0], current_user["id"], "edit"):
                raise HTTPException(status_code=403, detail="Access denied")
            
            # Delete the relationship
            c.execute(f"DELETE FROM missionops_mission_relationships WHERE id = {placeholder}", (relationship_id,))
            
            if c.rowcount == 0:
                raise HTTPException(status_code=404, detail="Relationship not found")
            
            conn.commit()
            
            return {"detail": "Mission relationship deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting mission relationship: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete mission relationship")

# TASK DEPENDENCY ENDPOINTS

@missionops_router.get("/tasks/{task_id}/dependencies", response_model=List[TaskDependencyResponse])
async def get_task_dependencies(task_id: int, current_user: dict = Depends(get_current_user)):
    """Get all dependencies for a task"""
    # Verify user has access to the task
    task = get_task_by_id(task_id, current_user["id"])
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or access denied")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Get dependencies (both as predecessor and successor)
            c.execute(f'''
                SELECT d.*, t1.title as predecessor_title, t2.title as successor_title
                FROM missionops_task_dependencies d
                JOIN missionops_tasks t1 ON d.predecessor_task_id = t1.id
                JOIN missionops_tasks t2 ON d.successor_task_id = t2.id
                WHERE d.predecessor_task_id = {placeholder} OR d.successor_task_id = {placeholder}
                ORDER BY d.created_at DESC
            ''', (task_id, task_id))
            
            dependencies = c.fetchall()
            result = []
            
            for dep in dependencies:
                dep_data = dict(dep)
                dep_data = convert_datetime_to_string(dep_data)
                result.append(dep_data)
            
            return result
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting task dependencies: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get task dependencies")

@missionops_router.post("/task-dependencies", response_model=TaskDependencyResponse)
async def create_task_dependency(dependency: TaskDependencyCreate, current_user: dict = Depends(get_current_user)):
    """Create a dependency between two tasks"""
    # Verify user has access to both tasks
    pred_task = get_task_by_id(dependency.predecessor_task_id, current_user["id"])
    succ_task = get_task_by_id(dependency.successor_task_id, current_user["id"])
    
    if not pred_task:
        raise HTTPException(status_code=404, detail="Predecessor task not found or access denied")
    if not succ_task:
        raise HTTPException(status_code=404, detail="Successor task not found or access denied")
    
    # Prevent circular dependencies
    if dependency.predecessor_task_id == dependency.successor_task_id:
        raise HTTPException(status_code=400, detail="Task cannot depend on itself")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Insert dependency
            if IS_PRODUCTION and DB_URL:
                c.execute(f'''
                    INSERT INTO missionops_task_dependencies 
                    (predecessor_task_id, successor_task_id, dependency_type, lag_time_hours)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                ''', (dependency.predecessor_task_id, dependency.successor_task_id, 
                      dependency.dependency_type, dependency.lag_time_hours))
                dep_id = c.fetchone()['id']
            else:
                c.execute(f'''
                    INSERT INTO missionops_task_dependencies 
                    (predecessor_task_id, successor_task_id, dependency_type, lag_time_hours)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})
                ''', (dependency.predecessor_task_id, dependency.successor_task_id, 
                      dependency.dependency_type, dependency.lag_time_hours))
                dep_id = c.lastrowid
            
            conn.commit()
            
            # Get the created dependency with task titles
            c.execute(f'''
                SELECT d.*, t1.title as predecessor_title, t2.title as successor_title
                FROM missionops_task_dependencies d
                JOIN missionops_tasks t1 ON d.predecessor_task_id = t1.id
                JOIN missionops_tasks t2 ON d.successor_task_id = t2.id
                WHERE d.id = {placeholder}
            ''', (dep_id,))
            
            dep_data = dict(c.fetchone())
            dep_data = convert_datetime_to_string(dep_data)
            
            return dep_data
            
    except Exception as e:
        logger.error(f"Error creating task dependency: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create task dependency")

@missionops_router.delete("/task-dependencies/{dependency_id}")
async def delete_task_dependency(dependency_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a task dependency"""
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user has access to the dependency
            c.execute(f'''
                SELECT d.predecessor_task_id, d.successor_task_id
                FROM missionops_task_dependencies d
                WHERE d.id = {placeholder}
            ''', (dependency_id,))
            
            dep = c.fetchone()
            if not dep:
                raise HTTPException(status_code=404, detail="Dependency not found")
            
            # Check access to both tasks
            pred_task = get_task_by_id(dep[0], current_user["id"])
            succ_task = get_task_by_id(dep[1], current_user["id"])
            
            if not pred_task or not succ_task:
                raise HTTPException(status_code=403, detail="Access denied")
            
            # Delete the dependency
            c.execute(f"DELETE FROM missionops_task_dependencies WHERE id = {placeholder}", (dependency_id,))
            
            if c.rowcount == 0:
                raise HTTPException(status_code=404, detail="Dependency not found")
            
            conn.commit()
            
            return {"detail": "Task dependency deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting task dependency: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete task dependency")

# DECISION WORKFLOW ENDPOINTS

@missionops_router.get("/missions/{mission_id}/decision-workflows", response_model=List[DecisionWorkflowResponse])
async def get_mission_decision_workflows(mission_id: int, current_user: dict = Depends(get_current_user)):
    """Get all decision workflows for a mission"""
    if not has_mission_access(mission_id, current_user["id"], "view"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Get workflows
            c.execute(f'''
                SELECT * FROM missionops_decision_workflows
                WHERE mission_id = {placeholder}
                ORDER BY created_at DESC
            ''', (mission_id,))
            
            workflows = c.fetchall()
            result = []
            
            for workflow in workflows:
                workflow_data = dict(workflow)
                workflow_data = convert_datetime_to_string(workflow_data)
                
                # Get nodes for this workflow
                c.execute(f'''
                    SELECT * FROM missionops_decision_nodes
                    WHERE workflow_id = {placeholder}
                    ORDER BY position_y, position_x
                ''', (workflow_data['id'],))
                
                nodes = [dict(node) for node in c.fetchall()]
                for node in nodes:
                    node = convert_datetime_to_string(node)
                
                # Get connections for this workflow
                c.execute(f'''
                    SELECT * FROM missionops_decision_connections
                    WHERE workflow_id = {placeholder}
                    ORDER BY created_at
                ''', (workflow_data['id'],))
                
                connections = [dict(conn) for conn in c.fetchall()]
                for connection in connections:
                    connection = convert_datetime_to_string(connection)
                
                workflow_data.update({
                    'nodes': nodes,
                    'connections': connections
                })
                
                result.append(workflow_data)
            
            return result
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting decision workflows: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get decision workflows")

@missionops_router.post("/decision-workflows", response_model=DecisionWorkflowResponse)
async def create_decision_workflow(workflow: DecisionWorkflowCreate, current_user: dict = Depends(get_current_user)):
    """Create a new decision workflow"""
    if not has_mission_access(workflow.mission_id, current_user["id"], "edit"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Insert workflow
            if IS_PRODUCTION and DB_URL:
                c.execute(f'''
                    INSERT INTO missionops_decision_workflows 
                    (mission_id, title, description, workflow_type, created_by)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                ''', (workflow.mission_id, workflow.title, workflow.description, 
                      workflow.workflow_type, current_user["id"]))
                workflow_id = c.fetchone()['id']
            else:
                c.execute(f'''
                    INSERT INTO missionops_decision_workflows 
                    (mission_id, title, description, workflow_type, created_by)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                ''', (workflow.mission_id, workflow.title, workflow.description, 
                      workflow.workflow_type, current_user["id"]))
                workflow_id = c.lastrowid
            
            conn.commit()
            
            # Get the created workflow
            c.execute(f"SELECT * FROM missionops_decision_workflows WHERE id = {placeholder}", (workflow_id,))
            workflow_data = dict(c.fetchone())
            workflow_data = convert_datetime_to_string(workflow_data)
            workflow_data.update({
                'nodes': [],
                'connections': []
            })
            
            return workflow_data
            
    except Exception as e:
        logger.error(f"Error creating decision workflow: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create decision workflow")

@missionops_router.post("/decision-nodes", response_model=DecisionNodeResponse)
async def create_decision_node(node: DecisionNodeCreate, current_user: dict = Depends(get_current_user)):
    """Create a new decision node"""
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Verify user has access to the workflow
            c.execute(f'''
                SELECT w.mission_id FROM missionops_decision_workflows w
                WHERE w.id = {placeholder}
            ''', (node.workflow_id,))
            
            workflow = c.fetchone()
            if not workflow:
                raise HTTPException(status_code=404, detail="Workflow not found")
            
            if not has_mission_access(workflow[0], current_user["id"], "edit"):
                raise HTTPException(status_code=403, detail="Access denied")
            
            # Insert node
            if IS_PRODUCTION and DB_URL:
                c.execute(f'''
                    INSERT INTO missionops_decision_nodes 
                    (workflow_id, title, description, node_type, position_x, position_y, decision_criteria, options)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                ''', (node.workflow_id, node.title, node.description, node.node_type,
                      node.position_x, node.position_y, node.decision_criteria, node.options))
                node_id = c.fetchone()['id']
            else:
                c.execute(f'''
                    INSERT INTO missionops_decision_nodes 
                    (workflow_id, title, description, node_type, position_x, position_y, decision_criteria, options)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                ''', (node.workflow_id, node.title, node.description, node.node_type,
                      node.position_x, node.position_y, node.decision_criteria, node.options))
                node_id = c.lastrowid
            
            conn.commit()
            
            # Get the created node
            c.execute(f"SELECT * FROM missionops_decision_nodes WHERE id = {placeholder}", (node_id,))
            node_data = dict(c.fetchone())
            node_data = convert_datetime_to_string(node_data)
            
            return node_data
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating decision node: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create decision node")

@missionops_router.put("/decision-nodes/{node_id}", response_model=DecisionNodeResponse)
async def update_decision_node(node_id: int, node_updates: DecisionNodeUpdate, current_user: dict = Depends(get_current_user)):
    """Update a decision node"""
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Verify user has access to the node
            c.execute(f'''
                SELECT n.workflow_id, w.mission_id
                FROM missionops_decision_nodes n
                JOIN missionops_decision_workflows w ON n.workflow_id = w.id
                WHERE n.id = {placeholder}
            ''', (node_id,))
            
            node_info = c.fetchone()
            if not node_info:
                raise HTTPException(status_code=404, detail="Node not found")
            
            if not has_mission_access(node_info[1], current_user["id"], "edit"):
                raise HTTPException(status_code=403, detail="Access denied")
            
            # Build update query
            update_fields = []
            update_values = []
            
            for field, value in node_updates.dict(exclude_unset=True).items():
                if value is not None:
                    update_fields.append(f"{field} = {placeholder}")
                    update_values.append(value)
            
            if not update_fields:
                raise HTTPException(status_code=400, detail="No fields to update")
            
            update_values.append(node_id)
            
            update_query = f'''
                UPDATE missionops_decision_nodes 
                SET {', '.join(update_fields)}
                WHERE id = {placeholder}
            '''
            
            c.execute(update_query, update_values)
            conn.commit()
            
            # Get the updated node
            c.execute(f"SELECT * FROM missionops_decision_nodes WHERE id = {placeholder}", (node_id,))
            node_data = dict(c.fetchone())
            node_data = convert_datetime_to_string(node_data)
            
            return node_data
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating decision node: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update decision node")

@missionops_router.post("/decision-connections", response_model=DecisionConnectionResponse)
async def create_decision_connection(connection: DecisionConnectionCreate, current_user: dict = Depends(get_current_user)):
    """Create a connection between decision nodes"""
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Verify user has access to the workflow
            c.execute(f'''
                SELECT w.mission_id FROM missionops_decision_workflows w
                WHERE w.id = {placeholder}
            ''', (connection.workflow_id,))
            
            workflow = c.fetchone()
            if not workflow:
                raise HTTPException(status_code=404, detail="Workflow not found")
            
            if not has_mission_access(workflow[0], current_user["id"], "edit"):
                raise HTTPException(status_code=403, detail="Access denied")
            
            # Verify both nodes exist and belong to the workflow
            c.execute(f'''
                SELECT COUNT(*) FROM missionops_decision_nodes
                WHERE workflow_id = {placeholder} AND id IN ({placeholder}, {placeholder})
            ''', (connection.workflow_id, connection.from_node_id, connection.to_node_id))
            
            node_count = c.fetchone()[0]
            if node_count != 2:
                raise HTTPException(status_code=400, detail="Invalid node IDs")
            
            # Insert connection
            if IS_PRODUCTION and DB_URL:
                c.execute(f'''
                    INSERT INTO missionops_decision_connections 
                    (workflow_id, from_node_id, to_node_id, condition_text)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                ''', (connection.workflow_id, connection.from_node_id, 
                      connection.to_node_id, connection.condition_text))
                conn_id = c.fetchone()['id']
            else:
                c.execute(f'''
                    INSERT INTO missionops_decision_connections 
                    (workflow_id, from_node_id, to_node_id, condition_text)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})
                ''', (connection.workflow_id, connection.from_node_id, 
                      connection.to_node_id, connection.condition_text))
                conn_id = c.lastrowid
            
            conn.commit()
            
            # Get the created connection
            c.execute(f"SELECT * FROM missionops_decision_connections WHERE id = {placeholder}", (conn_id,))
            conn_data = dict(c.fetchone())
            conn_data = convert_datetime_to_string(conn_data)
            
            return conn_data
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating decision connection: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create decision connection")

# AI INSIGHTS ENDPOINTS

@missionops_router.get("/missions/{mission_id}/ai-insights", response_model=List[AIInsightResponse])
async def get_mission_ai_insights(mission_id: int, current_user: dict = Depends(get_current_user)):
    """Get all AI insights for a mission"""
    if not has_mission_access(mission_id, current_user["id"], "view"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            c.execute(f'''
                SELECT * FROM missionops_ai_insights
                WHERE mission_id = {placeholder} AND status != 'dismissed'
                ORDER BY priority_level DESC, created_at DESC
            ''', (mission_id,))
            
            insights = c.fetchall()
            result = []
            
            for insight in insights:
                insight_data = dict(insight)
                insight_data = convert_datetime_to_string(insight_data)
                result.append(insight_data)
            
            return result
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting AI insights: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get AI insights")

@missionops_router.post("/missions/{mission_id}/ai-insights/generate")
async def generate_ai_insights(mission_id: int, current_user: dict = Depends(get_current_user)):
    """Generate AI insights for a mission"""
    if not has_mission_access(mission_id, current_user["id"], "view"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        # Get mission data for analysis
        mission = get_mission_by_id(mission_id, current_user["id"])
        if not mission:
            raise HTTPException(status_code=404, detail="Mission not found")
        
        tasks = get_mission_tasks_with_subtasks(mission_id)
        
        # Generate insights using simple heuristics (can be replaced with actual AI later)
        insights = []
        
        # Risk analysis
        high_risk_tasks = [t for t in tasks if t.get('priority') == 'critical' and t.get('status') != 'completed']
        if high_risk_tasks:
            insights.append({
                'insight_type': 'risk_analysis',
                'title': 'High-Risk Tasks Detected',
                'content': f'Found {len(high_risk_tasks)} critical priority tasks that require immediate attention.',
                'confidence_score': 0.9,
                'action_items': json.dumps([f"Review task: {t['title']}" for t in high_risk_tasks[:3]]),
                'priority_level': 'high'
            })
        
        # Timeline analysis
        overdue_tasks = []
        for task in tasks:
            if task.get('due_date') and task.get('status') != 'completed':
                try:
                    due_date = datetime.fromisoformat(task['due_date'].replace('Z', '+00:00'))
                    if due_date < datetime.now():
                        overdue_tasks.append(task)
                except:
                    pass
        
        if overdue_tasks:
            insights.append({
                'insight_type': 'timeline_analysis',
                'title': 'Overdue Tasks Impact Timeline',
                'content': f'{len(overdue_tasks)} overdue tasks may impact mission timeline.',
                'confidence_score': 0.95,
                'action_items': json.dumps(['Reschedule overdue tasks', 'Update mission timeline', 'Notify stakeholders']),
                'priority_level': 'high'
            })
        
        # Bottleneck detection
        incomplete_tasks = [t for t in tasks if t.get('status') not in ['completed', 'cancelled']]
        if len(incomplete_tasks) > 10:
            insights.append({
                'insight_type': 'bottleneck_detection',
                'title': 'Task Overload Detected',
                'content': f'Mission has {len(incomplete_tasks)} incomplete tasks which may indicate resource bottlenecks.',
                'confidence_score': 0.8,
                'action_items': json.dumps(['Review task priorities', 'Consider task delegation', 'Break down complex tasks']),
                'priority_level': 'medium'
            })
        
        # Priority optimization
        unassigned_tasks = [t for t in tasks if not t.get('assigned_to') and t.get('status') not in ['completed', 'cancelled']]
        if unassigned_tasks:
            insights.append({
                'insight_type': 'priority_optimization',
                'title': 'Unassigned Tasks Need Attention',
                'content': f'{len(unassigned_tasks)} tasks are unassigned and may delay mission progress.',
                'confidence_score': 0.85,
                'action_items': json.dumps(['Assign task owners', 'Review resource availability', 'Prioritize critical tasks']),
                'priority_level': 'medium'
            })
        
        # Store insights in database
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Clear old insights of the same types
            c.execute(f'''
                UPDATE missionops_ai_insights 
                SET status = 'expired' 
                WHERE mission_id = {placeholder} AND status = 'new'
            ''', (mission_id,))
            
            result_insights = []
            
            for insight in insights:
                if IS_PRODUCTION and DB_URL:
                    c.execute(f'''
                        INSERT INTO missionops_ai_insights 
                        (mission_id, insight_type, title, content, confidence_score, action_items, priority_level)
                        VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                        RETURNING id
                    ''', (mission_id, insight['insight_type'], insight['title'], insight['content'],
                          insight['confidence_score'], insight['action_items'], insight['priority_level']))
                    insight_id = c.fetchone()['id']
                else:
                    c.execute(f'''
                        INSERT INTO missionops_ai_insights 
                        (mission_id, insight_type, title, content, confidence_score, action_items, priority_level)
                        VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    ''', (mission_id, insight['insight_type'], insight['title'], insight['content'],
                          insight['confidence_score'], insight['action_items'], insight['priority_level']))
                    insight_id = c.lastrowid
                
                # Get the created insight
                c.execute(f"SELECT * FROM missionops_ai_insights WHERE id = {placeholder}", (insight_id,))
                insight_data = dict(c.fetchone())
                insight_data = convert_datetime_to_string(insight_data)
                result_insights.append(insight_data)
            
            conn.commit()
        
        return {
            "detail": f"Generated {len(result_insights)} AI insights",
            "insights": result_insights
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating AI insights: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate AI insights")

@missionops_router.put("/ai-insights/{insight_id}/status")
async def update_ai_insight_status(insight_id: int, status_update: dict, current_user: dict = Depends(get_current_user)):
    """Update AI insight status (e.g., mark as addressed, dismissed)"""
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Verify user has access to the insight
            c.execute(f'''
                SELECT i.mission_id
                FROM missionops_ai_insights i
                WHERE i.id = {placeholder}
            ''', (insight_id,))
            
            insight = c.fetchone()
            if not insight:
                raise HTTPException(status_code=404, detail="Insight not found")
            
            if not has_mission_access(insight[0], current_user["id"], "edit"):
                raise HTTPException(status_code=403, detail="Access denied")
            
            # Update status
            new_status = status_update.get('status', 'new')
            c.execute(f'''
                UPDATE missionops_ai_insights 
                SET status = {placeholder}
                WHERE id = {placeholder}
            ''', (new_status, insight_id))
            
            if c.rowcount == 0:
                raise HTTPException(status_code=404, detail="Insight not found")
            
            conn.commit()
            
            return {"detail": "AI insight status updated successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating AI insight status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update AI insight status")

# RESOURCE MANAGEMENT ENDPOINTS

@missionops_router.get("/resources", response_model=List[ResourceResponse])
async def list_resources(current_user: dict = Depends(get_current_user)):
    """Get all resources owned by the current user"""
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            c.execute(f'''
                SELECT * FROM missionops_resources
                WHERE owner_id = {placeholder}
                ORDER BY created_at DESC
            ''', (current_user["id"],))
            
            resources = c.fetchall()
            result = []
            
            for resource in resources:
                resource_data = dict(resource)
                resource_data = convert_datetime_to_string(resource_data)
                result.append(resource_data)
            
            return result
            
    except Exception as e:
        logger.error(f"Error listing resources: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list resources")

@missionops_router.post("/resources", response_model=ResourceResponse)
async def create_resource(resource: ResourceCreate, current_user: dict = Depends(get_current_user)):
    """Create a new resource"""
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Insert resource
            if IS_PRODUCTION and DB_URL:
                c.execute(f'''
                    INSERT INTO missionops_resources 
                    (name, type, capacity, cost_per_hour, availability_start, availability_end, owner_id)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                ''', (resource.name, resource.type, resource.capacity, resource.cost_per_hour,
                      resource.availability_start, resource.availability_end, current_user["id"]))
                resource_id = c.fetchone()['id']
            else:
                c.execute(f'''
                    INSERT INTO missionops_resources 
                    (name, type, capacity, cost_per_hour, availability_start, availability_end, owner_id)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                ''', (resource.name, resource.type, resource.capacity, resource.cost_per_hour,
                      resource.availability_start, resource.availability_end, current_user["id"]))
                resource_id = c.lastrowid
            
            conn.commit()
            
            # Get the created resource
            c.execute(f"SELECT * FROM missionops_resources WHERE id = {placeholder}", (resource_id,))
            resource_data = dict(c.fetchone())
            resource_data = convert_datetime_to_string(resource_data)
            
            return resource_data
            
    except Exception as e:
        logger.error(f"Error creating resource: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create resource")

@missionops_router.post("/task-resources", response_model=TaskResourceResponse)
async def assign_resource_to_task(task_resource: TaskResourceCreate, current_user: dict = Depends(get_current_user)):
    """Assign a resource to a task"""
    try:
        # Verify user has access to the task
        task = get_task_by_id(task_resource.task_id, current_user["id"])
        if not task:
            raise HTTPException(status_code=404, detail="Task not found or access denied")
        
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Verify user owns the resource
            c.execute(f'''
                SELECT id FROM missionops_resources
                WHERE id = {placeholder} AND owner_id = {placeholder}
            ''', (task_resource.resource_id, current_user["id"]))
            
            if not c.fetchone():
                raise HTTPException(status_code=404, detail="Resource not found or access denied")
            
            # Insert task resource assignment
            if IS_PRODUCTION and DB_URL:
                c.execute(f'''
                    INSERT INTO missionops_task_resources 
                    (task_id, resource_id, allocation_percentage, start_date, end_date)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                ''', (task_resource.task_id, task_resource.resource_id, task_resource.allocation_percentage,
                      task_resource.start_date, task_resource.end_date))
                tr_id = c.fetchone()['id']
            else:
                c.execute(f'''
                    INSERT INTO missionops_task_resources 
                    (task_id, resource_id, allocation_percentage, start_date, end_date)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                ''', (task_resource.task_id, task_resource.resource_id, task_resource.allocation_percentage,
                      task_resource.start_date, task_resource.end_date))
                tr_id = c.lastrowid
            
            conn.commit()
            
            # Get the created task resource with resource info
            c.execute(f'''
                SELECT tr.*, r.name as resource_name, r.type as resource_type
                FROM missionops_task_resources tr
                JOIN missionops_resources r ON tr.resource_id = r.id
                WHERE tr.id = {placeholder}
            ''', (tr_id,))
            
            tr_data = dict(c.fetchone())
            tr_data = convert_datetime_to_string(tr_data)
            
            return tr_data
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning resource to task: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to assign resource to task")

@missionops_router.get("/debug/mission/{mission_id}")
async def debug_mission_access(mission_id: int, current_user: dict = Depends(get_current_user)):
    """Debug endpoint to check mission access"""
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if mission exists
            c.execute(f"SELECT * FROM missionops_missions WHERE id = {placeholder}", (mission_id,))
            mission_raw = c.fetchone()
            
            if not mission_raw:
                return {
                    "mission_exists": False,
                    "user_id": current_user["id"],
                    "mission_id": mission_id
                }
            
            mission_dict = dict(mission_raw)
            
            # Check access via get_mission_by_id
            mission_access = get_mission_by_id(mission_id, current_user["id"])
            
            # Check access via has_mission_access
            has_access = has_mission_access(mission_id, current_user["id"], "view")
            
            # Check shared access
            c.execute(f'''
                SELECT s.access_level
                FROM missionops_mission_shares s
                WHERE s.mission_id = {placeholder} AND s.shared_with_id = {placeholder}
            ''', (mission_id, current_user["id"]))
            shared_access = c.fetchone()
            
            return {
                "mission_exists": True,
                "mission_id": mission_id,
                "user_id": current_user["id"],
                "mission_owner_id": mission_dict.get("owner_id"),
                "is_owner": mission_dict.get("owner_id") == current_user["id"],
                "shared_access": shared_access[0] if shared_access else None,
                "has_access_function": has_access,
                "get_mission_result": mission_access is not None,
                "mission_title": mission_dict.get("title"),
                "raw_mission_fields": list(mission_dict.keys())
            }
            
    except Exception as e:
        logger.error(f"Debug mission access error: {str(e)}")
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc(),
            "user_id": current_user.get("id"),
            "mission_id": mission_id
        }