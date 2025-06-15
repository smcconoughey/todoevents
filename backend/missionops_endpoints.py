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
from backend import get_current_user, get_db, get_placeholder, IS_PRODUCTION, DB_URL

# Import MissionOps models and utilities
from missionops_models import (
    MissionCreate, MissionUpdate, MissionResponse,
    TaskCreate, TaskUpdate, TaskResponse,
    RiskCreate, RiskUpdate, RiskResponse,
    DecisionLogCreate, DecisionLogResponse,
    MissionShareCreate, MissionShareResponse,
    init_missionops_db, dict_from_row, get_user_missions_access, has_mission_access
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

# MISSION ENDPOINTS

@missionops_router.get("/missions", response_model=List[MissionResponse])
async def list_missions(current_user: dict = Depends(get_current_user)):
    """Get all missions for the current user (owned or shared)"""
    try:
        missions = get_user_missions_access(current_user["id"])
        
        result = []
        for mission in missions:
            mission_dict = dict_from_row(mission, [
                'id', 'title', 'description', 'start_date', 'end_date', 
                'priority', 'status', 'tags', 'grid_x', 'grid_y', 
                'owner_id', 'created_at', 'updated_at', 'access_level'
            ])
            
            # Convert datetime objects to strings
            mission_dict = convert_datetime_to_string(mission_dict)
            
            # Get tasks and risks count
            with get_db() as conn:
                c = conn.cursor()
                placeholder = get_placeholder()
                
                # Count tasks
                c.execute(f"SELECT COUNT(*) FROM missionops_tasks WHERE mission_id = {placeholder}", (mission_dict['id'],))
                tasks_result = c.fetchone()
                tasks_count = tasks_result[0] if tasks_result else 0
                
                # Count risks
                c.execute(f"SELECT COUNT(*) FROM missionops_risks WHERE mission_id = {placeholder}", (mission_dict['id'],))
                risks_result = c.fetchone()
                risks_count = risks_result[0] if risks_result else 0
                
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
        
        return result
    except Exception as e:
        logger.error(f"Error listing missions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list missions")

@missionops_router.post("/missions", response_model=MissionResponse)
async def create_mission(mission: MissionCreate, current_user: dict = Depends(get_current_user)):
    """Create a new mission"""
    try:
        placeholder = get_placeholder()
        
        # Convert empty strings to None for date fields
        start_date = mission.start_date if mission.start_date and mission.start_date.strip() else None
        end_date = mission.end_date if mission.end_date and mission.end_date.strip() else None
        
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
                      mission.priority, mission.status, mission.tags, mission.grid_x, mission.grid_y, current_user["id"]))
                mission_id = c.fetchone()['id']
            else:
                c.execute(f'''
                    INSERT INTO missionops_missions 
                    (title, description, start_date, end_date, priority, status, tags, grid_x, grid_y, owner_id)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                ''', (mission.title, mission.description, start_date, end_date, 
                      mission.priority, mission.status, mission.tags, mission.grid_x, mission.grid_y, current_user["id"]))
                mission_id = c.lastrowid
            
            conn.commit()
            
            # Get the created mission
            c.execute(f"SELECT * FROM missionops_missions WHERE id = {placeholder}", (mission_id,))
            mission_data = dict(c.fetchone())
            
            # Convert datetime objects to strings
            mission_data = convert_datetime_to_string(mission_data)
            
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

