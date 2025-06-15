"""
MissionOps - Isolated Planning Tool Database Models and API Endpoints
All models are prefixed with 'missionops_' to avoid conflicts with existing todo-events models.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

from pydantic import BaseModel, validator
from fastapi import HTTPException, Depends
from fastapi.responses import JSONResponse

# Import existing auth and database utilities
from backend import get_current_user, get_db, get_placeholder, IS_PRODUCTION, DB_URL

logger = logging.getLogger(__name__)

# Pydantic Models for MissionOps
class MissionOpsBaseModel(BaseModel):
    class Config:
        validate_assignment = True

class MissionCreate(MissionOpsBaseModel):
    title: str
    description: Optional[str] = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    priority: Optional[str] = "medium"  # low, medium, high, critical
    status: Optional[str] = "active"    # active, paused, completed, cancelled
    tags: Optional[str] = ""            # JSON string of tags
    grid_x: Optional[float] = 0.0       # Grid position X
    grid_y: Optional[float] = 0.0       # Grid position Y (timeline based)
    
class MissionUpdate(MissionOpsBaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[str] = None
    grid_x: Optional[float] = None
    grid_y: Optional[float] = None

class MissionResponse(MissionOpsBaseModel):
    id: int
    title: str
    description: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    priority: str
    status: str
    tags: Optional[str]
    grid_x: float
    grid_y: float
    owner_id: int
    created_at: str
    updated_at: Optional[str]
    shared_with: Optional[List[Dict]] = []  # List of shared users
    tasks_count: Optional[int] = 0
    risks_count: Optional[int] = 0

class TaskCreate(MissionOpsBaseModel):
    mission_id: int
    title: str
    description: Optional[str] = ""
    due_date: Optional[str] = None
    priority: Optional[str] = "medium"
    status: Optional[str] = "todo"  # todo, in_progress, completed, blocked
    parent_task_id: Optional[int] = None  # For nested tasks
    assigned_to: Optional[int] = None
    
class TaskUpdate(MissionOpsBaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    parent_task_id: Optional[int] = None
    assigned_to: Optional[int] = None

class TaskResponse(MissionOpsBaseModel):
    id: int
    mission_id: int
    title: str
    description: Optional[str]
    due_date: Optional[str]
    priority: str
    status: str
    parent_task_id: Optional[int]
    assigned_to: Optional[int]
    created_by: int
    created_at: str
    updated_at: Optional[str]
    subtasks: Optional[List['TaskResponse']] = []

class RiskCreate(MissionOpsBaseModel):
    mission_id: int
    task_id: Optional[int] = None
    title: str
    description: Optional[str] = ""
    probability: Optional[str] = "medium"  # low, medium, high
    impact: Optional[str] = "medium"       # low, medium, high
    mitigation: Optional[str] = ""
    status: Optional[str] = "open"         # open, mitigated, closed

class RiskUpdate(MissionOpsBaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    probability: Optional[str] = None
    impact: Optional[str] = None
    mitigation: Optional[str] = None
    status: Optional[str] = None

class RiskResponse(MissionOpsBaseModel):
    id: int
    mission_id: int
    task_id: Optional[int]
    title: str
    description: Optional[str]
    probability: str
    impact: str
    mitigation: Optional[str]
    status: str
    created_by: int
    created_at: str
    updated_at: Optional[str]

class DecisionLogCreate(MissionOpsBaseModel):
    mission_id: int
    title: str
    description: str
    decision: str
    rationale: Optional[str] = ""
    alternatives: Optional[str] = ""  # JSON string of considered alternatives
    
class DecisionLogResponse(MissionOpsBaseModel):
    id: int
    mission_id: int
    title: str
    description: str
    decision: str
    rationale: Optional[str]
    alternatives: Optional[str]
    created_by: int
    created_at: str

class MissionShareCreate(MissionOpsBaseModel):
    mission_id: int
    shared_with_email: str
    access_level: str = "view"  # view, edit, admin

class MissionShareResponse(MissionOpsBaseModel):
    id: int
    mission_id: int
    shared_with_id: int
    shared_with_email: str
    access_level: str
    shared_by: int
    created_at: str

# Database initialization for MissionOps
def init_missionops_db():
    """Initialize MissionOps database tables"""
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            if IS_PRODUCTION and DB_URL:
                # PostgreSQL table creation
                
                # Missions table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS missionops_missions (
                        id SERIAL PRIMARY KEY,
                        title TEXT NOT NULL,
                        description TEXT,
                        start_date DATE,
                        end_date DATE,
                        priority TEXT NOT NULL DEFAULT 'medium',
                        status TEXT NOT NULL DEFAULT 'active',
                        tags TEXT,
                        grid_x REAL DEFAULT 0.0,
                        grid_y REAL DEFAULT 0.0,
                        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Tasks table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS missionops_tasks (
                        id SERIAL PRIMARY KEY,
                        mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
                        title TEXT NOT NULL,
                        description TEXT,
                        due_date DATE,
                        priority TEXT NOT NULL DEFAULT 'medium',
                        status TEXT NOT NULL DEFAULT 'todo',
                        parent_task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE CASCADE,
                        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Risks table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS missionops_risks (
                        id SERIAL PRIMARY KEY,
                        mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
                        task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE SET NULL,
                        title TEXT NOT NULL,
                        description TEXT,
                        probability TEXT NOT NULL DEFAULT 'medium',
                        impact TEXT NOT NULL DEFAULT 'medium',
                        mitigation TEXT,
                        status TEXT NOT NULL DEFAULT 'open',
                        created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Decision logs table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS missionops_decision_logs (
                        id SERIAL PRIMARY KEY,
                        mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
                        title TEXT NOT NULL,
                        description TEXT NOT NULL,
                        decision TEXT NOT NULL,
                        rationale TEXT,
                        alternatives TEXT,
                        created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Mission sharing table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS missionops_mission_shares (
                        id SERIAL PRIMARY KEY,
                        mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
                        shared_with_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        access_level TEXT NOT NULL DEFAULT 'view',
                        shared_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(mission_id, shared_with_id)
                    )
                ''')
                
            else:
                # SQLite table creation
                
                # Missions table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS missionops_missions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT NOT NULL,
                        description TEXT,
                        start_date TEXT,
                        end_date TEXT,
                        priority TEXT NOT NULL DEFAULT 'medium',
                        status TEXT NOT NULL DEFAULT 'active',
                        tags TEXT,
                        grid_x REAL DEFAULT 0.0,
                        grid_y REAL DEFAULT 0.0,
                        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Tasks table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS missionops_tasks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
                        title TEXT NOT NULL,
                        description TEXT,
                        due_date TEXT,
                        priority TEXT NOT NULL DEFAULT 'medium',
                        status TEXT NOT NULL DEFAULT 'todo',
                        parent_task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE CASCADE,
                        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Risks table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS missionops_risks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
                        task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE SET NULL,
                        title TEXT NOT NULL,
                        description TEXT,
                        probability TEXT NOT NULL DEFAULT 'medium',
                        impact TEXT NOT NULL DEFAULT 'medium',
                        mitigation TEXT,
                        status TEXT NOT NULL DEFAULT 'open',
                        created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Decision logs table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS missionops_decision_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
                        title TEXT NOT NULL,
                        description TEXT NOT NULL,
                        decision TEXT NOT NULL,
                        rationale TEXT,
                        alternatives TEXT,
                        created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Mission sharing table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS missionops_mission_shares (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
                        shared_with_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        access_level TEXT NOT NULL DEFAULT 'view',
                        shared_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(mission_id, shared_with_id)
                    )
                ''')
            
            # Create indexes for performance
            indexes = [
                'CREATE INDEX IF NOT EXISTS idx_missionops_missions_owner ON missionops_missions(owner_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_missions_status ON missionops_missions(status)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_tasks_mission ON missionops_tasks(mission_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_tasks_assignee ON missionops_tasks(assigned_to)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_tasks_parent ON missionops_tasks(parent_task_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_risks_mission ON missionops_risks(mission_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_decision_logs_mission ON missionops_decision_logs(mission_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_shares_mission ON missionops_mission_shares(mission_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_shares_user ON missionops_mission_shares(shared_with_id)',
            ]
            
            for index_sql in indexes:
                try:
                    c.execute(index_sql)
                except Exception as e:
                    logger.warning(f"Could not create index: {e}")
                    
            conn.commit()
            logger.info("✅ MissionOps database tables initialized successfully")
            
    except Exception as e:
        logger.error(f"❌ Error initializing MissionOps database: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to initialize MissionOps database")

# Utility functions
def dict_from_row(row, columns):
    """Convert database row to dictionary"""
    if hasattr(row, '_asdict'):
        return row._asdict()
    elif isinstance(row, dict):
        return dict(row)
    else:
        return dict(zip(columns, row))

def get_user_missions_access(user_id: int):
    """Get all missions the user owns or has access to"""
    placeholder = get_placeholder()
    
    with get_db() as conn:
        c = conn.cursor()
        
        # Query for missions owned by user or shared with user
        c.execute(f'''
            SELECT DISTINCT m.*, 
                   CASE WHEN m.owner_id = {placeholder} THEN 'owner' 
                        WHEN s.access_level IS NOT NULL THEN s.access_level 
                        ELSE 'none' END as access_level
            FROM missionops_missions m
            LEFT JOIN missionops_mission_shares s ON m.id = s.mission_id AND s.shared_with_id = {placeholder}
            WHERE m.owner_id = {placeholder} OR s.shared_with_id = {placeholder}
            ORDER BY m.updated_at DESC, m.created_at DESC
        ''', (user_id, user_id, user_id, user_id))
        
        missions = c.fetchall()
        return missions

def has_mission_access(mission_id: int, user_id: int, required_access: str = "view"):
    """Check if user has required access to a mission"""
    placeholder = get_placeholder()
    
    with get_db() as conn:
        c = conn.cursor()
        
        # Check if user owns the mission or has shared access
        c.execute(f'''
            SELECT 
                CASE WHEN m.owner_id = {placeholder} THEN 'owner'
                     WHEN s.access_level IS NOT NULL THEN s.access_level
                     ELSE 'none' END as access_level
            FROM missionops_missions m
            LEFT JOIN missionops_mission_shares s ON m.id = s.mission_id AND s.shared_with_id = {placeholder}
            WHERE m.id = {placeholder}
        ''', (user_id, user_id, mission_id))
        
        result = c.fetchone()
        
        if not result:
            return False
            
        access_level = result[0] if isinstance(result, (tuple, list)) else result.get('access_level', 'none')
        
        # Define access hierarchy
        access_hierarchy = {
            'view': 0,
            'edit': 1,
            'admin': 2,
            'owner': 3
        }
        
        required_level = access_hierarchy.get(required_access, 0)
        user_level = access_hierarchy.get(access_level, -1)
        
        return user_level >= required_level