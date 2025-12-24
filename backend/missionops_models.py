"""
MissionOps - Isolated Planning Tool Database Models and API Endpoints
All models are prefixed with 'missionops_' to avoid conflicts with existing todo-events models.
"""

import os
import json
import logging
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

from pydantic import BaseModel, validator
from fastapi import HTTPException, Depends
from fastapi.responses import JSONResponse

# Import existing auth and database utilities
from shared_utils import get_current_user, get_db, get_placeholder, IS_PRODUCTION, DB_URL

logger = logging.getLogger(__name__)

# Shared datetime conversion used by helpers in this module
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

# Pydantic Models for MissionOps
class MissionOpsBaseModel(BaseModel):
    class Config:
        extra = "forbid"
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

# Mission Relationship Models
class MissionRelationshipCreate(MissionOpsBaseModel):
    from_mission_id: int
    to_mission_id: int
    relationship_type: str  # depends_on, blocks, related_to, duplicates, splits_from
    dependency_type: Optional[str] = None  # hard, soft, informational
    strength: Optional[float] = 1.0  # 0.0 to 1.0
    notes: Optional[str] = ""

class MissionRelationshipResponse(MissionOpsBaseModel):
    id: int
    from_mission_id: int
    to_mission_id: int
    relationship_type: str
    dependency_type: Optional[str]
    strength: float
    notes: Optional[str]
    created_at: str
    from_mission_title: Optional[str] = ""
    to_mission_title: Optional[str] = ""

# Enhanced Task Models
class TaskCreateEnhanced(MissionOpsBaseModel):
    mission_id: int
    title: str
    description: Optional[str] = ""
    due_date: Optional[str] = None
    estimated_hours: Optional[float] = None
    priority: Optional[str] = "medium"
    status: Optional[str] = "todo"
    parent_task_id: Optional[int] = None
    assigned_to: Optional[int] = None