@missionops_router.get("/missions/{mission_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(mission_id: int, current_user: dict = Depends(get_current_user)):
    """Get all tasks for a mission"""
    if not has_mission_access(mission_id, current_user["id"], "view"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Get all tasks for the mission with user info
            c.execute(f'''
                SELECT t.*, u.email as assigned_email, creator.email as creator_email
                FROM missionops_tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                LEFT JOIN users creator ON t.created_by = creator.id
                WHERE t.mission_id = {placeholder}
                ORDER BY t.created_at DESC
            ''', (mission_id,))
            
            tasks = c.fetchall()
            
            # Build task tree (with subtasks)
            task_dict = {}
            root_tasks = []
            
            for task in tasks:
                task_data = dict_from_row(task, [
                    'id', 'mission_id', 'title', 'description', 'due_date',
                    'priority', 'status', 'parent_task_id', 'assigned_to',
                    'created_by', 'created_at', 'updated_at', 'assigned_email', 'creator_email'
                ])
                task_data['subtasks'] = []
                task_dict[task_data['id']] = task_data
                
                if task_data['parent_task_id'] is None:
                    root_tasks.append(task_data)
            
            # Build subtask relationships
            for task in tasks:
                task_data = dict_from_row(task, [
                    'id', 'mission_id', 'title', 'description', 'due_date',
                    'priority', 'status', 'parent_task_id', 'assigned_to',
                    'created_by', 'created_at', 'updated_at', 'assigned_email', 'creator_email'
                ])
                
                if task_data['parent_task_id'] and task_data['parent_task_id'] in task_dict:
                    parent_task = task_dict[task_data['parent_task_id']]
                    parent_task['subtasks'].append(task_data)
            
            return root_tasks
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing tasks: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list tasks")

@missionops_router.post("/tasks", response_model=TaskResponse)
async def create_task(task: TaskCreate, current_user: dict = Depends(get_current_user)):
    """Create a new task"""
    if not has_mission_access(task.mission_id, current_user["id"], "edit"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        placeholder = get_placeholder()
        
        # Convert empty strings to None for date fields
        due_date = task.due_date if task.due_date and task.due_date.strip() else None
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Insert task
            if IS_PRODUCTION and DB_URL:
                c.execute(f'''
                    INSERT INTO missionops_tasks 
                    (mission_id, title, description, due_date, priority, status, parent_task_id, assigned_to, created_by)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                ''', (task.mission_id, task.title, task.description, due_date, 
                      task.priority, task.status, task.parent_task_id, task.assigned_to, current_user["id"]))
                task_id = c.fetchone()['id']
            else:
                c.execute(f'''
                    INSERT INTO missionops_tasks 
                    (mission_id, title, description, due_date, priority, status, parent_task_id, assigned_to, created_by)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                ''', (task.mission_id, task.title, task.description, due_date, 
                      task.priority, task.status, task.parent_task_id, task.assigned_to, current_user["id"]))
                task_id = c.lastrowid
            
            conn.commit()
            
            # Get the created task
            c.execute(f'''
                SELECT t.*, u.email as assigned_email, creator.email as creator_email
                FROM missionops_tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                LEFT JOIN users creator ON t.created_by = creator.id
                WHERE t.id = {placeholder}
            ''', (task_id,))
            task_data = dict(c.fetchone())
            task_data['subtasks'] = []
            
            return task_data
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating task: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create task")

@missionops_router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: int, task: TaskUpdate, current_user: dict = Depends(get_current_user)):
    """Update a task"""
    try:
        placeholder = get_placeholder()
        
        # Check if user has access to the mission containing this task
        with get_db() as conn:
            c = conn.cursor()
            
            c.execute(f"SELECT mission_id FROM missionops_tasks WHERE id = {placeholder}", (task_id,))
            result = c.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Task not found")
            
            mission_id = result[0] if isinstance(result, (tuple, list)) else result['mission_id']
            
            if not has_mission_access(mission_id, current_user["id"], "edit"):
                raise HTTPException(status_code=403, detail="Access denied")
            
            # Build update query
            update_fields = []
            update_values = []
            
            for field, value in task.dict(exclude_unset=True).items():
                if value is not None:
                    # Convert empty strings to None for date fields
                    if field == 'due_date' and isinstance(value, str) and not value.strip():
                        value = None
                    update_fields.append(f"{field} = {placeholder}")
                    update_values.append(value)
            
            if not update_fields:
                raise HTTPException(status_code=400, detail="No fields to update")
            
            update_fields.append(f"updated_at = {placeholder}")
            update_values.append(datetime.utcnow())
            update_values.append(task_id)
            
            update_query = f'''
                UPDATE missionops_tasks 
                SET {', '.join(update_fields)}
                WHERE id = {placeholder}
            '''
            
            c.execute(update_query, update_values)
            conn.commit()
            
            # Return updated task
            c.execute(f'''
                SELECT t.*, u.email as assigned_email, creator.email as creator_email
                FROM missionops_tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                LEFT JOIN users creator ON t.created_by = creator.id
                WHERE t.id = {placeholder}
            ''', (task_id,))
            task_data = dict(c.fetchone())
            task_data['subtasks'] = []
            
            return task_data
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating task: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update task")

@missionops_router.delete("/tasks/{task_id}")
async def delete_task(task_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a task"""
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Check access
            c.execute(f"SELECT mission_id FROM missionops_tasks WHERE id = {placeholder}", (task_id,))
            result = c.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Task not found")
            
            mission_id = result[0] if isinstance(result, (tuple, list)) else result['mission_id']
            
            if not has_mission_access(mission_id, current_user["id"], "edit"):
                raise HTTPException(status_code=403, detail="Access denied")
            
            c.execute(f"DELETE FROM missionops_tasks WHERE id = {placeholder}", (task_id,))
            conn.commit()
            
            return {"detail": "Task deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting task: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete task")

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