class TaskUpdateEnhanced(MissionOpsBaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[int] = None
    completion_percentage: Optional[int] = None

class TaskResponseEnhanced(MissionOpsBaseModel):
    id: int
    mission_id: int
    title: str
    description: Optional[str]
    due_date: Optional[str]
    estimated_hours: Optional[float]
    actual_hours: Optional[float]
    priority: str
    status: str
    parent_task_id: Optional[int]
    assigned_to: Optional[int]
    created_by: int
    completion_percentage: int
    created_at: str
    updated_at: Optional[str]
    subtasks: Optional[List['TaskResponseEnhanced']] = []
    dependencies: Optional[List['TaskDependencyResponse']] = []
    dependents: Optional[List['TaskDependencyResponse']] = []
    resources: Optional[List['TaskResourceResponse']] = []

# Task Dependency Models
class TaskDependencyCreate(MissionOpsBaseModel):
    predecessor_task_id: int
    successor_task_id: int
    dependency_type: Optional[str] = "finish_to_start"  # finish_to_start, start_to_start, finish_to_finish, start_to_finish
    lag_time_hours: Optional[int] = 0

class TaskDependencyResponse(MissionOpsBaseModel):
    id: int
    predecessor_task_id: int
    successor_task_id: int
    dependency_type: str
    lag_time_hours: int
    created_at: str
    predecessor_title: Optional[str] = ""
    successor_title: Optional[str] = ""

# Resource Management Models
class ResourceCreate(MissionOpsBaseModel):
    name: str
    type: str  # person, equipment, material, budget
    capacity: Optional[float] = 1.0
    cost_per_hour: Optional[float] = 0.0
    availability_start: Optional[str] = None
    availability_end: Optional[str] = None

class ResourceResponse(MissionOpsBaseModel):
    id: int
    name: str
    type: str
    capacity: float
    cost_per_hour: float
    availability_start: Optional[str]
    availability_end: Optional[str]
    owner_id: int
    created_at: str

class TaskResourceCreate(MissionOpsBaseModel):
    task_id: int
    resource_id: int
    allocation_percentage: Optional[float] = 100.0
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class TaskResourceResponse(MissionOpsBaseModel):
    id: int
    task_id: int
    resource_id: int
    allocation_percentage: float
    start_date: Optional[str]
    end_date: Optional[str]
    created_at: str
    resource_name: Optional[str] = ""
    resource_type: Optional[str] = ""

# Enhanced Risk Models
class RiskCreateEnhanced(RiskCreate):
    risk_score: Optional[float] = None
    owner_id: Optional[int] = None

class RiskResponseEnhanced(RiskResponse):
    risk_score: Optional[float] = None
    owner_id: Optional[int] = None

# Decision Workflow Models
class DecisionWorkflowCreate(MissionOpsBaseModel):
    mission_id: int
    title: str
    description: Optional[str] = ""
    workflow_type: Optional[str] = "linear"  # linear, branching, parallel

class DecisionWorkflowResponse(MissionOpsBaseModel):
    id: int
    mission_id: int
    title: str
    description: Optional[str]
    workflow_type: str
    status: str
    created_by: int
    created_at: str
    nodes: Optional[List['DecisionNodeResponse']] = []
    connections: Optional[List['DecisionConnectionResponse']] = []

class DecisionNodeCreate(MissionOpsBaseModel):
    workflow_id: int
    title: str
    description: Optional[str] = ""
    node_type: str  # decision, action, condition, milestone
    position_x: Optional[float] = 0.0
    position_y: Optional[float] = 0.0
    decision_criteria: Optional[str] = ""
    options: Optional[str] = ""  # JSON string of options

class DecisionNodeUpdate(MissionOpsBaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    decision_criteria: Optional[str] = None
    options: Optional[str] = None
    selected_option: Optional[str] = None
    rationale: Optional[str] = None
    status: Optional[str] = None

class DecisionNodeResponse(MissionOpsBaseModel):
    id: int
    workflow_id: int
    title: str
    description: Optional[str]
    node_type: str
    position_x: float
    position_y: float
    decision_criteria: Optional[str]
    options: Optional[str]
    selected_option: Optional[str]
    rationale: Optional[str]
    status: str
    created_at: str

class DecisionConnectionCreate(MissionOpsBaseModel):
    workflow_id: int
    from_node_id: int
    to_node_id: int
    condition_text: Optional[str] = ""

class DecisionConnectionResponse(MissionOpsBaseModel):
    id: int
    workflow_id: int
    from_node_id: int
    to_node_id: int
    condition_text: Optional[str]
    created_at: str

# AI Insights Models
class AIInsightCreate(MissionOpsBaseModel):
    mission_id: int
    insight_type: str  # risk_analysis, priority_optimization, resource_conflict, timeline_analysis, bottleneck_detection
    title: str
    content: str
    confidence_score: Optional[float] = None
    action_items: Optional[str] = ""
    priority_level: Optional[str] = "medium"

class AIInsightResponse(MissionOpsBaseModel):
    id: int
    mission_id: int
    insight_type: str
    title: str
    content: str
    confidence_score: Optional[float]
    action_items: Optional[str]
    priority_level: str
    status: str
    created_at: str
    expires_at: Optional[str]

# Enhanced Decision Log Models
class DecisionLogCreateEnhanced(DecisionLogCreate):
    impact_assessment: Optional[str] = ""
    review_date: Optional[str] = None

class DecisionLogResponseEnhanced(DecisionLogResponse):
    impact_assessment: Optional[str] = ""
    review_date: Optional[str] = None

# ===== Text-based Interface (Sessions, Messages, Context) =====

class TextSessionCreate(MissionOpsBaseModel):
    title: Optional[str] = "MissionOps Session"
    baseline_prompt: Optional[str] = None
    model_name: Optional[str] = None
    max_context_chars: Optional[int] = 120000

class TextSessionUpdate(MissionOpsBaseModel):
    title: Optional[str] = None
    baseline_prompt: Optional[str] = None
    working_prompt: Optional[str] = None
    model_name: Optional[str] = None
    max_context_chars: Optional[int] = None

class TextSessionResponse(MissionOpsBaseModel):
    id: int
    owner_id: int
    title: str
    baseline_prompt: Optional[str]
    working_prompt: Optional[str]
    context_json: Optional[str]
    model_name: Optional[str]
    max_context_chars: int
    created_at: str
    updated_at: Optional[str]

class TextMessageCreate(MissionOpsBaseModel):
    content: str

class TextMessageResponse(MissionOpsBaseModel):
    id: int
    session_id: int
    role: str
    content: str
    tokens_used: Optional[int]
    created_at: str

class ContextItemCreate(MissionOpsBaseModel):
    title: Optional[str] = "Context Upload"
    text: str
    importance: Optional[int] = 3
    source_type: Optional[str] = "upload"  # upload, note, mission, task

class ContextItemResponse(MissionOpsBaseModel):
    id: int
    session_id: int
    source_type: str
    title: Optional[str]
    content: Optional[str]
    importance: int
    summary: Optional[str]
    metadata: Optional[str]
    created_at: str

# Database initialization for MissionOps
def init_missionops_db():
    """Initialize MissionOps database tables"""
    
    try:
        logger.info("🚀 Initializing MissionOps database tables...")
        
        with get_db() as conn:
            c = conn.cursor()
            
            if IS_PRODUCTION and DB_URL:
                # PostgreSQL schema
                queries = [
        '''
        CREATE TABLE IF NOT EXISTS missionops_missions (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            start_date DATE,
            end_date DATE,
            priority VARCHAR(20) DEFAULT 'medium',
            status VARCHAR(20) DEFAULT 'active',
            tags TEXT,
            grid_x FLOAT DEFAULT 0.0,
            grid_y FLOAT DEFAULT 0.0,
            owner_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_text_sessions (
            id SERIAL PRIMARY KEY,
            owner_id INTEGER NOT NULL,
            title VARCHAR(255) DEFAULT 'MissionOps Session',
            baseline_prompt TEXT,
            working_prompt TEXT,
            context_json TEXT,
            model_name VARCHAR(100) DEFAULT 'gpt-4o-mini',
            max_context_chars INTEGER DEFAULT 120000,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_text_messages (
            id SERIAL PRIMARY KEY,
            session_id INTEGER REFERENCES missionops_text_sessions(id) ON DELETE CASCADE,
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            tokens_used INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_context_items (
            id SERIAL PRIMARY KEY,
            session_id INTEGER REFERENCES missionops_text_sessions(id) ON DELETE CASCADE,
            source_type VARCHAR(50),
            title VARCHAR(255),
            content TEXT,
            importance INTEGER DEFAULT 3,
            summary TEXT,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_mission_relationships (
            id SERIAL PRIMARY KEY,
            from_mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            to_mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            relationship_type VARCHAR(50) NOT NULL,
            dependency_type VARCHAR(50),
            strength FLOAT DEFAULT 1.0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(from_mission_id, to_mission_id, relationship_type)
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_tasks (
            id SERIAL PRIMARY KEY,
            mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            due_date DATE,
            estimated_hours FLOAT,
            actual_hours FLOAT,
            priority VARCHAR(20) DEFAULT 'medium',
            status VARCHAR(20) DEFAULT 'todo',
            parent_task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE CASCADE,
            assigned_to INTEGER,
            created_by INTEGER NOT NULL,
            completion_percentage INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_task_dependencies (
            id SERIAL PRIMARY KEY,
            predecessor_task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE CASCADE,
            successor_task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE CASCADE,
            dependency_type VARCHAR(50) DEFAULT 'finish_to_start',
            lag_time_hours INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(predecessor_task_id, successor_task_id)
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_resources (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL,
            capacity FLOAT DEFAULT 1.0,
            cost_per_hour FLOAT DEFAULT 0.0,
            availability_start DATE,
            availability_end DATE,
            owner_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_task_resources (
            id SERIAL PRIMARY KEY,
            task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE CASCADE,
            resource_id INTEGER REFERENCES missionops_resources(id) ON DELETE CASCADE,
            allocation_percentage FLOAT DEFAULT 100.0,
            start_date DATE,
            end_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(task_id, resource_id)
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_risks (
            id SERIAL PRIMARY KEY,
            mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            probability VARCHAR(20) NOT NULL,
            impact VARCHAR(20) NOT NULL,
            risk_score FLOAT,
            mitigation TEXT,
            status VARCHAR(20) DEFAULT 'open',
            owner_id INTEGER,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_decision_workflows (
            id SERIAL PRIMARY KEY,
            mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            workflow_type VARCHAR(50) DEFAULT 'linear',
            status VARCHAR(20) DEFAULT 'active',
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_decision_nodes (
            id SERIAL PRIMARY KEY,
            workflow_id INTEGER REFERENCES missionops_decision_workflows(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            node_type VARCHAR(50) NOT NULL,
            position_x FLOAT DEFAULT 0.0,
            position_y FLOAT DEFAULT 0.0,
            decision_criteria TEXT,
            options TEXT,
            selected_option VARCHAR(255),
            rationale TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_decision_connections (
            id SERIAL PRIMARY KEY,
            workflow_id INTEGER REFERENCES missionops_decision_workflows(id) ON DELETE CASCADE,
            from_node_id INTEGER REFERENCES missionops_decision_nodes(id) ON DELETE CASCADE,
            to_node_id INTEGER REFERENCES missionops_decision_nodes(id) ON DELETE CASCADE,
            condition_text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(from_node_id, to_node_id)
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_ai_insights (
            id SERIAL PRIMARY KEY,
            mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            insight_type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            confidence_score FLOAT,
            action_items TEXT,
            priority_level VARCHAR(20) DEFAULT 'medium',
            status VARCHAR(20) DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_decision_logs (
            id SERIAL PRIMARY KEY,
            mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            decision TEXT NOT NULL,
            rationale TEXT,
            alternatives TEXT,
            impact_assessment TEXT,
            review_date DATE,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_mission_shares (
            id SERIAL PRIMARY KEY,
            mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            shared_with_id INTEGER NOT NULL,
            access_level VARCHAR(20) DEFAULT 'view',
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(mission_id, shared_with_id)
        )
        '''
                ]
            else:
                # SQLite schema
                queries = [
        '''
        CREATE TABLE IF NOT EXISTS missionops_missions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            start_date DATE,
            end_date DATE,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'active',
            tags TEXT,
            grid_x REAL DEFAULT 0.0,
            grid_y REAL DEFAULT 0.0,
            owner_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_text_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            title TEXT DEFAULT 'MissionOps Session',
            baseline_prompt TEXT,
            working_prompt TEXT,
            context_json TEXT,
            model_name TEXT DEFAULT 'gpt-4o-mini',
            max_context_chars INTEGER DEFAULT 120000,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_text_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES missionops_text_sessions(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            tokens_used INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_context_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER REFERENCES missionops_text_sessions(id) ON DELETE CASCADE,
            source_type TEXT,
            title TEXT,
            content TEXT,
            importance INTEGER DEFAULT 3,
            summary TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_mission_relationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            to_mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            relationship_type TEXT NOT NULL,
            dependency_type TEXT,
            strength REAL DEFAULT 1.0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(from_mission_id, to_mission_id, relationship_type)
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            due_date DATE,
            estimated_hours REAL,
            actual_hours REAL,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'todo',
            parent_task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE CASCADE,
            assigned_to INTEGER,
            created_by INTEGER NOT NULL,
            completion_percentage INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_task_dependencies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            predecessor_task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE CASCADE,
            successor_task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE CASCADE,
            dependency_type TEXT DEFAULT 'finish_to_start',
            lag_time_hours INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(predecessor_task_id, successor_task_id)
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            capacity REAL DEFAULT 1.0,
            cost_per_hour REAL DEFAULT 0.0,
            availability_start DATE,
            availability_end DATE,
            owner_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_task_resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE CASCADE,
            resource_id INTEGER REFERENCES missionops_resources(id) ON DELETE CASCADE,
            allocation_percentage REAL DEFAULT 100.0,
            start_date DATE,
            end_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(task_id, resource_id)
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_risks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            task_id INTEGER REFERENCES missionops_tasks(id) ON DELETE SET NULL,
            title TEXT NOT NULL,
            description TEXT,
            probability TEXT NOT NULL,
            impact TEXT NOT NULL,
            risk_score REAL,
            mitigation TEXT,
            status TEXT DEFAULT 'open',
            owner_id INTEGER,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_decision_workflows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            workflow_type TEXT DEFAULT 'linear',
            status TEXT DEFAULT 'active',
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_decision_nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workflow_id INTEGER REFERENCES missionops_decision_workflows(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            node_type TEXT NOT NULL,
            position_x REAL DEFAULT 0.0,
            position_y REAL DEFAULT 0.0,
            decision_criteria TEXT,
            options TEXT,
            selected_option TEXT,
            rationale TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_decision_connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workflow_id INTEGER REFERENCES missionops_decision_workflows(id) ON DELETE CASCADE,
            from_node_id INTEGER REFERENCES missionops_decision_nodes(id) ON DELETE CASCADE,
            to_node_id INTEGER REFERENCES missionops_decision_nodes(id) ON DELETE CASCADE,
            condition_text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(from_node_id, to_node_id)
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_ai_insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            insight_type TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            confidence_score REAL,
            action_items TEXT,
            priority_level TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'new',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_decision_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            decision TEXT NOT NULL,
            rationale TEXT,
            alternatives TEXT,
            impact_assessment TEXT,
            review_date DATE,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''',
        '''
        CREATE TABLE IF NOT EXISTS missionops_mission_shares (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mission_id INTEGER REFERENCES missionops_missions(id) ON DELETE CASCADE,
            shared_with_id INTEGER NOT NULL,
            access_level TEXT DEFAULT 'view',
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(mission_id, shared_with_id)
        )
        '''
                ]
            
            # Execute table creation queries
            for query in queries:
                c.execute(query)
            
            # Create indexes for performance
            index_queries = [
                'CREATE INDEX IF NOT EXISTS idx_missionops_missions_owner ON missionops_missions(owner_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_missions_status ON missionops_missions(status)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_text_sessions_owner ON missionops_text_sessions(owner_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_text_messages_session ON missionops_text_messages(session_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_context_items_session ON missionops_context_items(session_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_context_items_importance ON missionops_context_items(importance)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_mission_relationships_from ON missionops_mission_relationships(from_mission_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_mission_relationships_to ON missionops_mission_relationships(to_mission_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_tasks_mission ON missionops_tasks(mission_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_tasks_assignee ON missionops_tasks(assigned_to)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_tasks_parent ON missionops_tasks(parent_task_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_task_dependencies_pred ON missionops_task_dependencies(predecessor_task_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_task_dependencies_succ ON missionops_task_dependencies(successor_task_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_resources_owner ON missionops_resources(owner_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_task_resources_task ON missionops_task_resources(task_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_task_resources_resource ON missionops_task_resources(resource_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_risks_mission ON missionops_risks(mission_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_decision_workflows_mission ON missionops_decision_workflows(mission_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_decision_nodes_workflow ON missionops_decision_nodes(workflow_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_decision_connections_workflow ON missionops_decision_connections(workflow_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_ai_insights_mission ON missionops_ai_insights(mission_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_decision_logs_mission ON missionops_decision_logs(mission_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_shares_mission ON missionops_mission_shares(mission_id)',
                'CREATE INDEX IF NOT EXISTS idx_missionops_shares_user ON missionops_mission_shares(shared_with_id)',
            ]
            
            for index_query in index_queries:
                c.execute(index_query)
            
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
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            logger.info(f"Querying missions for user_id: {user_id}")
            
            # Query for missions owned by user or shared with user
            c.execute(f'''
                SELECT DISTINCT m.*
                FROM missionops_missions m
                LEFT JOIN missionops_mission_shares s ON m.id = s.mission_id AND s.shared_with_id = {placeholder}
                WHERE m.owner_id = {placeholder} OR s.shared_with_id = {placeholder}
                ORDER BY m.updated_at DESC, m.created_at DESC
            ''', (user_id, user_id, user_id))
            
            missions = c.fetchall()
            logger.info(f"Query returned {len(missions) if missions else 0} missions")
            
            if missions:
                for i, mission in enumerate(missions):
                    logger.info(f"Mission {i}: {dict(mission) if hasattr(mission, 'keys') else mission}")
            
            return missions
            
    except Exception as e:
        logger.error(f"Error in get_user_missions_access: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return []

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

def get_mission_tasks_with_subtasks(mission_id: int):
    """Get all tasks for a mission organized with subtasks"""
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            logger.info(f"Querying tasks for mission_id: {mission_id}")
            
            # Get all tasks for the mission
            c.execute(f'''
                SELECT t.*, u.email as assigned_email, creator.email as creator_email
                FROM missionops_tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                LEFT JOIN users creator ON t.created_by = creator.id
                WHERE t.mission_id = {placeholder}
                ORDER BY t.created_at ASC
            ''', (mission_id,))
            
            tasks = c.fetchall()
            logger.info(f"Found {len(tasks) if tasks else 0} tasks for mission {mission_id}")
            
            if not tasks:
                return []
            
            # Convert to dictionaries and organize into tree structure
            task_dict = {}
            root_tasks = []
            
            for task in tasks:
                task_data = dict(zip([col[0] for col in c.description], task))
                task_data = convert_datetime_to_string(task_data)
                task_data['subtasks'] = []
                task_dict[task_data['id']] = task_data
                
                if task_data['parent_task_id'] is None:
                    root_tasks.append(task_data)
            
            # Build subtask relationships
            for task in tasks:
                task_data = dict(zip([col[0] for col in c.description], task))
                task_data = convert_datetime_to_string(task_data)
                
                if task_data['parent_task_id'] and task_data['parent_task_id'] in task_dict:
                    parent_task = task_dict[task_data['parent_task_id']]
                    parent_task['subtasks'].append(task_data)
            
            return root_tasks
            
    except Exception as e:
        logger.error(f"Error getting tasks for mission {mission_id}: {str(e)}")
        return []

def get_task_by_id(task_id: int, user_id: int):
    """Get a task by ID if user has access"""
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Get task with mission access check
            c.execute(f'''
                SELECT t.*, m.owner_id, m.title as mission_title
                FROM missionops_tasks t
                JOIN missionops_missions m ON t.mission_id = m.id
                WHERE t.id = {placeholder}
            ''', (task_id,))
            
            task = c.fetchone()
            
            if not task:
                return None
            
            task_dict = dict(zip([col[0] for col in c.description], task))
            
            # Check if user has access to the mission
            mission_id = task_dict['mission_id']
            owner_id = task_dict['owner_id']
            
            # User has access if they own the mission or have shared access
            if owner_id == user_id:
                return convert_datetime_to_string(task_dict)
            
            # Check shared access
            c.execute(f'''
                SELECT access_level FROM missionops_mission_shares 
                WHERE mission_id = {placeholder} AND shared_with_id = {placeholder}
            ''', (mission_id, user_id))
            
            shared_access = c.fetchone()
            if shared_access and shared_access[0] in ['edit', 'view']:
                return convert_datetime_to_string(task_dict)
            
            return None
            
    except Exception as e:
        logger.error(f"Error getting task {task_id}: {str(e)}")
        return None

def get_mission_by_id(mission_id: int, user_id: int):
    """Get a mission by ID if user has access"""
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Get mission with access check
            c.execute(f'''
                SELECT m.*, 
                       CASE WHEN m.owner_id = {placeholder} THEN 'owner' 
                            WHEN s.access_level IS NOT NULL THEN s.access_level 
                            ELSE 'none' END as access_level
                FROM missionops_missions m
                LEFT JOIN missionops_mission_shares s ON m.id = s.mission_id AND s.shared_with_id = {placeholder}
                WHERE m.id = {placeholder}
            ''', (user_id, user_id, mission_id))
            
            mission = c.fetchone()
            
            if not mission:
                return None
            
            mission_dict = dict(zip([col[0] for col in c.description], mission))
            
            # Check if user has access
            if mission_dict['access_level'] in ['owner', 'edit', 'view']:
                return convert_datetime_to_string(mission_dict)
            
            return None
            
    except Exception as e:
        logger.error(f"Error getting mission {mission_id}: {str(e)}")
        return None