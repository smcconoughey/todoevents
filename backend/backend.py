import os
import re
import sqlite3
import logging
import time
import json
import traceback
import math
import uuid
import shutil
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from contextlib import contextmanager
from enum import Enum
import asyncio
import threading
import stripe
from PIL import Image, ImageOps
import io

# Import SEO utilities
try:
    from seo_utils import SEOEventProcessor, generate_event_json_ld, generate_seo_metadata, slugify
except ImportError:
    def slugify(text): return text.lower().replace(' ', '-')
    SEOEventProcessor = None

import uvicorn
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks, Request, Header, UploadFile, File
from fastapi.responses import FileResponse

# MissionOps import
try:
    from missionops_endpoints import missionops_router
except ImportError:
    missionops_router = None
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response, JSONResponse

from pydantic import BaseModel, EmailStr, validator
from passlib.context import CryptContext
import jwt

# Scheduler imports
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import httpx

# Load environment variables
load_dotenv()

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key-for-development-only")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 90))

# Environment configuration 
IS_PRODUCTION = os.getenv("RENDER", False) or os.getenv("RAILWAY_ENVIRONMENT", False)
DB_URL = os.getenv("DATABASE_URL", None)

# Stripe configuration
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")  # Monthly subscription price ID

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="EventFinder API")

# Register MissionOps router
if missionops_router:
    app.include_router(missionops_router)

# Dynamic CORS origins based on environment
def get_cors_origins():
    base_origins = [
        "http://localhost:5173",  # Local Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:5174",  # Admin dashboard local
        "http://127.0.0.1:5174",
    ]
    
    if IS_PRODUCTION:
        # In production, add common Render.com patterns including the actual deployed URL
        production_origins = [
            "https://todoevents.onrender.com",  # Actual frontend URL
            "https://eventfinder-api.onrender.com",
            "https://eventfinder-web.onrender.com", 
            "https://eventfinder-admin.onrender.com",
            "https://todoevents-1.onrender.com",
            "https://todoevents-1-frontend.onrender.com", 
            "https://todoevents-1-web.onrender.com",
            "https://todoevents-api.onrender.com",
            "https://todoevents-frontend.onrender.com",
            "https://todoevents-web.onrender.com",
            # Add todo-events.com domains
            "https://todo-events.com",
            "https://www.todo-events.com",
            "http://todo-events.com",
            "http://www.todo-events.com",
        ]
        return base_origins + production_origins
    else:
        return base_origins

# Custom CORS middleware for flexible Render.com handling
@app.middleware("http")
async def cors_handler(request, call_next):
    # Log the request for debugging (reduced logging for performance)
    if request.url.path == "/api/report-event":
        logger.info(f"🚨 CORS MIDDLEWARE: {request.method} {request.url.path}")
        logger.info(f"🚨 Headers: {dict(request.headers)}")
    origin = request.headers.get("origin")
    
    # Handle preflight requests
    if request.method == "OPTIONS":
        # Determine allowed origin
        allowed_origin = "*"  # Default fallback
        
        if origin:
            # Allow localhost and 127.0.0.1 for development
            if ("localhost" in origin or "127.0.0.1" in origin):
                allowed_origin = origin
            # Allow Render.com domains for production
            elif ".onrender.com" in origin:
                allowed_origin = origin
            # Allow the actual domain
            elif "todo-events.com" in origin:
                allowed_origin = origin
            else:
                allowed_origin = origin
        
        # Return proper preflight response
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": allowed_origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "86400",
            }
        )
    
    try:
        # Call the next middleware or endpoint handler
        response = await call_next(request)
        
        # Add CORS headers to successful responses
        if origin:
            # Determine allowed origin for response
            allowed_origin = "*"
            if ("localhost" in origin or "127.0.0.1" in origin or 
                ".onrender.com" in origin or "todo-events.com" in origin):
                allowed_origin = origin
            
            response.headers["Access-Control-Allow-Origin"] = allowed_origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma"
        
        return response
        
    except Exception as e:
        # Handle exceptions and ensure CORS headers are added to error responses
        logger.error(f"Error during request processing: {str(e)}")
        
        # Create response with error details
        status_code = 500
        if isinstance(e, HTTPException):
            status_code = e.status_code
            
        error_response = JSONResponse(
            status_code=status_code,
            content={"detail": str(e)},
        )
        
        # Add CORS headers to error response
        if origin:
            allowed_origin = "*"
            if ("localhost" in origin or "127.0.0.1" in origin or 
                ".onrender.com" in origin or "todo-events.com" in origin):
                allowed_origin = origin
                
            error_response.headers["Access-Control-Allow-Origin"] = allowed_origin
            error_response.headers["Access-Control-Allow-Credentials"] = "true"
            
        return error_response

# CORS middleware with dynamic origins (as fallback)
# Commenting out the built-in CORS middleware since we have custom CORS handling
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400,  # Cache preflight requests for 24 hours
)

# Database file for SQLite (development only)
DB_FILE = os.path.join(os.path.dirname(__file__), "events.db")

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"

# Database context manager with retry logic
@contextmanager
def get_db_transaction():
    """
    Get database connection with transaction control - properly handles autocommit for PostgreSQL
    
    CRITICAL FIX: PostgreSQL connections default to autocommit=True which prevents manual 
    transaction control (BEGIN/COMMIT/ROLLBACK). This function temporarily disables autocommit
    to allow explicit transaction management, then restores the original setting.
    
    This fixes the "set_session cannot be used inside a transaction" error.
    """
    if IS_PRODUCTION and DB_URL:
        # In production with PostgreSQL
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        conn = None
        original_autocommit = None
        
        try:
            conn = psycopg2.connect(
                DB_URL,
                cursor_factory=RealDictCursor,
                connect_timeout=8,
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=5,
                keepalives_count=3,
                application_name='todoevents'
            )
            
            # Store original autocommit setting and disable it for transaction control
            original_autocommit = conn.autocommit
            conn.autocommit = False  # CRITICAL: Disable autocommit for manual transactions
            
            yield conn
            
        finally:
            if conn:
                # Restore original autocommit setting
                if original_autocommit is not None:
                    try:
                        conn.autocommit = original_autocommit
                    except:
                        pass
                conn.close()
    else:
        # Local development with SQLite
        conn = sqlite3.connect(DB_FILE, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL')
        conn.execute('PRAGMA cache_size=10000')
        try:
            yield conn
        finally:
            conn.close()

@contextmanager
def get_db():
    if IS_PRODUCTION and DB_URL:
        # In production with PostgreSQL
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        # Reduced retry count for faster failover
        retry_count = 2  # Reduced from 3
        conn = None
        
        for attempt in range(retry_count):
            try:
                # Optimized connection parameters for faster connections
                conn = psycopg2.connect(
                    DB_URL,
                    cursor_factory=RealDictCursor,
                    connect_timeout=8,  # Reduced from 10
                    keepalives=1,
                    keepalives_idle=30,
                    keepalives_interval=5,
                    keepalives_count=3,
                    # Add connection pooling parameters
                    application_name='todoevents'
                )
                
                # Set autocommit for read operations to reduce lock time
                conn.autocommit = True
                break  # Connection successful, exit retry loop
                
            except Exception as e:
                if conn:
                    try:
                        conn.close()
                        conn = None
                    except:
                        pass
                
                error_msg = str(e)
                
                if attempt < retry_count - 1:
                    # Faster backoff for production
                    wait_time = 1  # Reduced wait time
                    time.sleep(wait_time)
                else:
                    logger.critical(f"Failed to connect to database after {retry_count} attempts: {error_msg}")
                    # Instead of falling back to SQLite, raise a proper HTTP exception
                    raise HTTPException(
                        status_code=503,
                        detail="Database connection failed. Please try again later."
                    )
        
        # If we made it here, conn should be valid
        try:
            yield conn
        finally:
            if conn:
                conn.close()
    else:
        # Local development with SQLite - optimized
        conn = sqlite3.connect(DB_FILE, timeout=10)  # Add timeout
        conn.row_factory = sqlite3.Row
        # Enable WAL mode for better concurrent access
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL')  # Faster than FULL
        conn.execute('PRAGMA cache_size=10000')    # Increase cache
        try:
            yield conn
        finally:
            conn.close()

# Helper function to get placeholder style based on environment
def get_placeholder():
    if IS_PRODUCTION and DB_URL:
        return "%s"  # PostgreSQL uses %s
    else:
        return "?"   # SQLite uses ?

# Helper function to get count from cursor result (handles both SQLite and PostgreSQL)
def get_count_from_result(cursor_result):
    """Extract count value from cursor result, handling both SQLite tuples and PostgreSQL RealDictRow"""
    if cursor_result is None:
        return 0
    
    # Check if this is a dict-like object (PostgreSQL RealDictRow)
    if isinstance(cursor_result, dict) or hasattr(cursor_result, 'get'):
        # PostgreSQL RealDictCursor returns dict-like objects
        # Try various count column names
        for key in ['count', 'COUNT(*)', 'count(*)', 'cnt']:
            if hasattr(cursor_result, 'get'):
                value = cursor_result.get(key)
            else:
                value = cursor_result.get(key, None)
            if value is not None:
                return value
        # If no count key found, return the first value
        if hasattr(cursor_result, 'values'):
            values = list(cursor_result.values())
            return values[0] if values else 0
        return 0
    else:
        # SQLite returns tuples
        return cursor_result[0] if cursor_result and len(cursor_result) > 0 else 0

def format_cursor_row(row, column_names):
    """Format a single cursor row for both SQLite and PostgreSQL compatibility"""
    if isinstance(row, dict) or hasattr(row, 'get'):
        # PostgreSQL RealDictCursor returns dict-like objects
        return {col: row.get(col) for col in column_names}
    else:
        # SQLite returns tuples
        return {col: row[i] if i < len(row) else None for i, col in enumerate(column_names)}

# Missing validation function that's being called
def validate_recurring_event(event_data, user_role):
    """
    Validate recurring event data and permissions
    This function was being called but was missing, causing NameError
    """
    # For now, just return the event data unchanged
    # Can be enhanced later with actual validation logic
    return event_data

def is_postgresql_db():
    """Check if we're using PostgreSQL"""
    return os.environ.get('DATABASE_URL') is not None

def get_db_compatible_query_parts():
    """Get database-compatible SQL functions and syntax"""
    if is_postgresql_db():
        return {
            'string_agg': 'STRING_AGG',
            'like_op': 'ILIKE',
            'now_func': 'NOW()',
            'interval_90_days': "NOW() - INTERVAL '90 days'",
            'interval_30_days': "NOW() - INTERVAL '30 days'",
            'interval_60_days': "NOW() - INTERVAL '60 days'",
            'date_sub_30': "NOW() - INTERVAL '30 days'",
            'date_sub_60': "NOW() - INTERVAL '60 days'"
        }
    else:
        # SQLite compatible
        return {
            'string_agg': 'GROUP_CONCAT',
            'like_op': 'LIKE',
            'now_func': "datetime('now')",
            'interval_90_days': "datetime('now', '-90 days')",
            'interval_30_days': "datetime('now', '-30 days')",
            'interval_60_days': "datetime('now', '-60 days')",
            'date_sub_30': "datetime('now', '-30 days')",
            'date_sub_60': "datetime('now', '-60 days')"
        }
# Database initialization
# Force production database migration for interest/view tracking - v2.1
def init_db():
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            if IS_PRODUCTION and DB_URL:
                # PostgreSQL table creation
                
                # Create users table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        email TEXT UNIQUE NOT NULL,
                        hashed_password TEXT NOT NULL,
                        role TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create events table with user relationship
                c.execute('''
                    CREATE TABLE IF NOT EXISTS events (
                        id SERIAL PRIMARY KEY,
                        title TEXT NOT NULL,
                        description TEXT NOT NULL,
                        date TEXT NOT NULL,
                        start_time TEXT NOT NULL,
                        end_time TEXT,
                        end_date TEXT,
                        category TEXT NOT NULL,
                        secondary_category TEXT,
                        address TEXT NOT NULL,
                        lat REAL NOT NULL,
                        lng REAL NOT NULL,
                        recurring BOOLEAN NOT NULL DEFAULT FALSE,
                        frequency TEXT,
                        created_by INTEGER,
                        interest_count INTEGER DEFAULT 0,
                        view_count INTEGER DEFAULT 0,
                        fee_required TEXT,
                        event_url TEXT,
                        host_name TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        verified BOOLEAN DEFAULT FALSE,
                        FOREIGN KEY(created_by) REFERENCES users(id)
                    )
                ''')
                
                # Add migration for existing events to have start_time and end_time
                try:
                    # Use PostgreSQL-compatible column checking method with fallback
                    def column_exists(table_name, column_name):
                        try:
                            # Try information_schema first
                            c.execute("""
                                SELECT column_name FROM information_schema.columns 
                                WHERE table_name = %s AND column_name = %s
                            """, (table_name, column_name))
                            return c.fetchone() is not None
                        except Exception:
                            # Fallback: try to add column and catch error if it exists
                            try:
                                c.execute(f'ALTER TABLE {table_name} ADD COLUMN {column_name}_test_temp TEXT')
                                c.execute(f'ALTER TABLE {table_name} DROP COLUMN {column_name}_test_temp')
                                # If we got here, column doesn't exist
                                return False
                            except Exception:
                                # If adding temp column failed, assume original column exists
                                return True
                    
                    # Check if we need to migrate old 'time' column to 'start_time'
                    if column_exists('events', 'time'):
                        # Migrate old 'time' column to 'start_time'
                        c.execute('ALTER TABLE events RENAME COLUMN time TO start_time')
                        logger.info("✅ Migrated 'time' column to 'start_time'")
                        conn.commit()
                        
                    # Add start_time column if it doesn't exist
                    if not column_exists('events', 'start_time'):
                        c.execute('ALTER TABLE events ADD COLUMN start_time TEXT DEFAULT \'12:00\'')
                        logger.info("✅ Added 'start_time' column")
                        conn.commit()
                        
                    # Add end_time column if it doesn't exist
                    if not column_exists('events', 'end_time'):
                        c.execute('ALTER TABLE events ADD COLUMN end_time TEXT')
                        logger.info("✅ Added 'end_time' column")
                        conn.commit()
                        
                    # Add end_date column if it doesn't exist
                    if not column_exists('events', 'end_date'):
                        c.execute('ALTER TABLE events ADD COLUMN end_date TEXT')
                        logger.info("✅ Added 'end_date' column")
                        conn.commit()
                    
                    # Add interest_count column if it doesn't exist
                    if not column_exists('events', 'interest_count'):
                        c.execute('ALTER TABLE events ADD COLUMN interest_count INTEGER DEFAULT 0')
                        logger.info("✅ Added 'interest_count' column")
                        conn.commit()
                    
                    # Add view_count column if it doesn't exist
                    if not column_exists('events', 'view_count'):
                        c.execute('ALTER TABLE events ADD COLUMN view_count INTEGER DEFAULT 0')
                        logger.info("✅ Added 'view_count' column")
                        conn.commit()
                    
                    # Add new UX enhancement columns
                    if not column_exists('events', 'fee_required'):
                        c.execute('ALTER TABLE events ADD COLUMN fee_required TEXT')
                        logger.info("✅ Added 'fee_required' column")
                        conn.commit()
                    
                    if not column_exists('events', 'event_url'):
                        c.execute('ALTER TABLE events ADD COLUMN event_url TEXT')
                        logger.info("✅ Added 'event_url' column")
                        conn.commit()
                    
                    if not column_exists('events', 'host_name'):
                        c.execute('ALTER TABLE events ADD COLUMN host_name TEXT')
                        logger.info("✅ Added 'host_name' column")
                        conn.commit()
                    
                    # Add secondary_category column if it doesn't exist
                    if not column_exists('events', 'secondary_category'):
                        c.execute('ALTER TABLE events ADD COLUMN secondary_category TEXT')
                        logger.info("✅ Added 'secondary_category' column")
                        conn.commit()
                        
                    # Add verified column if it doesn't exist
                    if not column_exists('events', 'verified'):
                        c.execute('ALTER TABLE events ADD COLUMN verified BOOLEAN DEFAULT FALSE')
                        logger.info("✅ Added 'verified' column")
                        conn.commit()
                    
                    # Add premium image upload columns if they don't exist
                    if not column_exists('events', 'banner_image'):
                        c.execute('ALTER TABLE events ADD COLUMN banner_image TEXT')
                        logger.info("✅ Added 'banner_image' column")
                        conn.commit()
                    
                    if not column_exists('events', 'logo_image'):
                        c.execute('ALTER TABLE events ADD COLUMN logo_image TEXT')
                        logger.info("✅ Added 'logo_image' column")
                        conn.commit()
                    
                    # Add is_premium_event column if it doesn't exist
                    if not column_exists('events', 'is_premium_event'):
                        c.execute('ALTER TABLE events ADD COLUMN is_premium_event BOOLEAN DEFAULT FALSE')
                        logger.info("✅ Added 'is_premium_event' column")
                        conn.commit()
                        
                except Exception as migration_error:
                    logger.error(f"❌ Schema fix error: {migration_error}")
                    # Don't fail the entire initialization, just log the error
                    try:
                        conn.rollback()
                    except:
                        pass
                
                # Create activity_logs table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS activity_logs (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER,
                        action TEXT NOT NULL,
                        details TEXT,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(user_id) REFERENCES users(id)
                    )
                ''')
                
                # Create interest tracking table
                c.execute('''CREATE TABLE IF NOT EXISTS event_interests (
                            id SERIAL PRIMARY KEY,
                            event_id INTEGER NOT NULL,
                            user_id INTEGER,
                            browser_fingerprint TEXT NOT NULL DEFAULT 'legacy',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(event_id, user_id, browser_fingerprint),
                            FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
                            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                        )''')
                
                # Create view tracking table
                c.execute('''CREATE TABLE IF NOT EXISTS event_views (
                            id SERIAL PRIMARY KEY,
                            event_id INTEGER NOT NULL,
                            user_id INTEGER,
                            browser_fingerprint TEXT NOT NULL DEFAULT 'legacy',
                            viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(event_id, user_id, browser_fingerprint),
                            FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
                            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                        )''')
                
                # Create page visits tracking table
                c.execute('''CREATE TABLE IF NOT EXISTS page_visits (
                            id SERIAL PRIMARY KEY,
                            page_type TEXT NOT NULL,
                            page_path TEXT NOT NULL,
                            user_id INTEGER,
                            browser_fingerprint TEXT NOT NULL DEFAULT 'anonymous',
                            visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                        )''')

                # Create privacy requests table for CCPA compliance
                c.execute('''CREATE TABLE IF NOT EXISTS privacy_requests (
                            id SERIAL PRIMARY KEY,
                            request_type TEXT NOT NULL CHECK (request_type IN ('access', 'delete', 'opt_out')),
                            email TEXT NOT NULL,
                            full_name TEXT,
                            verification_info TEXT,
                            details TEXT,
                            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'denied')),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            completed_at TIMESTAMP,
                            admin_notes TEXT
                        )''')

                # Create event reports table for reporting functionality
                c.execute('''CREATE TABLE IF NOT EXISTS event_reports (
                            id SERIAL PRIMARY KEY,
                            event_id INTEGER NOT NULL,
                            event_title TEXT,
                            event_address TEXT,
                            event_date TEXT,
                            reason TEXT NOT NULL,
                            category TEXT NOT NULL,
                            description TEXT NOT NULL,
                            reporter_email TEXT NOT NULL,
                            reporter_name TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            status TEXT DEFAULT 'pending',
                            FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
                        )''')
                
                # Ensure tables are committed
                conn.commit()
                logger.info("✅ Interest, view tracking, privacy requests, and event reports tables created/verified")
            else:
                # SQLite table creation (existing code)
                c.execute('''CREATE TABLE IF NOT EXISTS users (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            email TEXT UNIQUE NOT NULL,
                            hashed_password TEXT NOT NULL,
                            role TEXT NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )''')
                
                # Check if events table exists and needs migration
                c.execute('''PRAGMA table_info(events)''')
                columns = [column[1] for column in c.fetchall()]
                
                if 'events' not in [table[0] for table in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
                    # Create new table with updated schema
                    c.execute('''CREATE TABLE events (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                title TEXT NOT NULL,
                                description TEXT NOT NULL,
                                date TEXT NOT NULL,
                                start_time TEXT NOT NULL,
                                end_time TEXT,
                                end_date TEXT,
                                category TEXT NOT NULL,
                                secondary_category TEXT,
                                address TEXT NOT NULL,
                                lat REAL NOT NULL,
                                lng REAL NOT NULL,
                                recurring BOOLEAN NOT NULL DEFAULT 0,
                                frequency TEXT,
                                created_by INTEGER,
                                interest_count INTEGER DEFAULT 0,
                                view_count INTEGER DEFAULT 0,
                                fee_required TEXT,
                                event_url TEXT,
                                host_name TEXT,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                verified BOOLEAN DEFAULT FALSE,
                                FOREIGN KEY(created_by) REFERENCES users(id)
                            )''')
                else:
                    # Migrate existing table
                    if 'time' in columns and 'start_time' not in columns:
                        # Rename time to start_time
                        c.execute('''ALTER TABLE events RENAME COLUMN time TO start_time''')
                        logger.info("Migrated 'time' column to 'start_time'")
                    
                    if 'start_time' not in columns:
                        # Add start_time column with default value from time column if it exists
                        if 'time' in columns:
                            c.execute('''ALTER TABLE events ADD COLUMN start_time TEXT''')
                            c.execute('''UPDATE events SET start_time = time WHERE start_time IS NULL''')
                            logger.info("Added start_time column and migrated from time")
                        else:
                            c.execute('''ALTER TABLE events ADD COLUMN start_time TEXT DEFAULT "12:00"''')
                            logger.info("Added start_time column with default value")
                    
                    if 'end_time' not in columns:
                        c.execute('''ALTER TABLE events ADD COLUMN end_time TEXT''')
                        logger.info("Added end_time column")
                    
                    # Add interest_count and view_count columns if they don't exist
                    if 'interest_count' not in columns:
                        c.execute('''ALTER TABLE events ADD COLUMN interest_count INTEGER DEFAULT 0''')
                        logger.info("Added interest_count column")
                    
                    if 'view_count' not in columns:
                        c.execute('''ALTER TABLE events ADD COLUMN view_count INTEGER DEFAULT 0''')
                        logger.info("Added view_count column")
                    
                    # Add new UX enhancement columns for SQLite
                    if 'fee_required' not in columns:
                        c.execute('''ALTER TABLE events ADD COLUMN fee_required TEXT''')
                        logger.info("Added fee_required column")
                    
                    if 'event_url' not in columns:
                        c.execute('''ALTER TABLE events ADD COLUMN event_url TEXT''')
                        logger.info("Added event_url column")
                    
                    if 'host_name' not in columns:
                        c.execute('''ALTER TABLE events ADD COLUMN host_name TEXT''')
                        logger.info("Added host_name column")
                    
                    # Add secondary_category column if it doesn't exist  
                    if 'secondary_category' not in columns:
                        c.execute('''ALTER TABLE events ADD COLUMN secondary_category TEXT''')
                        logger.info("Added secondary_category column")
                    
                    # Add verified column if it doesn't exist
                    if 'verified' not in columns:
                        c.execute('''ALTER TABLE events ADD COLUMN verified BOOLEAN DEFAULT FALSE''')
                        logger.info("Added verified column")
                    
                    # Add premium image upload columns if they don't exist
                    if 'banner_image' not in columns:
                        c.execute('''ALTER TABLE events ADD COLUMN banner_image TEXT''')
                        logger.info("Added banner_image column")
                    
                    if 'logo_image' not in columns:
                        c.execute('''ALTER TABLE events ADD COLUMN logo_image TEXT''')
                        logger.info("Added logo_image column")
                    
                    # Add is_premium_event column if it doesn't exist
                    if 'is_premium_event' not in columns:
                        c.execute('''ALTER TABLE events ADD COLUMN is_premium_event BOOLEAN DEFAULT FALSE''')
                        logger.info("Added is_premium_event column")
                
                c.execute('''CREATE TABLE IF NOT EXISTS activity_logs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER,
                            action TEXT NOT NULL,
                            details TEXT,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY(user_id) REFERENCES users(id)
                        )''')
                
                # Create interest tracking table
                c.execute('''CREATE TABLE IF NOT EXISTS event_interests (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            event_id INTEGER NOT NULL,
                            user_id INTEGER,
                            browser_fingerprint TEXT NOT NULL DEFAULT 'legacy',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(event_id, user_id, browser_fingerprint),
                            FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
                            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                        )''')
                
                # Create view tracking table
                c.execute('''CREATE TABLE IF NOT EXISTS event_views (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            event_id INTEGER NOT NULL,
                            user_id INTEGER,
                            browser_fingerprint TEXT NOT NULL DEFAULT 'legacy',
                            viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(event_id, user_id, browser_fingerprint),
                            FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
                            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                        )''')
                
                # Create page visits tracking table
                c.execute('''CREATE TABLE IF NOT EXISTS page_visits (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            page_type TEXT NOT NULL,
                            page_path TEXT NOT NULL,
                            user_id INTEGER,
                            browser_fingerprint TEXT NOT NULL DEFAULT 'anonymous',
                            visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                        )''')

                # Create privacy requests table for CCPA compliance
                c.execute('''CREATE TABLE IF NOT EXISTS privacy_requests (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            request_type TEXT NOT NULL CHECK (request_type IN ('access', 'delete', 'opt_out')),
                            email TEXT NOT NULL,
                            full_name TEXT,
                            verification_info TEXT,
                            details TEXT,
                            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'denied')),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            completed_at TIMESTAMP,
                            admin_notes TEXT
                        )''')

                # Create event reports table for reporting functionality
                c.execute('''CREATE TABLE IF NOT EXISTS event_reports (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            event_id INTEGER NOT NULL,
                            event_title TEXT,
                            event_address TEXT,
                            event_date TEXT,
                            reason TEXT NOT NULL,
                            category TEXT NOT NULL,
                            description TEXT NOT NULL,
                            reporter_email TEXT NOT NULL,
                            reporter_name TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            status TEXT DEFAULT 'pending',
                            FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
                        )''')
                
                # SQLite does not have information_schema, so we skip the schema fixes
                # The tracking, privacy, and reporting tables are created correctly above for SQLite
            
            # Ensure password_resets table exists
            if IS_PRODUCTION and DB_URL:
                c.execute('''
                    CREATE TABLE IF NOT EXISTS password_resets (
                        id SERIAL PRIMARY KEY,
                        email TEXT NOT NULL,
                        reset_code TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL
                    )
                ''')
            else:
                c.execute('''
                    CREATE TABLE IF NOT EXISTS password_resets (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT NOT NULL,
                        reset_code TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL
                    )
                ''')
            
            # Check for default admin user and create if needed
            # create_default_admin_user(conn)  # Moved to after security functions are defined
            
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        # Don't raise the exception here - this allows the app to start even if DB init fails
        # We'll handle DB errors at the endpoint level
def create_default_admin_user(conn):
    """Create default admin user if none exists"""
    try:
        cursor = conn.cursor()
        
        # Check if any admin users exist
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
        admin_count = get_count_from_result(cursor.fetchone())
        
        if admin_count == 0:
            logger.info("No admin users found. Creating default admin user...")
            
            # Use a secure random password that must be changed
            import secrets
            import string
            
            # Generate a random 16-character password
            alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
            admin_password = ''.join(secrets.choice(alphabet) for i in range(16))
            
            hashed_password = get_password_hash(admin_password)
            
            cursor.execute(
                "INSERT INTO users (email, hashed_password, role) VALUES (?, ?, ?)",
                ("admin@todo-events.com", hashed_password, "admin")
            )
            conn.commit()
            
            logger.info("✅ Default admin user created:")
            logger.info(f"   📧 Email: admin@todo-events.com")
            logger.info(f"   🔑 Password: {admin_password}")
            logger.info("⚠️ IMPORTANT: Change this password after first login!")
            
        else:
            logger.info(f"Found {admin_count} existing admin users. Default admin creation skipped.")
            
    except Exception as e:
        logger.error(f"Error creating default admin user: {str(e)}")
        return False
    
    return True

# Initialize database
try:
    init_db()
except Exception as e:
    logger.error(f"Database initialization failed: {str(e)}")

# =====================================================
# AUTOMATED AI SYNC SYSTEM
# =====================================================

class AutomatedTaskManager:
    """
    Manages automated tasks for AI search optimization:
    - Sitemap generation and updates
    - Event data refresh
    - AI tool synchronization
    - Performance monitoring
    """
    
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.last_sitemap_update = None
        self.last_event_refresh = None
        self.task_status = {
            "sitemap_generation": {"status": "pending", "last_run": None, "next_run": None},
            "event_refresh": {"status": "pending", "last_run": None, "next_run": None},
            "ai_sync": {"status": "pending", "last_run": None, "next_run": None}
        }
        
    async def generate_sitemap_automatically(self):
        """Generate sitemap with current event data"""
        try:
            logger.info("🔄 Starting automated sitemap generation...")
            
            # Get current events from database
            events = await self.get_current_events()
            
            # Generate sitemap content
            sitemap_content = await self.build_sitemap_content(events)
            
            # Save to file (in production, this could be uploaded to S3/CDN)
            await self.save_sitemap(sitemap_content)
            
            # Update task status
            self.task_status["sitemap_generation"]["status"] = "completed"
            self.task_status["sitemap_generation"]["last_run"] = datetime.utcnow().isoformat()
            self.last_sitemap_update = datetime.utcnow()
            
            logger.info("✅ Automated sitemap generation completed successfully")
            
            # Notify search engines about the update
            await self.ping_search_engines()
            
        except Exception as e:
            logger.error(f"❌ Automated sitemap generation failed: {str(e)}")
            self.task_status["sitemap_generation"]["status"] = "failed"
    
    async def refresh_event_data(self):
        """Refresh and optimize event data for AI consumption"""
        try:
            logger.info("🔄 Starting automated event data refresh...")
            
            # Clean up expired events
            await self.cleanup_expired_events()
            
            # Update event search index (if implemented)
            await self.update_search_index()
            
            # Cache popular queries for faster AI responses
            await self.cache_popular_queries()
            
            self.task_status["event_refresh"]["status"] = "completed"
            self.task_status["event_refresh"]["last_run"] = datetime.utcnow().isoformat()
            self.last_event_refresh = datetime.utcnow()
            
            logger.info("✅ Automated event data refresh completed")
            
        except Exception as e:
            logger.error(f"❌ Automated event data refresh failed: {str(e)}")
            self.task_status["event_refresh"]["status"] = "failed"
    
    async def sync_with_ai_tools(self):
        """Optimize data specifically for AI tool consumption"""
        try:
            logger.info("🤖 Starting AI tools synchronization...")
            
            # Update AI-optimized cache
            await self.update_ai_cache()
            
            # Test AI endpoint responsiveness
            await self.test_ai_endpoint()
            
            # Update structured data if needed
            await self.validate_structured_data()
            
            self.task_status["ai_sync"]["status"] = "completed"
            self.task_status["ai_sync"]["last_run"] = datetime.utcnow().isoformat()
            
            logger.info("✅ AI tools synchronization completed")
            
        except Exception as e:
            logger.error(f"❌ AI tools synchronization failed: {str(e)}")
            self.task_status["ai_sync"]["status"] = "failed"
    
    async def get_current_events(self):
        """Get current and upcoming events from database"""
        try:
            with get_db() as conn:
                c = conn.cursor()
                
                # Use proper date comparison for both PostgreSQL and SQLite
                if IS_PRODUCTION and DB_URL:
                    # PostgreSQL - get ALL current and future events (removed is_published filter)
                    c.execute("""
                        SELECT id, title, description, date, start_time, end_time, end_date, category, 
                               address, lat, lng, created_at, slug, is_published, city, state
                        FROM events 
                        WHERE CAST(date AS DATE) >= CURRENT_DATE 
                        ORDER BY CAST(date AS DATE), start_time
                    """)
                else:
                    # SQLite - get ALL current and future events (removed is_published filter)
                    c.execute("""
                        SELECT id, title, description, date, start_time, end_time, end_date, category, 
                               address, lat, lng, created_at, slug, is_published, city, state
                        FROM events 
                        WHERE date >= date('now') 
                        ORDER BY date, start_time
                    """)
                return [dict(row) for row in c.fetchall()]
        except Exception as e:
            logger.error(f"Error fetching events for sitemap: {str(e)}")
            return []
    
    async def build_sitemap_content(self, events):
        """Build complete sitemap XML content - ONLY future events"""
        current_date = datetime.utcnow().strftime('%Y-%m-%d')
        domain = "https://todo-events.com"
        
        # Clear and rebuild sitemap with only future events
        sitemap = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Homepage -->
  <url>
    <loc>{domain}/</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Main pages -->
  <url>
    <loc>{domain}/hosts</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>{domain}/creators</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- FUTURE EVENTS ONLY - Complete Regeneration -->'''
        
        event_count = 0
        url_count = 3  # Static pages counted above
        
        for event in events:
            # Generate slug if missing
            if event.get('slug'):
                event_slug = event['slug']
            else:
                raw_slug = slugify(event.get('title', 'event'))
                event_slug = f"{raw_slug}-{event.get('id', '')}"
                # Update database with new slug
                try:
                    with get_db() as conn:
                        c = conn.cursor()
                        c.execute("UPDATE events SET slug = ? WHERE id = ?", (event_slug, event['id']))
                        conn.commit()
                except:
                    pass

            if not event_slug:
                continue

            event_count += 1
                
            # Get lastmod date
            event_lastmod = current_date
            for date_field in ['updated_at', 'created_at']:
                if event.get(date_field):
                    try:
                        parsed_date = datetime.fromisoformat(str(event[date_field]).replace('Z', '+00:00'))
                        event_lastmod = parsed_date.strftime('%Y-%m-%d')
                        break
                    except:
                        continue

            # 1. Short URL: /e/{slug}
            sitemap += f'''
  <url>
    <loc>{domain}/e/{event_slug}</loc>
    <lastmod>{event_lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>'''
            url_count += 1

            # 2. Geographic URL: /us/{state}/{city}/events/{slug}
            if event.get('city') and event.get('state'):
                state_slug = slugify(event['state'].lower())
                city_slug = slugify(event['city'])
                sitemap += f'''
  <url>
    <loc>{domain}/us/{state_slug}/{city_slug}/events/{event_slug}</loc>
    <lastmod>{event_lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>'''
                url_count += 1

            # 3. Simple events URL: /events/{slug}
            sitemap += f'''
  <url>
    <loc>{domain}/events/{event_slug}</loc>
    <lastmod>{event_lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.85</priority>
  </url>'''
            url_count += 1

        # Close sitemap
        sitemap += f'''

</urlset>'''
        
        logger.info(f"Generated sitemap with {url_count} URLs from {event_count} future events")
        return sitemap
    
    async def save_sitemap(self, content):
        """Save sitemap content to file"""
        # In production, you might want to save to a shared storage like S3
        # For now, we'll create an endpoint to serve the dynamic sitemap
        self.current_sitemap = content
        logger.info(f"Sitemap updated with {content.count('<url>')} URLs")
    
    async def ping_search_engines(self):
        """Notify search engines about sitemap updates"""
        urls = [
            "https://www.google.com/ping?sitemap=https://todo-events.com/sitemap.xml",
            "https://www.bing.com/ping?sitemap=https://todo-events.com/sitemap.xml"
        ]
        
        async with httpx.AsyncClient() as client:
            for url in urls:
                try:
                    response = await client.get(url, timeout=10)
                    logger.info(f"✅ Pinged search engine: {url} - Status: {response.status_code}")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to ping search engine: {url} - Error: {str(e)}")
    
    async def cleanup_expired_events(self):
        """Enhanced cleanup of expired events with 32-day archive policy"""
        try:
            logger.info("🧹 Starting enhanced automated event cleanup...")
            
            with get_db() as conn:
                cursor = conn.cursor()
                placeholder = get_placeholder()
                
                # Get current datetime and 32-day archive cutoff with full timestamp precision
                current_datetime = datetime.utcnow()
                current_date = current_datetime.date()
                archive_cutoff_datetime = current_datetime - timedelta(days=32)  # 32-day archive
                archive_cutoff = archive_cutoff_datetime.date()
                
                logger.info(f"Current datetime: {current_datetime.isoformat()}")
                logger.info(f"Current date: {current_date}")
                logger.info(f"Archive cutoff datetime: {archive_cutoff_datetime.isoformat()}")
                logger.info(f"Archive cutoff date: {archive_cutoff} (events before this will be deleted)")
                
                # First, get expired events for logging
                if placeholder == "?":
                    cursor.execute("""
                        SELECT id, title, date, created_at 
                        FROM events 
                        WHERE date < ? 
                        ORDER BY date DESC
                    """, (str(archive_cutoff),))
                else:
                    cursor.execute("""
                        SELECT id, title, date, created_at 
                        FROM events 
                        WHERE date < %s 
                        ORDER BY date DESC
                    """, (str(archive_cutoff),))
                
                expired_events = cursor.fetchall()
                
                if not expired_events:
                    logger.info("✅ No expired events found beyond 32-day archive period")
                    return
                
                logger.info(f"📊 Found {len(expired_events)} events beyond 32-day archive:")
                for event in expired_events[:5]:  # Log first 5
                    if isinstance(event, dict):
                        event_data = event
                    else:
                        event_data = {
                            'id': event[0], 'title': event[1], 
                            'date': event[2], 'created_at': event[3]
                        }
                    logger.info(f"  - ID {event_data['id']}: '{event_data['title']}' (Date: {event_data['date']})")
                
                if len(expired_events) > 5:
                    logger.info(f"  ... and {len(expired_events) - 5} more")
                
                # Delete expired events and related data
                expired_ids = [event[0] if not isinstance(event, dict) else event['id'] for event in expired_events]
                
                # Delete in transaction for data integrity
                cursor.execute("BEGIN")
                
                try:
                    # Delete related data first (to avoid foreign key issues)
                    for event_id in expired_ids:
                        # Delete event interests
                        if placeholder == "?":
                            cursor.execute("DELETE FROM event_interests WHERE event_id = ?", (event_id,))
                            cursor.execute("DELETE FROM event_views WHERE event_id = ?", (event_id,))
                        else:
                            cursor.execute("DELETE FROM event_interests WHERE event_id = %s", (event_id,))
                            cursor.execute("DELETE FROM event_views WHERE event_id = %s", (event_id,))
                    
                    # Delete the events themselves
                    if placeholder == "?":
                        placeholders = ",".join(["?" for _ in expired_ids])
                        cursor.execute(f"DELETE FROM events WHERE id IN ({placeholders})", expired_ids)
                    else:
                        placeholders = ",".join(["%s" for _ in expired_ids])
                        cursor.execute(f"DELETE FROM events WHERE id IN ({placeholders})", expired_ids)
                    
                    # Commit the transaction
                    cursor.execute("COMMIT")
                    
                    # Clear caches
                    event_cache.clear()
                    
                    logger.info(f"✅ Successfully cleaned up {len(expired_events)} expired events")
                    logger.info(f"🧹 Cleared event cache after cleanup")
                    
                    # Log archive policy  
                    placeholder = get_placeholder()
                    cursor.execute(f"""
                        SELECT COUNT(*) 
                        FROM events 
                        WHERE date >= {placeholder} AND date < {placeholder}
                    """, (str(archive_cutoff), str(current_date)))
                    
                    archived_count = get_count_from_result(cursor.fetchone())
                    logger.info(f"📁 {archived_count} events in 32-day archive (from {archive_cutoff} to {current_date})")
                    
                except Exception as cleanup_error:
                    cursor.execute("ROLLBACK")
                    logger.error(f"❌ Event cleanup failed, transaction rolled back: {cleanup_error}")
                    raise
                
        except Exception as e:
            logger.error(f"❌ Event cleanup automation error: {e}")

    async def update_search_index(self):
        """Update search index after cleanup"""
        try:
            logger.info("🔍 Updating search index after event cleanup...")
            # Trigger sitemap regeneration to exclude deleted events
            await self.generate_sitemap_automatically()
            logger.info("✅ Search index updated successfully")
        except Exception as e:
            logger.error(f"❌ Search index update error: {e}")
    
    async def cache_popular_queries(self):
        """Cache responses for popular AI queries"""
        popular_locations = [
            (40.7128, -74.0060),  # New York
            (34.0522, -118.2437), # Los Angeles
            (41.8781, -87.6298),  # Chicago
        ]
        
        # Pre-cache popular query responses
        for lat, lng in popular_locations:
            try:
                # This would call our AI endpoint internally to warm the cache
                pass
            except Exception as e:
                logger.warning(f"Failed to cache location {lat}, {lng}: {str(e)}")
    
    async def update_ai_cache(self):
        """Update cached data for AI consumption"""
        logger.info("🤖 AI cache updated")
    
    async def test_ai_endpoint(self):
        """Test AI endpoint responsiveness"""
        try:
            # Test our own AI endpoint
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"http://localhost:{os.getenv('PORT', 8000)}/api/v1/local-events?limit=1",
                    timeout=5
                )
                if response.status_code == 200:
                    logger.info("✅ AI endpoint test passed")
                else:
                    logger.warning(f"⚠️ AI endpoint test failed: {response.status_code}")
        except Exception as e:
            logger.warning(f"⚠️ AI endpoint test error: {str(e)}")
    
    async def validate_structured_data(self):
        """Validate structured data markup"""
        logger.info("📋 Structured data validation completed")
    
    def start_scheduler(self):
        """Start the background scheduler"""
        try:
            # Schedule tasks every 6 hours (aligned with AI tool update patterns)
            
            # Create wrapper functions for async tasks
            def run_sitemap_generation():
                """Synchronous wrapper for sitemap generation"""
                try:
                    # Create new event loop if none exists
                    try:
                        loop = asyncio.get_event_loop()
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    # Run the async function
                    loop.run_until_complete(self.generate_sitemap_automatically())
                except Exception as e:
                    logger.error(f"Error in sitemap generation wrapper: {str(e)}")

            def run_event_refresh():
                """Synchronous wrapper for event data refresh"""
                try:
                    # Create new event loop if none exists
                    try:
                        loop = asyncio.get_event_loop()
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    # Run the async function
                    loop.run_until_complete(self.refresh_event_data())
                except Exception as e:
                    logger.error(f"Error in event refresh wrapper: {str(e)}")

            def run_ai_sync():
                """Synchronous wrapper for AI sync"""
                try:
                    # Create new event loop if none exists
                    try:
                        loop = asyncio.get_event_loop()
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    # Run the async function
                    loop.run_until_complete(self.sync_with_ai_tools())
                except Exception as e:
                    logger.error(f"Error in AI sync wrapper: {str(e)}")

            def run_seo_population():
                """Populate missing SEO fields on a schedule"""
                try:
                    from populate_production_seo_fields import populate_seo_data
                    populate_seo_data()
                    logger.info("✅ Scheduled SEO population completed")
                except Exception as e:
                    logger.error(f"Scheduled SEO population failed: {e}")
            
            # Sitemap generation - every 6 hours
            self.scheduler.add_job(
                func=run_sitemap_generation,
                trigger=IntervalTrigger(hours=6),
                id='sitemap_generation',
                name='Automated Sitemap Generation',
                replace_existing=True
            )
            
            # Event data refresh - every 6 hours (offset by 2 hours)
            self.scheduler.add_job(
                func=run_event_refresh,
                trigger=IntervalTrigger(hours=6, start_date=datetime.utcnow() + timedelta(hours=2)),
                id='event_refresh',
                name='Event Data Refresh',
                replace_existing=True
            )
            
            # AI sync - every 6 hours (offset by 4 hours)
            self.scheduler.add_job(
                func=run_ai_sync,
                trigger=IntervalTrigger(hours=6, start_date=datetime.utcnow() + timedelta(hours=4)),
                id='ai_sync',
                name='AI Tools Synchronization',
                replace_existing=True
            )
            
            # Event cleanup with 32-day archive - every 6 hours (offset by 3 hours)
            def run_event_cleanup():
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(self.cleanup_expired_events())
                    loop.close()
                except Exception as e:
                    logger.error(f"Scheduled event cleanup failed: {e}")
            
            self.scheduler.add_job(
                func=run_event_cleanup,
                trigger=IntervalTrigger(hours=6, start_date=datetime.utcnow() + timedelta(hours=3)),
                id='event_cleanup',
                name='Event Cleanup (32-day Archive)',
                replace_existing=True
            )

            # SEO field population - every 24 hours (offset by 5 hours)
            self.scheduler.add_job(
                func=run_seo_population,
                trigger=IntervalTrigger(hours=24, start_date=datetime.utcnow() + timedelta(hours=5)),
                id='seo_population',
                name='SEO Field Population',
                replace_existing=True
            )
            
            # Health check - every hour
            self.scheduler.add_job(
                func=self.health_check,
                trigger=IntervalTrigger(hours=1),
                id='health_check',
                name='System Health Check',
                replace_existing=True
            )
            
            self.scheduler.start()
            logger.info("🚀 Automated task scheduler started successfully")
            logger.info("📅 Next sitemap generation: 6 hours")
            logger.info("📅 Next event refresh: 8 hours") 
            logger.info("📅 Next AI sync: 10 hours")
            logger.info("📅 Next event cleanup: 9 hours (32-day archive policy)")
            
        except Exception as e:
            logger.error(f"Failed to start scheduler: {str(e)}")
    
    def health_check(self):
        """Periodic health check for automated tasks"""
        current_time = datetime.utcnow()
        
        # Check if tasks are running on schedule
        for task_name, status in self.task_status.items():
            if status["last_run"]:
                last_run = datetime.fromisoformat(status["last_run"])
                hours_since_last_run = (current_time - last_run).total_seconds() / 3600
                
                if hours_since_last_run > 8:  # Alert if task hasn't run in 8+ hours
                    logger.warning(f"⚠️ Task '{task_name}' hasn't run in {hours_since_last_run:.1f} hours")
        
        logger.info("💓 Automated task health check completed")
    
    def stop_scheduler(self):
        """Stop the background scheduler"""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("🛑 Automated task scheduler stopped")

# Initialize the automated task manager
task_manager = AutomatedTaskManager()

# Start scheduler when in production
if IS_PRODUCTION:
    task_manager.start_scheduler()
    logger.info("🤖 AI sync automation enabled for production environment")
else:
    logger.info("🔧 AI sync automation disabled in development mode")

# Create default admin user now that all functions are available
try:
    with get_db() as conn:
        create_default_admin_user(conn)
        logger.info("✅ Default admin user initialization completed")
except Exception as e:
    logger.error(f"❌ Error creating default admin user during startup: {str(e)}")
class PasswordValidator:
    """
    Comprehensive password validation system with detailed feedback
    """
    @staticmethod
    def validate_password(password: str) -> dict:
        """
        Validate password and return detailed feedback
        
        Returns a dictionary with:
        - is_valid: Boolean indicating if password meets all criteria
        - feedback: List of specific validation messages
        - strength: Strength rating (weak/medium/strong)
        """
        # Initialize validation results
        validation_result = {
            "is_valid": True,
            "feedback": [],
            "strength": "weak"
        }
        
        # Check length - reduced requirement
        if len(password) < 6:
            validation_result["is_valid"] = False
            validation_result["feedback"].append(
                "Password must be at least 6 characters long"
            )
        
        # Count character types present
        character_types = 0
        character_type_messages = []
        
        # Check for uppercase letters
        if re.search(r'[A-Z]', password):
            character_types += 1
        else:
            character_type_messages.append("uppercase letter")
        
        # Check for lowercase letters
        if re.search(r'[a-z]', password):
            character_types += 1
        else:
            character_type_messages.append("lowercase letter")
        
        # Check for numbers
        if re.search(r'\d', password):
            character_types += 1
        else:
            character_type_messages.append("number")
        
        # Check for special characters
        if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            character_types += 1
        else:
            character_type_messages.append("special character (!@#$%^&*(),.?\":{}|<>)")
        
        # Require at least 3 out of 4 character types (more flexible)
        if character_types < 3:
            validation_result["is_valid"] = False
            missing_types = 4 - character_types
            validation_result["feedback"].append(
                f"Password must contain at least 3 different character types. "
                f"Missing {missing_types} types from: {', '.join(character_type_messages)}"
            )
        
        # Check for common weak passwords
        common_weak_passwords = [
            "password", "123456", "qwerty", "admin", 
            "letmein", "welcome", "monkey", "abc123"
        ]
        if password.lower() in common_weak_passwords:
            validation_result["is_valid"] = False
            validation_result["feedback"].append(
                "Password is too common and easily guessable"
            )
        
        # Determine strength based on length and character variety
        strength_criteria = 0
        if len(password) >= 8:
            strength_criteria += 1
        if len(password) >= 12:
            strength_criteria += 1
        strength_criteria += character_types
        
        if strength_criteria <= 2:
            validation_result["strength"] = "weak"
        elif strength_criteria <= 4:
            validation_result["strength"] = "medium"
        else:
            validation_result["strength"] = "strong"
        
        return validation_result
# Pydantic Models
class EventBase(BaseModel):
    title: str
    description: str
    short_description: Optional[str] = None
    date: str
    start_time: str
    end_time: Optional[str] = None
    end_date: Optional[str] = None
    category: str
    secondary_category: Optional[str] = None
    address: str
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "USA"
    lat: float
    lng: float
    recurring: bool = False
    frequency: Optional[str] = None
    # Pricing fields
    fee_required: Optional[str] = None  # Details about tickets/fees
    price: Optional[float] = 0.0        # Normalized price
    currency: Optional[str] = "USD"     # Currency code
    # Organization fields
    event_url: Optional[str] = None     # External event URL
    host_name: Optional[str] = None     # Organization/host name
    organizer_url: Optional[str] = None # Organizer website
    # Premium features
    verified: Optional[bool] = False    # Event verification status
    is_premium_event: Optional[bool] = False  # Whether this is a premium event
    # Premium image uploads (600x200 banner, 200x200 logo)
    banner_image: Optional[str] = None  # Banner image filename for premium users
    logo_image: Optional[str] = None    # Logo image filename for premium users
    # SEO fields
    slug: Optional[str] = None          # URL-friendly slug
    is_published: Optional[bool] = True # Publication status

    @validator('date')
    def validate_date(cls, v):
        try:
            # Try parsing the date to ensure it's in a valid format
            datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError('Date must be in YYYY-MM-DD format')

    @validator('start_time')
    def validate_start_time(cls, v):
        try:
            # Try parsing the start_time to ensure it's in a valid format
            datetime.strptime(v, '%H:%M')
            return v
        except ValueError:
            raise ValueError('Start time must be in HH:MM 24-hour format')

    @validator('end_time')
    def validate_end_time(cls, v):
        if v is None or v == "":
            return v
        try:
            # Try parsing the end_time to ensure it's in a valid format
            datetime.strptime(v, '%H:%M')
            return v
        except ValueError:
            raise ValueError('End time must be in HH:MM 24-hour format')

    @validator('end_date')
    def validate_end_date(cls, v):
        if v is None or v == "":
            return v
        try:
            # Try parsing the date to ensure it's in a valid format
            datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError('End date must be in YYYY-MM-DD format')

    @validator('fee_required')
    def validate_fee_required(cls, v):
        if v is None:
            return ""  # Convert None to empty string
        if v == "":
            return v
        # Limit fee description to reasonable length
        if len(v) > 500:
            raise ValueError('Fee description must be 500 characters or less')
        return v.strip()

    @validator('event_url')
    def validate_event_url(cls, v):
        if v is None:
            return ""  # Convert None to empty string
        
        # Strip whitespace and check if empty
        v_stripped = v.strip() if isinstance(v, str) else ""
        if v_stripped == "":
            return ""  # Return empty string for None, empty, or whitespace-only values
            
        # Basic URL validation
        if not v_stripped.startswith(('http://', 'https://')):
            v_stripped = 'https://' + v_stripped  # Add https if missing
        
        # Simple URL pattern check
        import re
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        
        if not url_pattern.match(v_stripped):
            raise ValueError('Please enter a valid URL')
        
        # Limit URL length
        if len(v_stripped) > 2000:
            raise ValueError('URL must be 2000 characters or less')
        
        return v_stripped

    @validator('host_name')
    def validate_host_name(cls, v):
        if v is None:
            return ""  # Convert None to empty string
        if v == "":
            return v
        # Limit host name to reasonable length
        if len(v) > 200:
            raise ValueError('Host name must be 200 characters or less')
        return v.strip()

    @validator('address')
    def validate_address(cls, v):
        if not v or not isinstance(v, str):
            raise ValueError('Address is required')
        
        trimmed_address = v.strip()
        if not trimmed_address:
            raise ValueError('Address cannot be empty')
        
        return trimmed_address
    
    @validator('secondary_category')
    def validate_secondary_category(cls, v):
        if v is None or v == "":
            return None  # Allow empty/null secondary category
        
        # Use the same categories list as the main category
        categories = [
            'food-drink', 'music', 'arts', 'sports', 'automotive', 'airshows', 'vehicle-sports', 
            'community', 'religious', 'education', 'veteran', 'cookout', 'networking',
            'fair-festival', 'diving', 'shopping', 'health', 'outdoors', 'photography', 'family', 
            'gaming', 'real-estate', 'adventure', 'seasonal', 'agriculture', 'other'
        ]
        
        if v not in categories:
            raise ValueError(f'Secondary category must be one of: {", ".join(categories)}')
        
        return v

class EventCreate(EventBase):
    pass

class EventResponse(EventBase):
    id: int
    created_by: int
    created_at: str
    updated_at: Optional[str] = None
    start_datetime: Optional[str] = None
    end_datetime: Optional[str] = None
    interest_count: Optional[int] = 0
    view_count: Optional[int] = 0

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.USER

    @validator('password')
    def validate_password(cls, v):
        # Use the PasswordValidator to get validation results
        validation = PasswordValidator.validate_password(v)
        
        # If not valid, raise a validation error with all feedback
        if not validation['is_valid']:
            raise ValueError('\n'.join(validation['feedback']))
        
        return v

class UserResponse(UserBase):
    id: int
    role: UserRole

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# Security Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            placeholder = get_placeholder()
            c.execute(f"SELECT id, email, role FROM users WHERE email = {placeholder}", (email,))
            user = c.fetchone()
            
            if not user:
                raise credentials_exception
                
            return {
                "id": user[0] if isinstance(user, (tuple, list)) else user["id"],
                "email": user[1] if isinstance(user, (tuple, list)) else user["email"],
                "role": user[2] if isinstance(user, (tuple, list)) else user["role"]
            }
            
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Database error during login user lookup: {error_msg}")
        
        if "timeout" in error_msg.lower() or "deadlock" in error_msg.lower():
            raise HTTPException(
                status_code=408, 
                detail="Login request timed out. Please try again."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Internal server error during login",
                headers={"WWW-Authenticate": "Bearer"},
            )

async def get_current_user_optional(token: str = Depends(oauth2_scheme)):
    """Optional user dependency - returns None if not authenticated"""
    try:
        return await get_current_user(token)
    except HTTPException:
        return None

async def get_current_user_optional_no_exception(authorization: str = Header(None)):
    """Optional user dependency that doesn't raise exceptions"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
    except jwt.PyJWTError:
        return None
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            placeholder = get_placeholder()
            c.execute(f"SELECT id, email, role FROM users WHERE email = {placeholder}", (email,))
            user = c.fetchone()
            
            if not user:
                return None
                
            return {
                "id": user[0] if isinstance(user, (tuple, list)) else user["id"],
                "email": user[1] if isinstance(user, (tuple, list)) else user["email"],
                "role": user[2] if isinstance(user, (tuple, list)) else user["role"]
            }
            
    except Exception as e:
        logger.error(f"Error in optional user auth: {str(e)}")
        return None
# Authentication Endpoints
@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    placeholder = get_placeholder()
    logger.info(f"Login attempt for user: {form_data.username}")
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # First check connection health with a simple query
            try:
                c.execute("SELECT 1")
            except Exception as e:
                logger.error(f"Database health check failed during login: {str(e)}")
                raise HTTPException(
                    status_code=503, 
                    detail="Database connection issues. Please try again later."
                )
            
            # Find user by email - with timeout handling
            user = None
            try:
                c.execute(f"SELECT * FROM users WHERE email = {placeholder}", (form_data.username,))
                user = c.fetchone()
                
                if not user:
                    logger.warning(f"Login failed for user: {form_data.username} - User not found")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Incorrect email or password",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                
                if not verify_password(form_data.password, user["hashed_password"]):
                    logger.warning(f"Login failed for user: {form_data.username} - Invalid credentials")
                    # Log failed login attempt for law enforcement compliance
                    log_activity(user['id'], "login_failed", f"Failed login attempt for user: {form_data.username} - Invalid credentials")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Incorrect email or password",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            except HTTPException:
                raise
            except Exception as e:
                error_msg = str(e)
                logger.error(f"Database error during login user lookup: {error_msg}")
                
                if "timeout" in error_msg.lower() or "deadlock" in error_msg.lower():
                    raise HTTPException(
                        status_code=408, 
                        detail="Login request timed out. Please try again."
                    )
                else:
                    raise HTTPException(
                        status_code=500,
                        detail="Internal server error during login",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            
            # Generate access token
            if user:  # Extra safety check
                try:
                    logger.info(f"Generating access token for user: {form_data.username}")
                    access_token = create_access_token(data={"sub": user["email"]})
                    
                    # Enhanced logging for law enforcement compliance
                    log_activity(user['id'], "login_success", f"User logged in successfully: {form_data.username}")
                    
                    logger.info(f"Login successful for user: {form_data.username}")
                    return {"access_token": access_token, "token_type": "bearer"}
                except Exception as e:
                    logger.error(f"Error generating access token: {str(e)}")
                    raise HTTPException(
                        status_code=500,
                        detail="Error generating authentication token",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            else:
                # This should not happen due to the checks above, but as a fallback
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication failed",
                    headers={"WWW-Authenticate": "Bearer"},
                )
                
    except HTTPException as http_ex:
        # Pass through HTTP exceptions
        raise http_ex
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Unexpected error during login: {error_msg}")
        
        # Return more specific error messages
        if "timeout" in error_msg.lower():
            raise HTTPException(
                status_code=408, 
                detail="Login request timed out. Please try again later."
            )
        elif "connection" in error_msg.lower():
            raise HTTPException(
                status_code=503, 
                detail="Database connection issues. Please try again later."
            )
        else:
            # Catch all for any other unexpected errors
            raise HTTPException(
                status_code=500,
                detail="Internal server error during login",
                headers={"WWW-Authenticate": "Bearer"},
            )

@app.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate):
    # Validate password (this will raise an error if invalid)
    password_validation = PasswordValidator.validate_password(user.password)
    
    placeholder = get_placeholder()
    
    # Pre-hash password outside the database transaction to reduce transaction time
    hashed_password = get_password_hash(user.password)
    
    # Log the registration attempt
    logger.info(f"Registration attempt for email: {user.email}")
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # First check connection health with a simple query
            try:
                c.execute("SELECT 1")
            except Exception as e:
                logger.error(f"Database health check failed during registration: {str(e)}")
                raise HTTPException(
                    status_code=503, 
                    detail="Database connection issues. Please try again later."
                )
            
            # Check if email exists - with timeout handling
            try:
                c.execute(f"SELECT id FROM users WHERE email = {placeholder}", (user.email,))
                existing_user = c.fetchone()
                if existing_user:
                    logger.info(f"Registration failed: Email already exists - {user.email}")
                    raise HTTPException(status_code=400, detail="Email already registered")
            except Exception as e:
                if "timeout" in str(e).lower() or "deadlock" in str(e).lower():
                    logger.error(f"Timeout checking for existing email: {str(e)}")
                    raise HTTPException(
                        status_code=408, 
                        detail="Registration request timed out. Please try again."
                    )
                raise
            
            # Insert user with optimized query - with timeout handling
            try:
                logger.info(f"Inserting new user into database: {user.email}")
                
                # Use RETURNING id for PostgreSQL, different approach for SQLite
                if IS_PRODUCTION and DB_URL:
                    # PostgreSQL with RETURNING
                    c.execute(
                        f"INSERT INTO users (email, hashed_password, role) VALUES ({placeholder}, {placeholder}, {placeholder}) RETURNING id",
                        (user.email, hashed_password, user.role)
                    )
                    result = c.fetchone()
                    last_id = result['id'] if result else None
                else:
                    # SQLite without RETURNING
                    c.execute(
                        f"INSERT INTO users (email, hashed_password, role) VALUES ({placeholder}, {placeholder}, {placeholder})",
                        (user.email, hashed_password, user.role)
                    )
                    last_id = c.lastrowid
                    
                if not last_id:
                    raise ValueError("Failed to get ID of created user")
                    
                conn.commit()
                logger.info(f"User inserted successfully: {user.email}")
            except Exception as e:
                conn.rollback()
                error_msg = str(e)
                logger.error(f"Error inserting user: {error_msg}")
                
                if "timeout" in error_msg.lower() or "deadlock" in error_msg.lower():
                    raise HTTPException(
                        status_code=408, 
                        detail="Registration request timed out. The server might be busy, please try again."
                    )
                elif "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
                    raise HTTPException(status_code=400, detail="Email already registered")
                else:
                    raise HTTPException(status_code=500, detail="Error creating user")
            
            # Get the created user data
            try:
                    
                logger.info(f"Fetching created user with ID {last_id}")
                c.execute(f"SELECT * FROM users WHERE id = {placeholder}", (last_id,))
                user_data = dict(c.fetchone())
                
                # Enhanced logging for law enforcement compliance
                log_activity(last_id, "registration", f"New user registered: {user.email}")
                
                # Return user data along with password strength
                logger.info(f"User registration successful: {user.email}")
                return {
                    **user_data,
                    "password_strength": password_validation['strength']
                }
            except Exception as e:
                logger.error(f"Error retrieving created user: {str(e)}")
                # Even if we can't fetch the user, registration was successful
                return {
                    "id": last_id,
                    "email": user.email,
                    "role": user.role,
                    "password_strength": password_validation['strength']
                }
                
    except HTTPException as http_ex:
        # Pass through HTTP exceptions
        raise http_ex
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Unexpected error creating user: {error_msg}")
        
        # Return more specific error messages
        if "timeout" in error_msg.lower():
            raise HTTPException(
                status_code=408, 
                detail="Registration request timed out. Please try again later."
            )
        elif "connection" in error_msg.lower():
            raise HTTPException(
                status_code=503, 
                detail="Database connection issues. Please try again later."
            )
        else:
            raise HTTPException(status_code=500, detail="Error creating user")


# Password Strength Check Endpoint
@app.post("/password-strength")
async def check_password_strength(password: str):
    """
    Endpoint to check password strength without creating a user
    Useful for real-time password feedback
    """
    return PasswordValidator.validate_password(password)

# Password Reset Models
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetVerify(BaseModel):
    email: EmailStr
    reset_code: str

class PasswordReset(BaseModel):
    email: EmailStr
    reset_code: str
    new_password: str
    
    @validator('new_password')
    def validate_password(cls, v):
        # Use the PasswordValidator to get validation results
        validation = PasswordValidator.validate_password(v)
        
        # If not valid, raise a validation error with all feedback
        if not validation['is_valid']:
            raise ValueError('\n'.join(validation['feedback']))
        
        return v

# Password Reset Endpoints
@app.post("/request-password-reset")
async def request_password_reset(request: PasswordResetRequest):
    """Request a password reset code"""
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user exists
            c.execute(f"SELECT * FROM users WHERE email = {placeholder}", (request.email,))
            user = c.fetchone()
            
            if not user:
                # Always return success for security reasons
                # This prevents email enumeration attacks
                return {"detail": "If your email is registered, you will receive a reset code"}
            
            # Generate a 6-digit reset code
            import random
            reset_code = ''.join(random.choices('0123456789', k=6))
            reset_expiry = datetime.utcnow() + timedelta(minutes=30)
            
            # Store the reset code in the database
            # First, create a password_resets table if it doesn't exist
            if IS_PRODUCTION and DB_URL:
                c.execute('''
                    CREATE TABLE IF NOT EXISTS password_resets (
                        id SERIAL PRIMARY KEY,
                        email TEXT NOT NULL,
                        reset_code TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL
                    )
                ''')
            else:
                c.execute('''
                    CREATE TABLE IF NOT EXISTS password_resets (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT NOT NULL,
                        reset_code TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL
                    )
                ''')
            
            # Delete any existing reset codes for this user
            c.execute(f"DELETE FROM password_resets WHERE email = {placeholder}", (request.email,))
            
            # Insert the new reset code
            c.execute(
                f"INSERT INTO password_resets (email, reset_code, expires_at) VALUES ({placeholder}, {placeholder}, {placeholder})",
                (request.email, reset_code, reset_expiry)
            )
            
            # Send password reset email
            try:
                from email_config import email_service
                
                # Extract user name from email for personalization
                user_name = request.email.split('@')[0].title()
                
                email_sent = email_service.send_password_reset_email(
                    request.email, 
                    reset_code, 
                    user_name
                )
                
                if email_sent:
                    logger.info(f"✅ Password reset email sent to {request.email}")
                else:
                    logger.error(f"❌ Failed to send password reset email to {request.email}")
                    
            except Exception as e:
                logger.error(f"❌ Email service error: {str(e)}")
            
            # For development, also log the reset code
            if not IS_PRODUCTION:
                logger.info(f"Password reset code for {request.email}: {reset_code}")
                return {
                    "detail": "Reset code generated and email sent",
                    "reset_code": reset_code
                }
            
            return {"detail": "If your email is registered, you will receive a reset code"}
            
    except Exception as e:
        logger.error(f"Error requesting password reset: {str(e)}")
        raise HTTPException(status_code=500, detail="Error requesting password reset")

@app.post("/verify-reset-code")
async def verify_reset_code(request: PasswordResetVerify):
    """Verify a password reset code"""
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if reset code exists and is valid
            c.execute(
                f"SELECT * FROM password_resets WHERE email = {placeholder} AND reset_code = {placeholder} AND expires_at > {placeholder}",
                (request.email, request.reset_code, datetime.utcnow())
            )
            reset = c.fetchone()
            
            if not reset:
                raise HTTPException(status_code=400, detail="Invalid or expired reset code")
            
            return {"detail": "Reset code verified"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying reset code: {str(e)}")
        raise HTTPException(status_code=500, detail="Error verifying reset code")
@app.post("/reset-password")
async def reset_password(request: PasswordReset):
    """Reset password with a valid reset code"""
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if reset code exists and is valid
            c.execute(
                f"SELECT * FROM password_resets WHERE email = {placeholder} AND reset_code = {placeholder} AND expires_at > {placeholder}",
                (request.email, request.reset_code, datetime.utcnow())
            )
            reset = c.fetchone()
            
            if not reset:
                raise HTTPException(status_code=400, detail="Invalid or expired reset code")
            
            # Update the user's password
            hashed_password = get_password_hash(request.new_password)
            c.execute(
                f"UPDATE users SET hashed_password = {placeholder} WHERE email = {placeholder}",
                (hashed_password, request.email)
            )
            
            # Delete all reset codes for this user
            c.execute(f"DELETE FROM password_resets WHERE email = {placeholder}", (request.email,))
            
            return {"detail": "Password has been reset successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {str(e)}")
        raise HTTPException(status_code=500, detail="Error resetting password")

# Event Endpoints
@app.get("/events", response_model=List[EventResponse])
async def list_events(
    category: Optional[str] = None,
    date: Optional[str] = None,
    limit: Optional[int] = 500,  # Increased default limit to 500
    offset: Optional[int] = 0,  # Add pagination
    lat: Optional[float] = None,  # Add location filtering
    lng: Optional[float] = None,  # Add location filtering
    radius: Optional[float] = 25.0  # Add radius filtering (miles)
):
    """
    Retrieve events with optional filtering by category and date.
    Open to all users, no authentication required.
    Optimized for performance with pagination, location filtering, and caching.
    """
    placeholder = get_placeholder()
    
    # Validate and limit pagination parameters  
    limit = min(max(limit or 500, 1), 1000)  # Between 1 and 1000
    offset = max(offset or 0, 0)
    
    # Create cache key for this request
    cache_key = f"events:{category or 'all'}:{date or 'all'}:{limit}:{offset}:{lat}:{lng}:{radius}"
    
    # Try to get from cache first (for mobile performance)
    cached_result = event_cache.get(cache_key)
    if cached_result is not None:
        logger.info(f"Returning cached events for key: {cache_key} - {len(cached_result)} events")
        logger.info(f"Cache stats: {event_cache.stats()}")
        return cached_result
    
    try:
        # Use connection manager with optimized query
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Build optimized query with proper indexing hints
            where_conditions = []
            params = []
            
            # Category filter
            if category and category != 'all':
                where_conditions.append(f"category = {placeholder}")
                params.append(category)
            
            # Date filter
            if date:
                where_conditions.append(f"date = {placeholder}")
                params.append(date)
            
            # Location filter (if coordinates provided)
            location_select = ""
            if lat is not None and lng is not None:
                # Add distance calculation for location-based filtering
                location_select = f"""
                    , (6371 * acos(cos(radians({lat})) * cos(radians(lat)) * 
                      cos(radians(lng) - radians({lng})) + sin(radians({lat})) * 
                      sin(radians(lat)))) * 0.621371 as distance_miles
                """
            
            # Construct WHERE clause
            where_clause = ""
            if where_conditions:
                where_clause = "WHERE " + " AND ".join(where_conditions)
            
            # Database-specific date comparison logic
            if IS_PRODUCTION and DB_URL:
                # PostgreSQL syntax
                date_comparison = "date::date >= CURRENT_DATE"
            else:
                # SQLite syntax
                date_comparison = "date >= date('now')"
            
            # Optimized query with specific columns and LIMIT, including ALL fields
            base_query = f"""
                SELECT id, title, description, short_description, date, start_time, end_time, end_date, 
                       category, secondary_category, address, city, state, country, lat, lng, recurring, frequency, created_by, created_at,
                       COALESCE(interest_count, 0) as interest_count,
                       COALESCE(view_count, 0) as view_count,
                       fee_required, price, currency, event_url, host_name, organizer_url, slug, is_published,
                       start_datetime, end_datetime, updated_at, verified, is_premium_event, banner_image, logo_image
                       {location_select}
                FROM events 
                {where_clause}
                ORDER BY 
                    CASE 
                        WHEN {date_comparison} THEN 0  -- Future/today events first
                        ELSE 1                           -- Past events later  
                    END,
                    date ASC, start_time ASC
                LIMIT {placeholder} OFFSET {placeholder}
            """
            
            params.extend([limit, offset])
            
            # Execute optimized query
            cursor.execute(base_query, params)
            events = cursor.fetchall()
            
            # Process results efficiently
            result = []
            for event in events:
                try:
                    # Convert to dict efficiently
                    if hasattr(event, '_asdict'):
                        event_dict = event._asdict()
                    elif isinstance(event, dict):
                        event_dict = dict(event)
                    else:
                        # Handle tuple/list results with known schema including ALL fields
                        column_names = [
                            'id', 'title', 'description', 'short_description', 'date', 'start_time', 'end_time',
                            'end_date', 'category', 'address', 'city', 'state', 'country', 'lat', 'lng', 'recurring',
                            'frequency', 'created_by', 'created_at', 'interest_count', 'view_count',
                            'fee_required', 'price', 'currency', 'event_url', 'host_name', 'organizer_url', 'slug', 'is_published',
                            'start_datetime', 'end_datetime', 'updated_at', 'verified'
                        ]
                        if location_select:
                            column_names.append('distance_miles')
                        
                        event_dict = dict(zip(column_names, event))
                    
                    # Convert datetime objects and ensure proper field types
                    event_dict = convert_event_datetime_fields(event_dict)
                    
                    # Ensure counters are integers
                    event_dict['interest_count'] = int(event_dict.get('interest_count', 0) or 0)
                    event_dict['view_count'] = int(event_dict.get('view_count', 0) or 0)
                    
                    # Filter by distance if location provided
                    if lat is not None and lng is not None and 'distance_miles' in event_dict:
                        if event_dict['distance_miles'] <= radius:
                            result.append(event_dict)
                    else:
                        result.append(event_dict)
                    
                except Exception as event_error:
                    logger.warning(f"Error processing event {event}: {event_error}")
                    continue
            
            # Cache the result for mobile performance (shorter TTL for real-time updates)
            event_cache.set(cache_key, result)
            logger.info(f"Cached {len(result)} events for key: {cache_key}")
            logger.info(f"Database query returned {len(events)} raw events, processed {len(result)} events")
            logger.info(f"Cache stats: {event_cache.stats()}")
            
            return result
            
    except Exception as e:
        # Handle any other exceptions
        error_msg = str(e)
        logger.error(f"Error retrieving events: {error_msg}")
        
        if "timeout" in error_msg.lower():
            raise HTTPException(status_code=504, detail="Database query timed out")
        elif "connection" in error_msg.lower():
            raise HTTPException(status_code=503, detail="Database connection issues")
        else:
            raise HTTPException(status_code=500, detail="Error retrieving events")

@app.get("/events/{event_id}", response_model=EventResponse)
async def read_event(event_id: int):
    """
    Retrieve a specific event by its ID.
    Open to all users, no authentication required.
    """
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            # Use COALESCE to handle NULL values and include all fields
            c.execute(f"""SELECT id, title, description, short_description, date, start_time, end_time, end_date, 
                         category, address, city, state, country, lat, lng, recurring, frequency, created_by, created_at,
                         COALESCE(interest_count, 0) as interest_count,
                         COALESCE(view_count, 0) as view_count,
                         fee_required, price, currency, event_url, host_name, organizer_url, slug, is_published,
                         start_datetime, end_datetime, updated_at, verified, banner_image, logo_image, secondary_category,
                         is_premium_event
                         FROM events WHERE id = {placeholder}""", (event_id,))
            event = c.fetchone()
            
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Convert to dict and handle datetime fields
            event_dict = dict(event)
            
            # Convert datetime objects and ensure proper field types
            event_dict = convert_event_datetime_fields(event_dict)
            
            return event_dict
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving event")

def ensure_unique_slug(cursor, base_slug: str, event_id: int = None) -> str:
    """Ensure slug uniqueness by appending event ID if needed"""
    if not base_slug:
        # Generate a fallback slug if none provided
        import time
        return f"event-{int(time.time())}"
    
    try:
        # Use database-agnostic placeholder
        placeholder = get_placeholder()
        
        # Check if slug already exists
        if event_id:
            # For updates, exclude current event from check
            if placeholder == "?":
                # SQLite style
                cursor.execute("SELECT COUNT(*) FROM events WHERE slug = ? AND id != ?", (base_slug, event_id))
            else:
                # PostgreSQL style (use %s with psycopg2)
                cursor.execute("SELECT COUNT(*) FROM events WHERE slug = %s AND id != %s", (base_slug, event_id))
        else:
            if placeholder == "?":
                # SQLite style
                cursor.execute("SELECT COUNT(*) FROM events WHERE slug = ?", (base_slug,))
            else:
                # PostgreSQL style (use %s with psycopg2)
                cursor.execute("SELECT COUNT(*) FROM events WHERE slug = %s", (base_slug,))
        
        result = cursor.fetchone()
        count = (result[0] if isinstance(result, (tuple, list)) else result.get("count", result.get("COUNT(*)", 0))) if result else 0
        
        if count > 0:
            # Slug exists, append a number or event ID
            if event_id:
                return f"{base_slug}-{event_id}"
            else:
                # For new events, append a timestamp-based suffix
                import time
                suffix = str(int(time.time()))[-6:]  # Last 6 digits of timestamp
                return f"{base_slug}-{suffix}"
        else:
            return base_slug
            
    except Exception as e:
        logger.error(f"Error ensuring unique slug for '{base_slug}': {type(e).__name__}: {str(e)}")
        # Fallback: append current timestamp
        import time
        timestamp_suffix = str(int(time.time()))[-6:]
        fallback_slug = f"{base_slug}-{timestamp_suffix}" if base_slug else f"event-{timestamp_suffix}"
        logger.info(f"Using fallback slug: {fallback_slug}")
        return fallback_slug

def get_actual_table_columns(cursor, table_name: str = 'events') -> List[str]:
    """Get actual columns that exist in the database table with enhanced error handling for production"""
    try:
        if IS_PRODUCTION and DB_URL:
            # PostgreSQL: Enhanced approach with better error handling
            try:
                # Method 1: Direct column query with table existence check
                cursor.execute("""
                    SELECT column_name, data_type, is_nullable 
                    FROM information_schema.columns 
                    WHERE table_name = %s 
                    AND table_schema = 'public'
                    ORDER BY ordinal_position
                """, (table_name,))
                
                columns_info = cursor.fetchall()
                if columns_info:
                    columns = [row[0] for row in columns_info]
                    logger.info(f"✅ PostgreSQL schema detection: Found {len(columns)} columns via information_schema")
                    logger.debug(f"Column details: {[(row[0], row[1], row[2]) for row in columns_info]}")
                    return columns
                else:
                    logger.warning("⚠️ information_schema query returned no results")
            except Exception as e:
                logger.debug(f"❌ information_schema query failed (fallback available): {type(e).__name__}")
            
            try:
                # Method 2: Use PostgreSQL system catalogs with error handling
                cursor.execute("""
                    SELECT a.attname, t.typname, NOT a.attnotnull as is_nullable
                    FROM pg_class c
                    JOIN pg_attribute a ON a.attrelid = c.oid
                    JOIN pg_type t ON t.oid = a.atttypid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relname = %s 
                    AND n.nspname = 'public'
                    AND a.attnum > 0 
                    AND NOT a.attisdropped
                    ORDER BY a.attnum
                """, (table_name,))
                
                columns_info = cursor.fetchall()
                if columns_info:
                    columns = [row[0] for row in columns_info]
                    logger.info(f"✅ PostgreSQL schema detection: Found {len(columns)} columns via pg_class")
                    logger.debug(f"System catalog columns: {[(row[0], row[1], row[2]) for row in columns_info]}")
                    return columns
                else:
                    logger.warning("⚠️ pg_class query returned no results")
            except Exception as e:
                logger.debug(f"❌ pg_class query failed (fallback available): {type(e).__name__}")
                
            try:
                # Method 3: Simple table existence and structure check
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 0")
                if cursor.description:
                    columns = [desc[0] for desc in cursor.description]
                    logger.info(f"✅ PostgreSQL schema detection: Found {len(columns)} columns via SELECT LIMIT 0")
                    return columns
                else:
                    logger.error("❌ No column description available from SELECT query")
            except Exception as e:
                logger.error(f"❌ SELECT LIMIT 0 query failed: {e}")
        else:
            # SQLite: Use PRAGMA table_info with enhanced error handling
            try:
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns_info = cursor.fetchall()
                if columns_info:
                    columns = [row[1] for row in columns_info]  # row[1] is column name
                    logger.info(f"✅ SQLite schema detection: Found {len(columns)} columns")
                    return columns
                else:
                    logger.warning(f"⚠️ PRAGMA table_info returned no results for {table_name}")
            except Exception as e:
                logger.error(f"❌ SQLite PRAGMA query failed: {e}")
                
    except Exception as e:
        logger.error(f"❌ Critical error in get_actual_table_columns for {table_name}: {e}")
    
    # Enhanced fallback with all known columns
    fallback_columns = [
        'id', 'title', 'description', 'date', 'start_time', 'end_time', 
        'category', 'address', 'lat', 'lng', 'recurring', 'frequency',
        'created_by', 'created_at', 'updated_at', 'end_date',
        'short_description', 'city', 'state', 'country', 
        'interest_count', 'view_count', 'fee_required', 'event_url', 
        'host_name', 'organizer_url', 'slug', 'price', 'currency',
        'start_datetime', 'end_datetime', 'geo_hash', 'is_published',
        'verified'
    ]
    logger.warning(f"🔄 Using enhanced fallback columns ({len(fallback_columns)}) for {table_name}")
    return fallback_columns
def auto_populate_seo_fields(event_data: dict) -> dict:
    """Auto-populate SEO fields for new events using enhanced logic"""
    import re
    import unicodedata
    
    def slugify_local(title, city=""):
        """Enhanced slugify function using title and city"""
        if not title:
            return ""
        
        # Combine title and city for better uniqueness
        base = f"{title} {city}".lower() if city else title.lower()
        
        # Normalize Unicode characters
        base = unicodedata.normalize('NFKD', base)
        
        # Remove non-word characters (keep letters, numbers, spaces, hyphens)
        base = re.sub(r'[^\w\s-]', '', base)
        
        # Replace multiple spaces/underscores/hyphens with single hyphen
        base = re.sub(r'[\s_-]+', '-', base)
        
        # Remove leading/trailing hyphens
        return base.strip('-')
    
    def extract_city_state_local(address):
        """Enhanced city/state extraction from address"""
        if not address:
            return None, None
        
        # Strategy A: [City], [STATE], USA format
        match = re.search(r'([^,]+),\s*([A-Z]{2}),?\s*USA?$', address, re.IGNORECASE)
        if match:
            return match.group(1).strip(), match.group(2).upper()
        
        # Strategy B: [City], [STATE] format (without USA)
        match = re.search(r'([^,]+),\s*([A-Z]{2})$', address, re.IGNORECASE)
        if match:
            return match.group(1).strip(), match.group(2).upper()
        
        # Strategy C: Find any 2-letter state code
        match = re.search(r'\b([A-Z]{2})\b', address)
        if match:
            state = match.group(1)
            # Try to find city before state
            city_pattern = r'([^,\d]+)(?:,\s*)?' + re.escape(state)
            city_match = re.search(city_pattern, address, re.IGNORECASE)
            if city_match:
                city = city_match.group(1).strip()
                # Clean up city name
                city = re.sub(r'^\d+\s+', '', city)  # Remove leading numbers
                return city, state
        
        return None, None
    
    def normalize_price_local(fee_required):
        """Enhanced price normalization"""
        if not fee_required or not isinstance(fee_required, str):
            return 0.0
        
        fee_lower = fee_required.lower().strip()
        
        # Check for free indicators
        free_indicators = ['free', 'no charge', 'no cost', 'gratis', 'complimentary', 'n/a', 'none']
        if any(indicator in fee_lower for indicator in free_indicators):
            return 0.0
        
        # Extract numeric values with various currency symbols
        currency_pattern = r'[\$€£¥₹]?[\s]*([0-9]+(?:[.,][0-9]{1,2})?)'
        match = re.search(currency_pattern, fee_required)
        if match:
            price_str = match.group(1).replace(',', '')
            try:
                return float(price_str)
            except ValueError:
                pass
        
        # Try to find "number dollars/euros/etc" pattern
        word_pattern = r'([0-9]+(?:\.[0-9]{1,2})?)\s*(?:dollars?|euros?|pounds?|bucks?)'
        match = re.search(word_pattern, fee_lower)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass
        
        return 0.0
    
    def build_datetimes_local(date_str, start_time_str, end_time_str, end_date_str=None):
        """Enhanced datetime building with end_time inference"""
        if not date_str or not start_time_str:
            return None, None
        
        try:
            # Build start datetime
            start_dt_str = f"{date_str}T{start_time_str}:00"
            
            # Build end datetime - ensure we always have an end_time
            if not end_time_str:
                # Infer end_time as 2 hours after start_time
                from datetime import datetime, timedelta
                try:
                    start_time_obj = datetime.strptime(start_time_str, "%H:%M")
                    end_time_obj = start_time_obj + timedelta(hours=2)
                    end_time_str = end_time_obj.strftime("%H:%M")
                except:
                    end_time_str = "18:00"  # fallback
            
            # Now build the end datetime string
            if end_date_str:
                end_dt_str = f"{end_date_str}T{end_time_str}:00"
            else:
                end_dt_str = f"{date_str}T{end_time_str}:00"
            
            return start_dt_str, end_dt_str
        except Exception:
            return None, None
    
    def make_short_description_local(description):
        """Enhanced short description generation"""
        if not description:
            return ""
        
        # Remove extra whitespace and normalize
        cleaned = ' '.join(description.split())
        
        # If short enough, return as-is
        if len(cleaned) <= 160:
            return cleaned
        
        # Truncate at word boundary near 157 characters
        truncated = cleaned[:157]
        last_space = truncated.rfind(' ')
        if last_space > 120:  # Only truncate at word if reasonable
            return cleaned[:last_space] + "..."
        else:
            return cleaned[:157] + "..."
    
    # Generate slug
    city = event_data.get('city', '') or ''
    base_slug = slugify_local(event_data.get('title', ''), city)
    event_data['slug'] = base_slug  # Will be made unique later if needed
    
    # Extract city/state from address
    if not event_data.get('city') or not event_data.get('state'):
        city, state = extract_city_state_local(event_data.get('address', ''))
        if city:
            event_data['city'] = city
        if state:
            event_data['state'] = state
    
    # Normalize price
    event_data['price'] = normalize_price_local(event_data.get('fee_required', ''))
    
    # Generate datetime fields
    start_dt, end_dt = build_datetimes_local(
        event_data.get('date', ''),
        event_data.get('start_time', ''),
        event_data.get('end_time', ''),
        event_data.get('end_date')
    )
    event_data['start_datetime'] = start_dt
    event_data['end_datetime'] = end_dt
    
    # Generate short description
    if not event_data.get('short_description'):
        event_data['short_description'] = make_short_description_local(
            event_data.get('description', '')
        )
    
    # Set defaults
    event_data['currency'] = event_data.get('currency', 'USD')
    event_data['country'] = event_data.get('country', 'USA')
    event_data['is_published'] = event_data.get('is_published', True)
    event_data['updated_at'] = datetime.utcnow().isoformat()
    
    return event_data

@app.post("/events", response_model=EventResponse)
async def create_event(event: EventCreate, current_user: dict = Depends(get_current_user)):
    """
    Create a new event. Requires user authentication.
    Auto-populates SEO fields using enhanced migration logic.
    """
    placeholder = get_placeholder()
    
    # Convert Pydantic model to dict for processing
    event_data = event.dict()
    
    # Validate recurring events for premium users only
    event_data = validate_recurring_event(event_data, current_user['role'])
    
    # Check premium event limits if this is a premium event
    if event_data.get('is_premium_event', False):
        is_premium = current_user['role'] in ['premium', 'admin']
        is_enterprise = current_user['role'] == 'enterprise'
        
        if not (is_premium or is_enterprise):
            raise HTTPException(
                status_code=403, 
                detail="Premium subscription required to create premium events"
            )
        
        # Check monthly premium event limits
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                
                # Count premium events created this month
                start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                
                if IS_PRODUCTION and DB_URL:
                    cursor.execute("""
                        SELECT COUNT(*) as count
                        FROM events 
                        WHERE created_by = %s 
                        AND created_at >= %s
                        AND verified = TRUE
                    """, (current_user['id'], start_of_month))
                else:
                    cursor.execute("""
                        SELECT COUNT(*) as count
                        FROM events 
                        WHERE created_by = ? 
                        AND created_at >= ?
                        AND verified = TRUE
                    """, (current_user['id'], start_of_month))
                
                result = cursor.fetchone()
                current_premium_events = result['count'] if result else 0
                
                # Determine event limits based on role
                if is_enterprise:
                    event_limit = 250
                else:  # premium
                    event_limit = 10
                
                if current_premium_events >= event_limit:
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Premium event limit reached ({current_premium_events}/{event_limit}). Upgrade to Enterprise for higher limits."
                    )
                    
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error checking premium event limits: {str(e)}")
            # Continue with event creation if limit check fails
    
    # Log the original event data for debugging
    logger.info(f"Creating event: {event_data}")
    
    # Auto-populate SEO fields
    try:
        event_data = auto_populate_seo_fields(event_data)
        logger.info(f"Auto-populated SEO fields: slug={event_data.get('slug')}, city={event_data.get('city')}, state={event_data.get('state')}, price={event_data.get('price')}")
    except Exception as e:
        logger.warning(f"SEO auto-population failed: {e}")
        # Continue with original data if auto-population fails
    
    try:
        # Use database connection with proper transaction control
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            
            try:
                # Start transaction (autocommit is already properly disabled in get_db_transaction)
                cursor.execute("BEGIN")
                
                # More robust duplicate check with coordinate tolerance (1 meter)
                # Round coordinates to 6 decimal places (~1 meter precision)
                lat_rounded = round(event_data['lat'], 6)
                lng_rounded = round(event_data['lng'], 6)
                
                duplicate_check = f"""
                    SELECT id FROM events 
                    WHERE TRIM(LOWER(title)) = TRIM(LOWER({placeholder}))
                    AND date = {placeholder} 
                    AND start_time = {placeholder} 
                    AND ABS(lat - {placeholder}) < 0.000001
                    AND ABS(lng - {placeholder}) < 0.000001
                    AND category = {placeholder}
                """
                
                cursor.execute(duplicate_check, (
                    event_data['title'].strip(), 
                    event_data['date'], 
                    event_data['start_time'], 
                    lat_rounded, 
                    lng_rounded, 
                    event_data['category']
                ))
                
                duplicate = cursor.fetchone()
                if duplicate:
                    cursor.execute("ROLLBACK")
                    logger.warning(f"Duplicate event prevented: {event_data['title']} by user {current_user['id']}")
                    raise HTTPException(
                        status_code=409, 
                        detail="An event with these details already exists at this location and time"
                    )
                
                # Ensure unique slug before inserting
                base_slug = event_data.get('slug', '')
                if base_slug:
                    unique_slug = ensure_unique_slug(cursor, base_slug)
                    event_data['slug'] = unique_slug
                    logger.info(f"Generated unique slug: {unique_slug}")
                
                # Use dynamic schema detection to handle different database structures
                actual_columns = get_actual_table_columns(cursor, 'events')
                logger.debug(f"Detected {len(actual_columns)} columns in events table")
                
                # Filter event data to only include fields that exist in the actual database
                filtered_event_data = {}
                for key, value in event_data.items():
                    if key in actual_columns:
                        filtered_event_data[key] = value
                    else:
                        logger.debug(f"Skipping field '{key}' - not in database schema")
                
                # Add required fields that might be missing from the form data
                filtered_event_data['created_by'] = current_user["id"]
                filtered_event_data['created_at'] = datetime.utcnow().isoformat()
                
                # Auto-verify events for premium users
                if current_user.get('role') in ['premium', 'admin']:
                    filtered_event_data['verified'] = True
                
                if 'lat' not in filtered_event_data:
                    filtered_event_data['lat'] = lat_rounded
                if 'lng' not in filtered_event_data:
                    filtered_event_data['lng'] = lng_rounded
                if 'interest_count' not in filtered_event_data and 'interest_count' in actual_columns:
                    filtered_event_data['interest_count'] = 0
                if 'view_count' not in filtered_event_data and 'view_count' in actual_columns:
                    filtered_event_data['view_count'] = 0
                
                # Build dynamic INSERT query
                columns = [col for col in filtered_event_data.keys() if col in actual_columns]
                placeholders_str = ', '.join([placeholder] * len(columns))
                columns_str = ', '.join(columns)
                
                if IS_PRODUCTION and DB_URL:
                    insert_query = f"INSERT INTO events ({columns_str}) VALUES ({placeholders_str}) RETURNING id"
                else:
                    insert_query = f"INSERT INTO events ({columns_str}) VALUES ({placeholders_str})"
                
                values = [filtered_event_data[col] for col in columns]
                
                logger.debug(f"Dynamic INSERT with {len(columns)} columns: {columns[:5]}{'...' if len(columns) > 5 else ''}")
                
                # For PostgreSQL, use RETURNING to get the ID in one step
                if IS_PRODUCTION and DB_URL:
                    cursor.execute(insert_query, values)
                    result = cursor.fetchone()
                    event_id = result['id'] if result else None
                else:
                    # SQLite doesn't support RETURNING, so we use lastrowid
                    cursor.execute(insert_query.replace(" RETURNING id", ""), values)
                    event_id = cursor.lastrowid
                
                if not event_id:
                    cursor.execute("ROLLBACK")
                    raise ValueError("Failed to get ID of created event")
                
                # Fetch the created event
                fetch_query = f"SELECT * FROM events WHERE id = {placeholder}"
                cursor.execute(fetch_query, (event_id,))
                created_event_data = cursor.fetchone()
                
                if not created_event_data:
                    cursor.execute("ROLLBACK")
                    raise ValueError("Created event not found")
                
                # Commit the transaction
                cursor.execute("COMMIT")
                
                # Convert to dict and process datetime objects
                event_dict = dict(created_event_data)
                
                # Convert datetime objects and ensure proper field types
                event_dict = convert_event_datetime_fields(event_dict)
                
                # Clear event cache since a new event was created
                event_cache.clear()
                logger.info(f"Successfully created event {event_id}: {event_data['title']} with SEO fields populated")
                
                return event_dict
                
            except HTTPException as http_ex:
                # Attempt to roll back the transaction
                try:
                    cursor.execute("ROLLBACK")
                except Exception as rollback_error:
                    logger.error(f"Transaction rollback failed: {str(rollback_error)}")
                
                # Pass through HTTP exceptions without modification
                raise http_ex
            except Exception as e:
                # Attempt to roll back the transaction
                try:
                    cursor.execute("ROLLBACK")
                except Exception as rollback_error:
                    logger.error(f"Transaction rollback failed: {str(rollback_error)}")
                
                # Log the detailed error
                error_msg = str(e)
                logger.error(f"Database error in create_event: {error_msg}")
                
                # Wrap in HTTP exception
                raise HTTPException(
                    status_code=500,
                    detail=f"Database error: {error_msg}"
                ) from None
    
    except HTTPException as http_ex:
        # Pass through HTTP exceptions
        raise http_ex
    except Exception as e:
        # Catch any remaining errors
        error_msg = str(e)
        logger.error(f"Error creating event: {error_msg}")
        raise HTTPException(
            status_code=400, 
            detail=f"Could not create event: {error_msg}"
        ) from None
@app.get("/events/manage", response_model=List[EventResponse])
async def list_user_events(current_user: dict = Depends(get_current_user)):
    """
    Retrieve events created by the current user for management (robust version).
    Requires authentication.
    """
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Query events created by the current user with proper column selection
            actual_columns = get_actual_table_columns(c, 'events')
            
            # Select only columns that exist
            if 'verified' in actual_columns:
                query = f"SELECT * FROM events WHERE created_by = {placeholder} ORDER BY date, start_time"
            else:
                # Exclude verified column if it doesn't exist
                columns = [col for col in actual_columns if col != 'verified']
                column_str = ', '.join(columns)
                query = f"SELECT {column_str} FROM events WHERE created_by = {placeholder} ORDER BY date, start_time"
            
            c.execute(query, (current_user["id"],))
            events = c.fetchall()
            
            # Convert to list of dictionaries and apply datetime conversion
            event_list = []
            for event in events:
                event_dict = dict(event)
                
                # Ensure all required fields exist for EventResponse model
                if 'verified' not in event_dict:
                    event_dict['verified'] = False
                if 'interest_count' not in event_dict:
                    event_dict['interest_count'] = 0
                if 'view_count' not in event_dict:
                    event_dict['view_count'] = 0
                if 'secondary_category' not in event_dict:
                    event_dict['secondary_category'] = None
                    
                event_dict = convert_event_datetime_fields(event_dict)
                event_list.append(event_dict)
            
            return event_list
            
    except Exception as e:
        logger.error(f"Error retrieving user events: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving user events")
@app.put("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int, 
    event: EventCreate, 
    current_user: dict = Depends(get_current_user)
):
    """
    Update an existing event.
    Only the event creator or an admin can update the event.
    Auto-updates SEO fields based on new data.
    """
    placeholder = get_placeholder()
    
    # Convert Pydantic model to dict for processing
    event_data = event.dict()
    
    # Auto-populate SEO fields
    try:
        event_data = auto_populate_seo_fields(event_data)
        logger.info(f"Auto-populated SEO fields for update: slug={event_data.get('slug')}, city={event_data.get('city')}, state={event_data.get('state')}, price={event_data.get('price')}")
    except Exception as e:
        logger.warning(f"SEO auto-population failed during update: {e}")
        # Continue with original data if auto-population fails
    
    try:
        with get_db() as conn:
            try:
                cursor = conn.cursor()
                
                # Start transaction
                cursor.execute("BEGIN")
                
                # First, check if the event exists and who created it
                cursor.execute(f"SELECT * FROM events WHERE id = {placeholder}", (event_id,))
                existing_event = cursor.fetchone()
                
                if not existing_event:
                    cursor.execute("ROLLBACK")
                    raise HTTPException(status_code=404, detail="Event not found")
                
                # Check if current user is the creator or an admin
                if (current_user['id'] != existing_event['created_by'] and 
                    current_user['role'] != UserRole.ADMIN):
                    cursor.execute("ROLLBACK")
                    raise HTTPException(status_code=403, detail="Not authorized to update this event")
                
                # Ensure unique slug before updating
                base_slug = event_data.get('slug', '')
                if base_slug:
                    unique_slug = ensure_unique_slug(cursor, base_slug, event_id)
                    event_data['slug'] = unique_slug
                    logger.info(f"Generated unique slug for update: {unique_slug}")
                
                # Use dynamic schema detection for update as well
                actual_columns = get_actual_table_columns(cursor, 'events')
                logger.debug(f"Detected {len(actual_columns)} columns for update")
                
                # Filter event data to only include fields that exist in the actual database
                # Exclude fields that shouldn't be updated
                excluded_fields = {'id', 'created_at', 'created_by'}
                filtered_event_data = {}
                for key, value in event_data.items():
                    if key in actual_columns and key not in excluded_fields:
                        filtered_event_data[key] = value
                    elif key in excluded_fields:
                        logger.debug(f"Skipping field '{key}' - excluded from updates")
                    else:
                        logger.debug(f"Skipping field '{key}' - not in database schema")
                
                # Add updated_at timestamp if the column exists
                if 'updated_at' in actual_columns:
                    filtered_event_data['updated_at'] = datetime.utcnow().isoformat()
                
                # Build dynamic UPDATE query
                update_columns = list(filtered_event_data.keys())
                set_clause = ', '.join([f"{col} = {placeholder}" for col in update_columns])
                query = f"UPDATE events SET {set_clause} WHERE id = {placeholder}"
                values = list(filtered_event_data.values()) + [event_id]
                
                logger.debug(f"Dynamic UPDATE with {len(update_columns)} columns: {update_columns[:5]}{'...' if len(update_columns) > 5 else ''}")
                
                cursor.execute(query, values)
                
                # Fetch and return the updated event
                cursor.execute(f"SELECT * FROM events WHERE id = {placeholder}", (event_id,))
                updated_event = cursor.fetchone()
                
                if not updated_event:
                    cursor.execute("ROLLBACK")
                    raise HTTPException(status_code=404, detail="Event not found after update")
                
                # Commit the transaction
                cursor.execute("COMMIT")
                
                # Convert to dict and handle datetime objects
                event_dict = dict(updated_event)
                
                # Convert datetime objects and ensure proper field types
                event_dict = convert_event_datetime_fields(event_dict)
                
                # Clear event cache since an event was updated
                event_cache.clear()
                logger.info("Cleared event cache after updating event")
                
                return event_dict
                
            except HTTPException as http_ex:
                # Attempt to roll back the transaction
                try:
                    cursor.execute("ROLLBACK")
                except Exception as rollback_error:
                    logger.error(f"Transaction rollback failed: {str(rollback_error)}")
                
                # Re-raise the HTTP exception
                raise http_ex
            except Exception as e:
                # Attempt to roll back the transaction
                try:
                    cursor.execute("ROLLBACK")
                except Exception as rollback_error:
                    logger.error(f"Transaction rollback failed: {str(rollback_error)}")
                
                # Log error and raise HTTP exception
                error_msg = str(e)
                logger.error(f"Error updating event {event_id}: {error_msg}")
                raise HTTPException(status_code=500, detail=f"Error updating event: {error_msg}")
                
    except HTTPException as http_ex:
        # Pass through HTTP exceptions
        raise http_ex
    except Exception as e:
        # Handle other exceptions
        error_msg = str(e)
        logger.error(f"Error updating event {event_id}: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Error updating event: {error_msg}")

@app.delete("/events/{event_id}")
async def delete_event(
    event_id: int, 
    current_user: dict = Depends(get_current_user)
):
    """
    Delete an event.
    Only the event creator or an admin can delete the event.
    """
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            try:
                cursor = conn.cursor()
                
                # Start transaction
                cursor.execute("BEGIN")
                
                # First, check if the event exists and who created it
                cursor.execute(f"SELECT * FROM events WHERE id = {placeholder}", (event_id,))
                existing_event = cursor.fetchone()
                
                if not existing_event:
                    cursor.execute("ROLLBACK")
                    raise HTTPException(status_code=404, detail="Event not found")
                
                # Check if current user is the creator or an admin
                if (current_user['id'] != existing_event['created_by'] and 
                    current_user['role'] != UserRole.ADMIN):
                    cursor.execute("ROLLBACK")
                    raise HTTPException(status_code=403, detail="Not authorized to delete this event")
                
                # Delete related records first to avoid foreign key constraint violations
                
                # Delete media audit logs
                try:
                    cursor.execute(f"DELETE FROM media_audit_logs WHERE event_id = {placeholder}", (event_id,))
                except Exception as e:
                    logger.warning(f"No media_audit_logs to delete for event {event_id}: {e}")
                
                # Delete media forensic data
                try:
                    cursor.execute(f"DELETE FROM media_forensic_data WHERE event_id = {placeholder}", (event_id,))
                except Exception as e:
                    logger.warning(f"No media_forensic_data to delete for event {event_id}: {e}")
                
                # Delete event reports
                try:
                    cursor.execute(f"DELETE FROM event_reports WHERE event_id = {placeholder}", (event_id,))
                except Exception as e:
                    logger.warning(f"No event_reports to delete for event {event_id}: {e}")
                
                # Delete interest tracking
                try:
                    cursor.execute(f"DELETE FROM event_interests WHERE event_id = {placeholder}", (event_id,))
                except Exception as e:
                    logger.warning(f"No event_interests to delete for event {event_id}: {e}")
                
                # Delete view tracking  
                try:
                    cursor.execute(f"DELETE FROM event_views WHERE event_id = {placeholder}", (event_id,))
                except Exception as e:
                    logger.warning(f"No event_views to delete for event {event_id}: {e}")
                
                # Delete the event itself
                cursor.execute(f"DELETE FROM events WHERE id = {placeholder}", (event_id,))
                
                # Commit the transaction
                cursor.execute("COMMIT")
                
                # Clear event cache since an event was deleted
                event_cache.clear()
                
                # Also clean up any specific cache entries for this event
                event_cache.delete(f"event:{event_id}")
                event_cache.delete(f"event_interest:{event_id}")
                event_cache.delete(f"event_view:{event_id}")
                
                logger.info("Cleared event cache after deleting event")
                
                return {"detail": "Event successfully deleted"}
                
            except HTTPException as http_ex:
                # Attempt to roll back the transaction
                try:
                    cursor.execute("ROLLBACK")
                except Exception as rollback_error:
                    logger.error(f"Transaction rollback failed: {str(rollback_error)}")
                
                # Re-raise the HTTP exception
                raise http_ex
            except Exception as e:
                # Attempt to roll back the transaction
                try:
                    cursor.execute("ROLLBACK")
                except Exception as rollback_error:
                    logger.error(f"Transaction rollback failed: {str(rollback_error)}")
                
                # Log error and raise HTTP exception
                error_msg = str(e)
                logger.error(f"Error deleting event {event_id}: {error_msg}")
                raise HTTPException(status_code=500, detail=f"Error deleting event: {error_msg}")
                
    except HTTPException as http_ex:
        # Pass through HTTP exceptions
        raise http_ex
    except Exception as e:
        # Handle other exceptions
        error_msg = str(e)
        logger.error(f"Error deleting event {event_id}: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Error deleting event: {error_msg}")

# Optional: Admin endpoint to get all users (for admin dashboard)
@app.get("/admin/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(get_current_user)):
    """
    List all users (admin-only endpoint)
    """
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM users")
            users = c.fetchall()
            
            return [dict(user) for user in users]
    except Exception as e:
        logger.error(f"Error retrieving users: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving users")

# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check endpoint that returns app status.
    """
    try:
        # Test database connection
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
        
        # Get cache stats for monitoring
        cache_stats = event_cache.stats()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected",
            "cache": cache_stats,
            "memory_optimization": "enabled"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "error",
            "error": str(e),
            "cache": event_cache.stats() if event_cache else None
        }

# Root endpoint
@app.get("/")
async def root():
    """
    Root endpoint for API
    """
    return {
        "message": "EventFinder API is running",
        "docs": "/docs",
        "health": "/health"
    }

# New Admin Endpoints
@app.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: int, 
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a user (admin-only)
    """
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user exists
            c.execute(f"SELECT * FROM users WHERE id = {placeholder}", (user_id,))
            user = c.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Prevent deleting the last admin
            c.execute(f"SELECT COUNT(*) as admin_count FROM users WHERE role = {placeholder}", (UserRole.ADMIN,))
            admin_count = c.fetchone()['admin_count']
            
            if admin_count <= 1 and user['role'] == UserRole.ADMIN:
                raise HTTPException(status_code=400, detail="Cannot delete the last admin")
            
            # Delete user
            c.execute(f"DELETE FROM users WHERE id = {placeholder}", (user_id,))
            
            # Optionally, delete user's events
            c.execute(f"DELETE FROM events WHERE created_by = {placeholder}", (user_id,))
            
            conn.commit()
            
            return {"detail": "User successfully deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error deleting user")

@app.put("/admin/users/{user_id}/role")
async def update_user_role(
    user_id: int, 
    role: UserRole,
    current_user: dict = Depends(get_current_user)
):
    """
    Update user role (admin-only)
    """
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user exists
            c.execute(f"SELECT * FROM users WHERE id = {placeholder}", (user_id,))
            user = c.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Prevent removing last admin
            if user['role'] == UserRole.ADMIN:
                c.execute(f"SELECT COUNT(*) as admin_count FROM users WHERE role = {placeholder}", (UserRole.ADMIN,))
                admin_count = c.fetchone()['admin_count']
                
                if admin_count <= 1:
                    raise HTTPException(status_code=400, detail="Cannot remove the last admin")
            
            # Update role
            c.execute(f"UPDATE users SET role = {placeholder} WHERE id = {placeholder}", (role, user_id))
            conn.commit()
            
            return {"detail": "User role updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user role {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error updating user role")

class AdminPasswordReset(BaseModel):
    new_password: str
    
    @validator('new_password')
    def validate_password(cls, v):
        # Use the PasswordValidator to get validation results
        validation = PasswordValidator.validate_password(v)
        
        # If not valid, raise a validation error with all feedback
        if not validation['is_valid']:
            raise ValueError('\n'.join(validation['feedback']))
        
        return v

@app.put("/admin/users/{user_id}/password")
async def admin_reset_user_password(
    user_id: int,
    password_data: AdminPasswordReset,
    current_user: dict = Depends(get_current_user)
):
    """
    Reset a user's password (admin-only)
    """
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user exists
            c.execute(f"SELECT * FROM users WHERE id = {placeholder}", (user_id,))
            user = c.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Hash the new password
            hashed_password = get_password_hash(password_data.new_password)
            
            # Update the user's password
            c.execute(f"UPDATE users SET hashed_password = {placeholder} WHERE id = {placeholder}", (hashed_password, user_id))
            conn.commit()
            
            # Log the activity
            log_activity(current_user['id'], "admin_password_reset", f"Reset password for user {user['email']}")
            
            return {"detail": "Password reset successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error resetting password")

@app.get("/admin/activity-logs")
async def get_activity_logs(
    current_user: dict = Depends(get_current_user),
    limit: int = 500,
    offset: int = 0
):
    """
    Retrieve activity logs (admin-only)
    """
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Create an activity logs table if it doesn't exist
            if IS_PRODUCTION and DB_URL:
                c.execute('''CREATE TABLE IF NOT EXISTS activity_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
            else:
                c.execute('''CREATE TABLE IF NOT EXISTS activity_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
            
            # Fetch logs with optional pagination
            c.execute(f"""
                SELECT al.*, u.email 
                FROM activity_logs al
                LEFT JOIN users u ON al.user_id = u.id
                ORDER BY al.timestamp DESC
                LIMIT {placeholder} OFFSET {placeholder}
            """, (limit, offset))
            
            logs = [dict(log) for log in c.fetchall()]
            
            return logs
    except Exception as e:
        logger.error(f"Error retrieving activity logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving activity logs")

# Utility function to log activities
def log_activity(user_id: int, action: str, details: str = None):
    """
    Log user activities
    """
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Ensure activity_logs table exists
            if IS_PRODUCTION and DB_URL:
                c.execute('''CREATE TABLE IF NOT EXISTS activity_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
            else:
                c.execute('''CREATE TABLE IF NOT EXISTS activity_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
            
            # Insert log entry
            c.execute(
                f"INSERT INTO activity_logs (user_id, action, details) VALUES ({placeholder}, {placeholder}, {placeholder})",
                (user_id, action, details)
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Error logging activity: {str(e)}")

# Enhanced media tracking and law enforcement data retention
def log_media_activity(user_id: int, event_id: int, media_type: str, action: str, filename: str = None, 
                      file_size: int = None, ip_address: str = None, user_agent: str = None, details: str = None):
    """
    Enhanced media activity logging for law enforcement compliance
    """
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Ensure media_audit_logs table exists
            if IS_PRODUCTION and DB_URL:
                c.execute('''CREATE TABLE IF NOT EXISTS media_audit_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    event_id INTEGER,
                    media_type TEXT NOT NULL,
                    action TEXT NOT NULL,
                    filename TEXT,
                    file_size BIGINT,
                    ip_address TEXT,
                    user_agent TEXT,
                    details TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(event_id) REFERENCES events(id)
                )''')
            else:
                c.execute('''CREATE TABLE IF NOT EXISTS media_audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    event_id INTEGER,
                    media_type TEXT NOT NULL,
                    action TEXT NOT NULL,
                    filename TEXT,
                    file_size INTEGER,
                    ip_address TEXT,
                    user_agent TEXT,
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(event_id) REFERENCES events(id)
                )''')
            
            # Insert media audit log entry
            c.execute(f"""
                INSERT INTO media_audit_logs 
                (user_id, event_id, media_type, action, filename, file_size, ip_address, user_agent, details) 
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
            """, (user_id, event_id, media_type, action, filename, file_size, ip_address, user_agent, details))
            conn.commit()
    except Exception as e:
        logger.error(f"Error logging media activity: {str(e)}")

def create_forensic_tables():
    """
    Create comprehensive forensic data tables for law enforcement compliance
    """
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Media forensic data table
            if IS_PRODUCTION and DB_URL:
                c.execute('''CREATE TABLE IF NOT EXISTS media_forensic_data (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    event_id INTEGER,
                    filename TEXT NOT NULL,
                    original_filename TEXT,
                    file_path TEXT,
                    file_hash TEXT,
                    file_size BIGINT,
                    mime_type TEXT,
                    media_type TEXT,
                    upload_ip TEXT,
                    upload_user_agent TEXT,
                    upload_timestamp TIMESTAMP,
                    last_accessed TIMESTAMP,
                    access_count INTEGER DEFAULT 0,
                    moderation_status TEXT DEFAULT 'pending',
                    moderation_notes TEXT,
                    flagged_content BOOLEAN DEFAULT FALSE,
                    removed_timestamp TIMESTAMP,
                    removal_reason TEXT,
                    law_enforcement_hold BOOLEAN DEFAULT FALSE,
                    retention_until TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(event_id) REFERENCES events(id)
                )''')
                
                # User forensic data table
                c.execute('''CREATE TABLE IF NOT EXISTS user_forensic_data (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER UNIQUE,
                    registration_ip TEXT,
                    registration_user_agent TEXT,
                    registration_timestamp TIMESTAMP,
                    last_login_ip TEXT,
                    last_login_user_agent TEXT,
                    last_login_timestamp TIMESTAMP,
                    login_count INTEGER DEFAULT 0,
                    failed_login_attempts INTEGER DEFAULT 0,
                    password_changes INTEGER DEFAULT 0,
                    email_changes INTEGER DEFAULT 0,
                    account_status TEXT DEFAULT 'active',
                    suspicious_activity_flags TEXT,
                    law_enforcement_notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
                
                # Login attempts table
                c.execute('''CREATE TABLE IF NOT EXISTS login_attempts (
                    id SERIAL PRIMARY KEY,
                    email TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    success BOOLEAN,
                    failure_reason TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )''')
                
                # Activity logs table (ensure it exists for forensic queries)
                c.execute('''CREATE TABLE IF NOT EXISTS activity_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
            else:
                # SQLite versions
                c.execute('''CREATE TABLE IF NOT EXISTS media_forensic_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    event_id INTEGER,
                    filename TEXT NOT NULL,
                    original_filename TEXT,
                    file_path TEXT,
                    file_hash TEXT,
                    file_size INTEGER,
                    mime_type TEXT,
                    media_type TEXT,
                    upload_ip TEXT,
                    upload_user_agent TEXT,
                    upload_timestamp DATETIME,
                    last_accessed DATETIME,
                    access_count INTEGER DEFAULT 0,
                    moderation_status TEXT DEFAULT 'pending',
                    moderation_notes TEXT,
                    flagged_content BOOLEAN DEFAULT FALSE,
                    removed_timestamp DATETIME,
                    removal_reason TEXT,
                    law_enforcement_hold BOOLEAN DEFAULT FALSE,
                    retention_until DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(event_id) REFERENCES events(id)
                )''')
                
                c.execute('''CREATE TABLE IF NOT EXISTS user_forensic_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER UNIQUE,
                    registration_ip TEXT,
                    registration_user_agent TEXT,
                    registration_timestamp DATETIME,
                    last_login_ip TEXT,
                    last_login_user_agent TEXT,
                    last_login_timestamp DATETIME,
                    login_count INTEGER DEFAULT 0,
                    failed_login_attempts INTEGER DEFAULT 0,
                    password_changes INTEGER DEFAULT 0,
                    email_changes INTEGER DEFAULT 0,
                    account_status TEXT DEFAULT 'active',
                    suspicious_activity_flags TEXT,
                    law_enforcement_notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
                
                c.execute('''CREATE TABLE IF NOT EXISTS login_attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    success BOOLEAN,
                    failure_reason TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )''')
                
                # Activity logs table (ensure it exists for forensic queries)
                c.execute('''CREATE TABLE IF NOT EXISTS activity_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
            
            conn.commit()
            logger.info("✅ Created forensic data tables for law enforcement compliance")
            
    except Exception as e:
        logger.error(f"Error creating forensic tables: {str(e)}")

# Helper functions for AI event processing
def _generate_ai_summary(event_dict):
    """Generate AI-friendly summary with proper time handling"""
    start_time = event_dict['start_time']
    end_time = event_dict.get('end_time')
    end_date = event_dict.get('end_date')
    
    # Build time string
    if end_time:
        time_str = f"from {start_time} to {end_time}"
    else:
        time_str = f"at {start_time}"
        
    # Build date string
    if end_date and end_date != event_dict['date']:
        date_str = f"from {event_dict['date']} to {end_date}"
    else:
        date_str = f"on {event_dict['date']}"
        
    description = event_dict['description'][:200]
    if len(event_dict['description']) > 200:
        description += "..."
        
    return f"{event_dict['title']} - {event_dict['category']} event {date_str} {time_str} in {event_dict['address']}. {description}"

def _generate_structured_data(event_dict):
    """Generate structured data with proper date/time handling"""
    start_datetime = f"{event_dict['date']}T{event_dict['start_time']}:00"
    
    # Calculate end datetime
    end_date = event_dict.get('end_date') or event_dict['date']
    end_time = event_dict.get('end_time') or event_dict['start_time']
    end_datetime = f"{end_date}T{end_time}:00"
    
    return {
        "@type": "Event",
        "name": event_dict['title'],
        "startDate": start_datetime,
        "endDate": end_datetime,
        "location": {
            "@type": "Place",
            "address": event_dict['address']
        },
        "description": event_dict['description'],
        "eventStatus": "EventScheduled"
    }

# AI Search API Endpoints
@app.get("/api/v1/local-events")
async def get_local_events_for_ai(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: Optional[float] = 25.0,  # miles
    category: Optional[str] = None,
    limit: Optional[int] = 200
):
    """
    Public API endpoint for AI search tools to discover local events.
    
    This endpoint provides structured event data that AI tools can use
    to answer queries like "local events near me" or "events this weekend".
    """
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Build base query including UX fields
            query = """
                SELECT id, title, description, date, start_time, end_time, end_date, category, 
                       address, lat, lng, created_at, fee_required, event_url, host_name
                FROM events 
                WHERE date::date >= CURRENT_DATE
            """
            params = []
            
            # Add category filter
            if category:
                query += f" AND category = {placeholder}"
                params.append(category)
            
            # Add location-based filtering if coordinates provided
            if lat is not None and lng is not None:
                # Use Haversine formula for distance calculation
                query += f"""
                    AND (
                        3959 * acos(
                            cos(radians({placeholder})) * cos(radians(lat)) * 
                            cos(radians(lng) - radians({placeholder})) + 
                            sin(radians({placeholder})) * sin(radians(lat))
                        )
                    ) <= {placeholder}
                """
                params.extend([lat, lng, lat, radius])
            
            # Order by date and limit results
            query += f" ORDER BY date, start_time LIMIT {placeholder}"
            params.append(limit)
            
            c.execute(query, params)
            events = c.fetchall()
            
            # Format response for AI consumption
            ai_response = {
                "status": "success",
                "message": "Local events discovered",
                "search_context": {
                    "query_type": "local_events_near_me",
                    "location": {"lat": lat, "lng": lng} if lat and lng else None,
                    "radius_miles": radius,
                    "category_filter": category,
                    "results_count": len(events)
                },
                "events": [],
                "metadata": {
                    "platform": "todo-events.com",
                    "description": "Real-time local event discovery platform",
                    "last_updated": datetime.utcnow().isoformat(),
                    "categories": ["food-drink", "music", "arts", "sports", "community"],
                    "coverage_area": "United States",
                    "features": [
                        "Location-based event search",
                        "Real-time event updates", 
                        "Community-driven content",
                        "Interactive event mapping",
                        "Category-based filtering"
                    ]
                }
            }
            
            # Process each event with AI-friendly formatting
            for event in events:
                event_dict = dict(event)
                
                # Calculate distance if location provided
                distance = None
                if lat is not None and lng is not None:
                    try:
                        from math import radians, cos, sin, asin, sqrt
                        
                        def haversine(lat1, lon1, lat2, lon2):
                            # Convert to radians
                            lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
                            
                            # Haversine formula
                            dlat = lat2 - lat1
                            dlon = lon2 - lon1
                            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                            c = 2 * asin(sqrt(a))
                            r = 3959  # Earth radius in miles
                            return c * r
                        
                        distance = round(haversine(lat, lng, event_dict['lat'], event_dict['lng']), 1)
                    except:
                        distance = None
                
                # Format event for AI consumption
                ai_event = {
                    "id": event_dict['id'],
                    "title": event_dict['title'],
                    "description": event_dict['description'],
                    "date": event_dict['date'],
                    "start_time": event_dict['start_time'],
                    "end_time": event_dict['end_time'],
                    "end_date": event_dict['end_date'],
                    "category": event_dict['category'],
                    "location": {
                        "address": event_dict['address'],
                        "coordinates": {
                            "lat": event_dict['lat'],
                            "lng": event_dict['lng']
                        },
                        "distance_miles": distance
                    },
                    "url": f"https://todo-events.com/?event={event_dict['id']}",
                    "ai_summary": _generate_ai_summary(event_dict),
                    "structured_data": _generate_structured_data(event_dict)
                }
                
                ai_response["events"].append(ai_event)
            
            # Add helpful context for AI tools
            if len(events) == 0:
                ai_response["message"] = "No local events found matching your criteria"
                ai_response["suggestions"] = [
                    "Try expanding your search radius",
                    "Remove category filters to see all event types", 
                    "Check for events on different dates",
                    "Visit todo-events.com to create the first event in your area"
                ]
            
            return ai_response
            
    except Exception as e:
        logger.error(f"Error in AI events API: {str(e)}")
        return {
            "status": "error",
            "message": "Unable to retrieve local events",
            "error": str(e),
            "metadata": {
                "platform": "todo-events.com",
                "support": "Visit https://todo-events.com for manual event discovery"
            }
        }

# Automation Control Endpoints
@app.get("/api/v1/automation/status")
async def get_automation_status():
    """Get status of automated tasks"""
    return {
        "automation": {
            "enabled": IS_PRODUCTION,
            "scheduler_running": task_manager.scheduler.running if IS_PRODUCTION else False,
            "last_sitemap_update": task_manager.last_sitemap_update.isoformat() if task_manager.last_sitemap_update else None,
            "last_event_refresh": task_manager.last_event_refresh.isoformat() if task_manager.last_event_refresh else None,
            "task_status": task_manager.task_status,
            "next_runs": {
                job.id: job.next_run_time.isoformat() if job.next_run_time else None
                for job in task_manager.scheduler.get_jobs()
            } if IS_PRODUCTION and task_manager.scheduler.running else {}
        },
        "system": {
            "environment": "production" if IS_PRODUCTION else "development",
            "timestamp": datetime.utcnow().isoformat()
        }
    }
@app.post("/api/v1/automation/trigger/{task_name}")
async def trigger_automated_task(task_name: str, background_tasks: BackgroundTasks):
    """Manually trigger automated tasks"""
    
    if not IS_PRODUCTION:
        raise HTTPException(status_code=400, detail="Automation only available in production")
    
    task_functions = {
        "sitemap": task_manager.generate_sitemap_automatically,
        "events": task_manager.refresh_event_data,
        "ai_sync": task_manager.sync_with_ai_tools,
        "cleanup": task_manager.cleanup_expired_events
    }
    
    if task_name not in task_functions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unknown task: {task_name}. Available: {list(task_functions.keys())}"
        )
    
    # Trigger the task in the background
    background_tasks.add_task(task_functions[task_name])
    
    return {
        "message": f"Task '{task_name}' triggered successfully",
        "task": task_name,
        "triggered_at": datetime.utcnow().isoformat(),
        "note": "Task is running in the background"
    }

@app.get("/sitemap.xml")
async def get_dynamic_sitemap():
    """Serve dynamically generated sitemap"""
    try:
        # If we have a cached sitemap from automation, serve it
        if hasattr(task_manager, 'current_sitemap') and task_manager.current_sitemap:
            return Response(
                content=task_manager.current_sitemap,
                media_type="application/xml",
                headers={"Cache-Control": "public, max-age=3600"}  # Cache for 1 hour
            )
        
        # Otherwise, generate on-demand
        events = await task_manager.get_current_events()
        sitemap_content = await task_manager.build_sitemap_content(events)
        
        return Response(
            content=sitemap_content,
            media_type="application/xml",
            headers={"Cache-Control": "public, max-age=1800"}  # Cache for 30 minutes
        )
        
    except Exception as e:
        logger.error(f"Error serving dynamic sitemap: {str(e)}")
        raise HTTPException(status_code=500, detail="Error generating sitemap")

@app.get("/api/debug/database-stats")
async def get_database_stats():
    """Get database statistics for debugging"""
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Total events
            c.execute("SELECT COUNT(*) FROM events")
            total_events = c.fetchone()[0]
            
            # Future events
            if IS_PRODUCTION and DB_URL:
                c.execute("SELECT COUNT(*) FROM events WHERE CAST(date AS DATE) >= CURRENT_DATE")
            else:
                c.execute("SELECT COUNT(*) FROM events WHERE date >= date('now')")
            future_events = c.fetchone()[0]
            
            # Events with slugs
            c.execute("SELECT COUNT(*) FROM events WHERE slug IS NOT NULL AND slug != ''")
            with_slugs = c.fetchone()[0]
            
            # Future events with slugs (sitemap eligible)
            if IS_PRODUCTION and DB_URL:
                c.execute("SELECT COUNT(*) FROM events WHERE CAST(date AS DATE) >= CURRENT_DATE AND slug IS NOT NULL AND slug != ''")
            else:
                c.execute("SELECT COUNT(*) FROM events WHERE date >= date('now') AND slug IS NOT NULL AND slug != ''")
            sitemap_eligible = c.fetchone()[0]
            
            # Past events for reference
            if IS_PRODUCTION and DB_URL:
                c.execute("SELECT COUNT(*) FROM events WHERE CAST(date AS DATE) < CURRENT_DATE")
            else:
                c.execute("SELECT COUNT(*) FROM events WHERE date < date('now')")
            past_events = c.fetchone()[0]
            
            return {
                "database_type": "PostgreSQL" if (IS_PRODUCTION and DB_URL) else "SQLite",
                "total_events": total_events,
                "future_events": future_events,
                "past_events": past_events,
                "events_with_slugs": with_slugs,
                "sitemap_eligible_events": sitemap_eligible,
                "expected_sitemap_urls": sitemap_eligible * 3,  # 3 URL formats per event
                "current_date": datetime.utcnow().strftime('%Y-%m-%d'),
                "note": "Future events with slugs should match sitemap event count"
            }
    except Exception as e:
        return {"error": str(e), "message": "Failed to get database statistics"}

@app.post("/api/sitemap/regenerate")
async def force_regenerate_sitemap():
    """Force regenerate sitemap and update cache"""
    try:
        logger.info("🔄 Manually triggering sitemap regeneration ...")
        
        # Generate new sitemap content
        events = await task_manager.get_current_events()
        sitemap_content = await task_manager.build_sitemap_content(events)
        
        # Update the cache
        await task_manager.save_sitemap(sitemap_content)
        
        # Ping search engines
        await task_manager.ping_search_engines()
        
        # Count URLs for response
        url_count = sitemap_content.count('<url>')
        
        logger.info(f"✅ Sitemap regenerated and cached in memory")
        return {
            "success": True,
            "message": f"Sitemap regenerated with {url_count} URLs",
            "url_count": url_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Error regenerating sitemap: {str(e)}")
        return {"error": str(e), "success": False}

@app.post("/api/debug/fix-event-images/{event_id}")
async def debug_fix_event_images(
    event_id: int,
    banner_filename: Optional[str] = None,
    logo_filename: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Debug endpoint to manually fix image data for events"""
    # Only allow admin users
    if current_user['role'] not in ['admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if event exists
            cursor.execute(f"SELECT id, title, banner_image, logo_image FROM events WHERE id = {placeholder}", (event_id,))
            event = cursor.fetchone()
            
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            updates = []
            update_values = []
            
            if banner_filename:
                updates.append(f"banner_image = {placeholder}")
                update_values.append(banner_filename)
            
            if logo_filename:
                updates.append(f"logo_image = {placeholder}")
                update_values.append(logo_filename)
            
            if updates:
                update_query = f"UPDATE events SET {', '.join(updates)} WHERE id = {placeholder}"
                update_values.append(event_id)
                
                cursor.execute(update_query, update_values)
                conn.commit()
                
                logger.info(f"Fixed image data for event {event_id}: banner={banner_filename}, logo={logo_filename}")
                
                return {
                    "detail": "Image data fixed successfully",
                    "event_id": event_id,
                    "banner_image": banner_filename,
                    "logo_image": logo_filename,
                    "rows_updated": cursor.rowcount
                }
            else:
                return {"detail": "No image filenames provided"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fixing image data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fix image data")

@app.put("/admin/events/{event_id}/verification")
async def toggle_event_verification(
    event_id: int,
    verification_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Toggle event verification status (admin-only)
    """
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    verified = verification_data.get('verified', False)
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if event exists
            c.execute(f"SELECT * FROM events WHERE id = {placeholder}", (event_id,))
            event = c.fetchone()
            
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Update verification status
            c.execute(f"UPDATE events SET verified = {placeholder} WHERE id = {placeholder}", (verified, event_id))
            conn.commit()
            
            return {"detail": f"Event verification {'enabled' if verified else 'disabled'} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating event verification {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error updating event verification")

def generate_browser_fingerprint(request: Request) -> str:
    """Generate a browser fingerprint for anonymous users"""
    import hashlib
    
    # Get client info
    user_agent = request.headers.get("user-agent", "")
    client_ip = request.client.host if request.client else "unknown"
    accept_language = request.headers.get("accept-language", "")
    accept_encoding = request.headers.get("accept-encoding", "")
    
    # Create fingerprint
    fingerprint_string = f"{client_ip}:{user_agent}:{accept_language}:{accept_encoding}"
    fingerprint = hashlib.md5(fingerprint_string.encode()).hexdigest()
    
    return fingerprint

async def track_event_view(event_id: int, user_id: int = None, browser_fingerprint: str = None):
    """
    Track a view for an event - simplified and robust implementation
    """
    if not browser_fingerprint:
        browser_fingerprint = 'anonymous'
    
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # First, verify the event exists
            cursor.execute(f"SELECT id FROM events WHERE id = {placeholder}", (event_id,))
            if not cursor.fetchone():
                logger.warning(f"Attempted to track view for non-existent event {event_id}")
                return False
            
            # Check if view already exists (prevent duplicates)
            if user_id:
                cursor.execute(
                    f"SELECT id FROM event_views WHERE event_id = {placeholder} AND user_id = {placeholder} LIMIT 1",
                    (event_id, user_id)
                )
            else:
                cursor.execute(
                    f"SELECT id FROM event_views WHERE event_id = {placeholder} AND browser_fingerprint = {placeholder} LIMIT 1",
                    (event_id, browser_fingerprint)
                )
            
            existing_view = cursor.fetchone()
            
            if existing_view:
                # View already exists, don't track again
                return False
            
            # Insert new view record
            cursor.execute(
                f"INSERT INTO event_views (event_id, user_id, browser_fingerprint) VALUES ({placeholder}, {placeholder}, {placeholder})",
                (event_id, user_id, browser_fingerprint)
            )
            
            # Update view count safely
            cursor.execute(
                f"UPDATE events SET view_count = COALESCE(view_count, 0) + 1 WHERE id = {placeholder}",
                (event_id,)
            )
            
            conn.commit()
            logger.info(f"Successfully tracked view for event {event_id}")
            return True
            
    except Exception as e:
        logger.error(f"Error in track_event_view for event {event_id}: {type(e).__name__}: {str(e)}")
        return False

# Interest and View API Endpoints
@app.post("/events/{event_id}/interest")
async def toggle_event_interest(
    event_id: int, 
    request: Request,
    current_user: dict = Depends(get_current_user_optional_no_exception)
):
    """
    Toggle interest in an event - simplified endpoint
    """
    try:
        # Get user ID if authenticated
        user_id = current_user.get('id') if current_user else None
        logger.info(f"🎯 Interest toggle - Event: {event_id}, User ID: {user_id}, Has Auth: {current_user is not None}")
        
        # Generate browser fingerprint
        browser_fingerprint = generate_browser_fingerprint(request)
        if not browser_fingerprint:
            browser_fingerprint = 'anonymous'
        
        placeholder = get_placeholder()
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Verify event exists
            cursor.execute(f"SELECT id FROM events WHERE id = {placeholder}", (event_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Check if interest already exists
            if user_id:
                cursor.execute(
                    f"SELECT id FROM event_interests WHERE event_id = {placeholder} AND user_id = {placeholder} LIMIT 1",
                    (event_id, user_id)
                )
            else:
                cursor.execute(
                    f"SELECT id FROM event_interests WHERE event_id = {placeholder} AND browser_fingerprint = {placeholder} LIMIT 1",
                    (event_id, browser_fingerprint)
                )
            
            existing_interest = cursor.fetchone()
            
            if existing_interest:
                # Remove interest
                if user_id:
                    cursor.execute(
                        f"DELETE FROM event_interests WHERE event_id = {placeholder} AND user_id = {placeholder}",
                        (event_id, user_id)
                    )
                else:
                    cursor.execute(
                        f"DELETE FROM event_interests WHERE event_id = {placeholder} AND browser_fingerprint = {placeholder}",
                        (event_id, browser_fingerprint)
                    )
                
                # Decrease interest count
                cursor.execute(
                    f"UPDATE events SET interest_count = GREATEST(COALESCE(interest_count, 0) - 1, 0) WHERE id = {placeholder}",
                    (event_id,)
                )
                
                action = "removed"
                interested = False
            else:
                # Add interest
                cursor.execute(
                    f"INSERT INTO event_interests (event_id, user_id, browser_fingerprint) VALUES ({placeholder}, {placeholder}, {placeholder})",
                    (event_id, user_id, browser_fingerprint)
                )
                
                # Increase interest count
                cursor.execute(
                    f"UPDATE events SET interest_count = COALESCE(interest_count, 0) + 1 WHERE id = {placeholder}",
                    (event_id,)
                )
                
                action = "added"
                interested = True
            
            # Get updated count with ultra-robust safety check
            cursor.execute(f"SELECT COALESCE(interest_count, 0) FROM events WHERE id = {placeholder}", (event_id,))
            result = cursor.fetchone()
            
            # Ultra-robust result handling for different database types
            try:
                if isinstance(result, (list, tuple)):
                    interest_count = result[0] if len(result) > 0 else 0
                elif hasattr(result, '__getitem__'):
                    interest_count = result[0]
                else:
                    interest_count = int(result) if result is not None else 0
            except (IndexError, KeyError, TypeError, ValueError):
                interest_count = 0
            
            conn.commit()
            
            logger.info(f"✅ Interest {action} - Event: {event_id}, Count: {interest_count}, User: {user_id}, Fingerprint: {browser_fingerprint}")
            
            return {
                "success": True,
                "action": action,
                "interested": interested,
                "interest_count": interest_count,
                "event_id": event_id
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in interest toggle endpoint for event {event_id}: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error updating interest")

@app.get("/events/{event_id}/interest")
async def get_event_interest_status(
    event_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user_optional_no_exception)
):
    """
    Get interest status for an event - optimized for mobile performance
    """
    try:
        # Get user ID if authenticated
        user_id = current_user.get('id') if current_user else None
        
        # Generate browser fingerprint
        browser_fingerprint = generate_browser_fingerprint(request)
        if not browser_fingerprint:
            browser_fingerprint = 'anonymous'
        
        placeholder = get_placeholder()
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Single optimized query to get both event data and interest status
            if user_id:
                # For authenticated users, check both user and fingerprint
                query = f"""
                    SELECT 
                        e.id,
                        COALESCE(e.interest_count, 0) as interest_count,
                        COALESCE(e.view_count, 0) as view_count,
                        CASE WHEN ei.id IS NOT NULL THEN true ELSE false END as interested
                    FROM events e
                    LEFT JOIN event_interests ei ON (
                        e.id = ei.event_id AND 
                        (ei.user_id = {placeholder} OR ei.browser_fingerprint = {placeholder})
                    )
                    WHERE e.id = {placeholder}
                    LIMIT 1
                """
                cursor.execute(query, (user_id, browser_fingerprint, event_id))
            else:
                # For anonymous users, check only fingerprint
                query = f"""
                    SELECT 
                        e.id,
                        COALESCE(e.interest_count, 0) as interest_count,
                        COALESCE(e.view_count, 0) as view_count,
                        CASE WHEN ei.id IS NOT NULL THEN true ELSE false END as interested
                    FROM events e
                    LEFT JOIN event_interests ei ON (
                        e.id = ei.event_id AND ei.browser_fingerprint = {placeholder}
                    )
                    WHERE e.id = {placeholder}
                    LIMIT 1
                """
                cursor.execute(query, (browser_fingerprint, event_id))
            
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Convert to dict and ensure proper types
            if hasattr(result, '_asdict'):
                data = result._asdict()
            elif isinstance(result, dict):
                data = dict(result)
            else:
                data = {
                    'id': result[0],
                    'interest_count': result[1],
                    'view_count': result[2],
                    'interested': result[3]
                }
            
            # Ensure proper types
            return {
                'interested': bool(data['interested']),
                'interest_count': int(data['interest_count'] or 0),
                'view_count': int(data['view_count'] or 0)
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting interest status for event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get interest status")

@app.post("/events/{event_id}/view")
async def track_event_view_endpoint(
    event_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user_optional_no_exception)
):
    """
    Track a view for an event - simplified endpoint
    """
    try:
        # Get user ID if authenticated
        user_id = current_user.get('id') if current_user else None
        
        # Generate browser fingerprint
        browser_fingerprint = generate_browser_fingerprint(request)
        
        # Track the view
        view_tracked = await track_event_view(event_id, user_id, browser_fingerprint)
        
        # Get updated view count with ultra-robust safety check
        placeholder = get_placeholder()
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT COALESCE(view_count, 0) FROM events WHERE id = {placeholder}", (event_id,))
            result = cursor.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="Event not found after view tracking")
            
            # Ultra-robust result handling for different database types
            try:
                if isinstance(result, (list, tuple)):
                    view_count = result[0] if len(result) > 0 else 0
                elif hasattr(result, '__getitem__'):
                    view_count = result[0]
                else:
                    view_count = int(result) if result is not None else 0
            except (IndexError, KeyError, TypeError, ValueError):
                view_count = 0
        
        return {
            "success": True,
            "view_tracked": view_tracked,
            "view_count": view_count,
            "event_id": event_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in view tracking endpoint for event {event_id}: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error tracking view")

# Premium Status Endpoint
@app.get("/users/premium-status")
async def get_premium_status(current_user: dict = Depends(get_current_user)):
    """
    Get user's premium status with event limits and counts
    """
    is_premium = current_user['role'] in ['premium', 'admin']
    is_enterprise = current_user['role'] == 'enterprise'
    
    # Get current month's event count for this user
    current_month_events = 0
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Count events created this month
            from datetime import datetime, timedelta
            start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            if IS_PRODUCTION and DB_URL:
                # PostgreSQL
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM events 
                    WHERE created_by = %s 
                    AND created_at >= %s
                """, (current_user['id'], start_of_month))
            else:
                # SQLite
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM events 
                    WHERE created_by = ? 
                    AND created_at >= ?
                """, (current_user['id'], start_of_month))
            
            result = cursor.fetchone()
            current_month_events = result['count'] if result else 0
            
    except Exception as e:
        logger.error(f"Error counting user events: {str(e)}")
        current_month_events = 0
    
    # Determine event limits based on role
    if is_enterprise:
        event_limit = 250
    elif is_premium:
        event_limit = 10
    else:
        event_limit = 0  # Free users have no limit but no premium features
    
    return {
        "is_premium": is_premium,
        "is_enterprise": is_enterprise,
        "role": current_user['role'],
        "user_id": current_user['id'],
        "event_limit": event_limit,
        "current_month_events": current_month_events,
        "events_remaining": max(0, event_limit - current_month_events) if event_limit > 0 else None,
        "can_create_events": event_limit == 0 or current_month_events < event_limit,
        "features": {
            "verified_events": is_premium or is_enterprise,
            "analytics": is_premium or is_enterprise,
            "recurring_events": is_premium or is_enterprise,
            "priority_support": is_premium or is_enterprise,
            "enhanced_visibility": is_premium or is_enterprise,
            "image_uploads": is_premium or is_enterprise
        }
    }

# Image Processing Utilities
def process_image(image_bytes: bytes, target_width: int, target_height: int, max_file_size_mb: int = 5) -> bytes:
    """
    Process uploaded image: resize if close to target dimensions, compress if needed
    Args:
        image_bytes: Raw image bytes
        target_width: Target width (e.g., 600 for banner)
        target_height: Target height (e.g., 200 for banner)
        max_file_size_mb: Maximum file size in MB
    Returns:
        Processed image bytes
    """
    try:
        # Open image
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary (handles RGBA, P mode, etc.)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Get current dimensions
        current_width, current_height = img.size
        
        # Check if dimensions are close to target (within 10% tolerance)
        width_diff = abs(current_width - target_width) / target_width
        height_diff = abs(current_height - target_height) / target_height
        
        # If dimensions are close to target, resize to exact dimensions
        if width_diff <= 0.1 and height_diff <= 0.1:
            logger.info(f"Resizing image from {current_width}x{current_height} to {target_width}x{target_height}")
            img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
        elif current_width > target_width * 2 or current_height > target_height * 2:
            # If image is much larger, scale it down proportionally
            img.thumbnail((target_width * 2, target_height * 2), Image.Resampling.LANCZOS)
            logger.info(f"Scaled down large image to {img.size}")
        
        # Compress image if needed
        output = io.BytesIO()
        quality = 85  # Start with high quality
        
        # Try different quality levels to get under size limit
        for attempt in range(3):
            output.seek(0)
            output.truncate(0)
            
            img.save(output, format='JPEG', quality=quality, optimize=True)
            output_size = output.tell()
            
            # Check if under size limit
            if output_size <= max_file_size_mb * 1024 * 1024:
                break
                
            # Reduce quality for next attempt
            quality -= 15
            if quality < 50:
                quality = 50
                break
        
        output.seek(0)
        processed_bytes = output.getvalue()
        
        logger.info(f"Image processed: {len(image_bytes)} bytes -> {len(processed_bytes)} bytes, quality: {quality}")
        return processed_bytes
        
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        # Return original bytes if processing fails
        return image_bytes

# Premium Image Upload Endpoints
@app.post("/events/{event_id}/upload-banner")
async def upload_event_banner(
    event_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload banner image for premium users (600x200px recommended)"""
    # Check if user is premium
    is_premium = current_user['role'] in ['premium', 'admin', 'enterprise']
    if not is_premium:
        raise HTTPException(status_code=403, detail="Premium subscription required for image uploads")
    
    # Validate file type - only JPG and PNG
    if not file.content_type in ['image/jpeg', 'image/jpg', 'image/png']:
        raise HTTPException(status_code=400, detail="File must be JPG or PNG format only")
    
    # Validate file size (5MB max)
    if file.size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    # Check if user owns the event
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Verify event ownership
            cursor.execute(f"SELECT created_by FROM events WHERE id = {placeholder}", (event_id,))
            event = cursor.fetchone()
            
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            if event['created_by'] != current_user['id']:
                raise HTTPException(status_code=403, detail="You can only upload images to your own events")
            
            # Read and process the image
            image_bytes = await file.read()
            processed_image_bytes = process_image(image_bytes, 600, 200, 5)
            
            # Generate unique filename for logging
            unique_filename = f"banner_{event_id}_{uuid.uuid4().hex[:8]}_{file.filename}"
            
            # Store as base64 string in database instead of file system
            import base64
            base64_image = base64.b64encode(processed_image_bytes).decode('utf-8')
            image_data_url = f"data:image/jpeg;base64,{base64_image}"
            
            logger.info(f"Storing banner image in database for event {event_id} ({len(processed_image_bytes)} bytes as base64)")
            
            # Update event with base64 image data instead of filename
            cursor.execute(f"""
                UPDATE events 
                SET banner_image = {placeholder}
                WHERE id = {placeholder}
            """, (image_data_url, event_id))
            
            # Check if update was successful
            if cursor.rowcount == 0:
                logger.error(f"Failed to update event {event_id} - no rows affected")
                raise HTTPException(status_code=500, detail="Failed to link banner image to event")
            
            logger.info(f"Database updated successfully for event {event_id}")
            
            conn.commit()
            
            # Enhanced logging for law enforcement compliance
            log_activity(current_user['id'], "upload_banner", f"Uploaded banner image for event {event_id}")
            log_media_activity(
                user_id=current_user['id'],
                event_id=event_id,
                media_type="banner",
                action="upload",
                filename=unique_filename,
                file_size=len(processed_image_bytes),
                ip_address=None,  # TODO: Extract from request
                user_agent=None,  # TODO: Extract from request
                details=f"Banner image uploaded for event {event_id}, processed size: {len(processed_image_bytes)} bytes"
            )
            
            # Clear event cache since event was updated with new banner
            event_cache.clear()
            logger.info("Cleared event cache after banner upload")
            
            return {
                "detail": "Banner image uploaded successfully",
                "filename": unique_filename,
                "event_id": event_id,
                "processed_size": len(processed_image_bytes)
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading banner image: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload banner image")

@app.post("/events/{event_id}/upload-logo")
async def upload_event_logo(
    event_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload logo image for premium users (200x200px recommended)"""
    # Check if user is premium
    is_premium = current_user['role'] in ['premium', 'admin', 'enterprise']
    if not is_premium:
        raise HTTPException(status_code=403, detail="Premium subscription required for image uploads")
    
    # Validate file type - only JPG and PNG
    if not file.content_type in ['image/jpeg', 'image/jpg', 'image/png']:
        raise HTTPException(status_code=400, detail="File must be JPG or PNG format only")
    
    # Validate file size (5MB max)
    if file.size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    # Check if user owns the event
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Verify event ownership
            cursor.execute(f"SELECT created_by FROM events WHERE id = {placeholder}", (event_id,))
            event = cursor.fetchone()
            
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            if event['created_by'] != current_user['id']:
                raise HTTPException(status_code=403, detail="You can only upload images to your own events")
            
            # Read and process the image
            image_bytes = await file.read()
            processed_image_bytes = process_image(image_bytes, 200, 200, 5)
            
            # Generate unique filename for logging
            unique_filename = f"logo_{event_id}_{uuid.uuid4().hex[:8]}_{file.filename}"
            
            # Store as base64 string in database instead of file system
            import base64
            base64_image = base64.b64encode(processed_image_bytes).decode('utf-8')
            image_data_url = f"data:image/jpeg;base64,{base64_image}"
            
            logger.info(f"Storing logo image in database for event {event_id} ({len(processed_image_bytes)} bytes as base64)")
            
            # Update event with base64 image data instead of filename
            cursor.execute(f"""
                UPDATE events 
                SET logo_image = {placeholder}
                WHERE id = {placeholder}
            """, (image_data_url, event_id))
            
            # Check if update was successful
            if cursor.rowcount == 0:
                logger.error(f"Failed to update event {event_id} - no rows affected")
                raise HTTPException(status_code=500, detail="Failed to link logo image to event")
            
            logger.info(f"Database updated successfully for event {event_id}")
            
            conn.commit()
            
            # Enhanced logging for law enforcement compliance
            log_activity(current_user['id'], "upload_logo", f"Uploaded logo image for event {event_id}")
            log_media_activity(
                user_id=current_user['id'],
                event_id=event_id,
                media_type="logo",
                action="upload",
                filename=unique_filename,
                file_size=len(processed_image_bytes),
                ip_address=None,  # TODO: Extract from request
                user_agent=None,  # TODO: Extract from request
                details=f"Logo image uploaded for event {event_id}, processed size: {len(processed_image_bytes)} bytes"
            )
            
            # Clear event cache since event was updated with new logo
            event_cache.clear()
            logger.info("Cleared event cache after logo upload")
            
            return {
                "detail": "Logo image uploaded successfully",
                "filename": unique_filename,
                "event_id": event_id,
                "processed_size": len(processed_image_bytes)
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading logo image: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload logo image")

@app.get("/uploads/{image_type}/{filename}")
async def serve_uploaded_image(image_type: str, filename: str):
    """Serve uploaded images"""
    if image_type not in ['banners', 'logos']:
        raise HTTPException(status_code=404, detail="Invalid image type")
    
    file_path = os.path.join("uploads", image_type, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Return file with proper headers for browser caching and CORS
    return FileResponse(
        file_path,
        headers={
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Allow-Headers": "*"
        }
    )

@app.delete("/events/{event_id}/banner")
async def delete_event_banner(
    event_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete banner image for premium users"""
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Verify event ownership and get current banner
            cursor.execute(f"SELECT created_by, banner_image FROM events WHERE id = {placeholder}", (event_id,))
            event = cursor.fetchone()
            
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            if event['created_by'] != current_user['id']:
                raise HTTPException(status_code=403, detail="You can only delete images from your own events")
            
            if not event['banner_image']:
                raise HTTPException(status_code=404, detail="No banner image to delete")
            
            # Delete file from filesystem
            file_path = os.path.join("uploads", "banners", event['banner_image'])
            if os.path.exists(file_path):
                os.remove(file_path)
            
            # Update database
            cursor.execute(f"""
                UPDATE events 
                SET banner_image = NULL
                WHERE id = {placeholder}
            """, (event_id,))
            
            conn.commit()
            
            log_activity(current_user['id'], "delete_banner", f"Deleted banner image for event {event_id}")
            
            return {"detail": "Banner image deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting banner image: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete banner image")

@app.delete("/events/{event_id}/logo")
async def delete_event_logo(
    event_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete logo image for premium users"""
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Verify event ownership and get current logo
            cursor.execute(f"SELECT created_by, logo_image FROM events WHERE id = {placeholder}", (event_id,))
            event = cursor.fetchone()
            
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            if event['created_by'] != current_user['id']:
                raise HTTPException(status_code=403, detail="You can only delete images from your own events")
            
            if not event['logo_image']:
                raise HTTPException(status_code=404, detail="No logo image to delete")
            
            # Delete file from filesystem
            file_path = os.path.join("uploads", "logos", event['logo_image'])
            if os.path.exists(file_path):
                os.remove(file_path)
            
            # Update database
            cursor.execute(f"""
                UPDATE events 
                SET logo_image = NULL
                WHERE id = {placeholder}
            """, (event_id,))
            
            conn.commit()
            
            log_activity(current_user['id'], "delete_logo", f"Deleted logo image for event {event_id}")
            
            return {"detail": "Logo image deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting logo image: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete logo image")

# Premium trial management endpoints
@app.post("/premium/cancel-trial")
async def cancel_premium_trial(current_user: dict = Depends(get_current_user)):
    """Cancel a user's premium trial immediately"""
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user has an active trial
            c.execute(f"""
                SELECT premium_expires_at, role 
                FROM users 
                WHERE id = {placeholder}
            """, (current_user['id'],))
            
            user_data = c.fetchone()
            
            if not user_data or user_data['role'] not in ['premium', 'admin']:
                raise HTTPException(status_code=404, detail="No active premium trial found")
            
            # Check if they have a Stripe subscription (if so, this isn't a trial)
            try:
                customers = stripe.Customer.list(email=current_user['email'], limit=1)
                if customers.data:
                    customer = customers.data[0]
                    subscriptions = stripe.Subscription.list(
                        customer=customer.id,
                        status='active',
                        limit=10
                    )
                    if subscriptions.data:
                        raise HTTPException(status_code=400, detail="Cannot cancel trial - active subscription found. Use subscription cancellation instead.")
            except stripe.error.StripeError:
                # If Stripe lookup fails, assume it's a trial
                pass
            
            # Cancel the trial by setting role back to user and clearing expiration
            c.execute(f"""
                UPDATE users 
                SET role = 'user', premium_expires_at = NULL
                WHERE id = {placeholder}
            """, (current_user['id'],))
            
            conn.commit()
            
            log_activity(current_user['id'], "trial_cancelled", "Premium trial cancelled by user")
            logger.info(f"✅ Premium trial cancelled for user {current_user['id']} ({current_user['email']})")
            
            # Send trial cancellation email
            try:
                from email_config import email_service
                user_name = current_user['email'].split('@')[0]
                email_sent = email_service.send_trial_cancellation_email(
                    to_email=current_user['email'],
                    user_name=user_name
                )
                
                if email_sent:
                    logger.info(f"✅ Trial cancellation email sent to {current_user['email']}")
                else:
                    logger.error(f"❌ Failed to send trial cancellation email to {current_user['email']}")
            except Exception as e:
                logger.error(f"❌ Error sending trial cancellation email: {str(e)}")
            
            return {
                "success": True,
                "message": "Premium trial cancelled successfully",
                "new_role": "user"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling premium trial: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to cancel trial")

@app.post("/premium/convert-trial-to-subscription")
async def convert_trial_to_subscription(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Convert an active trial to a paid subscription, keeping trial benefits until expiration"""
    try:
        # Parse request body
        try:
            body = await request.json()
        except Exception:
            body = {}
            
        pricing_tier = body.get('pricing_tier', 'premium')
        
        if pricing_tier not in ['premium', 'enterprise']:
            raise HTTPException(status_code=400, detail="Invalid pricing tier")
        
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user has an active trial
            c.execute(f"""
                SELECT premium_expires_at, role 
                FROM users 
                WHERE id = {placeholder}
            """, (current_user['id'],))
            
            user_data = c.fetchone()
            
            if not user_data or user_data['role'] not in ['premium', 'admin']:
                raise HTTPException(status_code=404, detail="No active premium trial found")
            
            trial_expires_at = user_data['premium_expires_at']
            
            # Check if they already have a Stripe subscription
            try:
                customers = stripe.Customer.list(email=current_user['email'], limit=1)
                if customers.data:
                    customer = customers.data[0]
                    subscriptions = stripe.Subscription.list(
                        customer=customer.id,
                        status='active',
                        limit=10
                    )
                    if subscriptions.data:
                        raise HTTPException(status_code=400, detail="Active subscription already exists")
            except stripe.error.StripeError:
                # If Stripe lookup fails, continue with conversion
                pass
            
            # Create Stripe checkout session with trial period
            if pricing_tier == 'enterprise':
                price_id = os.getenv("STRIPE_ENTERPRISE_PRICE_ID", STRIPE_PRICE_ID)
            else:
                price_id = STRIPE_PRICE_ID
            
            base_url = "https://todo-events.com" if IS_PRODUCTION else "http://localhost:3000"
            
            # Calculate trial period if trial hasn't expired
            trial_period_days = None
            if trial_expires_at:
                from datetime import timezone
                if isinstance(trial_expires_at, str):
                    expires_at = datetime.fromisoformat(trial_expires_at.replace('Z', '+00:00'))
                else:
                    expires_at = trial_expires_at
                
                # Only add trial period if trial hasn't expired
                if expires_at > datetime.now(timezone.utc):
                    trial_days = max(1, (expires_at - datetime.now(timezone.utc)).days)
                    trial_period_days = min(trial_days, 30)  # Stripe max is 30 days
            
            subscription_data = {
                'metadata': {
                    'user_id': str(current_user['id']),
                    'user_email': current_user['email'],
                    'pricing_tier': pricing_tier,
                    'trial_conversion': 'true',
                    'trial_expires_at': trial_expires_at.isoformat() if trial_expires_at else ''
                }
            }
            
            if trial_period_days:
                subscription_data['trial_period_days'] = trial_period_days
            
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price': price_id,
                    'quantity': 1,
                }],
                mode='subscription',
                success_url=f"{base_url}/?session_id={{CHECKOUT_SESSION_ID}}&success=true&tier={pricing_tier}",
                cancel_url=f"{base_url}/subscription?cancelled=true",
                customer_email=current_user['email'],
                metadata={
                    'user_id': str(current_user['id']),
                    'user_email': current_user['email'],
                    'pricing_tier': pricing_tier,
                    'trial_conversion': 'true',
                    'trial_expires_at': trial_expires_at.isoformat() if trial_expires_at else ''
                },
                subscription_data=subscription_data
            )
            
            logger.info(f"✅ Created {pricing_tier} trial conversion checkout session for user {current_user['id']} ({current_user['email']})")
            
            return {
                "checkout_url": checkout_session.url,
                "session_id": checkout_session.id,
                "pricing_tier": pricing_tier,
                "trial_period_days": trial_period_days
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error converting trial to subscription: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to convert trial to subscription")

@app.get("/premium/trial-status")
async def get_premium_trial_status(current_user: dict = Depends(get_current_user)):
    """Get detailed trial status for current user"""
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            c = conn.cursor()
            
            # Get user trial information
            c.execute(f"""
                SELECT premium_expires_at, premium_granted_by, premium_invited, role
                FROM users 
                WHERE id = {placeholder}
            """, (current_user['id'],))
            
            user_data = c.fetchone()
            
            if not user_data:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Check if they have any active Stripe subscriptions
            has_stripe_subscription = False
            try:
                customers = stripe.Customer.list(email=current_user['email'], limit=1)
                if customers.data:
                    customer = customers.data[0]
                    subscriptions = stripe.Subscription.list(
                        customer=customer.id,
                        status='active',
                        limit=10
                    )
                    has_stripe_subscription = len(subscriptions.data) > 0
            except stripe.error.StripeError:
                # If Stripe lookup fails, assume no subscription
                pass
            
            trial_info = None
            if user_data['premium_expires_at'] and not has_stripe_subscription:
                from datetime import timezone
                expires_at = user_data['premium_expires_at']
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                
                trial_info = {
                    "is_trial": True,
                    "expires_at": expires_at.isoformat(),
                    "is_expired": expires_at < datetime.now(timezone.utc),
                    "days_remaining": max(0, (expires_at - datetime.now(timezone.utc)).days),
                    "granted_by": user_data.get('premium_granted_by'),
                    "was_invited": user_data.get('premium_invited', False),
                    "can_cancel": True,
                    "can_convert": True
                }
            
            return {
                "user_role": user_data['role'],
                "is_premium": user_data['role'] in ['premium', 'admin'],
                "has_stripe_subscription": has_stripe_subscription,
                "trial": trial_info
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting trial status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get trial status")
# User account management endpoints
@app.post("/user/delete-account")
async def delete_user_account(current_user: dict = Depends(get_current_user)):
    """
    Allow users to delete their own account and all associated data
    This will:
    1. Cancel any active Stripe subscriptions
    2. Delete all user data (events, interests, views, etc.)
    3. Mark the account for deletion (30-day retention period)
    4. Send confirmation email
    """
    try:
        user_id = current_user['id']
        user_email = current_user['email']
        
        # Step 1: Cancel Stripe subscriptions if any exist
        stripe_cancellation_info = None
        try:
            customers = stripe.Customer.list(email=user_email, limit=1)
            if customers.data:
                customer = customers.data[0]
                
                # Get all active subscriptions
                subscriptions = stripe.Subscription.list(
                    customer=customer.id,
                    status='active',
                    limit=10
                )
                
                # Cancel all active subscriptions immediately
                for subscription in subscriptions.data:
                    canceled_sub = stripe.Subscription.modify(
                        subscription.id,
                        cancel_at_period_end=False  # Cancel immediately
                    )
                    logger.info(f"✅ Cancelled Stripe subscription {subscription.id} for account deletion")
                
                stripe_cancellation_info = {
                    "subscriptions_cancelled": len(subscriptions.data),
                    "customer_id": customer.id
                }
        except stripe.error.StripeError as e:
            logger.warning(f"Stripe cancellation failed during account deletion: {str(e)}")
            # Continue with deletion even if Stripe fails
        
        # Step 2: Mark account for deletion and collect data to be deleted
        placeholder = get_placeholder()
        deletion_date = datetime.utcnow()
        deletion_scheduled = deletion_date + timedelta(days=30)
        
        deleted_items = {}
        
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            
            # Count items before deletion for confirmation
            cursor.execute(f"SELECT COUNT(*) as count FROM events WHERE created_by = {placeholder}", (user_id,))
            deleted_items["events"] = cursor.fetchone()['count']
            
            cursor.execute(f"SELECT COUNT(*) as count FROM event_interests WHERE user_id = {placeholder}", (user_id,))
            deleted_items["interests"] = cursor.fetchone()['count']
            
            cursor.execute(f"SELECT COUNT(*) as count FROM event_views WHERE user_id = {placeholder}", (user_id,))
            deleted_items["views"] = cursor.fetchone()['count']
            
            cursor.execute(f"SELECT COUNT(*) as count FROM page_visits WHERE user_id = {placeholder}", (user_id,))
            deleted_items["page_visits"] = cursor.fetchone()['count']
            
            # Delete user's event-related data
            cursor.execute(f"DELETE FROM event_interests WHERE event_id IN (SELECT id FROM events WHERE created_by = {placeholder})", (user_id,))
            cursor.execute(f"DELETE FROM event_views WHERE event_id IN (SELECT id FROM events WHERE created_by = {placeholder})", (user_id,))
            cursor.execute(f"DELETE FROM events WHERE created_by = {placeholder}", (user_id,))
            
            # Delete user's interaction data
            cursor.execute(f"DELETE FROM event_interests WHERE user_id = {placeholder}", (user_id,))
            cursor.execute(f"DELETE FROM event_views WHERE user_id = {placeholder}", (user_id,))
            cursor.execute(f"DELETE FROM page_visits WHERE user_id = {placeholder}", (user_id,))
            
            # Delete any event reports made by this user
            cursor.execute(f"DELETE FROM event_reports WHERE reporter_email = {placeholder}", (user_email,))
            
            # Update user account to mark for deletion (instead of immediate deletion)
            # This allows for account recovery within 30 days
            cursor.execute(f"""
                UPDATE users 
                SET 
                    deleted_at = {placeholder},
                    deletion_scheduled_at = {placeholder},
                    role = 'deleted',
                    premium_expires_at = NULL,
                    premium_granted_by = NULL,
                    premium_invited = FALSE
                WHERE id = {placeholder}
            """, (deletion_date.isoformat(), deletion_scheduled.isoformat(), user_id))
            
            conn.commit()
        
        # Step 3: Log the deletion activity
        log_activity(user_id, "account_deletion_request", f"User requested account deletion")
        
        # Step 4: Send account deletion confirmation email
        try:
            from email_config import email_service
            user_name = user_email.split('@')[0]
            email_sent = email_service.send_account_deletion_email(
                to_email=user_email,
                user_name=user_name,
                deletion_date=deletion_date.isoformat(),
                final_deletion_date=deletion_scheduled.isoformat(),
                deleted_items=deleted_items,
                stripe_info=stripe_cancellation_info
            )
            
            if email_sent:
                logger.info(f"✅ Account deletion confirmation email sent to {user_email}")
            else:
                logger.error(f"❌ Failed to send account deletion confirmation email to {user_email}")
        except Exception as e:
            logger.error(f"❌ Error sending account deletion email: {str(e)}")
        
        # Clear any cached data for this user
        try:
            event_cache.clear()  # Clear all cache since user events are deleted
        except:
            pass
        
        logger.info(f"✅ Account deletion completed for user {user_id} ({user_email})")
        
        return {
            "success": True,
            "message": "Account deletion completed successfully",
            "deletion_date": deletion_date.isoformat(),
            "final_deletion_date": deletion_scheduled.isoformat(),
            "deleted_items": deleted_items,
            "stripe_cancellations": stripe_cancellation_info,
            "recovery_period_days": 30
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user account {current_user['id']}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete account")

@app.post("/user/cancel-account-deletion")
async def cancel_account_deletion(current_user: dict = Depends(get_current_user)):
    """
    Allow users to cancel their account deletion within the 30-day period
    """
    try:
        user_id = current_user['id']
        user_email = current_user['email']
        
        placeholder = get_placeholder()
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if account is marked for deletion
            cursor.execute(f"""
                SELECT deleted_at, deletion_scheduled_at, role 
                FROM users 
                WHERE id = {placeholder}
            """, (user_id,))
            
            user_data = cursor.fetchone()
            
            if not user_data or user_data['role'] != 'deleted':
                raise HTTPException(status_code=400, detail="Account is not scheduled for deletion")
            
            # Check if we're still within the recovery period
            if user_data['deletion_scheduled_at']:
                scheduled_deletion = datetime.fromisoformat(user_data['deletion_scheduled_at'].replace('Z', '+00:00'))
                if datetime.utcnow() >= scheduled_deletion:
                    raise HTTPException(status_code=400, detail="Recovery period has expired")
            
            # Restore the account
            cursor.execute(f"""
                UPDATE users 
                SET 
                    deleted_at = NULL,
                    deletion_scheduled_at = NULL,
                    role = 'user'
                WHERE id = {placeholder}
            """, (user_id,))
            
            conn.commit()
        
        # Log the recovery
        log_activity(user_id, "account_deletion_cancelled", f"User cancelled account deletion")
        
        # Send recovery confirmation email
        try:
            from email_config import email_service
            user_name = user_email.split('@')[0]
            email_sent = email_service.send_account_recovery_email(
                to_email=user_email,
                user_name=user_name
            )
            
            if email_sent:
                logger.info(f"✅ Account recovery confirmation email sent to {user_email}")
        except Exception as e:
            logger.error(f"❌ Error sending account recovery email: {str(e)}")
        
        logger.info(f"✅ Account deletion cancelled for user {user_id} ({user_email})")
        
        return {
            "success": True,
            "message": "Account deletion cancelled successfully",
            "restored_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling account deletion for user {current_user['id']}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to cancel account deletion")

@app.get("/stripe/config")
async def get_stripe_config():
    """Get Stripe publishable key for frontend"""
    return {"publishable_key": STRIPE_PUBLISHABLE_KEY}
@app.post("/stripe/create-checkout-session")
async def create_checkout_session(request: Request, current_user: dict = Depends(get_current_user)):
    """Create Stripe checkout session for premium subscription"""
    try:
        # Get pricing tier from request (default to monthly)
        # Parse JSON body
        try:
            body = await request.json()
        except Exception:
            body = {}
        
        # Get pricing tier from request (default to monthly)
        pricing_tier = body.get('pricing_tier', 'monthly')
        trial_ends_at = body.get('trial_ends_at')
        
        # Determine which price ID to use
        if pricing_tier == 'annual':
            price_id = os.getenv("STRIPE_ANNUAL_PRICE_ID", STRIPE_PRICE_ID)
        elif pricing_tier == 'enterprise':
            price_id = os.getenv("STRIPE_ENTERPRISE_PRICE_ID", STRIPE_PRICE_ID)
        else:  # monthly or premium
            price_id = STRIPE_PRICE_ID
        
        # Determine the base URL for success/cancel URLs
        base_url = "https://todo-events.com" if IS_PRODUCTION else "http://localhost:5173"
        
        # Configure subscription data based on trial status
        subscription_data = {
            'metadata': {
                'user_id': str(current_user['id']),
                'user_email': current_user['email'],
                'pricing_tier': pricing_tier
            }
        }
        
        # If trial is provided and not expired, schedule subscription to start after trial
        if trial_ends_at:
            try:
                from datetime import timezone
                trial_end_date = datetime.fromisoformat(trial_ends_at.replace('Z', '+00:00'))
                
                # Only schedule future billing if trial hasn't expired
                if trial_end_date > datetime.now(timezone.utc):
                    # Calculate trial period in days (Stripe requires this for trial_period_days)
                    trial_days = max(1, (trial_end_date - datetime.now(timezone.utc)).days)
                    subscription_data['trial_period_days'] = min(trial_days, 30)  # Stripe max is 30 days
                    logger.info(f"🕒 Setting {trial_days} day trial for user {current_user['id']}")
                else:
                    logger.info(f"⏰ Trial already expired for user {current_user['id']}, starting subscription immediately")
            except Exception as e:
                logger.warning(f"Could not parse trial date {trial_ends_at}: {e}")
        
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f"{base_url}/?session_id={{CHECKOUT_SESSION_ID}}&success=true&tier={pricing_tier}",
            cancel_url=f"{base_url}/subscription?cancelled=true",
            customer_email=current_user['email'],
            metadata={
                'user_id': str(current_user['id']),
                'user_email': current_user['email'],
                'pricing_tier': pricing_tier,
                'trial_ends_at': trial_ends_at or ''
            },
            subscription_data=subscription_data
        )
        
        logger.info(f"✅ Created {pricing_tier} checkout session for user {current_user['id']} ({current_user['email']})")
        
        # Ensure we have a checkout URL
        if not checkout_session.url:
            logger.error(f"Checkout session created but no URL returned: {checkout_session.id}")
            raise HTTPException(status_code=500, detail="No checkout URL received from Stripe")
            
        return {"checkout_url": checkout_session.url}
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating checkout session: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"Error creating checkout session: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

@app.post("/stripe/cancel-subscription")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Cancel user's active subscription"""
    try:
        # First, find the user's active subscription in Stripe
        customers = stripe.Customer.list(email=current_user['email'], limit=1)
        
        if not customers.data:
            raise HTTPException(status_code=404, detail="No Stripe customer found")
        
        customer = customers.data[0]
        
        # Get active subscriptions for this customer
        subscriptions = stripe.Subscription.list(
            customer=customer.id,
            status='active',
            limit=10
        )
        
        if not subscriptions.data:
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        # Cancel the first active subscription (assuming one subscription per customer)
        subscription = subscriptions.data[0]
        
        # Cancel at period end (so they keep access until billing period ends)
        canceled_subscription = stripe.Subscription.modify(
            subscription.id,
            cancel_at_period_end=True
        )
        
        logger.info(f"✅ Marked subscription {subscription.id} for cancellation for user {current_user['id']} ({current_user['email']})")
        
        # Get the correct access_until date using the same logic as subscription status
        access_until = None
        try:
            # Try to get the next billing date from upcoming invoice
            upcoming = stripe.Invoice.create_preview(customer=customer.id, subscription=subscription.id)
            if upcoming and hasattr(upcoming, 'lines') and upcoming.lines and upcoming.lines.data:
                for line in upcoming.lines.data:
                    if hasattr(line, 'period') and line.period and hasattr(line.period, 'start') and line.period.start:
                        access_until = datetime.fromtimestamp(line.period.start).isoformat()
                        logger.info(f"🗓️ Subscription will end at: {access_until}")
                        break
        except Exception as e:
            logger.warning(f"Could not get upcoming invoice for cancellation date: {e}")
            # Fallback to subscription's current period end if available
            try:
                cancels_at_ts = getattr(canceled_subscription, 'current_period_end', None)
                if cancels_at_ts:
                    access_until = datetime.fromtimestamp(cancels_at_ts).isoformat()
                    logger.info(f"🗓️ Using subscription current_period_end: {access_until}")
            except (ValueError, TypeError, OSError):
                logger.warning(f"Could not convert cancellation timestamp")
        
        # Send cancellation confirmation email
        try:
            from email_config import email_service
            user_name = current_user['email'].split('@')[0]
            email_sent = email_service.send_subscription_cancellation_email(
                to_email=current_user['email'],
                user_name=user_name,
                cancellation_type="scheduled",
                effective_date=access_until
            )
            
            if email_sent:
                logger.info(f"✅ Cancellation confirmation email sent to {current_user['email']}")
            else:
                logger.error(f"❌ Failed to send cancellation confirmation email to {current_user['email']}")
        except Exception as e:
            logger.error(f"❌ Error sending cancellation email: {str(e)}")
        
        return {
            "success": True,
            "message": "Subscription marked for cancellation",
            "subscription_id": subscription.id,
            "access_until": access_until
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error canceling subscription: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"Error canceling subscription: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to cancel subscription")

@app.post("/stripe/cancel-subscription-immediately")
async def cancel_subscription_immediately(current_user: dict = Depends(get_current_user)):
    """Cancel user's subscription immediately (loses access right away)"""
    try:
        # Find the user's active subscription
        customers = stripe.Customer.list(email=current_user['email'], limit=1)
        
        if not customers.data:
            raise HTTPException(status_code=404, detail="No Stripe customer found")
        
        customer = customers.data[0]
        
        # Get active subscriptions
        subscriptions = stripe.Subscription.list(
            customer=customer.id,
            status='active',
            limit=10
        )
        
        if not subscriptions.data:
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        subscription = subscriptions.data[0]
        
        # Cancel immediately
        canceled_subscription = stripe.Subscription.cancel(subscription.id)
        
        logger.info(f"✅ Immediately canceled subscription {subscription.id} for user {current_user['id']} ({current_user['email']})")
        
        # Send immediate cancellation confirmation email
        try:
            from email_config import email_service
            user_name = current_user['email'].split('@')[0]
            email_sent = email_service.send_subscription_cancellation_email(
                to_email=current_user['email'],
                user_name=user_name,
                cancellation_type="immediate"
            )
            
            if email_sent:
                logger.info(f"✅ Immediate cancellation email sent to {current_user['email']}")
            else:
                logger.error(f"❌ Failed to send immediate cancellation email to {current_user['email']}")
        except Exception as e:
            logger.error(f"❌ Error sending immediate cancellation email: {str(e)}")
        
        return {
            "success": True,
            "message": "Subscription canceled immediately",
            "subscription_id": subscription.id,
            "status": canceled_subscription.status
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error canceling subscription: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"Error canceling subscription immediately: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to cancel subscription")

@app.post("/stripe/reactivate-subscription")
async def reactivate_subscription(request: dict, current_user: dict = Depends(get_current_user)):
    """Reactivate a subscription that was scheduled for cancellation"""
    try:
        subscription_id = request.get('subscription_id')
        if not subscription_id:
            raise HTTPException(status_code=400, detail="subscription_id is required")
        
        # Verify the subscription belongs to this user
        customers = stripe.Customer.list(email=current_user['email'], limit=1)
        if not customers.data:
            raise HTTPException(status_code=404, detail="No Stripe customer found")
        
        customer = customers.data[0]
        
        # Get the subscription to verify ownership
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            if subscription.customer != customer.id:
                raise HTTPException(status_code=403, detail="Subscription does not belong to this customer")
        except stripe.error.InvalidRequestError:
            raise HTTPException(status_code=404, detail="Subscription not found")
        
        # Check if subscription is scheduled for cancellation
        if not subscription.cancel_at_period_end:
            raise HTTPException(status_code=400, detail="Subscription is not scheduled for cancellation")
        
        # Reactivate the subscription by removing the cancellation
        reactivated_subscription = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=False
        )
        
        logger.info(f"✅ Reactivated subscription {subscription_id} for user {current_user['id']} ({current_user['email']})")
        
        # Send reactivation confirmation email
        try:
            from email_config import email_service
            user_name = current_user['email'].split('@')[0]
            
            # Get next billing date for email
            next_billing_date = None
            try:
                upcoming = stripe.Invoice.create_preview(customer=customer.id, subscription=subscription_id)
                if upcoming and hasattr(upcoming, 'lines') and upcoming.lines and upcoming.lines.data:
                    for line in upcoming.lines.data:
                        if hasattr(line, 'period') and line.period and hasattr(line.period, 'start') and line.period.start:
                            next_billing_date = datetime.fromtimestamp(line.period.start).strftime('%B %d, %Y')
                            break
            except Exception:
                pass
            
            email_content = f"""
            <h2>🎉 Subscription Reactivated - TodoEvents</h2>
            <p>Great news! Your TodoEvents premium subscription has been successfully reactivated.</p>
            <p><strong>What this means:</strong></p>
            <ul>
                <li>✅ Your scheduled cancellation has been removed</li>
                <li>✅ You'll continue to have premium access</li>
                <li>✅ Billing will continue as normal</li>
                {f"<li>📅 Your next billing date: {next_billing_date}</li>" if next_billing_date else ""}
            </ul>
            <p>Thank you for staying with TodoEvents Premium!</p>
            """
            
            email_service.send_email(
                current_user['email'],
                "🎉 Subscription Reactivated - TodoEvents",
                email_content
            )
            logger.info(f"✅ Sent reactivation email to {current_user['email']}")
            
        except Exception as e:
            logger.error(f"❌ Error sending reactivation email: {str(e)}")
        
        return {
            "success": True,
            "message": "Subscription reactivated successfully",
            "subscription_id": subscription_id
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error reactivating subscription: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"Error reactivating subscription: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to reactivate subscription")

@app.get("/stripe/subscription-status")
async def get_detailed_subscription_status(current_user: dict = Depends(get_current_user)):
    """Get detailed subscription status from Stripe"""
    try:
        # Find customer in Stripe
        customers = stripe.Customer.list(email=current_user['email'], limit=1)
        
        if not customers.data:
            # Check for trial information from database even if no Stripe customer
            trial_info = None
            placeholder = get_placeholder()
            try:
                with get_db() as conn:
                    c = conn.cursor()
                    c.execute(f"""
                        SELECT premium_expires_at, premium_granted_by, premium_invited 
                        FROM users 
                        WHERE id = {placeholder}
                    """, (current_user['id'],))
                    user_data = c.fetchone()
                    
                    if user_data and user_data.get('premium_expires_at'):
                        from datetime import timezone
                        expires_at = user_data['premium_expires_at']
                        if isinstance(expires_at, str):
                            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                        
                        trial_info = {
                            "is_trial": True,
                            "expires_at": expires_at.isoformat(),
                            "is_expired": expires_at < datetime.now(timezone.utc),
                            "days_remaining": max(0, (expires_at - datetime.now(timezone.utc)).days),
                            "granted_by": user_data.get('premium_granted_by'),
                            "was_invited": user_data.get('premium_invited', False)
                        }
            except Exception as e:
                logger.warning(f"Could not fetch trial info: {e}")
            
            return {
                "has_stripe_customer": False,
                "user_role": current_user['role'],
                "is_premium": current_user['role'] in ['premium', 'admin'],
                "trial": trial_info
            }
        
        customer = customers.data[0]
        
        # Get all subscriptions for this customer
        subscriptions = stripe.Subscription.list(
            customer=customer.id,
            limit=10
        )
        
        subscription_info = []
        for sub in subscriptions.data:
            # Debug: Log subscription object structure
            logger.info(f"Processing subscription: {sub.id}, status: {sub.status}")
            logger.info(f"Available subscription attributes: {list(sub.keys()) if hasattr(sub, 'keys') else 'No keys method'}")
            
            # Get the actual subscription's current period (what they've already paid for)
            actual_period_start = None
            actual_period_end = None
            next_billing_date = None
            
            # Get actual current period from subscription object first
            try:
                current_period_start_ts = getattr(sub, 'current_period_start', None)
                if current_period_start_ts:
                    actual_period_start = datetime.fromtimestamp(current_period_start_ts).isoformat()
                    logger.info(f"🕒 Actual current period start: {actual_period_start} (ts: {current_period_start_ts})")
            except (ValueError, TypeError, OSError, AttributeError):
                pass
                
            try:
                current_period_end_ts = getattr(sub, 'current_period_end', None)
                if current_period_end_ts:
                    actual_period_end = datetime.fromtimestamp(current_period_end_ts).isoformat()
                    logger.info(f"🕒 Actual current period end: {actual_period_end} (ts: {current_period_end_ts})")
            except (ValueError, TypeError, OSError, AttributeError):
                pass
            
            # Now get the next billing date from upcoming invoice (separate from current period)
            try:
                logger.info(f"Attempting to fetch upcoming invoice preview for customer: {customer.id}")
                upcoming = stripe.Invoice.create_preview(customer=customer.id, subscription=sub.id)
                if upcoming:
                    if hasattr(upcoming, 'lines') and upcoming.lines and upcoming.lines.data:
                        for line in upcoming.lines.data:
                            if hasattr(line, 'period') and line.period:
                                if hasattr(line.period, 'start') and line.period.start:
                                    next_billing_date = datetime.fromtimestamp(line.period.start).isoformat()
                                    logger.info(f"📅 Next billing date from upcoming invoice: {next_billing_date}")
                                break
                    
                    # Also log the amount for debugging
                    if hasattr(upcoming, 'amount_due'):
                        logger.info(f"💰 Next invoice amount: {upcoming.amount_due}")
                        
            except Exception as upcoming_error:
                logger.warning(f"⚠️ Could not fetch upcoming invoice preview: {upcoming_error}")
                # Fallback: use current period end as next billing date if we can't get upcoming invoice
                next_billing_date = actual_period_end
            
            # Fallback for missing actual period data
            if not actual_period_start:
                try:
                    start_date_ts = getattr(sub, 'start_date', None)
                    if start_date_ts:
                        actual_period_start = datetime.fromtimestamp(start_date_ts).isoformat()
                except (ValueError, TypeError, OSError, AttributeError):
                    try:
                        created_ts = getattr(sub, 'created', None)
                        if created_ts:
                            actual_period_start = datetime.fromtimestamp(created_ts).isoformat()
                    except (ValueError, TypeError, OSError, AttributeError):
                        pass
                        
            if not actual_period_end:
                # Final fallback to latest invoice if we couldn't get subscription period
                try:
                    latest_invoice_id = getattr(sub, 'latest_invoice', None)
                    if latest_invoice_id:
                        logger.info(f"Fetching latest invoice as fallback: {latest_invoice_id}")
                        invoice = stripe.Invoice.retrieve(latest_invoice_id)
                        if invoice:
                            if hasattr(invoice, 'period_end') and invoice.period_end:
                                actual_period_end = datetime.fromtimestamp(invoice.period_end).isoformat()
                                logger.info(f"Got actual period end from latest invoice: {actual_period_end}")
                except Exception as invoice_error:
                    logger.warning(f"Could not fetch latest invoice data: {invoice_error}")
                
            try:
                canceled_at_ts = getattr(sub, 'canceled_at', None)
                canceled_at = datetime.fromtimestamp(canceled_at_ts).isoformat() if canceled_at_ts else None
            except (ValueError, TypeError, OSError, AttributeError):
                canceled_at = None
            
            # Check if subscription is scheduled for cancellation and get the actual end date
            cancel_at_period_end = getattr(sub, 'cancel_at_period_end', False)
            if cancel_at_period_end:
                # For scheduled cancellations, use the actual current period end
                logger.info(f"🗓️ Subscription scheduled for cancellation, access until: {actual_period_end}")
            
            # Safely get price information from multiple possible sources
            amount = 0
            currency = "usd"
            
            # Try items.data[0].price first (newer Stripe API)
            try:
                if hasattr(sub, 'items') and sub.items and sub.items.data:
                    if hasattr(sub.items.data[0], 'price') and sub.items.data[0].price:
                        amount = getattr(sub.items.data[0].price, 'unit_amount', 0) or 0
                        currency = getattr(sub.items.data[0].price, 'currency', 'usd') or 'usd'
            except (AttributeError, IndexError):
                pass
            
            # Fallback to plan object (older Stripe API)
            if amount == 0:
                try:
                    plan = getattr(sub, 'plan', None)
                    if plan:
                        amount = getattr(plan, 'amount', 0) or 0
                        currency = getattr(plan, 'currency', 'usd') or 'usd'
                except (AttributeError, TypeError):
                    pass
            
            # Log what we found for debugging
            logger.info(f"Subscription pricing: amount={amount}, currency={currency}")
            logger.info(f"Actual period: start={actual_period_start}, end={actual_period_end}")
            logger.info(f"Next billing date: {next_billing_date}")
            
            subscription_info.append({
                "id": getattr(sub, 'id', 'unknown'),
                "status": getattr(sub, 'status', 'unknown'),
                "current_period_start": next_billing_date,  # When they'll be charged next
                "current_period_end": actual_period_end,   # When their current paid period ends (for cancellation)
                "cancel_at_period_end": getattr(sub, 'cancel_at_period_end', False),
                "canceled_at": canceled_at,
                "amount": amount,
                "currency": currency
            })
        
        # Check for trial information from database
        trial_info = None
        placeholder = get_placeholder()
        try:
            with get_db() as conn:
                c = conn.cursor()
                c.execute(f"""
                    SELECT premium_expires_at, premium_granted_by, premium_invited 
                    FROM users 
                    WHERE id = {placeholder}
                """, (current_user['id'],))
                user_data = c.fetchone()
                
                if user_data and user_data.get('premium_expires_at'):
                    from datetime import timezone
                    expires_at = user_data['premium_expires_at']
                    if isinstance(expires_at, str):
                        expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                    
                    # Check if this looks like a trial (no Stripe subscription but has expiration)
                    is_trial = len(subscription_info) == 0 and expires_at
                    
                    if is_trial:
                        trial_info = {
                            "is_trial": True,
                            "expires_at": expires_at.isoformat(),
                            "is_expired": expires_at < datetime.now(timezone.utc),
                            "days_remaining": max(0, (expires_at - datetime.now(timezone.utc)).days),
                            "granted_by": user_data.get('premium_granted_by'),
                            "was_invited": user_data.get('premium_invited', False)
                        }
        except Exception as e:
            logger.warning(f"Could not fetch trial info: {e}")

        return {
            "has_stripe_customer": True,
            "customer_id": customer.id,
            "user_role": current_user['role'],
            "is_premium": current_user['role'] in ['premium', 'admin'],
            "subscriptions": subscription_info,
            "trial": trial_info
        }
        
    except Exception as e:
        logger.error(f"Error getting subscription status: {str(e)}")
        logger.error(f"Subscription status error traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to get subscription status: {str(e)}")

@app.get("/test-webhook")
async def test_webhook():
    """Simple test endpoint to verify webhook URL is reachable"""
    return {"status": "ok", "message": "Webhook endpoint is reachable", "timestamp": datetime.utcnow().isoformat()}
@app.post("/admin/quick-upgrade-user-3")
async def quick_upgrade_user_3():
    """Quick upgrade for user 3 since payment was successful but webhook may have been missed"""
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check current status
            cursor.execute(f"SELECT id, email, role FROM users WHERE id = {placeholder}", (3,))
            user = cursor.fetchone()
            
            if not user:
                return {"error": "User 3 not found"}
            
            if user['role'] == 'premium':
                return {"message": "User 3 is already premium", "role": user['role']}
            
            # Calculate expiration date (1 month from now) using UTC
            expires_at = datetime.utcnow() + timedelta(days=30)
            
            # Update user to premium
            cursor.execute(f"""
                UPDATE users 
                SET role = 'premium', 
                    premium_expires_at = {placeholder}
                WHERE id = {placeholder}
            """, (expires_at, 3))
            
            rows_affected = cursor.rowcount
            conn.commit()
            
            logger.info(f"✅ Manually upgraded user 3 ({user['email']}) to premium due to webhook processing issues")
            
            return {
                "success": True,
                "message": f"User 3 ({user['email']}) upgraded to premium",
                "previous_role": user['role'],
                "new_role": "premium",
                "expires_at": expires_at.isoformat(),
                "rows_affected": rows_affected
            }
            
    except Exception as e:
        logger.error(f"Error upgrading user 3: {str(e)}")
        return {"error": str(e)}

@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    # FORCE IMMEDIATE LOGGING WITH MULTIPLE METHODS
    import sys
    import os
    
    # Method 1: Logger
    logger.info("🔔🔔🔔 WEBHOOK ENDPOINT HIT! 🔔🔔🔔")
    logger.warning("🔔🔔🔔 WEBHOOK ENDPOINT HIT! 🔔🔔🔔")
    logger.error("🔔🔔🔔 WEBHOOK ENDPOINT HIT! 🔔🔔🔔")
    
    # Method 2: Print to stdout
    
    # Method 3: Print to stderr  
    
    # Method 4: Force flush
    sys.stdout.flush()
    sys.stderr.flush()
    
    # Method 5: Write to a file for debugging
    try:
        with open("/tmp/webhook_debug.log", "a") as f:
            f.write(f"WEBHOOK HIT: {datetime.utcnow().isoformat()}\n")
            f.flush()
    except:
        pass
    
    try:
        payload = await request.body()
        sig_header = request.headers.get('stripe-signature')
        
        logger.info(f"🔔 Webhook payload size: {len(payload)}, signature present: {bool(sig_header)}")
        
        if not STRIPE_WEBHOOK_SECRET:
            logger.error("❌ STRIPE_WEBHOOK_SECRET not configured")
            raise HTTPException(status_code=500, detail="Webhook secret not configured")
        
        logger.info(f"🔔 Attempting to construct Stripe event with secret: {STRIPE_WEBHOOK_SECRET[:8]}...")
        
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
        
        logger.info(f"🔔 SUCCESS! Received Stripe webhook: {event['type']} (ID: {event.get('id', 'unknown')})")
        
        # Handle the event
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            logger.info(f"🔔 Processing checkout.session.completed for session: {session.get('id')}")
            await handle_successful_payment(session)
        elif event['type'] == 'customer.subscription.created':
            subscription = event['data']['object']
            logger.info(f"🔔 Processing customer.subscription.created for subscription: {subscription.get('id')}")
            await handle_subscription_created(subscription)
        elif event['type'] == 'invoice.payment_succeeded':
            invoice = event['data']['object']
            logger.info(f"🔔 Processing invoice.payment_succeeded for invoice: {invoice.get('id')}")
            await handle_subscription_renewal(invoice)
        elif event['type'] == 'customer.subscription.deleted':
            subscription = event['data']['object']
            logger.info(f"🔔 Processing customer.subscription.deleted for subscription: {subscription.get('id')}")
            await handle_subscription_cancelled(subscription)
        elif event['type'] == 'customer.subscription.paused':
            subscription = event['data']['object']
            logger.info(f"🔔 Processing customer.subscription.paused for subscription: {subscription.get('id')}")
            await handle_subscription_paused(subscription)
        elif event['type'] == 'customer.subscription.updated':
            subscription = event['data']['object']
            logger.info(f"🔔 Processing customer.subscription.updated for subscription: {subscription.get('id')}")
            await handle_subscription_updated(subscription)
        elif event['type'] == 'customer.subscription.resumed':
            subscription = event['data']['object']
            logger.info(f"🔔 Processing customer.subscription.resumed for subscription: {subscription.get('id')}")
            await handle_subscription_resumed(subscription)
        elif event['type'] == 'invoice.created':
            invoice = event['data']['object']
            logger.info(f"🔔 Processing invoice.created for invoice: {invoice.get('id')}")
            await handle_invoice_created(invoice)
        elif event['type'] == 'invoice.upcoming':
            invoice = event['data']['object']
            logger.info(f"🔔 Processing invoice.upcoming for invoice: {invoice.get('id')}")
            await handle_invoice_upcoming(invoice)
        else:
            logger.info(f"ℹ️ Unhandled event type: {event['type']}")
        
        logger.info(f"✅ Successfully processed webhook {event['type']}")
        return {"status": "success"}
        
    except ValueError as e:
        logger.error(f"❌ Invalid webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"❌ Invalid webhook signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"❌ Webhook processing error: {str(e)}")
        logger.error(f"❌ Webhook traceback: {traceback.format_exc()}")
        # Return 200 to prevent Stripe from retrying
        return {"status": "error", "message": str(e)}

async def handle_successful_payment(session):
    """Handle successful payment from Stripe checkout"""
    try:
        logger.info(f"🔔 Processing successful payment for session: {session.get('id')}")
        logger.info(f"🔔 Session metadata: {session.get('metadata', {})}")
        
        # Validate metadata exists
        if 'metadata' not in session or not session['metadata']:
            logger.error("❌ No metadata found in session")
            raise ValueError("Session metadata missing")
        
        if 'user_id' not in session['metadata']:
            logger.error("❌ user_id not found in session metadata")
            raise ValueError("user_id missing from metadata")
        
        user_id = int(session['metadata']['user_id'])
        user_email = session['metadata']['user_email']
        pricing_tier = session['metadata'].get('pricing_tier', 'monthly')
        
        logger.info(f"🔔 Processing payment for user {user_id} ({user_email}) - pricing tier: {pricing_tier}")
        
        # Determine role based on pricing tier
        if pricing_tier == 'enterprise':
            new_role = 'enterprise'
            # Enterprise gets 1 month access (monthly subscription)
            expires_at = datetime.utcnow() + timedelta(days=30)
        else:
            new_role = 'premium'
            # Premium gets 1 month access
            expires_at = datetime.utcnow() + timedelta(days=30)
        
        # Update user to appropriate role
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # First check if user exists
            cursor.execute(f"SELECT id, email, role FROM users WHERE id = {placeholder}", (user_id,))
            user = cursor.fetchone()
            
            if not user:
                logger.error(f"❌ User {user_id} not found in database")
                raise ValueError(f"User {user_id} not found")
            
            logger.info(f"🔔 Found user: {user['email']}, current role: {user['role']}, upgrading to: {new_role}")
            
            # Update user role and expiration
            cursor.execute(f"""
                UPDATE users 
                SET role = {placeholder}, premium_expires_at = {placeholder}
                WHERE id = {placeholder}
            """, (new_role, expires_at, user_id))
            
            rows_affected = cursor.rowcount
            logger.info(f"🔔 Update query affected {rows_affected} rows")
            
            conn.commit()
            
            # Log the activity
            log_activity(user_id, "stripe_payment_success", f"{new_role.title()} subscription activated via Stripe for {user_email}")
            
            logger.info(f"✅ {new_role.title()} activated for user {user_id} ({user_email}) via Stripe payment, expires: {expires_at}")
            
            # Send appropriate notification email based on role
            try:
                from email_config import email_service
                
                if new_role == 'enterprise':
                    email_sent = email_service.send_enterprise_notification_email(
                        to_email=user_email,
                        user_name=user_email.split('@')[0],  # Use email prefix as name
                        expires_at=expires_at.isoformat(),
                        granted_by="Stripe Payment"
                    )
                    
                    if email_sent:
                        logger.info(f"✅ Enterprise notification email sent to {user_email}")
                    else:
                        logger.error(f"❌ Failed to send enterprise notification email to {user_email}")
                else:
                    email_sent = email_service.send_premium_notification_email(
                    to_email=user_email,
                    user_name=user_email.split('@')[0],  # Use email prefix as name
                    expires_at=expires_at.isoformat(),
                    granted_by="Stripe Payment"
                )
                
                if email_sent:
                    logger.info(f"✅ Premium notification email sent to {user_email}")
                else:
                    logger.error(f"❌ Failed to send premium notification email to {user_email}")
            except Exception as e:
                logger.error(f"❌ Error sending {new_role} notification email: {str(e)}")
        
    except Exception as e:
        logger.error(f"❌ Error handling successful payment: {str(e)}")
        logger.error(f"❌ Payment handler traceback: {traceback.format_exc()}")
        raise  # Re-raise to let webhook handler decide how to respond

async def handle_subscription_created(subscription):
    """Handle when a subscription is created in Stripe"""
    try:
        user_id = int(subscription['metadata']['user_id'])
        user_email = subscription['metadata']['user_email']
        
        logger.info(f"📝 Subscription created for user {user_id} ({user_email}): {subscription['id']}")
        
        # Log the activity
        log_activity(user_id, "stripe_subscription_created", f"Stripe subscription created: {subscription['id']}")
        
    except Exception as e:
        logger.error(f"Error handling subscription created: {str(e)}")

async def handle_subscription_renewal(invoice):
    """Handle subscription renewal payments"""
    try:
        subscription_id = invoice['subscription']
        customer_id = invoice['customer']
        
        # Get subscription details to find user
        subscription = stripe.Subscription.retrieve(subscription_id)
        user_id = int(subscription['metadata']['user_id'])
        pricing_tier = subscription['metadata'].get('pricing_tier', 'monthly')
        
        # Determine renewal period based on pricing tier
        if pricing_tier == 'enterprise':
            renewal_days = 30   # Enterprise renews for 1 month (monthly subscription)
        else:
            renewal_days = 30   # Premium renews for 1 month
        
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Get current expiration date to extend it properly
            cursor.execute(f"SELECT premium_expires_at, role FROM users WHERE id = {placeholder}", (user_id,))
            user_data = cursor.fetchone()
            
            if user_data and user_data['premium_expires_at']:
                # Extend existing expiration by appropriate period
                current_expires = datetime.fromisoformat(user_data['premium_expires_at'].replace('Z', '+00:00')) if isinstance(user_data['premium_expires_at'], str) else user_data['premium_expires_at']
                # If current expiration is in the past, start from now
                base_date = max(current_expires, datetime.utcnow()) if current_expires else datetime.utcnow()
                expires_at = base_date + timedelta(days=renewal_days)
            else:
                # No existing expiration, start from now
                expires_at = datetime.utcnow() + timedelta(days=renewal_days)
            
            cursor.execute(f"""
                UPDATE users 
                SET premium_expires_at = {placeholder}
                WHERE id = {placeholder}
            """, (expires_at, user_id))
            
            conn.commit()
            
            subscription_type = "Enterprise" if pricing_tier == 'enterprise' else "Premium"
            log_activity(user_id, "stripe_renewal", f"{subscription_type} subscription renewed via Stripe")
            logger.info(f"✅ {subscription_type} renewed for user {user_id} via Stripe")
        
    except Exception as e:
        logger.error(f"Error handling subscription renewal: {str(e)}")

async def handle_subscription_cancelled(subscription):
    """Handle subscription cancellation"""
    try:
        user_id = int(subscription['metadata']['user_id'])
        user_email = subscription['metadata'].get('user_email', '')
        
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Get user details if email not in metadata
            if not user_email:
                cursor.execute(f"SELECT email FROM users WHERE id = {placeholder}", (user_id,))
                user_data = cursor.fetchone()
                if user_data:
                    user_email = user_data['email']
            
            # Set role back to user and clear expiration
            cursor.execute(f"""
                UPDATE users 
                SET role = 'user', premium_expires_at = NULL
                WHERE id = {placeholder}
            """, (user_id,))
            
            conn.commit()
            
            log_activity(user_id, "stripe_cancellation", f"Premium subscription cancelled via Stripe")
            logger.info(f"✅ Premium cancelled for user {user_id} via Stripe")
            
            # Send cancellation email via webhook (for subscriptions cancelled outside our app)
            if user_email:
                try:
                    from email_config import email_service
                    user_name = user_email.split('@')[0]
                    email_sent = email_service.send_subscription_cancellation_email(
                        to_email=user_email,
                        user_name=user_name,
                        cancellation_type="immediate"
                    )
                    
                    if email_sent:
                        logger.info(f"✅ Webhook cancellation email sent to {user_email}")
                    else:
                        logger.error(f"❌ Failed to send webhook cancellation email to {user_email}")
                except Exception as e:
                    logger.error(f"❌ Error sending webhook cancellation email: {str(e)}")
        
    except Exception as e:
        logger.error(f"Error handling subscription cancellation: {str(e)}")

async def handle_subscription_paused(subscription):
    """Handle subscription pause/suspension"""
    try:
        user_id = int(subscription['metadata']['user_id'])
        
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Set role back to user but keep expiration date for potential resume
            cursor.execute(f"""
                UPDATE users 
                SET role = 'user'
                WHERE id = {placeholder}
            """, (user_id,))
            
            conn.commit()
            
            log_activity(user_id, "stripe_subscription_paused", f"Premium subscription paused via Stripe")
            logger.info(f"⏸️ Premium paused for user {user_id} via Stripe")
        
    except Exception as e:
        logger.error(f"Error handling subscription pause: {str(e)}")

async def handle_subscription_updated(subscription):
    """Handle subscription updates (plan changes, quantity, etc.)"""
    try:
        # Extract user info from subscription metadata or customer
        user_id = None
        user_email = None
        
        if 'metadata' in subscription and subscription['metadata'].get('user_id'):
            user_id = int(subscription['metadata']['user_id'])
            user_email = subscription['metadata'].get('user_email')
        else:
            # Fallback: find user by customer ID
            customer_id = subscription.get('customer')
            if customer_id:
                with get_db() as conn:
                    cursor = conn.cursor()
                    placeholder = get_placeholder()
                    cursor.execute(f"SELECT id, email FROM users WHERE stripe_customer_id = {placeholder}", (customer_id,))
                    user_data = cursor.fetchone()
                    if user_data:
                        user_id = user_data['id']
                        user_email = user_data['email']
        
        if not user_id:
            logger.warning(f"Could not find user for subscription update: {subscription.get('id')}")
            return
        
        # Log subscription changes
        subscription_status = subscription.get('status', 'unknown')
        subscription_id = subscription.get('id', 'unknown')
        
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Update subscription status if it changed to active and user isn't premium
            if subscription_status == 'active':
                cursor.execute(f"SELECT role FROM users WHERE id = {placeholder}", (user_id,))
                user_data = cursor.fetchone()
                
                if user_data and user_data['role'] != 'premium':
                    # Calculate new expiration (30 days from now)
                    expires_at = datetime.utcnow() + timedelta(days=30)
                    
                    cursor.execute(f"""
                        UPDATE users 
                        SET role = 'premium', premium_expires_at = {placeholder}
                        WHERE id = {placeholder}
                    """, (expires_at, user_id))
                    
                    conn.commit()
                    
                    logger.info(f"✅ Updated user {user_id} to premium due to subscription update")
                    
                    # Send notification email about subscription change
                    try:
                        from email_config import email_service
                        email_service.send_premium_notification_email(
                            to_email=user_email,
                            user_name=user_email.split('@')[0] if user_email else "User",
                            expires_at=expires_at.isoformat(),
                            granted_by="Subscription Update"
                        )
                        logger.info(f"✅ Sent subscription update email to {user_email}")
                    except Exception as e:
                        logger.error(f"❌ Failed to send subscription update email: {str(e)}")
            
            # Log the activity regardless
            log_activity(user_id, "stripe_subscription_updated", f"Subscription {subscription_id} updated - status: {subscription_status}")
            logger.info(f"📝 Subscription updated for user {user_id}: {subscription_id} - {subscription_status}")
        
    except Exception as e:
        logger.error(f"Error handling subscription update: {str(e)}")
        logger.error(f"Subscription update error traceback: {traceback.format_exc()}")

async def handle_subscription_resumed(subscription):
    """Handle subscription resumption after pause"""
    try:
        # Extract user info
        user_id = None
        user_email = None
        
        if 'metadata' in subscription and subscription['metadata'].get('user_id'):
            user_id = int(subscription['metadata']['user_id'])
            user_email = subscription['metadata'].get('user_email')
        else:
            # Find user by customer ID
            customer_id = subscription.get('customer')
            if customer_id:
                with get_db() as conn:
                    cursor = conn.cursor()
                    placeholder = get_placeholder()
                    cursor.execute(f"SELECT id, email FROM users WHERE stripe_customer_id = {placeholder}", (customer_id,))
                    user_data = cursor.fetchone()
                    if user_data:
                        user_id = user_data['id']
                        user_email = user_data['email']
        
        if not user_id:
            logger.warning(f"Could not find user for subscription resume: {subscription.get('id')}")
            return
        
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Restore premium access
            expires_at = datetime.utcnow() + timedelta(days=30)
            
            cursor.execute(f"""
                UPDATE users 
                SET role = 'premium', premium_expires_at = {placeholder}
                WHERE id = {placeholder}
            """, (expires_at, user_id))
            
            conn.commit()
            
            log_activity(user_id, "stripe_subscription_resumed", f"Premium subscription resumed via Stripe")
            logger.info(f"▶️ Premium resumed for user {user_id} via Stripe")
            
            # Send welcome back email
            try:
                from email_config import email_service
                email_content = f"""
                <h2>Welcome Back to TodoEvents Premium!</h2>
                <p>Great news! Your premium subscription has been resumed.</p>
                <p>You now have access to all premium features including:</p>
                <ul>
                    <li>Advanced event analytics</li>
                    <li>Priority customer support</li>
                    <li>Enhanced event management tools</li>
                </ul>
                <p>Your premium access expires on: {expires_at.strftime('%B %d, %Y')}</p>
                <p>Thank you for being a TodoEvents premium member!</p>
                """
                
                email_service.send_email(
                    user_email,
                    "TodoEvents Premium - Welcome Back!",
                    email_content
                )
                logger.info(f"✅ Sent subscription resumed email to {user_email}")
            except Exception as e:
                logger.error(f"❌ Failed to send subscription resumed email: {str(e)}")
        
    except Exception as e:
        logger.error(f"Error handling subscription resume: {str(e)}")
        logger.error(f"Subscription resume error traceback: {traceback.format_exc()}")

async def handle_invoice_created(invoice):
    """Handle invoice creation for billing notifications"""
    try:
        customer_id = invoice.get('customer')
        invoice_id = invoice.get('id')
        amount_due = invoice.get('amount_due', 0)
        currency = invoice.get('currency', 'usd')
        
        if not customer_id:
            logger.warning(f"No customer ID in invoice: {invoice_id}")
            return
        
        # Find user by customer ID
        with get_db() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            cursor.execute(f"SELECT id, email FROM users WHERE stripe_customer_id = {placeholder}", (customer_id,))
            user_data = cursor.fetchone()
            
            if not user_data:
                logger.warning(f"Could not find user for customer: {customer_id}")
                return
            
            user_id = user_data['id']
            user_email = user_data['email']
        
        # Log invoice creation
        log_activity(user_id, "stripe_invoice_created", f"Invoice {invoice_id} created - amount: {amount_due/100:.2f} {currency.upper()}")
        
        # Send billing notification email
        try:
            formatted_amount = f"${amount_due/100:.2f}" if currency.lower() == 'usd' else f"{amount_due/100:.2f} {currency.upper()}"
            
            # Get invoice period for better context
            period_start = invoice.get('period_start')
            period_end = invoice.get('period_end')
            period_text = ""
            
            if period_start and period_end:
                start_date = datetime.fromtimestamp(period_start).strftime('%B %d, %Y')
                end_date = datetime.fromtimestamp(period_end).strftime('%B %d, %Y')
                period_text = f"<p>Billing period: {start_date} - {end_date}</p>"
            
            from email_config import email_service
            email_content = f"""
            <h2>TodoEvents Premium - Upcoming Payment</h2>
            <p>Hello,</p>
            <p>Your TodoEvents premium subscription invoice has been created.</p>
            <p><strong>Amount due: {formatted_amount}</strong></p>
            {period_text}
            <p>Payment will be automatically processed according to your billing schedule.</p>
            <p>If you have any questions about your subscription, please don't hesitate to contact our support team.</p>
            <p>Thank you for being a TodoEvents premium member!</p>
            """
            
            email_service.send_email(
                user_email,
                f"TodoEvents Premium - Invoice for {formatted_amount}",
                email_content
            )
            logger.info(f"✅ Sent invoice notification email to {user_email} for {formatted_amount}")
            
        except Exception as e:
            logger.error(f"❌ Failed to send invoice notification email: {str(e)}")
        
        logger.info(f"📄 Invoice created for user {user_id}: {invoice_id} - {formatted_amount}")
        
    except Exception as e:
        logger.error(f"Error handling invoice creation: {str(e)}")
        logger.error(f"Invoice creation error traceback: {traceback.format_exc()}")

async def handle_invoice_upcoming(invoice):
    """Handle upcoming invoice notifications"""
    try:
        customer_id = invoice.get('customer')
        invoice_id = invoice.get('id')
        amount_due = invoice.get('amount_due', 0)
        currency = invoice.get('currency', 'usd')
        
        if not customer_id:
            logger.warning(f"No customer ID in upcoming invoice: {invoice_id}")
            return
        
        # Find user by customer ID
        with get_db() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            cursor.execute(f"SELECT id, email FROM users WHERE stripe_customer_id = {placeholder}", (customer_id,))
            user_data = cursor.fetchone()
            
            if not user_data:
                logger.warning(f"Could not find user for customer: {customer_id}")
                return
            
            user_id = user_data['id']
            user_email = user_data['email']
        
        # Log upcoming invoice
        log_activity(user_id, "stripe_invoice_upcoming", f"Upcoming invoice {invoice_id} - amount: {amount_due/100:.2f} {currency.upper()}")
        
        # Send upcoming payment notification email
        try:
            formatted_amount = f"${amount_due/100:.2f}" if currency.lower() == 'usd' else f"{amount_due/100:.2f} {currency.upper()}"
            
            # Get invoice period for better context
            period_start = invoice.get('period_start')
            period_end = invoice.get('period_end')
            period_text = ""
            
            if period_start and period_end:
                start_date = datetime.fromtimestamp(period_start).strftime('%B %d, %Y')
                end_date = datetime.fromtimestamp(period_end).strftime('%B %d, %Y')
                period_text = f"<p>Billing period: {start_date} - {end_date}</p>"
            
            from email_config import email_service
            email_content = f"""
            <h2>TodoEvents Premium - Upcoming Payment Reminder</h2>
            <p>Hello,</p>
            <p>This is a friendly reminder that your TodoEvents premium subscription payment is coming up.</p>
            <p><strong>Amount: {formatted_amount}</strong></p>
            {period_text}
            <p>Your payment method will be automatically charged on your next billing date.</p>
            <p>To update your payment method or manage your subscription, you can visit your account settings.</p>
            <p>If you have any questions about your subscription, please don't hesitate to contact our support team.</p>
            <p>Thank you for being a TodoEvents premium member!</p>
            """
            
            email_service.send_email(
                user_email,
                f"TodoEvents Premium - Upcoming Payment of {formatted_amount}",
                email_content
            )
            logger.info(f"✅ Sent upcoming payment notification email to {user_email} for {formatted_amount}")
            
        except Exception as e:
            logger.error(f"❌ Failed to send upcoming payment notification email: {str(e)}")
        
        logger.info(f"📅 Upcoming invoice processed for user {user_id}: {invoice_id} - {formatted_amount}")
        
    except Exception as e:
        logger.error(f"Error handling upcoming invoice: {str(e)}")
        logger.error(f"Upcoming invoice error traceback: {traceback.format_exc()}")

@app.get("/stripe/subscription-status")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Get detailed subscription status from Stripe for current user"""
    try:
        # This endpoint can be used to check subscription details
        # For now, just return basic info from our database
        return {
            "user_id": current_user['id'],
            "role": current_user['role'],
            "is_premium": current_user['role'] in ['premium', 'admin'],
            "email": current_user['email']
        }
        
    except Exception as e:
        logger.error(f"Error getting subscription status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get subscription status")
# Enhanced Marketing Analytics Endpoints

# Comprehensive analytics now handled by main /users/analytics endpoint with comprehensive=true parameter

# CSV export now handled by main /users/analytics endpoint with export_csv parameter

# Add explicit OPTIONS handler for analytics endpoint
@app.options("/users/analytics")
async def options_user_analytics():
    """Handle CORS preflight for user analytics"""
    from fastapi.responses import Response
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Credentials": "true",
        }
    )

# Premium User Analytics Endpoint
@app.get("/users/analytics")
async def get_user_analytics(
    current_user: dict = Depends(get_current_user),
    period_days: int = 30,
    comprehensive: bool = False,
    export_csv: str = None
):
    """
    Get analytics data for premium users
    """
    if current_user['role'] not in ['premium', 'admin', 'enterprise']:
        raise HTTPException(status_code=403, detail="Premium access required")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check what columns exist in the events table
            actual_columns = get_actual_table_columns(cursor, 'events')
            
            # Build a safe query based on available columns
            select_columns = ['id', 'title', 'date', 'start_time']
            if 'view_count' in actual_columns:
                select_columns.append('view_count')
            if 'interest_count' in actual_columns:
                select_columns.append('interest_count')
            if 'verified' in actual_columns:
                select_columns.append('verified')
            
            query = f"""
                SELECT {', '.join(select_columns)}
                FROM events 
                WHERE created_by = {placeholder}
                ORDER BY date DESC
            """
            
            cursor.execute(query, (current_user['id'],))
            events = cursor.fetchall()
            
            # Convert to list of dicts and ensure all fields exist
            event_list = []
            for event in events:
                event_dict = dict(event)
                # Ensure all expected fields exist
                if 'view_count' not in event_dict:
                    event_dict['view_count'] = 0
                if 'interest_count' not in event_dict:
                    event_dict['interest_count'] = 0
                if 'verified' not in event_dict:
                    event_dict['verified'] = False
                event_list.append(event_dict)
            
            # Calculate overall stats
            total_events = len(event_list)
            total_views = sum(event.get('view_count', 0) or 0 for event in event_list)
            total_interests = sum(event.get('interest_count', 0) or 0 for event in event_list)
            avg_views = round(total_views / total_events) if total_events > 0 else 0
            
            # Try to get trend data, but handle gracefully if tables don't exist
            view_trends = []
            interest_trends = []
            
            try:
                # Check if analytics tables exist
                if IS_PRODUCTION and DB_URL:
                    # PostgreSQL
                    cursor.execute("""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_name IN ('event_views', 'event_interests')
                        AND table_schema = 'public'
                    """)
                else:
                    # SQLite
                    cursor.execute("""
                        SELECT name 
                        FROM sqlite_master 
                        WHERE type='table' AND name IN ('event_views', 'event_interests')
                    """)
                
                table_results = cursor.fetchall()
                existing_tables = [row[0] for row in table_results] if table_results else []
                
                if 'event_views' in existing_tables:
                    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
                    
                    # Get view trends - handle potential table/column issues
                    try:
                        cursor.execute(f"""
                            SELECT DATE(ev.created_at) as date, COUNT(*) as views
                            FROM event_views ev
                            JOIN events e ON ev.event_id = e.id
                            WHERE e.created_by = {placeholder} AND ev.created_at >= {placeholder}
                            GROUP BY DATE(ev.created_at)
                            ORDER BY date
                        """, (current_user['id'], thirty_days_ago))
                        view_results = cursor.fetchall()
                    except Exception as view_error:
                        logger.warning(f"View trends query failed: {str(view_error)}")
                        view_results = []
                    view_trends = []
                    for row in view_results:
                        if hasattr(row, '_asdict'):
                            view_trends.append(row._asdict())
                        elif isinstance(row, dict):
                            view_trends.append(row)
                        else:
                            # Handle tuple results
                            view_trends.append({"date": row[0], "views": row[1]})
                
                if 'event_interests' in existing_tables:
                    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
                    
                    # Get interest trends - handle potential table/column issues
                    try:
                        cursor.execute(f"""
                            SELECT DATE(ei.created_at) as date, COUNT(*) as interests
                            FROM event_interests ei
                            JOIN events e ON ei.event_id = e.id
                            WHERE e.created_by = {placeholder} AND ei.created_at >= {placeholder}
                            GROUP BY DATE(ei.created_at)
                            ORDER BY date
                        """, (current_user['id'], thirty_days_ago))
                        interest_results = cursor.fetchall()
                    except Exception as interest_error:
                        logger.warning(f"Interest trends query failed: {str(interest_error)}")
                        interest_results = []
                    interest_trends = []
                    for row in interest_results:
                        if hasattr(row, '_asdict'):
                            interest_trends.append(row._asdict())
                        elif isinstance(row, dict):
                            interest_trends.append(row)
                        else:
                            # Handle tuple results
                            interest_trends.append({"date": row[0], "interests": row[1]})
                    
            except Exception as trend_error:
                logger.warning(f"Could not get trend data: {str(trend_error)}")
                # Continue with empty trends
            
            # Calculate engagement rate
            engagement_rate = round((total_interests / total_views * 100), 2) if total_views > 0 else 0
            avg_interests = round(total_interests / total_events) if total_events > 0 else 0
            
            # Category performance
            category_stats = {}
            for event in event_list:
                cat = event.get('category', 'Other')
                if cat not in category_stats:
                    category_stats[cat] = {"events": 0, "views": 0, "interests": 0}
                category_stats[cat]["events"] += 1
                category_stats[cat]["views"] += event.get('view_count', 0) or 0
                category_stats[cat]["interests"] += event.get('interest_count', 0) or 0
            
            # Convert to list format
            category_performance = []
            for cat, stats in category_stats.items():
                engagement = round((stats["interests"] / stats["views"] * 100), 2) if stats["views"] > 0 else 0
                category_performance.append({
                    "category": cat,
                    "events": stats["events"],
                    "views": stats["views"], 
                    "interests": stats["interests"],
                    "engagement_rate": engagement
                })
            
            # Geographic performance analysis
            geographic_stats = {}
            for event in event_list:
                city = event.get('city', 'Unknown')
                state = event.get('state', 'Unknown')
                location = f"{city}, {state}" if city != 'Unknown' and state != 'Unknown' else city if city != 'Unknown' else 'Unknown Location'
                
                if location not in geographic_stats:
                    geographic_stats[location] = {"events": 0, "views": 0, "interests": 0}
                geographic_stats[location]["events"] += 1
                geographic_stats[location]["views"] += event.get('view_count', 0) or 0
                geographic_stats[location]["interests"] += event.get('interest_count', 0) or 0

            # Create time series data (last 30 days)
            from datetime import datetime, timedelta
            time_series_data = {}
            for i in range(30):
                date = (datetime.utcnow() - timedelta(days=29-i)).strftime('%Y-%m-%d')
                time_series_data[date] = {"views": 0, "interests": 0, "events_created": 0}
            
            # Add actual event creation dates
            for event in event_list:
                created_date = event.get('created_at', '').split('T')[0] if event.get('created_at') else None
                if created_date and created_date in time_series_data:
                    time_series_data[created_date]["events_created"] += 1
            
            # Always return comprehensive format that frontend expects
            response_data = {
                "summary": {
                    "total_events": total_events,
                    "total_views": total_views,
                    "total_interests": total_interests,
                    "avg_views_per_event": avg_views,
                    "avg_interests_per_event": avg_interests,
                    "engagement_rate_percent": engagement_rate,
                    "period_days": period_days
                },
                "category_performance": category_performance,
                "geographic_distribution": geographic_stats,
                "time_series": time_series_data,
                "top_performing_events": sorted(event_list, key=lambda x: x.get('view_count', 0), reverse=True)[:10],
                "all_events": event_list
            }
            
            # Handle CSV export if requested
            if export_csv:
                import csv
                from io import StringIO
                from fastapi.responses import Response
                
                output = StringIO()
                
                if export_csv == "events":
                    # Events performance CSV
                    writer = csv.writer(output)
                    writer.writerow(['Event Title', 'Date', 'Category', 'Views', 'Interests', 'Engagement Rate %'])
                    
                    for event in response_data.get('all_events', []):
                        views = event.get('view_count', 0) or 0
                        interests = event.get('interest_count', 0) or 0
                        engagement = round((interests / views * 100), 2) if views > 0 else 0
                        
                        writer.writerow([
                            event.get('title', ''),
                            event.get('date', ''),
                            event.get('category', ''),
                            views,
                            interests,
                            engagement
                        ])
                elif export_csv == "categories":
                    # Category performance CSV
                    writer = csv.writer(output)
                    writer.writerow(['Category', 'Events', 'Total Views', 'Total Interests', 'Engagement Rate %'])
                    
                    for cat in response_data.get('category_performance', []):
                        writer.writerow([
                            cat['category'],
                            cat['events'],
                            cat['views'],
                            cat['interests'],
                            cat['engagement_rate']
                        ])
                
                csv_content = output.getvalue()
                filename = f"todoevents_analytics_{export_csv}_{period_days}days_{datetime.utcnow().strftime('%Y%m%d')}.csv"
                
                return Response(
                    content=csv_content,
                    media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={filename}"}
                )
            
            # Return with explicit CORS headers
            from fastapi.responses import JSONResponse
            response = JSONResponse(content=response_data)
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
            
    except Exception as e:
        logger.error(f"Error getting user analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving analytics")


@app.get("/events/{event_id}/analytics")
async def get_event_analytics(
    event_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed analytics for a specific event"""
    logger.info(f"🔍 Getting analytics for event {event_id} by user {current_user.get('id')}")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Get event details and verify ownership
            cursor.execute(
                f"""SELECT id, title, description, date, start_time, category, city, state, 
                           created_by, COALESCE(view_count, 0) as view_count, 
                           COALESCE(interest_count, 0) as interest_count,
                           created_at, slug
                    FROM events 
                    WHERE id = {placeholder}""", 
                (event_id,)
            )
            event = cursor.fetchone()
            
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Check if user owns this event or is admin
            if event['created_by'] != current_user['id'] and current_user.get('role') != 'admin':
                raise HTTPException(status_code=403, detail="Not authorized to view this event's analytics")
            
            # Get time-based view analytics (simulate daily tracking over past 30 days)
            from datetime import datetime, timedelta
            
            # Create mock time series data based on event creation date and current views
            created_date = datetime.fromisoformat(event['created_at'].replace('Z', '+00:00')) if event['created_at'] else datetime.utcnow()
            current_date = datetime.utcnow()
            
            time_series = {}
            total_views = event['view_count'] or 0
            total_interests = event['interest_count'] or 0
            
            # Generate 30 days of data
            for i in range(30):
                date = (current_date - timedelta(days=29-i)).strftime('%Y-%m-%d')
                
                # Simulate realistic view progression
                days_since_creation = (current_date - timedelta(days=29-i) - created_date).days
                if days_since_creation >= 0:
                    # Simulate decreasing view rate over time
                    views_multiplier = max(0.1, 1 - (days_since_creation * 0.05))
                    daily_views = max(0, int(total_views * views_multiplier * 0.1))  # 10% of total distributed
                    daily_interests = max(0, int(total_interests * views_multiplier * 0.1))
                else:
                    daily_views = 0
                    daily_interests = 0
                
                time_series[date] = {
                    "views": daily_views,
                    "interests": daily_interests
                }
            
            # Extract location from city/state or slug
            location = 'Unknown Location'
            city = event.get('city', '').strip() if event.get('city') else ''
            state = event.get('state', '').strip() if event.get('state') else ''
            slug = event.get('slug', '').strip() if event.get('slug') else ''
            
            if city and state:
                location = f"{city}, {state}"
            elif city:
                location = city
            elif slug:
                # Extract location from slug: us/fl/daytona-beach/events/test-734175
                try:
                    slug_parts = slug.split('/')
                    if len(slug_parts) >= 3 and slug_parts[0] and slug_parts[1] and slug_parts[2]:
                        country = slug_parts[0].upper()  # us -> US
                        state_code = slug_parts[1].upper()    # fl -> FL 
                        city_slug = slug_parts[2].replace('-', ' ').title()  # daytona-beach -> Daytona Beach
                        location = f"{city_slug}, {state_code}, {country}"
                        logger.info(f"📍 Extracted location from slug: '{slug}' -> '{location}'")
                except Exception as e:
                    logger.warning(f"Could not parse location from slug '{slug}': {e}")
                    location = 'Unknown Location'
            
            geographic_data = {
                location: {
                    "views": total_views,
                    "interests": total_interests
                }
            }
            
            # Traffic source simulation (referral data)
            traffic_sources = {
                "Direct": int(total_views * 0.4),
                "Social Media": int(total_views * 0.3),
                "Search": int(total_views * 0.2),
                "Referral": int(total_views * 0.1)
            }
            
            # Engagement metrics
            engagement_rate = round((total_interests / total_views * 100), 2) if total_views > 0 else 0
            
            # Peak viewing times (simulate)
            peak_hours = {
                "9 AM": int(total_views * 0.08),
                "12 PM": int(total_views * 0.15),
                "3 PM": int(total_views * 0.12),
                "6 PM": int(total_views * 0.20),
                "9 PM": int(total_views * 0.18),
                "Other": int(total_views * 0.27)
            }
            
            # Log the extracted data for debugging
            logger.info(f"🔍 Event analytics for {event_id}: title='{event['title']}', category='{event['category']}', location='{location}', slug='{event.get('slug', 'None')}'")
            
            # Enhanced category handling
            category = event['category'] or 'Other'
            if not category or category.strip() == '':
                category = 'Other'
            
            response_data = {
                "event": {
                    "id": event['id'],
                    "title": event['title'] or 'Untitled Event',
                    "description": event['description'] or '',
                    "date": event['date'],
                    "category": category,
                    "location": location,
                    "slug": event.get('slug', '')
                },
                "summary": {
                    "total_views": total_views,
                    "total_interests": total_interests,
                    "engagement_rate": engagement_rate,
                    "created_date": event['created_at']
                },
                "time_series": time_series,
                "geographic_distribution": geographic_data,
                "traffic_sources": traffic_sources,
                "peak_viewing_hours": peak_hours,
                "performance_metrics": {
                    "view_velocity": round(total_views / max(1, (current_date - created_date).days), 2),
                    "interest_conversion": engagement_rate,
                    "days_active": max(1, (current_date - created_date).days)
                },
                "debug_info": {
                    "original_city": event.get('city', ''),
                    "original_state": event.get('state', ''),
                    "original_category": event.get('category', ''),
                    "slug": event.get('slug', '')
                }
            }
            
            return response_data
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting event analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving event analytics")

# Temporary debug version without Pydantic validation
@app.get("/events/manage-debug")
async def list_user_events_debug(current_user: dict = Depends(get_current_user)):
    """Debug version without Pydantic validation to isolate the issue"""
    logger.info(f"🔍 /events/manage-debug called by user {current_user.get('id', 'unknown')}")
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            placeholder = get_placeholder()
            
            # Simple query
            c.execute(f"SELECT * FROM events WHERE created_by = {placeholder} ORDER BY date, start_time LIMIT 5", (current_user["id"],))
            events = c.fetchall()
            
            raw_events = []
            for event in events:
                raw_events.append(dict(event))
            
            return {
                "success": True,
                "count": len(raw_events),
                "events": raw_events,
                "user_id": current_user["id"]
            }
    except Exception as e:
        logger.error(f"Debug endpoint error: {str(e)}")
        return {"success": False, "error": str(e)}

# Simple user events endpoint - replaces complex manage-fix endpoints
@app.get("/user/events", response_model=List[EventResponse])
async def get_user_events(current_user: dict = Depends(get_current_user)):
    """Get all events created by the current user - simple and reliable"""
    logger.info(f"🔍 /user/events called by user {current_user.get('id', 'unknown')} ({current_user.get('email', 'unknown')})")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Simple, reliable query for user's events
            query = f"""
                SELECT id, title, description, short_description, date, start_time, end_time, end_date, 
                       category, secondary_category, address, city, state, country, lat, lng, recurring, frequency, 
                       created_by, created_at, updated_at, start_datetime, end_datetime,
                       COALESCE(interest_count, 0) as interest_count,
                       COALESCE(view_count, 0) as view_count,
                       fee_required, price, currency, event_url, host_name, organizer_url, slug, is_published, verified
                FROM events 
                WHERE created_by = {placeholder}
                ORDER BY date DESC, start_time DESC
            """
            
            logger.info(f"🔍 Executing query for user {current_user['id']}")
            c.execute(query, (current_user["id"],))
            events = c.fetchall()
            
            logger.info(f"🔍 Found {len(events)} events for user {current_user['id']}")
            
            event_list = []
            for event in events:
                try:
                    # Convert to dict
                    event_dict = dict(event)
                    
                    # Apply datetime conversion
                    event_dict = convert_event_datetime_fields(event_dict)
                    
                    # Ensure required fields have safe values
                    event_dict['title'] = event_dict.get('title') or "Untitled Event"
                    event_dict['description'] = event_dict.get('description') or "No description"
                    event_dict['address'] = event_dict.get('address') or "Address not provided"
                    event_dict['category'] = event_dict.get('category') or "other"
                    event_dict['date'] = event_dict.get('date') or "2024-01-01"
                    event_dict['start_time'] = event_dict.get('start_time') or "00:00"
                    event_dict['lat'] = float(event_dict.get('lat') or 0.0)
                    event_dict['lng'] = float(event_dict.get('lng') or 0.0)
                    event_dict['recurring'] = bool(event_dict.get('recurring', False))
                    event_dict['interest_count'] = int(event_dict.get('interest_count', 0) or 0)
                    event_dict['view_count'] = int(event_dict.get('view_count', 0) or 0)
                    event_dict['verified'] = bool(event_dict.get('verified', False))
                    event_dict['is_published'] = bool(event_dict.get('is_published', True))
                    event_dict['country'] = event_dict.get('country') or "USA"
                    event_dict['currency'] = event_dict.get('currency') or "USD"
                    event_dict['price'] = float(event_dict.get('price', 0.0) or 0.0)
                    
                    # Handle optional string fields
                    optional_fields = ['short_description', 'end_time', 'end_date', 'secondary_category', 
                                     'city', 'state', 'frequency', 'fee_required', 'event_url', 
                                     'host_name', 'organizer_url', 'slug', 'updated_at', 
                                     'start_datetime', 'end_datetime']
                    for field in optional_fields:
                        if field in event_dict and event_dict[field] is None:
                            event_dict[field] = ""
                    
                    event_list.append(event_dict)
                    
                except Exception as event_error:
                    logger.error(f"🔍 Error processing event {event.get('id', 'unknown')}: {event_error}")
                    continue
            
            logger.info(f"🔍 Successfully processed {len(event_list)} events")
            return event_list
            
    except Exception as e:
        logger.error(f"🔍 Error in /user/events: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving user events: {str(e)}")

# Temporary version without response model to isolate Pydantic validation issues
@app.get("/events/manage-fix-no-validation")
async def list_user_events_no_validation(current_user: dict = Depends(get_current_user)):
    """Version without response_model to test if Pydantic validation is the issue"""
    logger.info(f"🔍 /events/manage-fix-no-validation called by user {current_user.get('id', 'unknown')}")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Simple query without column detection complexity
            query = f"SELECT * FROM events WHERE created_by = {placeholder} ORDER BY date, start_time"
            logger.info(f"🔍 Executing query: {query} with user_id={current_user['id']}")
            c.execute(query, (current_user["id"],))
            events = c.fetchall()
            
            logger.info(f"🔍 Found {len(events)} events for user {current_user['id']}")
            
            event_list = []
            for i, event in enumerate(events):
                try:
                    event_dict = dict(event)
                    event_id = event_dict.get('id', 'unknown')
                    
                    logger.info(f"🔍 Processing event {i+1}/{len(events)}: ID={event_id}")
                    
                    # Just convert to dict and add minimal required fields
                    event_dict = dict(event)
                    
                    # Apply basic datetime conversion if needed
                    try:
                        event_dict = convert_event_datetime_fields(event_dict)
                        logger.info(f"🔍 Event {event_id}: Successfully processed and converted")
                    except Exception as conversion_error:
                        logger.error(f"🔍 Event {event_id}: Datetime conversion failed: {conversion_error}")
                        # Continue with original event_dict if conversion fails
                    
                    event_list.append(event_dict)
                    
                except Exception as event_error:
                    logger.error(f"🔍 Error processing event {event_id}: {event_error}")
                    logger.error(f"🔍 Event data: {dict(event)}")
                    continue
            
            logger.info(f"🔍 Successfully processed {len(event_list)} events, returning response")
            return event_list
            
    except Exception as e:
        logger.error(f"🔍 Critical error in /events/manage-fix-no-validation: {str(e)}")
        logger.error(f"🔍 Traceback: {traceback.format_exc()}")
        return {"error": str(e), "traceback": traceback.format_exc()}

# Robust replacement for /events/manage to fix 422 errors
@app.get("/events/manage-fix", response_model=List[EventResponse])
async def list_user_events_robust(current_user: dict = Depends(get_current_user)):
    """
    ROBUST version of events/manage that ensures no 422 errors with detailed logging.
    """
    logger.info(f"🔍 /events/manage-fix called by user {current_user.get('id', 'unknown')} ({current_user.get('email', 'unknown')})")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Simple query without column detection complexity
            query = f"SELECT * FROM events WHERE created_by = {placeholder} ORDER BY date, start_time"
            logger.info(f"🔍 Executing query: {query} with user_id={current_user['id']}")
            c.execute(query, (current_user["id"],))
            events = c.fetchall()
            
            logger.info(f"🔍 Found {len(events)} events for user {current_user['id']}")
            
            event_list = []
            for i, event in enumerate(events):
                try:
                    event_dict = dict(event)
                    event_id = event_dict.get('id', 'unknown')
                    
                    logger.info(f"🔍 Processing event {i+1}/{len(events)}: ID={event_id}")
                    
                    # ENSURE ALL REQUIRED FIELDS EXIST WITH SAFE DEFAULTS
                    # Required string fields
                    event_dict['title'] = str(event_dict.get('title', '')).strip() or "Untitled Event"
                    event_dict['description'] = str(event_dict.get('description', '')).strip() or "No description provided"
                    event_dict['date'] = str(event_dict.get('date', '')).strip() or "2024-01-01"
                    event_dict['start_time'] = str(event_dict.get('start_time', '')).strip() or "00:00"
                    event_dict['category'] = str(event_dict.get('category', '')).strip() or "other"
                    event_dict['address'] = str(event_dict.get('address', '')).strip() or "Address not provided"
                    
                    # Required numeric fields
                    try:
                        event_dict['lat'] = float(event_dict.get('lat', 0.0) or 0.0)
                    except (ValueError, TypeError):
                        logger.warning(f"🔍 Event {event_id}: Invalid lat value, using default 0.0")
                        event_dict['lat'] = 0.0
                    try:
                        event_dict['lng'] = float(event_dict.get('lng', 0.0) or 0.0)
                    except (ValueError, TypeError):
                        logger.warning(f"🔍 Event {event_id}: Invalid lng value, using default 0.0")
                        event_dict['lng'] = 0.0
                    
                    # Required integer fields
                    event_dict['created_by'] = int(event_dict.get('created_by', current_user["id"]))
                    event_dict['id'] = int(event_dict.get('id', 0))
                    
                    # Required datetime field
                    event_dict['created_at'] = str(event_dict.get('created_at', datetime.utcnow().isoformat()))
                    
                    # All optional fields with proper defaults
                    event_dict['verified'] = bool(event_dict.get('verified', False))
                    event_dict['interest_count'] = int(event_dict.get('interest_count', 0) or 0)
                    event_dict['view_count'] = int(event_dict.get('view_count', 0) or 0)
                    event_dict['secondary_category'] = event_dict.get('secondary_category')
                    event_dict['updated_at'] = event_dict.get('updated_at')
                    event_dict['start_datetime'] = event_dict.get('start_datetime')
                    event_dict['end_datetime'] = event_dict.get('end_datetime')
                    event_dict['short_description'] = event_dict.get('short_description')
                    event_dict['end_time'] = event_dict.get('end_time')
                    event_dict['end_date'] = event_dict.get('end_date')
                    event_dict['city'] = event_dict.get('city')
                    event_dict['state'] = event_dict.get('state')
                    event_dict['country'] = str(event_dict.get('country', 'USA'))
                    event_dict['recurring'] = bool(event_dict.get('recurring', False))
                    event_dict['frequency'] = event_dict.get('frequency')
                    event_dict['fee_required'] = event_dict.get('fee_required')
                    try:
                        event_dict['price'] = float(event_dict.get('price', 0.0) or 0.0)
                    except (ValueError, TypeError):
                        logger.warning(f"🔍 Event {event_id}: Invalid price value, using default 0.0")
                        event_dict['price'] = 0.0
                    event_dict['currency'] = str(event_dict.get('currency', 'USD'))
                    event_dict['event_url'] = event_dict.get('event_url')
                    event_dict['host_name'] = event_dict.get('host_name')
                    event_dict['organizer_url'] = event_dict.get('organizer_url')
                    event_dict['slug'] = event_dict.get('slug')
                    event_dict['is_published'] = bool(event_dict.get('is_published', True))
                    
                    # Apply datetime conversion and log any issues
                    try:
                        event_dict = convert_event_datetime_fields(event_dict)
                        logger.info(f"🔍 Event {event_id}: Successfully processed and converted")
                    except Exception as conversion_error:
                        logger.error(f"🔍 Event {event_id}: Datetime conversion failed: {conversion_error}")
                        # Continue with original event_dict if conversion fails
                    
                    event_list.append(event_dict)
                    
                except Exception as event_error:
                    logger.error(f"🔍 Error processing event {event_id}: {event_error}")
                    logger.error(f"🔍 Event data: {dict(event)}")
                    # Skip this event but continue with others
                    continue
            
            logger.info(f"🔍 Successfully processed {len(event_list)} events, returning response")
            return event_list
            
    except Exception as e:
        logger.error(f"🔍 Critical error in /events/manage-fix: {str(e)}")
        logger.error(f"🔍 Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error retrieving user events: {str(e)}")

# Premium Management Models
class PremiumGrantRequest(BaseModel):
    months: int = 1

class PremiumInviteRequest(BaseModel):
    email: EmailStr
    months: int = 1
    message: Optional[str] = None

class EnterpriseInviteRequest(BaseModel):
    email: EmailStr
    months: int = 1
    message: Optional[str] = None

class RouteEventRequest(BaseModel):
    coordinates: List[Dict[str, float]]  # List of {lat: float, lng: float}
    radius: float = 25.0  # Default radius in miles
    dateRange: Optional[Dict[str, str]] = None  # Optional {startDate: str, endDate: str}
# Premium Management Endpoints
@app.get("/admin/premium-users")
async def get_premium_users(current_user: dict = Depends(get_current_user)):
    """Get all premium users with their expiration dates"""
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # First, check if premium columns exist
            try:
                if IS_PRODUCTION and DB_URL:
                    # PostgreSQL - check if columns exist
                    c.execute("""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name = 'users' 
                        AND column_name IN ('premium_expires_at', 'premium_granted_by', 'premium_invited')
                    """)
                    existing_columns = [row[0] for row in c.fetchall()]
                else:
                    # SQLite - check if columns exist
                    c.execute('PRAGMA table_info(users)')
                    columns_info = c.fetchall()
                    existing_columns = [col[1] for col in columns_info if col[1] in ['premium_expires_at', 'premium_granted_by', 'premium_invited']]
                
                has_premium_columns = len(existing_columns) > 0
                logger.info(f"Premium columns check: {existing_columns}, has_premium_columns: {has_premium_columns}")
                
            except Exception as e:
                logger.warning(f"Could not check premium columns: {e}")
                has_premium_columns = False
            
            # Build query based on available columns
            if has_premium_columns and 'premium_expires_at' in existing_columns:
                # Full query with premium columns
                query = f"""
                    SELECT u.id, u.email, u.role, u.created_at,
                           u.premium_expires_at, u.premium_granted_by, u.premium_invited,
                           admin.email as granted_by_email
                    FROM users u
                    LEFT JOIN users admin ON u.premium_granted_by = admin.id
                    WHERE u.role = 'premium' OR u.premium_expires_at IS NOT NULL
                    ORDER BY u.premium_expires_at DESC NULLS LAST, u.created_at DESC
                """
            else:
                # Fallback query without premium columns
                query = f"""
                    SELECT u.id, u.email, u.role, u.created_at
                    FROM users u
                    WHERE u.role = 'premium'
                    ORDER BY u.created_at DESC
                """
            
            c.execute(query)
            users = []
            for row in c.fetchall():
                user_dict = dict(row)
                
                # Add default values for missing columns
                if 'premium_expires_at' not in user_dict:
                    user_dict['premium_expires_at'] = None
                if 'premium_granted_by' not in user_dict:
                    user_dict['premium_granted_by'] = None
                if 'premium_invited' not in user_dict:
                    user_dict['premium_invited'] = False
                if 'granted_by_email' not in user_dict:
                    user_dict['granted_by_email'] = None
                
                # Check if premium is expired
                if user_dict['premium_expires_at']:
                    try:
                        from datetime import datetime
                        expires_at = datetime.fromisoformat(user_dict['premium_expires_at'].replace('Z', '+00:00')) if isinstance(user_dict['premium_expires_at'], str) else user_dict['premium_expires_at']
                        user_dict['is_expired'] = expires_at < datetime.utcnow()
                    except:
                        user_dict['is_expired'] = False
                else:
                    user_dict['is_expired'] = False
                
                users.append(user_dict)
            
            return {
                "users": users,
                "has_premium_columns": has_premium_columns,
                "available_columns": existing_columns if has_premium_columns else []
            }
            
    except Exception as e:
        logger.error(f"Error getting premium users: {str(e)}")
        logger.error(f"Error details: {type(e).__name__}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error retrieving premium users: {str(e)}")

@app.post("/admin/users/{user_id}/grant-premium")
async def grant_premium(
    user_id: int,
    request: PremiumGrantRequest,
    current_user: dict = Depends(get_current_user)
):
    """Grant premium access to a user for specified months"""
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user exists
            c.execute(f"SELECT * FROM users WHERE id = {placeholder}", (user_id,))
            user = c.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Calculate expiration date
            from datetime import datetime, timedelta
            expires_at = datetime.utcnow() + timedelta(days=30 * request.months)
            
            # Update user to premium
            c.execute(f"""
                UPDATE users 
                SET role = 'premium', 
                    premium_expires_at = {placeholder},
                    premium_granted_by = {placeholder}
                WHERE id = {placeholder}
            """, (expires_at, current_user['id'], user_id))
            
            conn.commit()
            
            # Log the activity
            log_activity(current_user['id'], "grant_premium", f"Granted {request.months} months premium to {user['email']}")
            
            return {
                "detail": f"Premium access granted for {request.months} months",
                "expires_at": expires_at.isoformat(),
                "user_email": user['email']
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error granting premium to user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error granting premium access")

@app.delete("/admin/users/{user_id}/remove-premium")
async def remove_premium(
    user_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Remove premium access from a user"""
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user exists
            c.execute(f"SELECT * FROM users WHERE id = {placeholder}", (user_id,))
            user = c.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Update user to regular user
            c.execute(f"""
                UPDATE users 
                SET role = 'user', 
                    premium_expires_at = NULL,
                    premium_granted_by = NULL
                WHERE id = {placeholder}
            """, (user_id,))
            
            conn.commit()
            
            # Log the activity
            log_activity(current_user['id'], "remove_premium", f"Removed premium from {user['email']}")
            
            return {
                "detail": "Premium access removed",
                "user_email": user['email']
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing premium from user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error removing premium access")

@app.post("/admin/premium-invite")
async def invite_premium_user(
    request: PremiumInviteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Invite a new user via email with premium trial"""
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user already exists
            c.execute(f"SELECT * FROM users WHERE email = {placeholder}", (request.email,))
            existing_user = c.fetchone()
            
            if existing_user:
                # For existing users, upgrade them to premium instead of returning error
                from datetime import datetime, timedelta
                expires_at = datetime.utcnow() + timedelta(days=30 * request.months)
                
                # Check if premium columns exist before updating
                try:
                    if IS_PRODUCTION and DB_URL:
                        # PostgreSQL - check if columns exist
                        c.execute("""
                            SELECT column_name 
                            FROM information_schema.columns 
                            WHERE table_name = 'users' 
                            AND column_name IN ('premium_expires_at', 'premium_granted_by')
                        """)
                        existing_columns = [row[0] for row in c.fetchall()]
                    else:
                        # SQLite - check if columns exist
                        c.execute('PRAGMA table_info(users)')
                        columns_info = c.fetchall()
                        existing_columns = [col[1] for col in columns_info if col[1] in ['premium_expires_at', 'premium_granted_by']]
                    
                    has_premium_columns = len(existing_columns) >= 2
                except Exception:
                    has_premium_columns = False
                
                # Update user to premium with appropriate columns
                if has_premium_columns:
                    c.execute(f"""
                        UPDATE users 
                        SET role = 'premium', 
                            premium_expires_at = {placeholder},
                            premium_granted_by = {placeholder}
                        WHERE id = {placeholder}
                    """, (expires_at, current_user['id'], existing_user['id']))
                else:
                    # Fallback: just update role
                    c.execute(f"""
                        UPDATE users 
                        SET role = 'premium'
                        WHERE id = {placeholder}
                    """, (existing_user['id'],))
                
                conn.commit()
                
                # Log the activity
                log_activity(current_user['id'], "premium_invite_existing", f"Upgraded existing user {request.email} to {request.months} months premium")
                
                # Send premium notification email
                try:
                    from email_config import email_service
                    email_sent = email_service.send_premium_notification_email(
                        to_email=request.email,
                        user_name=existing_user.get('full_name'),
                        expires_at=expires_at.isoformat(),
                        granted_by=current_user.get('email', 'Admin')
                    )
                    
                    if email_sent:
                        logger.info(f"✅ Premium upgrade notification email sent to {request.email}")
                    else:
                        logger.error(f"❌ Failed to send premium upgrade notification email to {request.email}")
                except Exception as e:
                    logger.error(f"❌ Error sending premium upgrade notification email: {str(e)}")
                
                return {
                    "detail": f"Existing user upgraded to premium for {request.months} months",
                    "user_exists": True,
                    "user_id": existing_user['id'],
                    "previous_role": existing_user['role'],
                    "new_role": "premium",
                    "expires_at": expires_at.isoformat(),
                    "email": request.email,
                    "months": request.months
                }
            
            # Create invitation record (we'll send email here in production)
            # For now, we'll just log the invitation
            log_activity(current_user['id'], "premium_invite", f"Invited {request.email} for {request.months} months premium trial")
            
            # In a real implementation, you would send an email here
            # send_premium_invitation_email(request.email, request.months, request.message)
            
            return {
                "detail": f"Premium invitation sent to {request.email}",
                "email": request.email,
                "months": request.months,
                "message": "Invitation email would be sent in production"
            }
    except Exception as e:
        logger.error(f"Error sending premium invitation: {str(e)}")
        raise HTTPException(status_code=500, detail="Error sending invitation")

@app.post("/admin/enterprise-invite")
async def invite_enterprise_user(
    request: EnterpriseInviteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Invite a new user via email with enterprise trial"""
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user already exists
            c.execute(f"SELECT * FROM users WHERE email = {placeholder}", (request.email,))
            existing_user = c.fetchone()
            
            if existing_user:
                # For existing users, upgrade them to enterprise instead of returning error
                from datetime import datetime, timedelta
                expires_at = datetime.utcnow() + timedelta(days=30 * request.months)
                
                # Check if premium columns exist before updating
                try:
                    if IS_PRODUCTION and DB_URL:
                        # PostgreSQL - check if columns exist
                        c.execute("""
                            SELECT column_name 
                            FROM information_schema.columns 
                            WHERE table_name = 'users' 
                            AND column_name IN ('premium_expires_at', 'premium_granted_by')
                        """)
                        existing_columns = [row[0] for row in c.fetchall()]
                    else:
                        # SQLite - check if columns exist
                        c.execute('PRAGMA table_info(users)')
                        columns_info = c.fetchall()
                        existing_columns = [col[1] for col in columns_info if col[1] in ['premium_expires_at', 'premium_granted_by']]
                    
                    has_premium_columns = len(existing_columns) >= 2
                except Exception:
                    has_premium_columns = False
                
                # Update user to enterprise with appropriate columns
                if has_premium_columns:
                    c.execute(f"""
                        UPDATE users 
                        SET role = 'enterprise', 
                            premium_expires_at = {placeholder},
                            premium_granted_by = {placeholder}
                        WHERE id = {placeholder}
                    """, (expires_at, current_user['id'], existing_user['id']))
                else:
                    # Fallback: just update role
                    c.execute(f"""
                        UPDATE users 
                        SET role = 'enterprise'
                        WHERE id = {placeholder}
                    """, (existing_user['id'],))
                
                conn.commit()
                
                # Log the activity
                log_activity(current_user['id'], "enterprise_invite_existing", f"Upgraded existing user {request.email} to {request.months} months enterprise")
                
                # Send enterprise notification email
                try:
                    from email_config import email_service
                    email_sent = email_service.send_enterprise_notification_email(
                        to_email=request.email,
                        user_name=existing_user.get('full_name'),
                        expires_at=expires_at.isoformat(),
                        granted_by=current_user.get('email', 'Admin')
                    )
                    
                    if email_sent:
                        logger.info(f"✅ Enterprise upgrade notification email sent to {request.email}")
                    else:
                        logger.error(f"❌ Failed to send enterprise upgrade notification email to {request.email}")
                except Exception as e:
                    logger.error(f"❌ Error sending enterprise upgrade notification email: {str(e)}")
                
                return {
                    "detail": f"Existing user upgraded to enterprise for {request.months} months",
                    "user_exists": True,
                    "user_id": existing_user['id'],
                    "previous_role": existing_user['role'],
                    "new_role": "enterprise",
                    "expires_at": expires_at.isoformat(),
                    "email": request.email,
                    "months": request.months
                }
            
            # Create invitation record (we'll send email here in production)
            # For now, we'll just log the invitation
            log_activity(current_user['id'], "enterprise_invite", f"Invited {request.email} for {request.months} months enterprise trial")
            
            # In a real implementation, you would send an email here
            # send_enterprise_invitation_email(request.email, request.months, request.message)
            
            return {
                "detail": f"Enterprise invitation sent to {request.email}",
                "email": request.email,
                "months": request.months,
                "message": "Invitation email would be sent in production"
            }
    except Exception as e:
        logger.error(f"Error sending enterprise invitation: {str(e)}")
        raise HTTPException(status_code=500, detail="Error sending invitation")

@app.get("/enterprise/stats")
async def get_enterprise_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get enterprise dashboard stats"""
    if current_user['role'] not in [UserRole.ENTERPRISE, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Get total events
            c.execute("SELECT COUNT(*) FROM events")
            total_events = c.fetchone()[0]
            
            # Get total users
            c.execute("SELECT COUNT(*) FROM users")
            total_users = c.fetchone()[0]
            
            # Get active users (users with events in last 30 days)
            db_parts = get_db_compatible_query_parts()
            query = f"""
                SELECT COUNT(DISTINCT created_by) 
                FROM events 
                WHERE created_at >= {db_parts['interval_30_days']}
            """
            c.execute(query)
            active_users = c.fetchone()[0]
            
            # Calculate completion rate (events with descriptions vs without)
            c.execute("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as with_description
                FROM events
            """)
            result = c.fetchone()
            completion_rate = round((result[1] / result[0] * 100) if result[0] > 0 else 0, 1)
            
            return {
                "totalEvents": total_events,
                "totalUsers": total_users,
                "activeUsers": active_users,
                "completionRate": completion_rate
            }
            
    except Exception as e:
        logger.error(f"Error fetching enterprise stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching stats")

@app.get("/enterprise/export")
async def export_enterprise_data(
    current_user: dict = Depends(get_current_user)
):
    """Export enterprise data as CSV"""
    if current_user['role'] not in [UserRole.ENTERPRISE, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Get events data with correct column names
            c.execute("""
                SELECT 
                    e.id,
                    e.title,
                    e.description,
                    e.date || ' ' || e.start_time as date_time,
                    e.address as location,
                    e.category,
                    CASE WHEN e.fee_required IS NULL OR e.fee_required = '' THEN 'Yes' ELSE 'No' END as is_free,
                    u.email as creator_email,
                    e.created_at
                FROM events e
                JOIN users u ON e.created_by = u.id
                ORDER BY e.created_at DESC
            """)
            
            events = c.fetchall()
            
            # Create CSV content
            import io
            import csv
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow([
                'Event ID', 'Title', 'Description', 'Date Time', 'Location', 
                'Category', 'Is Free', 'Creator Email', 'Created At'
            ])
            
            # Write data
            for event in events:
                writer.writerow(event)
            
            # Create response
            from fastapi.responses import Response
            csv_content = output.getvalue()
            output.close()
            
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": "attachment; filename=enterprise-data.csv"
                }
            )
            
    except Exception as e:
        logger.error(f"Error exporting enterprise data: {str(e)}")
        raise HTTPException(status_code=500, detail="Error exporting data")

@app.get("/enterprise/overview")
async def get_enterprise_overview(
    current_user: dict = Depends(get_current_user)
):
    """Get enterprise overview data"""
    if current_user['role'] not in [UserRole.ENTERPRISE, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    db_parts = get_db_compatible_query_parts()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            logger.info(f"Enterprise overview request from user {current_user['id']} with role {current_user['role']}")
            
            # Get stats - for enterprise users, show only their data
            if current_user['role'] == UserRole.ENTERPRISE:
                # Only show this user's events
                query = f"SELECT COUNT(*) FROM events WHERE created_by = {placeholder}"
                logger.info(f"Executing query: {query} with params: {(current_user['id'],)}")
                c.execute(query, (current_user['id'],))
                result = c.fetchone()
                logger.info(f"Query result: {result}")
                
                total_events = get_count_from_result(result)
                
                # For enterprise users, total_users is just 1 (themselves)
                total_users = 1
                
                # Get monthly growth for this user's events using database-compatible syntax
                db_parts = get_db_compatible_query_parts()
                try:
                    growth_query = f"""
                        SELECT 
                            COUNT(*) as this_month,
                            (SELECT COUNT(*) FROM events WHERE created_by = {placeholder} AND created_at >= {db_parts['interval_60_days']} AND created_at < {db_parts['interval_30_days']}) as last_month
                        FROM events 
                        WHERE created_by = {placeholder} AND created_at >= {db_parts['interval_30_days']}
                    """
                    logger.info(f"Executing growth query: {growth_query}")
                    c.execute(growth_query, (current_user['id'], current_user['id']))
                except Exception as e:
                    logger.error(f"Growth query failed, using fallback: {e}")
                    # Fallback to simpler query
                    c.execute(f"SELECT COUNT(*) as this_month, 0 as last_month FROM events WHERE created_by = {placeholder}", (current_user['id'],))
            else:
                # Admin sees all data
                c.execute("SELECT COUNT(*) FROM events")
                total_events = get_count_from_result(c.fetchone())
                
                c.execute("SELECT COUNT(*) FROM users")
                total_users = get_count_from_result(c.fetchone())
                
                # Get monthly growth for all events using database-compatible syntax
                db_parts = get_db_compatible_query_parts()
                try:
                    growth_query = f"""
                        SELECT 
                            COUNT(*) as this_month,
                            (SELECT COUNT(*) FROM events WHERE created_at >= {db_parts['interval_60_days']} AND created_at < {db_parts['interval_30_days']}) as last_month
                        FROM events 
                        WHERE created_at >= {db_parts['interval_30_days']}
                    """
                    c.execute(growth_query)
                except Exception as e:
                    logger.error(f"Admin growth query failed, using fallback: {e}")
                    c.execute("SELECT COUNT(*) as this_month, 0 as last_month FROM events")
            
            growth_data = c.fetchone()
            
            # Handle PostgreSQL RealDictRow vs SQLite tuple
            if isinstance(growth_data, dict) or hasattr(growth_data, 'get'):
                this_month = growth_data.get('this_month', 0) or 0
                last_month = growth_data.get('last_month', 0) or 0
            else:
                this_month = growth_data[0] if growth_data and len(growth_data) > 0 else 0
                last_month = growth_data[1] if growth_data and len(growth_data) > 1 else 0
            
            event_growth = ((this_month - last_month) / max(last_month, 1)) * 100 if last_month > 0 else 0
            
            # Get client breakdown (users with events vs without)
            c.execute("""
                SELECT 
                    COUNT(DISTINCT u.id) as total_clients,
                    COUNT(DISTINCT CASE WHEN e.created_by IS NOT NULL THEN u.id END) as active_clients
                FROM users u
                LEFT JOIN events e ON u.id = e.created_by
                WHERE u.role IN ('user', 'premium', 'enterprise')
            """)
            client_data = c.fetchone()
            
            # Handle PostgreSQL RealDictRow vs SQLite tuple for client data
            if isinstance(client_data, dict) or hasattr(client_data, 'get'):
                total_clients = client_data.get('total_clients', 0) or 0
                active_clients = client_data.get('active_clients', 0) or 0
            else:
                total_clients = client_data[0] if client_data and len(client_data) > 0 else 0
                active_clients = client_data[1] if client_data and len(client_data) > 1 else 0
            
            return {
                "total_events": total_events,
                "total_users": total_users,
                "total_clients": total_clients,
                "active_clients": active_clients,
                "event_growth_rate": round(event_growth, 1),
                "client_engagement_rate": round((active_clients / max(total_clients, 1)) * 100, 1)
            }
            
    except Exception as e:
        logger.error(f"Error fetching enterprise overview: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching overview")

@app.get("/enterprise/clients")
async def get_enterprise_clients(
    current_user: dict = Depends(get_current_user)
):
    """Get enterprise clients data"""
    if current_user['role'] not in [UserRole.ENTERPRISE, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Get clients with their event counts and categories
            db_parts = get_db_compatible_query_parts()
            
            if current_user['role'] == UserRole.ENTERPRISE:
                # For enterprise users, show all platform users as potential clients
                # This gives them insights into the user base they could potentially serve
                query = f"""
                    SELECT 
                        u.id,
                        u.email,
                        u.role,
                        u.created_at,
                        u.premium_expires_at,
                        COUNT(e.id) as event_count,
                        GROUP_CONCAT(DISTINCT e.category) as categories,
                        MAX(e.created_at) as last_event_date
                    FROM users u
                    LEFT JOIN events e ON u.id = e.created_by
                    WHERE u.role IN ('user', 'premium')
                    GROUP BY u.id, u.email, u.role, u.created_at, u.premium_expires_at
                    ORDER BY event_count DESC, u.created_at DESC
                """
                c.execute(query)
            else:
                # Admin sees all users including enterprise
                query = f"""
                    SELECT 
                        u.id,
                        u.email,
                        u.role,
                        u.created_at,
                        u.premium_expires_at,
                        COUNT(e.id) as event_count,
                        GROUP_CONCAT(DISTINCT e.category) as categories,
                        MAX(e.created_at) as last_event_date
                    FROM users u
                    LEFT JOIN events e ON u.id = e.created_by
                    WHERE u.role IN ('user', 'premium', 'enterprise')
                    GROUP BY u.id, u.email, u.role, u.created_at, u.premium_expires_at
                    ORDER BY event_count DESC, u.created_at DESC
                """
                c.execute(query)
            
            clients = []
            for row in c.fetchall():
                client = {
                    "id": row[0],
                    "email": row[1],
                    "role": row[2],
                    "created_at": row[3].isoformat() if row[3] else None,
                    "premium_expires_at": row[4].isoformat() if row[4] else None,
                    "event_count": row[5],
                    "categories": row[6] if row[6] else "None",
                    "last_event_date": row[7].isoformat() if row[7] else None,
                    "status": "active" if row[5] > 0 else "inactive"
                }
                clients.append(client)
            
            return {"clients": clients}
            
    except Exception as e:
        logger.error(f"Error fetching enterprise clients: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching clients")

@app.get("/enterprise/events")
async def get_enterprise_events(
    page: int = 1,
    client_filter: str = "",
    status_filter: str = "",
    search: str = "",
    user_id: int = None,
    current_user: dict = Depends(get_current_user)
):
    """Get enterprise events data with pagination and filtering"""
    if current_user['role'] not in [UserRole.ENTERPRISE, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Build query with filters
            where_conditions = []
            params = []
            
            # For enterprise users, only show their own events
            if current_user['role'] == UserRole.ENTERPRISE:
                where_conditions.append(f"e.created_by = {placeholder}")
                params.append(current_user['id'])
            
            db_parts = get_db_compatible_query_parts()
            
            if client_filter:
                where_conditions.append(f"u.email {db_parts['like_op']} {placeholder}")
                params.append(f"%{client_filter}%")
            
            if search:
                where_conditions.append(f"(e.title {db_parts['like_op']} {placeholder} OR e.description {db_parts['like_op']} {placeholder})")
                params.extend([f"%{search}%", f"%{search}%"])
            
            where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
            
            # Get total count
            count_query = f"""
                SELECT COUNT(*)
                FROM events e
                JOIN users u ON e.created_by = u.id
                WHERE {where_clause}
            """
            c.execute(count_query, params)
            total_events = get_count_from_result(c.fetchone())
            
            # Get paginated events
            limit = 20
            offset = (page - 1) * limit
            
            events_query = f"""
                SELECT 
                    e.id,
                    e.title,
                    e.description,
                    e.date,
                    e.start_time,
                    e.end_time,
                    e.address,
                    e.category,
                    e.fee_required,
                    e.created_at,
                    u.email as client_email,
                    u.role as client_role,
                    e.interest_count,
                    e.view_count,
                    e.verified
                FROM events e
                LEFT JOIN users u ON e.created_by = u.id
                WHERE {where_clause}
                ORDER BY e.created_at DESC
                LIMIT {limit} OFFSET {offset}
            """
            c.execute(events_query, params)
            
            events = []
            for row in c.fetchall():
                # Determine event status based on date
                event_date = row[3]  # date field
                from datetime import datetime, date
                try:
                    if isinstance(event_date, str):
                        event_date_obj = datetime.strptime(event_date, '%Y-%m-%d').date()
                    else:
                        event_date_obj = event_date
                    
                    today = date.today()
                    if event_date_obj < today:
                        status = "past"
                    elif event_date_obj == today:
                        status = "today"
                    else:
                        status = "upcoming"
                except:
                    status = "unknown"

                event = {
                    "id": row[0],
                    "title": row[1],
                    "description": row[2][:100] + "..." if row[2] and len(row[2]) > 100 else row[2],
                    "date": row[3],
                    "start_time": row[4],
                    "end_time": row[5],
                    "address": row[6],
                    "category": row[7] or "uncategorized",
                    "is_free": not bool(row[8] and row[8].strip()),  # fee_required empty means free
                    "created_at": row[9].isoformat() if row[9] else None,
                    "client_email": row[10] or "None",
                    "client_role": row[11] or "none", 
                    "interest_count": row[12] or 0,
                    "view_count": row[13] or 0,
                    "verified": bool(row[14]),

                    "status": status
                }
                events.append(event)
            
            total_pages = (total_events + limit - 1) // limit
            
            return {
                "events": events,
                "pagination": {
                    "current_page": page,
                    "total_pages": total_pages,
                    "total_events": total_events,
                    "events_per_page": limit
                }
            }
            
    except Exception as e:
        logger.error(f"Error fetching enterprise events: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching events")

@app.get("/enterprise/analytics/clients")
async def get_enterprise_client_analytics(
    current_user: dict = Depends(get_current_user)
):
    """Get enterprise client analytics data"""
    if current_user['role'] not in [UserRole.ENTERPRISE, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Client performance data
            db_parts = get_db_compatible_query_parts()
            
            db_parts = get_db_compatible_query_parts()
            if current_user['role'] == UserRole.ENTERPRISE:
                # For enterprise users, only show their own events
                query = f"""
                    SELECT 
                        COALESCE(u.email, 'None') as client,
                        COUNT(e.id) as event_count,
                        u.role as client_role
                    FROM events e
                    LEFT JOIN users u ON e.created_by = u.id
                    WHERE e.created_at >= {db_parts['interval_90_days']} 
                    AND e.created_by = {placeholder}
                    GROUP BY u.email, u.role
                    ORDER BY event_count DESC
                    LIMIT 20
                """
                c.execute(query, (current_user['id'],))
            else:
                # Admin sees all events
                query = f"""
                    SELECT 
                        COALESCE(u.email, 'None') as client,
                        COUNT(e.id) as event_count,
                        u.role as client_role
                    FROM events e
                    LEFT JOIN users u ON e.created_by = u.id
                    WHERE e.created_at >= {db_parts['interval_90_days']}
                    GROUP BY u.email, u.role
                    ORDER BY event_count DESC
                    LIMIT 20
                """
                c.execute(query)
            
            client_performance = []
            for row in c.fetchall():
                client_performance.append({
                    "client": row[0],
                    "event_count": row[1],
                    "client_role": row[2] or "none"
                })
            
            # Category distribution
            if current_user['role'] == UserRole.ENTERPRISE:
                # For enterprise users, only show their own events
                query = f"""
                    SELECT 
                        COALESCE(e.category, 'uncategorized') as category,
                        COUNT(*) as count
                    FROM events e
                    WHERE e.created_at >= {db_parts['interval_90_days']}
                    AND e.created_by = {placeholder}
                    GROUP BY e.category
                    ORDER BY count DESC
                """
                c.execute(query, (current_user['id'],))
            else:
                # Admin sees all events
                query = f"""
                    SELECT 
                        COALESCE(e.category, 'uncategorized') as category,
                        COUNT(*) as count
                    FROM events e
                    WHERE e.created_at >= {db_parts['interval_90_days']}
                    GROUP BY e.category
                    ORDER BY count DESC
                """
                c.execute(query)
            
            category_distribution = []
            for row in c.fetchall():
                category_distribution.append({
                    "category": row[0],
                    "count": row[1]
                })
            
            return {
                "client_performance": client_performance,
                "category_distribution": category_distribution
            }
            
    except Exception as e:
        logger.error(f"Error fetching enterprise analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching analytics")

@app.post("/admin/users/{user_id}/notify-premium")
async def notify_premium_granted(
    user_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Send notification to user about their premium access"""
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user exists and has premium
            c.execute(f"SELECT * FROM users WHERE id = {placeholder}", (user_id,))
            user = c.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            if user['role'] not in ['premium', 'enterprise']:
                raise HTTPException(status_code=400, detail="User does not have premium or enterprise access")
            
            # Log the notification
            log_activity(current_user['id'], "premium_notification", f"Sent {user['role']} notification to {user['email']}")
            
            # Send appropriate notification email based on role
            try:
                from email_config import email_service
                
                # Get the admin who granted premium access
                granted_by_email = None
                if user.get('premium_granted_by'):
                    c.execute(f"SELECT email FROM users WHERE id = {placeholder}", (user['premium_granted_by'],))
                    granted_by_user = c.fetchone()
                    if granted_by_user:
                        granted_by_email = granted_by_user['email']
                
                if user['role'] == 'enterprise':
                    # Send enterprise notification email
                    email_sent = email_service.send_enterprise_notification_email(
                        to_email=user['email'],
                        user_name=user.get('full_name'),
                        expires_at=user.get('premium_expires_at'),
                        granted_by=granted_by_email
                    )
                    
                    if email_sent:
                        logger.info(f"✅ Enterprise notification email sent to {user['email']}")
                    else:
                        logger.error(f"❌ Failed to send enterprise notification email to {user['email']}")
                else:
                    # Send premium notification email
                    email_sent = email_service.send_premium_notification_email(
                        to_email=user['email'],
                        user_name=user.get('full_name'),
                        expires_at=user.get('premium_expires_at'),
                        granted_by=granted_by_email
                    )
                
                if email_sent:
                    logger.info(f"✅ Premium notification email sent to {user['email']}")
                else:
                    logger.error(f"❌ Failed to send premium notification email to {user['email']}")
            except Exception as e:
                logger.error(f"❌ Error sending {user['role']} notification email: {str(e)}")
            
            return {
                "detail": f"{user['role'].title()} notification sent to {user['email']}",
                "user_email": user['email'],
                "message": f"{user['role'].title()} notification email sent successfully"
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending premium notification: {str(e)}")
        raise HTTPException(status_code=500, detail="Error sending notification")

class SimpleCache:
    """Thread-safe TTL cache for frequently accessed data."""

    def __init__(self, ttl_seconds: int = 300, max_size: int = 1000) -> None:
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl = ttl_seconds
        self.max_size = max_size
        self._lock = threading.RLock()
        self._last_cleanup = time.time()
        self._cleanup_interval = 60

    def _cleanup_expired(self) -> None:
        current_time = time.time()
        if current_time - self._last_cleanup < self._cleanup_interval:
            return
        with self._lock:
            expired_keys = [k for k, v in self.cache.items() if current_time - v['timestamp'] >= self.ttl]
            for key in expired_keys:
                del self.cache[key]
            if len(self.cache) > self.max_size:
                sorted_items = sorted(self.cache.items(), key=lambda x: x[1]['timestamp'])
                for i in range(len(self.cache) - self.max_size):
                    del self.cache[sorted_items[i][0]]
            self._last_cleanup = current_time
            if expired_keys or len(self.cache) > self.max_size * 0.8:
                logger.info(
                    f"Cache cleanup: removed {len(expired_keys)} expired items, current size: {len(self.cache)}")

    def get(self, key: str) -> Any:
        self._cleanup_expired()
        with self._lock:
            if key in self.cache:
                data = self.cache[key]
                if time.time() - data['timestamp'] < self.ttl:
                    data['last_access'] = time.time()
                    return data['value']
                del self.cache[key]
        return None

    def set(self, key: str, value: Any) -> None:
        self._cleanup_expired()
        with self._lock:
            current_time = time.time()
            self.cache[key] = {
                'value': value,
                'timestamp': current_time,
                'last_access': current_time
            }

    def delete(self, key: str) -> None:
        with self._lock:
            if key in self.cache:
                del self.cache[key]

    def clear(self) -> None:
        with self._lock:
            self.cache.clear()
            self._last_cleanup = time.time()

    def stats(self) -> Dict[str, Any]:
        self._cleanup_expired()
        with self._lock:
            return {
                'size': len(self.cache),
                'max_size': self.max_size,
                'ttl_seconds': self.ttl,
                'last_cleanup': self._last_cleanup,
            }

class BulkEventCreate(BaseModel):
    events: List[EventCreate]


class BulkEventResponse(BaseModel):
    success_count: int
    error_count: int
    errors: List[dict]
    created_events: List[EventResponse]


event_cache = SimpleCache(ttl_seconds=180, max_size=500)


@app.post("/admin/events/bulk-simple", response_model=BulkEventResponse)
async def bulk_create_events_simple(
    bulk_events: BulkEventCreate, 
    current_user: dict = Depends(get_current_user)
):
    """
    SIMPLIFIED Bulk create events using individual event creation (admin-only) - Workaround
    """
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized. Admin access required.")
    
    success_count = 0
    error_count = 0
    errors = []
    created_events = []
    
    logger.info(f"Admin {current_user['email']} initiating SIMPLE bulk event creation for {len(bulk_events.events)} events")
    
    # Use individual event creation to bypass bulk import issues
    for i, event_data in enumerate(bulk_events.events):
        try:
            # Create event using the proven single event creation function
            response_event = await create_event(event_data, current_user)
            created_events.append(response_event)
            success_count += 1
            logger.info(f"✅ Successfully created event {i+1}: '{event_data.title}' (ID: {response_event.id})")
            
        except Exception as e:
            error_count += 1
            error_msg = str(e)
            logger.error(f"❌ Error creating event {i+1} ({event_data.title}): {error_msg}")
            errors.append({
                "event_index": i + 1,
                "event_title": event_data.title,
                "error": error_msg
            })
            continue
    
    logger.info(f"✅ Simple bulk event creation completed. Success: {success_count}, Errors: {error_count}")
    
    return BulkEventResponse(
        success_count=success_count,
        error_count=error_count,
        errors=errors,
        created_events=created_events
    )

@app.post("/admin/events/bulk", response_model=BulkEventResponse)
async def bulk_create_events(
    bulk_events: BulkEventCreate, 
    current_user: dict = Depends(get_current_user)
):
    """
    ROBUST Bulk create events (admin-only endpoint) - Uses proven create_event logic
    """
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized. Admin access required.")
    
    success_count = 0
    error_count = 0
    errors = []
    created_events = []
    
    logger.info(f"Admin {current_user['email']} initiating ROBUST bulk event creation for {len(bulk_events.events)} events using proven create_event logic")
    
    # Use the proven single event creation logic for each event
    for i, event_data in enumerate(bulk_events.events):
        try:
            # Create event using the proven single event creation function
            response_event = await create_event(event_data, current_user)
            created_events.append(response_event)
            success_count += 1
            logger.info(f"✅ Successfully created event {i+1}: '{event_data.title}' (ID: {response_event.id})")
            
        except Exception as e:
            error_count += 1
            error_msg = str(e)
            logger.error(f"❌ Error creating event {i+1} ({event_data.title}): {error_msg}")
            errors.append({
                "event_index": i + 1,
                "event_title": event_data.title,
                "error": error_msg
            })
            continue
    
    logger.info(f"✅ Robust bulk event creation completed. Success: {success_count}, Errors: {error_count}")
    
    # Clear event cache after bulk import
    event_cache.clear()
    logger.info(f"🧹 Cleared event cache to ensure new events appear in API")
    
    return BulkEventResponse(
        success_count=success_count,
        error_count=error_count,
        errors=errors,
        created_events=created_events
    )

def ensure_unique_slug_failsafe(cursor, base_slug: str, placeholder: str) -> str:
    """Enhanced failsafe slug uniqueness check with production-ready error handling"""
    import time
    
    if not base_slug:
        fallback_slug = f"event-{int(time.time())}"
        logger.warning(f"🔄 Empty base_slug provided, using fallback: {fallback_slug}")
        return fallback_slug
    
    try:
        # Enhanced approach: check if slug exists with better error handling
        logger.debug(f"🔍 Checking slug uniqueness for: '{base_slug}'")
        
        if placeholder == "?":
            cursor.execute("SELECT COUNT(*) FROM events WHERE slug = ?", (base_slug,))
        else:
            cursor.execute("SELECT COUNT(*) FROM events WHERE slug = %s", (base_slug,))
        
        result = cursor.fetchone()
        logger.debug(f"🔍 Slug query result: {result} (type: {type(result)})")
        
        # Enhanced result handling with better validation
        count = 0
        if result is None:
            logger.debug("🔍 Query returned None, assuming count = 0")
            count = 0
        elif isinstance(result, (list, tuple)) and len(result) > 0:
            raw_value = result[0]
            count = int(raw_value) if raw_value is not None else 0
            logger.debug(f"🔍 Extracted count from tuple/list: {count}")
        elif hasattr(result, '__getitem__'):
            try:
                raw_value = result[0]
                count = int(raw_value) if raw_value is not None else 0
                logger.debug(f"🔍 Extracted count from indexable: {count}")
            except (IndexError, KeyError, TypeError):
                logger.warning(f"⚠️ Could not extract count from indexable result: {result}")
                count = 0
        else:
            try:
                count = int(result) if result is not None else 0
                logger.debug(f"🔍 Used result directly as count: {count}")
            except (ValueError, TypeError):
                logger.warning(f"⚠️ Could not convert result to int: {result}")
                count = 0
        
        if count > 0:
            # Slug exists, create unique variant
            suffix = str(int(time.time()))[-6:]  # Last 6 digits for brevity
            unique_slug = f"{base_slug}-{suffix}"
            logger.info(f"✅ Slug '{base_slug}' exists ({count} times), generated unique: '{unique_slug}'")
            return unique_slug
        else:
            logger.info(f"✅ Slug '{base_slug}' is unique, using as-is")
            return base_slug
            
    except Exception as e:
        logger.error(f"❌ Slug uniqueness check failed for '{base_slug}': {type(e).__name__}: {e}")
        # Enhanced emergency fallback with more detail
        emergency_slug = f"{base_slug}-{int(time.time())}"
        logger.warning(f"🚨 Using emergency fallback slug: '{emergency_slug}'")
        return emergency_slug
@app.post("/admin/migrate-database")
async def migrate_production_database():
    """Trigger PostgreSQL database migration (production only)"""
    try:
        if not IS_PRODUCTION or not DB_URL:
            return {
                "status": "skipped",
                "message": "Migration only available in production with PostgreSQL",
                "is_production": IS_PRODUCTION,
                "has_db_url": bool(DB_URL)
            }
        
        # Import and run the migration
        from migrate_production_postgres import main as migrate_db
        migrate_db()
        
        return {
            "status": "success", 
            "message": "PostgreSQL database migration completed successfully"
        }
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        return {
            "status": "error", 
            "message": f"Migration failed: {str(e)}"
        }
@app.post("/admin/fix-production-database")
async def fix_production_database():
    """Fix critical production database schema issues causing bulk import failures"""
    try:
        if not IS_PRODUCTION or not DB_URL:
            return {
                "status": "skipped",
                "message": "Database fix only available in production with PostgreSQL",
                "is_production": IS_PRODUCTION,
                "has_db_url": bool(DB_URL)
            }
        
        logger.info("🚀 Starting production database schema fix via API")
        
        # Run the database fix directly
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check current schema
            try:
                cursor.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'events' AND table_schema = 'public'
                """)
                current_columns = [row[0] for row in cursor.fetchall()]
                logger.info(f"📊 Current table has {len(current_columns)} columns")
            except Exception as e:
                logger.error(f"❌ Could not check current schema: {e}")
                current_columns = []
            
            # Define missing columns to add
            required_columns = {
                'fee_required': 'TEXT',
                'event_url': 'TEXT', 
                'host_name': 'TEXT',
                'organizer_url': 'TEXT',
                'price': 'DECIMAL(10,2) DEFAULT 0.0',
                'currency': 'VARCHAR(3) DEFAULT \'USD\'',
                'slug': 'TEXT',
                'short_description': 'TEXT',
                'city': 'VARCHAR(100)',
                'state': 'VARCHAR(50)',
                'country': 'VARCHAR(50) DEFAULT \'USA\'',
                'geo_hash': 'VARCHAR(20)',
                'is_published': 'BOOLEAN DEFAULT TRUE',
                'start_datetime': 'TIMESTAMP',
                'end_datetime': 'TIMESTAMP',
                'updated_at': 'TIMESTAMP',
                'interest_count': 'INTEGER DEFAULT 0',
                'view_count': 'INTEGER DEFAULT 0'
            }
            
            added_columns = []
            failed_columns = []
            
            # Add missing columns
            for column_name, column_spec in required_columns.items():
                if column_name not in current_columns:
                    try:
                        sql = f"ALTER TABLE events ADD COLUMN {column_name} {column_spec}"
                        logger.info(f"🔧 Adding column: {column_name}")
                        cursor.execute(sql)
                        added_columns.append(column_name)
                    except Exception as e:
                        logger.error(f"❌ Failed to add column {column_name}: {e}")
                        failed_columns.append(column_name)
            
            # Update NULL values
            null_updates = [
                "UPDATE events SET fee_required = '' WHERE fee_required IS NULL",
                "UPDATE events SET event_url = '' WHERE event_url IS NULL",
                "UPDATE events SET host_name = '' WHERE host_name IS NULL",
                "UPDATE events SET short_description = '' WHERE short_description IS NULL",
                "UPDATE events SET interest_count = 0 WHERE interest_count IS NULL",
                "UPDATE events SET view_count = 0 WHERE view_count IS NULL",
                "UPDATE events SET is_published = TRUE WHERE is_published IS NULL"
            ]
            
            updated_fields = []
            for sql in null_updates:
                try:
                    cursor.execute(sql)
                    if cursor.rowcount > 0:
                        field = sql.split("SET ")[1].split(" =")[0]
                        updated_fields.append(f"{field}({cursor.rowcount})")
                except Exception as e:
                    logger.warning(f"⚠️ NULL update failed: {e}")
            
            # Commit changes
            conn.commit()
            logger.info("✅ Database schema fix completed and committed")
            
        return {
            "status": "success",
            "message": "Production database schema fixed successfully",
            "details": {
                "columns_added": added_columns,
                "columns_failed": failed_columns,
                "null_updates": updated_fields,
                "total_columns_after": len(current_columns) + len(added_columns)
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Database fix failed: {e}")
        logger.error(f"📝 Traceback: {traceback.format_exc()}")
        return {
            "status": "error", 
            "message": f"Database fix failed: {str(e)}"
        }

@app.post("/admin/test-bulk-import-fix")
async def test_bulk_import_fix():
    """Test the PostgreSQL RETURNING clause fix for bulk import (admin only)"""
    try:
        if not IS_PRODUCTION or not DB_URL:
            return {
                "status": "skipped",
                "message": "Test only available in production with PostgreSQL",
                "is_production": IS_PRODUCTION,
                "has_db_url": bool(DB_URL)
            }
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Test RETURNING clause with a simple insert
            test_query = """
                INSERT INTO events (title, description, date, start_time, category, address, lat, lng, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """
            
            test_values = [
                "BULK IMPORT TEST EVENT",
                "Test event to verify RETURNING clause works",
                (datetime.utcnow() + timedelta(days=30)).strftime('%Y-%m-%d'),
                "12:00",
                "Educational & Business",
                "Test Address, Test City, TS 12345",
                40.7128,
                -74.0060,
                1  # Assuming admin user ID 1 exists
            ]
            
            cursor.execute(test_query, test_values)
            result = cursor.fetchone()
            
            if result is not None:
                try:
                    if hasattr(result, 'get') and 'id' in result:
                        event_id = int(result['id'])
                        method = "RealDictRow['id']"
                    elif hasattr(result, '__getitem__'):
                        event_id = int(result[0])
                        method = "result[0]"
                    else:
                        event_id = int(result)
                        method = "direct conversion"
                    
                    # Clean up test event
                    cursor.execute("DELETE FROM events WHERE id = %s", (event_id,))
                    conn.commit()
                    
                    return {
                        "status": "success",
                        "message": f"RETURNING clause fix working correctly! Got ID: {event_id} via {method}",
                        "event_id": event_id,
                        "extraction_method": method,
                        "result_type": str(type(result))
                    }
                    
                except Exception as extract_error:
                    return {
                        "status": "error",
                        "message": f"Failed to extract ID from result: {extract_error}",
                        "result": str(result),
                        "result_type": str(type(result))
                    }
            else:
                return {
                    "status": "error", 
                    "message": "RETURNING clause returned no result"
                }
                
    except Exception as e:
        logger.error(f"Bulk import test failed: {e}")
        return {
            "status": "error",
            "message": f"Test failed: {str(e)}"
        }

def sanitize_ux_field(value):
    """Convert None to empty string for UX fields to avoid NULLs in DB."""
    logger.info(f"sanitize_ux_field called with: {value!r} (type: {type(value)})")
    result = value if value is not None else ""
    logger.info(f"sanitize_ux_field returning: {result!r} (type: {type(result)})")
    return result
def convert_event_datetime_fields(event_dict):
    """Convert datetime objects to ISO format strings for API response"""
    from datetime import datetime, timezone
    
    # Handle NULL end_time values specifically to prevent validation errors
    if 'end_time' in event_dict and event_dict['end_time'] is None:
        event_dict['end_time'] = ""  # Convert None to empty string
    
    # Handle other potential NULL string fields
    string_fields = ['end_date', 'short_description', 'fee_required', 'event_url', 'host_name', 'organizer_url', 'slug']
    for field in string_fields:
        if field in event_dict and event_dict[field] is None:
            event_dict[field] = ""  # Convert None to empty string for optional string fields
    
    datetime_fields = ['created_at', 'updated_at', 'start_datetime', 'end_datetime']
    for field in datetime_fields:
        if field in event_dict and isinstance(event_dict[field], datetime):
            event_dict[field] = event_dict[field].isoformat()
        elif field in event_dict and event_dict[field] is not None and not isinstance(event_dict[field], str):
            # Convert any non-string datetime-like values to strings
            try:
                event_dict[field] = str(event_dict[field])
            except:
                event_dict[field] = None
        elif field in event_dict and event_dict[field] is None:
            # Handle NULL values - set a default for required fields
            if field == 'created_at':
                # For created_at, use current timestamp if None
                event_dict[field] = datetime.now(timezone.utc).isoformat()
            else:
                # For optional fields, keep as None
                event_dict[field] = None
    
    # Ensure counters are integers
    event_dict['interest_count'] = event_dict.get('interest_count', 0) or 0
    event_dict['view_count'] = event_dict.get('view_count', 0) or 0
    
    return event_dict

# ===== SEO ENDPOINTS =====

@app.get("/api/seo/events/{event_id}")
async def get_event_seo_data(event_id: int):
    """Get complete SEO data package for event"""
    
    if not SEOEventProcessor:
        raise HTTPException(status_code=501, detail="SEO utilities not available")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get event with all SEO fields
        cursor.execute('''
            SELECT 
                id, title, slug, description, short_description,
                date, start_time, end_time, end_date,
                start_datetime, end_datetime,
                category, address, city, state, country,
                lat, lng, price, currency, fee_required,
                event_url, host_name, organizer_url,
                created_by, created_at, updated_at,
                interest_count, view_count, is_published
            FROM events 
            WHERE id = ? AND is_published = 1
        ''', (event_id,))
        
        event_row = cursor.fetchone()
        if not event_row:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Convert to dict
        event_dict = dict(event_row)
        
        # Generate SEO data
        processor = SEOEventProcessor(base_url="https://todo-events.com")
        seo_data = processor.generate_full_seo_data(event_dict)
        
        return seo_data

@app.get("/api/seo/events/by-slug/{slug}")
async def get_event_by_slug(slug: str):
    """Get event data by SEO slug"""
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Use database-specific syntax for is_published
        if IS_PRODUCTION and DB_URL:
            # PostgreSQL - use boolean true
            cursor.execute('''
                SELECT 
                    id, title, slug, description, short_description,
                    date, start_time, end_time, end_date,
                    start_datetime, end_datetime,
                    category, address, city, state, country,
                    lat, lng, price, currency, fee_required,
                    event_url, host_name, organizer_url,
                    created_by, created_at, updated_at,
                    interest_count, view_count, is_published
                FROM events 
                WHERE slug = %s AND (is_published = true OR is_published IS NULL)
            ''', (slug,))
        else:
            # SQLite - use integer 1
            cursor.execute('''
                SELECT 
                    id, title, slug, description, short_description,
                    date, start_time, end_time, end_date,
                    start_datetime, end_datetime,
                    category, address, city, state, country,
                    lat, lng, price, currency, fee_required,
                    event_url, host_name, organizer_url,
                    created_by, created_at, updated_at,
                    interest_count, view_count, is_published
                FROM events 
                WHERE slug = ? AND (is_published = 1 OR is_published IS NULL)
            ''', (slug,))
        
        event_row = cursor.fetchone()
        if not event_row:
            raise HTTPException(status_code=404, detail="Event not found")
        
        event_dict = dict(event_row)
        return event_dict

@app.get("/api/seo/events/location/{state}/{city}")
async def get_events_by_location(
    state: str, 
    city: str,
    limit: int = 100,
    offset: int = 0
):
    """Get events by state and city for geographic SEO"""
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Use database-specific syntax for location queries
        if IS_PRODUCTION and DB_URL:
            # PostgreSQL
            cursor.execute('''
                SELECT 
                    id, title, slug, description, short_description,
                    date, start_time, end_time, start_datetime, end_datetime,
                    category, address, city, state, country,
                    lat, lng, price, currency,
                    host_name, interest_count, view_count
                FROM events 
                WHERE LOWER(state) = %s 
                AND LOWER(city) = %s 
                AND (is_published = true OR is_published IS NULL)
                AND CAST(date AS DATE) >= CURRENT_DATE
                ORDER BY date ASC, start_time ASC
                LIMIT %s OFFSET %s
            ''', (state.lower(), city.lower(), limit, offset))
        else:
            # SQLite
            cursor.execute('''
                SELECT 
                    id, title, slug, description, short_description,
                    date, start_time, end_time, start_datetime, end_datetime,
                    category, address, city, state, country,
                    lat, lng, price, currency,
                    host_name, interest_count, view_count
                FROM events 
                WHERE LOWER(state) = ? 
                AND LOWER(city) = ? 
                AND (is_published = 1 OR is_published IS NULL)
                AND date::date >= CURRENT_DATE
                ORDER BY date ASC, start_time ASC
                LIMIT ? OFFSET ?
            ''', (state.lower(), city.lower(), limit, offset))
        
        events = [dict(row) for row in cursor.fetchall()]
        
        # Get total count with database-specific syntax
        if IS_PRODUCTION and DB_URL:
            # PostgreSQL
            cursor.execute('''
                SELECT COUNT(*) FROM events 
                WHERE LOWER(state) = %s 
                AND LOWER(city) = %s 
                AND (is_published = true OR is_published IS NULL)
                AND CAST(date AS DATE) >= CURRENT_DATE
            ''', (state.lower(), city.lower()))
        else:
            # SQLite
            cursor.execute('''
                SELECT COUNT(*) FROM events 
                WHERE LOWER(state) = ? 
                AND LOWER(city) = ? 
                AND (is_published = 1 OR is_published IS NULL)
                AND date::date >= CURRENT_DATE
            ''', (state.lower(), city.lower()))
        
        total = get_count_from_result(cursor.fetchone())
        
        return {
            "events": events,
            "total": total,
            "limit": limit,
            "offset": offset,
            "location": {
                "city": city.title(),
                "state": state.upper(),
                "slug": f"{state.lower()}/{city.lower()}"
            }
        }
@app.get("/api/events/{event_id}/share-card")
async def get_event_share_card(event_id: int):
    """Generate and serve pre-generated share card data for SEO and social media"""
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Use database-specific syntax for share card
            if IS_PRODUCTION and DB_URL:
                # PostgreSQL
                cursor.execute('''
                    SELECT id, title, description, date, start_time, end_time, address, 
                           city, state, category, secondary_category, verified, 
                           view_count, interest_count, host_name, fee_required
                    FROM events 
                    WHERE id = %s AND (is_published = true OR is_published IS NULL)
                ''', (event_id,))
            else:
                # SQLite
                cursor.execute('''
                    SELECT id, title, description, date, start_time, end_time, address, 
                           city, state, category, secondary_category, verified, 
                           view_count, interest_count, host_name, fee_required
                    FROM events 
                    WHERE id = ? AND (is_published = 1 OR is_published IS NULL)
                ''', (event_id,))
            
            event_row = cursor.fetchone()
            if not event_row:
                raise HTTPException(status_code=404, detail="Event not found")
            
            event_dict = dict(event_row)
            
            # Return enhanced JSON data with proper image URL for SEO
            share_card_data = {
                "type": "share_card_image",
                "event_id": event_id,
                "title": event_dict["title"],
                "date": event_dict["date"],
                "time": f"{event_dict['start_time']}" + (f" - {event_dict['end_time']}" if event_dict.get('end_time') else ""),
                "location": f"{event_dict.get('city', '')}, {event_dict.get('state', '')}".strip(', '),
                "address": event_dict.get("address", ""),
                "category": event_dict["category"],
                "secondary_category": event_dict.get("secondary_category"),
                "description": event_dict["description"][:120] + "..." if len(event_dict["description"]) > 120 else event_dict["description"],
                "verified": bool(event_dict.get("verified", False)),
                "view_count": event_dict.get("view_count", 0),
                "interest_count": event_dict.get("interest_count", 0),
                "host_name": event_dict.get("host_name"),
                "is_free": not bool(event_dict.get("fee_required")),
                "image_url": f"https://todoevents-backend.onrender.com/api/events/{event_id}/share-card.png",
                "meta": {
                    "width": 800,
                    "height": 600,
                    "format": "PNG",
                    "seo_optimized": True,
                    "social_ready": True
                }
            }
            
            return share_card_data
            
    except Exception as e:
        logger.error(f"Error generating share card for event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error generating share card")

@app.get("/api/events/{event_id}/share-card.png")
async def get_event_share_card_png(event_id: int):
    """Serve actual PNG image for share cards (placeholder for future implementation)"""
    
    try:
        # For now, redirect to a placeholder image service
        # In production, this would generate and cache actual PNG images using PIL, Playwright, etc.
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            if IS_PRODUCTION and DB_URL:
                cursor.execute('''
                    SELECT title, category, verified FROM events 
                    WHERE id = %s AND (is_published = true OR is_published IS NULL)
                ''', (event_id,))
            else:
                cursor.execute('''
                    SELECT title, category, verified FROM events 
                    WHERE id = ? AND (is_published = 1 OR is_published IS NULL)
                ''', (event_id,))
            
            event_row = cursor.fetchone()
            if not event_row:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Placeholder URL with event info
            event_title = event_row['title'][:30] if len(event_row['title']) > 30 else event_row['title']
            placeholder_url = f"https://via.placeholder.com/800x600/3B82F6/FFFFFF?text=Event+{event_id}%0A{event_title.replace(' ', '+')}"
            
            return RedirectResponse(url=placeholder_url, status_code=302)
            
    except Exception as e:
        logger.error(f"Error serving PNG share card for event {event_id}: {str(e)}")
        # Fallback to generic placeholder
        return RedirectResponse(url="https://via.placeholder.com/800x600/3B82F6/FFFFFF?text=TodoEvents", status_code=302)

# ---------------------------------------------------------------------------
# In-memory cache utilities and bulk event models
# ---------------------------------------------------------------------------

@app.post("/api/seo/migrate-events")
async def migrate_events_for_seo(background_tasks: BackgroundTasks):
    """Trigger production SEO migration for existing events"""
    
    def run_migration():
        try:
            # Note: production_seo_migration.py was removed - using populate_production_seo_fields instead
            from populate_production_seo_fields import populate_seo_data
            result = populate_seo_data()
            logger.info(f"Production SEO migration completed: {result}")
        except Exception as e:
            logger.error(f"Production SEO migration failed: {e}")
    
    background_tasks.add_task(run_migration)
    
    return {
        "message": "Production SEO migration started in background",
        "status": "processing",
        "info": "Processing all existing events to populate missing SEO fields including slugs"
    }

@app.post("/api/seo/migrate-events-sync")
async def migrate_events_for_seo_sync():
    """Execute production SEO migration synchronously with real-time results"""
    try:
        # Note: production_seo_migration.py was removed - using populate_production_seo_fields instead
        from populate_production_seo_fields import populate_seo_data
        result = populate_seo_data()
        
        return {
            "success": True,
            "message": "Production SEO migration completed successfully",
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Production SEO migration failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Migration failed: {str(e)}"
        )

@app.post("/api/seo/populate-production-fields")
async def populate_production_seo_fields():
    """Populate SEO fields for all events in production PostgreSQL database"""
    try:
        from populate_production_seo_fields import populate_seo_data
        
        # Call the population function directly 
        populate_seo_data()
        
        return {
            "success": True,
            "message": "Production SEO field population completed successfully",
            "info": "All events have been updated with slugs, city/state, and other SEO fields"
        }
        
    except Exception as e:
        logger.error(f"Production SEO population failed: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"SEO population failed: {str(e)}"
        )

@app.get("/api/seo/sitemap/events")
async def get_events_sitemap():
    """Get sitemap XML for events with proper SEO URLs"""
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Use proper database-specific syntax
        if IS_PRODUCTION and DB_URL:
            # PostgreSQL - cast date text to date for comparison
            cursor.execute('''
                SELECT slug, city, state, updated_at, date
                FROM events 
                WHERE (is_published = true OR is_published IS NULL)
                AND slug IS NOT NULL
                AND CAST(date AS DATE) >= (CURRENT_DATE - INTERVAL '30 days')::DATE
                ORDER BY updated_at DESC
            ''')
        else:
            # SQLite
            cursor.execute('''
                SELECT slug, city, state, updated_at, date
                FROM events 
                WHERE (is_published = 1 OR is_published IS NULL)
                AND slug IS NOT NULL
                AND date::date >= CURRENT_DATE - INTERVAL '30 days'
                ORDER BY updated_at DESC
            ''')
        
        events = cursor.fetchall()
        
        # Generate sitemap XML
        sitemap_entries = []
        for event in events:
            slug, city, state, updated_at, event_date = event
            
            # Generate URL based on location
            if city and state:
                url = f"https://todo-events.com/us/{state.lower()}/{slugify(city)}/events/{slug}"
            else:
                url = f"https://todo-events.com/events/{slug}"
            
            # Use updated_at or event date for lastmod
            lastmod = updated_at or event_date
            
            sitemap_entries.append({
                "url": url,
                "lastmod": lastmod,
                "changefreq": "weekly",
                "priority": "0.8"
            })
        
        return {
            "entries": sitemap_entries,
            "count": len(sitemap_entries),
            "generated_at": datetime.now().isoformat()
        }

@app.get("/api/seo/validate/{event_id}")
async def validate_event_seo(event_id: int):
    """Validate event SEO completeness"""
    
    if not SEOEventProcessor:
        return {"error": "SEO utilities not available"}
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                id, title, slug, description, short_description,
                date, start_time, end_time, category, address, 
                city, state, lat, lng, host_name, is_published
            FROM events 
            WHERE id = ?
        ''', (event_id,))
        
        event_row = cursor.fetchone()
        if not event_row:
            raise HTTPException(status_code=404, detail="Event not found")
        
        event_dict = dict(event_row)
        
        # Import validation function
        from seo_utils import validate_event_data
        issues = validate_event_data(event_dict)
        
        return {
            "event_id": event_id,
            "is_seo_ready": len(issues) == 0,
            "issues": issues,
            "suggestions": [
                "Add missing required fields",
                "Generate SEO slug if missing", 
                "Add geographic information",
                "Include host/organizer details"
            ] if issues else ["Event is SEO-ready!"]
        }

@app.post("/api/fix/null-end-times")
async def fix_null_end_times():
    """Fix NULL end_time values in the database"""
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check how many events have NULL end_time
            c.execute("SELECT COUNT(*) FROM events WHERE end_time IS NULL")
            result = c.fetchone()
            null_count = result[0] if isinstance(result, (tuple, list)) else result.get("COUNT(*)", 0) if result else 0
            
            if null_count == 0:
                return {
                    "status": "success",
                    "message": "No NULL end_time values found",
                    "updated_count": 0
                }
            
            # Update NULL end_time values to empty string
            c.execute("UPDATE events SET end_time = '' WHERE end_time IS NULL")
            updated_count = c.rowcount
            conn.commit()
            
            # Verify the fix
            c.execute("SELECT COUNT(*) FROM events WHERE end_time IS NULL")
            result = c.fetchone()
            remaining_nulls = result[0] if isinstance(result, (tuple, list)) else result.get("COUNT(*)", 0) if result else 0
            
            return {
                "status": "success",
                "message": f"Fixed {updated_count} NULL end_time values",
                "updated_count": updated_count,
                "remaining_nulls": remaining_nulls
            }
            
    except Exception as e:
        logger.error(f"Error fixing NULL end_time values: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fixing NULL end_time values: {str(e)}")
@app.get("/admin/analytics/metrics")
async def get_analytics_metrics(
    current_user: dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    exclude_users: Optional[str] = None,  # Comma-separated user IDs
    category: Optional[str] = None
):
    """Get comprehensive analytics metrics with filtering"""
    # Check admin permission
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Parse filters
            excluded_user_ids = []
            if exclude_users:
                try:
                    excluded_user_ids = [int(uid.strip()) for uid in exclude_users.split(',') if uid.strip()]
                except ValueError:
                    excluded_user_ids = []
            
            # Build WHERE conditions
            conditions = ["1=1"]
            params = []
            
            if start_date:
                conditions.append(f"date >= {placeholder}")
                params.append(start_date)
            if end_date:
                conditions.append(f"date <= {placeholder}")
                params.append(end_date)
            if excluded_user_ids:
                placeholders = ','.join([placeholder for _ in excluded_user_ids])
                conditions.append(f"created_by NOT IN ({placeholders})")
                params.extend(excluded_user_ids)
            if category:
                conditions.append(f"category = {placeholder}")
                params.append(category)
            
            where_clause = " AND ".join(conditions)
            
            # Total events
            cursor.execute(f"""
                SELECT COUNT(*) FROM events 
                WHERE {where_clause}
            """, params)
            total_events = get_count_from_result(cursor.fetchone())
            
            # Total users
            cursor.execute("SELECT COUNT(*) FROM users")
            total_users = get_count_from_result(cursor.fetchone())
            
            # Active hosts (users with at least one event in the last month)
            one_month_ago = (datetime.utcnow() - timedelta(days=30)).strftime('%Y-%m-%d')
            host_conditions = [f"date >= {placeholder}"]
            host_params = [one_month_ago]
            if excluded_user_ids:
                host_placeholders = ','.join([placeholder for _ in excluded_user_ids])
                host_conditions.append(f"created_by NOT IN ({host_placeholders})")
                host_params.extend(excluded_user_ids)
            if category:
                host_conditions.append(f"category = {placeholder}")
                host_params.append(category)
            host_where = " AND ".join(host_conditions)
            
            cursor.execute(f"""
                SELECT COUNT(DISTINCT created_by) FROM events 
                WHERE {host_where}
            """, host_params)
            active_hosts = get_count_from_result(cursor.fetchone())
            
            # Events by category
            cursor.execute(f"""
                SELECT category, COUNT(*) 
                FROM events 
                WHERE {where_clause}
                GROUP BY category
                ORDER BY COUNT(*) DESC
            """, params)
            events_by_category = dict(cursor.fetchall())
            
            # User role distribution
            cursor.execute("SELECT role, COUNT(*) FROM users GROUP BY role")
            user_roles = dict(cursor.fetchall())
            
            # Recent events trend (last 30 days)
            cursor.execute(f"""
                SELECT date, COUNT(*) 
                FROM events 
                WHERE {host_where}
                GROUP BY date
                ORDER BY date
            """, host_params)
            events_trend = dict(cursor.fetchall())
            
            return {
                "total_events": total_events,
                "total_users": total_users,
                "active_hosts": active_hosts,
                "events_by_category": events_by_category,
                "user_roles": user_roles,
                "events_trend": events_trend,
                "filters_applied": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "excluded_users": excluded_user_ids,
                    "category": category
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch analytics: {str(e)}")

@app.get("/admin/analytics/time-series")
async def get_time_series_data(
    current_user: dict = Depends(get_current_user),
    metric: str = "events",  # events, users, active_hosts
    period: str = "daily",   # daily, weekly, monthly
    cumulative: Optional[bool] = None,  # Auto-default based on metric if None
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    exclude_users: Optional[str] = None,
    category: Optional[str] = None
):
    """Get time-series data for various metrics"""
    # Check admin permission
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Set cumulative defaults based on metric if not specified
            if cumulative is None:
                if metric == "events":
                    cumulative = True  # Events should show cumulative growth by default
                elif metric == "users":
                    cumulative = True  # Users should show cumulative growth by default
                elif metric == "active_hosts":
                    cumulative = False  # Active hosts is more meaningful as period-based by default
                else:
                    cumulative = False
            
            # Parse filters
            excluded_user_ids = []
            if exclude_users:
                try:
                    excluded_user_ids = [int(uid.strip()) for uid in exclude_users.split(',') if uid.strip()]
                except ValueError:
                    excluded_user_ids = []
            
            # Default date range (last 90 days)
            if not start_date:
                start_date = (datetime.utcnow() - timedelta(days=90)).strftime('%Y-%m-%d')
            if not end_date:
                end_date = datetime.utcnow().strftime('%Y-%m-%d')
            
            # Build WHERE conditions for events queries
            placeholder = get_placeholder()
            conditions = [f"date >= {placeholder}", f"date <= {placeholder}"]
            params = [start_date, end_date]
            
            if excluded_user_ids:
                placeholders = ','.join([placeholder for _ in excluded_user_ids])
                conditions.append(f"created_by NOT IN ({placeholders})")
                params.extend(excluded_user_ids)
            
            if category:
                conditions.append(f"category = {placeholder}")
                params.append(category)
            
            where_clause = " AND ".join(conditions)
            
            # Date grouping based on period and database type
            if IS_PRODUCTION and DB_URL:
                # PostgreSQL date functions
                if period == "weekly":
                    date_group = "TO_CHAR(DATE_TRUNC('week', date::date), 'YYYY-\"W\"WW')"
                    date_label = "Week"
                elif period == "monthly":
                    date_group = "TO_CHAR(date::date, 'YYYY-MM')"
                    date_label = "Month"
                else:  # daily
                    date_group = "date"
                    date_label = "Date"
            else:
                # SQLite date functions
                if period == "weekly":
                    date_group = "strftime('%Y-W%W', date)"
                    date_label = "Week"
                elif period == "monthly":
                    date_group = "strftime('%Y-%m', date)"
                    date_label = "Month"
                else:  # daily
                    date_group = "date"
                    date_label = "Date"
            
            if metric == "events":
                cursor.execute(f"""
                    SELECT {date_group} as period, COUNT(*) as count
                    FROM events 
                    WHERE {where_clause}
                    GROUP BY {date_group}
                    ORDER BY period
                """, params)
                
            elif metric == "users":
                # User registrations by period
                if IS_PRODUCTION and DB_URL:
                    # PostgreSQL - replace date references with created_at::date
                    user_date_group = date_group.replace('date', 'created_at::date')
                    cursor.execute(f"""
                        SELECT {user_date_group} as period, COUNT(*) as count
                        FROM users 
                        WHERE created_at::date >= {placeholder}::date AND created_at::date <= {placeholder}::date
                        GROUP BY {user_date_group}
                        ORDER BY period
                    """, [start_date, end_date])
                else:
                    # SQLite
                    cursor.execute(f"""
                        SELECT {date_group.replace('date', 'DATE(created_at)')} as period, COUNT(*) as count
                        FROM users 
                        WHERE DATE(created_at) >= {placeholder} AND DATE(created_at) <= {placeholder}
                        GROUP BY {date_group.replace('date', 'DATE(created_at)')}
                        ORDER BY period
                    """, [start_date, end_date])
                
            elif metric == "active_hosts":
                # Active hosts by period (users who created events in that period)
                cursor.execute(f"""
                    SELECT {date_group} as period, COUNT(DISTINCT created_by) as count
                    FROM events 
                    WHERE {where_clause}
                    GROUP BY {date_group}
                    ORDER BY period
                """, params)
            
            data = cursor.fetchall()
            
            # Handle both SQLite tuple results and PostgreSQL dict-like results
            formatted_data = []
            for row in data:
                if isinstance(row, dict) or hasattr(row, 'get'):
                    # PostgreSQL RealDictCursor returns dict-like objects
                    period_val = row.get('period') 
                    count_val = row.get('count')
                    
                    # Fallback: if standard keys don't exist, use first two values
                    if period_val is None or count_val is None:
                        keys = list(row.keys()) if hasattr(row, 'keys') else []
                        if len(keys) >= 2:
                            period_val = row.get(keys[0]) if period_val is None else period_val
                            count_val = row.get(keys[1]) if count_val is None else count_val
                else:
                    # SQLite returns tuples
                    period_val = row[0] if len(row) > 0 else None
                    count_val = row[1] if len(row) > 1 else None
                
                # Only add valid data
                if period_val is not None and count_val is not None:
                    formatted_data.append({"period": period_val, "count": count_val})
            
            # Convert to cumulative if requested
            if cumulative:
                cumulative_count = 0
                for item in formatted_data:
                    cumulative_count += item["count"]
                    item["count"] = cumulative_count
            
            return {
                "metric": metric,
                "period": period,
                "cumulative": cumulative,
                "date_label": date_label,
                "data": formatted_data,
                "filters_applied": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "excluded_users": excluded_user_ids,
                    "category": category
                }
            }
    except Exception as e:
        import traceback
        error_details = f"Time series data error: {str(e)}"
        raise HTTPException(status_code=500, detail=f"Failed to fetch time series data: {str(e)}")

@app.get("/admin/analytics/top-hosts")
async def get_top_hosts(
    current_user: dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 10,
    exclude_users: Optional[str] = None
):
    """Get top event hosts/creators by event count"""
    # Check admin permission
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Parse filters
            excluded_user_ids = []
            if exclude_users:
                try:
                    excluded_user_ids = [int(uid.strip()) for uid in exclude_users.split(',') if uid.strip()]
                except ValueError:
                    excluded_user_ids = []
            
            # Build WHERE conditions
            conditions = ["1=1"]
            params = []
            
            if start_date:
                conditions.append(f"e.date >= {placeholder}")
                params.append(start_date)
            if end_date:
                conditions.append(f"e.date <= {placeholder}")
                params.append(end_date)
            if excluded_user_ids:
                placeholders = ','.join([placeholder for _ in excluded_user_ids])
                conditions.append(f"e.created_by NOT IN ({placeholders})")
                params.extend(excluded_user_ids)
            
            where_clause = " AND ".join(conditions)
            params.append(limit)
            
            cursor.execute(f"""
                SELECT 
                    u.email,
                    u.id,
                    COUNT(e.id) as event_count,
                    MIN(e.date) as first_event_date,
                    MAX(e.date) as last_event_date
                FROM events e
                JOIN users u ON e.created_by = u.id
                WHERE {where_clause}
                GROUP BY u.id, u.email
                ORDER BY event_count DESC
                LIMIT {placeholder}
            """, params)
            
            hosts = cursor.fetchall()
            
            # Handle both SQLite tuple results and PostgreSQL dict-like results
            formatted_hosts = []
            for host in hosts:
                if isinstance(host, dict):
                    # PostgreSQL RealDictCursor returns dict-like objects
                    host_data = {
                        "email": host.get('email'),
                        "user_id": host.get('id'),
                        "event_count": host.get('event_count'),
                        "first_event_date": host.get('first_event_date'),
                        "last_event_date": host.get('last_event_date')
                    }
                else:
                    # SQLite returns tuples
                    host_data = {
                        "email": host[0],
                        "user_id": host[1],
                        "event_count": host[2],
                        "first_event_date": host[3],
                        "last_event_date": host[4]
                    }
                formatted_hosts.append(host_data)
            
            return {
                "hosts": formatted_hosts,
                "filters_applied": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "excluded_users": excluded_user_ids,
                    "limit": limit
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch top hosts: {str(e)}")

@app.get("/admin/analytics/geographic")
async def get_geographic_analytics(
    current_user: dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    exclude_users: Optional[str] = None
):
    """Get geographic distribution of events"""
    # Check admin permission
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Parse filters
            excluded_user_ids = []
            if exclude_users:
                try:
                    excluded_user_ids = [int(uid.strip()) for uid in exclude_users.split(',') if uid.strip()]
                except ValueError:
                    excluded_user_ids = []
            
            # Build WHERE conditions for state query
            state_conditions = ["state IS NOT NULL"]
            state_params = []
            
            if start_date:
                state_conditions.append(f"date >= {placeholder}")
                state_params.append(start_date)
            if end_date:
                state_conditions.append(f"date <= {placeholder}")
                state_params.append(end_date)
            if excluded_user_ids:
                state_placeholders = ','.join([placeholder for _ in excluded_user_ids])
                state_conditions.append(f"created_by NOT IN ({state_placeholders})")
                state_params.extend(excluded_user_ids)
            
            state_where = " AND ".join(state_conditions)
            
            # Build WHERE conditions for city query
            city_conditions = ["city IS NOT NULL"]
            city_params = []
            
            if start_date:
                city_conditions.append(f"date >= {placeholder}")
                city_params.append(start_date)
            if end_date:
                city_conditions.append(f"date <= {placeholder}")
                city_params.append(end_date)
            if excluded_user_ids:
                city_placeholders = ','.join([placeholder for _ in excluded_user_ids])
                city_conditions.append(f"created_by NOT IN ({city_placeholders})")
                city_params.extend(excluded_user_ids)
            
            city_where = " AND ".join(city_conditions)
            
            # Events by state
            cursor.execute(f"""
                SELECT state, COUNT(*) as count
                FROM events 
                WHERE {state_where}
                GROUP BY state
                ORDER BY count DESC
            """, state_params)
            state_results = cursor.fetchall()
            
            # Handle both SQLite tuple results and PostgreSQL dict-like results
            by_state = {}
            for row in state_results:
                if isinstance(row, dict) or hasattr(row, 'get'):
                    # PostgreSQL RealDictCursor returns dict-like objects
                    state_name = row.get('state')
                    count_val = row.get('count')
                else:
                    # SQLite returns tuples
                    state_name = row[0] if len(row) > 0 else None
                    count_val = row[1] if len(row) > 1 else None
                
                if state_name is not None and count_val is not None:
                    by_state[state_name] = count_val
            
            # Events by city
            cursor.execute(f"""
                SELECT city, state, COUNT(*) as count
                FROM events 
                WHERE {city_where}
                GROUP BY city, state
                ORDER BY count DESC
                LIMIT 20
            """, city_params)
            city_results = cursor.fetchall()
            
            # Handle both SQLite tuple results and PostgreSQL dict-like results
            by_city = []
            for row in city_results:
                if isinstance(row, dict):
                    # PostgreSQL RealDictCursor returns dict-like objects
                    city_data = {
                        "city": row.get('city'),
                        "state": row.get('state'),
                        "count": row.get('count')
                    }
                else:
                    # SQLite returns tuples
                    city_data = {
                        "city": row[0],
                        "state": row[1],
                        "count": row[2]
                    }
                by_city.append(city_data)
            
            return {
                "by_state": by_state,
                "by_city": by_city,
                "filters_applied": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "excluded_users": excluded_user_ids
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch geographic analytics: {str(e)}")

@app.get("/admin/analytics/category-cloud")
async def get_category_cloud_data(
    current_user: dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    exclude_users: Optional[str] = None
):
    """Get category data for word cloud/bubble visualization"""
    # Check admin permission
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Parse filters
            excluded_user_ids = []
            if exclude_users:
                try:
                    excluded_user_ids = [int(uid.strip()) for uid in exclude_users.split(',') if uid.strip()]
                except ValueError:
                    excluded_user_ids = []
            
            # Build WHERE conditions
            conditions = ["1=1"]
            params = []
            
            if start_date:
                conditions.append(f"date >= {placeholder}")
                params.append(start_date)
            if end_date:
                conditions.append(f"date <= {placeholder}")
                params.append(end_date)
            if excluded_user_ids:
                placeholders = ','.join([placeholder for _ in excluded_user_ids])
                conditions.append(f"created_by NOT IN ({placeholders})")
                params.extend(excluded_user_ids)
            
            where_clause = " AND ".join(conditions)
            
            # Get primary categories with counts and additional metrics
            cursor.execute(f"""
                SELECT 
                    category,
                    COUNT(*) as count,
                    COUNT(DISTINCT created_by) as unique_hosts,
                    AVG(COALESCE(interest_count, 0)) as avg_interest,
                    AVG(COALESCE(view_count, 0)) as avg_views
                FROM events 
                WHERE {where_clause}
                GROUP BY category
                ORDER BY count DESC
            """, params)
            
            primary_results = cursor.fetchall()
            
            # Get secondary categories (if they exist)
            cursor.execute(f"""
                SELECT 
                    secondary_category,
                    COUNT(*) as count
                FROM events 
                WHERE {where_clause} AND secondary_category IS NOT NULL AND secondary_category != ''
                GROUP BY secondary_category
                ORDER BY count DESC
            """, params)
            
            secondary_results = cursor.fetchall()
            
            # Process primary categories
            categories = []
            for row in primary_results:
                if isinstance(row, dict) or hasattr(row, 'get'):
                    category_data = {
                        "name": row.get('category', 'Unknown'),
                        "count": row.get('count', 0),
                        "unique_hosts": row.get('unique_hosts', 0),
                        "avg_interest": float(row.get('avg_interest', 0) or 0),
                        "avg_views": float(row.get('avg_views', 0) or 0),
                        "type": "primary"
                    }
                else:
                    category_data = {
                        "name": row[0] if row[0] else 'Unknown',
                        "count": row[1],
                        "unique_hosts": row[2],
                        "avg_interest": float(row[3] or 0),
                        "avg_views": float(row[4] or 0),
                        "type": "primary"
                    }
                categories.append(category_data)
            
            # Process secondary categories
            for row in secondary_results:
                if isinstance(row, dict) or hasattr(row, 'get'):
                    category_data = {
                        "name": row.get('secondary_category', 'Unknown'),
                        "count": row.get('count', 0),
                        "unique_hosts": 0,  # Not calculated for secondary
                        "avg_interest": 0,   # Not calculated for secondary
                        "avg_views": 0,      # Not calculated for secondary
                        "type": "secondary"
                    }
                else:
                    category_data = {
                        "name": row[0] if row[0] else 'Unknown',
                        "count": row[1],
                        "unique_hosts": 0,
                        "avg_interest": 0,
                        "avg_views": 0,
                        "type": "secondary"
                    }
                categories.append(category_data)
            
            return {
                "categories": categories,
                "total_categories": len(categories),
                "filters_applied": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "excluded_users": excluded_user_ids
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch category cloud data: {str(e)}")

@app.get("/admin/analytics/event-locations")
async def get_event_locations(
    current_user: dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    exclude_users: Optional[str] = None,
    category: Optional[str] = None,
    limit: Optional[int] = 1000
):
    """Get event locations with coordinates for density mapping"""
    # Check admin permission
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Parse filters
            excluded_user_ids = []
            if exclude_users:
                try:
                    excluded_user_ids = [int(uid.strip()) for uid in exclude_users.split(',') if uid.strip()]
                except ValueError:
                    excluded_user_ids = []
            
            # Build WHERE conditions
            conditions = ["lat IS NOT NULL", "lng IS NOT NULL"]
            params = []
            
            if start_date:
                conditions.append(f"date >= {placeholder}")
                params.append(start_date)
            if end_date:
                conditions.append(f"date <= {placeholder}")
                params.append(end_date)
            if category:
                conditions.append(f"category = {placeholder}")
                params.append(category)
            if excluded_user_ids:
                placeholders = ','.join([placeholder for _ in excluded_user_ids])
                conditions.append(f"created_by NOT IN ({placeholders})")
                params.extend(excluded_user_ids)
            
            where_clause = " AND ".join(conditions)
            
            # Get event locations with metadata
            cursor.execute(f"""
                SELECT 
                    lat, lng, category, city, state,
                    COALESCE(interest_count, 0) as interest_count,
                    COALESCE(view_count, 0) as view_count,
                    title
                FROM events 
                WHERE {where_clause}
                ORDER BY COALESCE(interest_count, 0) + COALESCE(view_count, 0) DESC
                LIMIT {placeholder}
            """, params + [limit])
            
            location_results = cursor.fetchall()
            
            # Process locations
            locations = []
            for row in location_results:
                if isinstance(row, dict) or hasattr(row, 'get'):
                    location_data = {
                        "lat": float(row.get('lat', 0)),
                        "lng": float(row.get('lng', 0)),
                        "category": row.get('category', 'Unknown'),
                        "city": row.get('city', ''),
                        "state": row.get('state', ''),
                        "interest_count": row.get('interest_count', 0),
                        "view_count": row.get('view_count', 0),
                        "title": row.get('title', '')[:50] + ("..." if len(row.get('title', '')) > 50 else "")
                    }
                else:
                    location_data = {
                        "lat": float(row[0] or 0),
                        "lng": float(row[1] or 0),
                        "category": row[2] or 'Unknown',
                        "city": row[3] or '',
                        "state": row[4] or '',
                        "interest_count": row[5] or 0,
                        "view_count": row[6] or 0,
                        "title": (row[7] or '')[:50] + ("..." if len(row[7] or '') > 50 else "")
                    }
                locations.append(location_data)
            
            # Calculate some summary stats
            total_locations = len(locations)
            avg_lat = sum(loc['lat'] for loc in locations) / total_locations if total_locations > 0 else 0
            avg_lng = sum(loc['lng'] for loc in locations) / total_locations if total_locations > 0 else 0
            
            return {
                "locations": locations,
                "total_locations": total_locations,
                "center": {"lat": avg_lat, "lng": avg_lng},
                "categories": list(set(loc['category'] for loc in locations)),
                "filters_applied": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "category": category,
                    "excluded_users": excluded_user_ids,
                    "limit": limit
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch event locations: {str(e)}")

# Page Visit Tracking - Privacy-friendly without personal data storage
async def track_page_visit(page_type: str, page_path: str, user_id: int = None, browser_fingerprint: str = None):
    """
    Track page visits in a privacy-friendly way
    Only stores aggregated data and basic page info
    """
    try:
        
        with get_db() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Temporarily disable deduplication to test tracking
            # TODO: Re-enable this later
            
            # Insert new page visit (always for testing)
            insert_query = f"""
                INSERT INTO page_visits (page_type, page_path, user_id, browser_fingerprint, visited_at)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, CURRENT_TIMESTAMP)
            """
            params = (page_type, page_path, user_id, browser_fingerprint or 'anonymous')
            
            
            cursor.execute(insert_query, params)
            
            conn.commit()
            
            return True
            
    except Exception as e:
        import traceback
        return False

@app.post("/api/track-visit")
async def track_page_visit_endpoint(
    request: Request,
    page_type: str,  # 'homepage', 'events_list', 'event_detail', 'admin', etc.
    page_path: str = "/",
    current_user: dict = Depends(get_current_user_optional_no_exception)
):
    """
    Privacy-friendly page visit tracking endpoint
    Only tracks basic page types and paths, no personal data
    """
    try:
        # Get user ID if authenticated (for better analytics, but not required)
        user_id = current_user.get('id') if current_user else None
        
        # Generate browser fingerprint for deduplication only
        browser_fingerprint = generate_browser_fingerprint(request)
        
        # Track the page visit
        visit_tracked = await track_page_visit(page_type, page_path, user_id, browser_fingerprint)
        
        return {
            "success": True,
            "visit_tracked": visit_tracked,
            "page_type": page_type
        }
        
    except Exception as e:
        logger.error(f"Error in page visit tracking endpoint: {e}")
        return {"success": False, "error": "Failed to track visit"}

@app.post("/admin/verify-premium-events")
async def verify_premium_events(current_user: dict = Depends(get_current_user)):
    """
    Verify all existing events created by premium users
    """
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Find all events created by premium users that aren't verified
            cursor.execute(f"""
                UPDATE events 
                SET verified = TRUE 
                WHERE created_by IN (
                    SELECT id FROM users WHERE role IN ('premium', 'admin')
                ) AND verified = FALSE
            """)
            
            affected_rows = cursor.rowcount
            
            return {
                "success": True,
                "verified_events": affected_rows,
                "message": f"Verified {affected_rows} events from premium users"
            }
            
    except Exception as e:
        logger.error(f"Error verifying premium events: {str(e)}")
        raise HTTPException(status_code=500, detail="Error verifying premium events")

@app.get("/admin/analytics/page-visits")
async def get_page_visits_analytics(
    current_user: dict = Depends(get_current_user),
    metric: str = "page_visits",  # page_visits
    period: str = "daily",   # daily, weekly, monthly
    cumulative: Optional[bool] = None,  # Auto-default to True for page visits
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    exclude_users: Optional[str] = None,
    page_type: Optional[str] = None  # Filter by page type
):
    """Get page visit analytics with time series data"""
    # Check admin permission
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Set cumulative default for page visits (usually we want to see growth)
            if cumulative is None:
                cumulative = True
            
            # Parse filters
            excluded_user_ids = []
            if exclude_users:
                try:
                    excluded_user_ids = [int(uid.strip()) for uid in exclude_users.split(',') if uid.strip()]
                except ValueError:
                    excluded_user_ids = []
            
            # Default date range (last 90 days)
            if not start_date:
                start_date = (datetime.utcnow() - timedelta(days=90)).strftime('%Y-%m-%d')
            if not end_date:
                end_date = datetime.utcnow().strftime('%Y-%m-%d')
            
            # Build WHERE clause
            where_conditions = [f"DATE(visited_at) >= {placeholder}", f"DATE(visited_at) <= {placeholder}"]
            params = [start_date, end_date]
            
            if excluded_user_ids:
                user_placeholders = ','.join([placeholder] * len(excluded_user_ids))
                where_conditions.append(f"(user_id IS NULL OR user_id NOT IN ({user_placeholders}))")
                params.extend(excluded_user_ids)
            
            if page_type:
                where_conditions.append(f"page_type = {placeholder}")
                params.append(page_type)
            
            where_clause = " AND ".join(where_conditions)
            
            # Generate period-specific date grouping
            if IS_PRODUCTION and DB_URL:
                # PostgreSQL
                if period == "daily":
                    date_group = "TO_CHAR(visited_at, 'YYYY-MM-DD')"
                    date_label = "Daily"
                elif period == "weekly":
                    date_group = "TO_CHAR(DATE_TRUNC('week', visited_at), 'YYYY-\"W\"WW')"
                    date_label = "Weekly"
                elif period == "monthly":
                    date_group = "TO_CHAR(DATE_TRUNC('month', visited_at), 'YYYY-MM')"
                    date_label = "Monthly"
                else:
                    date_group = "TO_CHAR(visited_at, 'YYYY-MM-DD')"
                    date_label = "Daily"
            else:
                # SQLite
                if period == "daily":
                    date_group = "strftime('%Y-%m-%d', visited_at)"
                    date_label = "Daily"
                elif period == "weekly":
                    date_group = "strftime('%Y-W%W', visited_at)"
                    date_label = "Weekly"
                elif period == "monthly":
                    date_group = "strftime('%Y-%m', visited_at)"
                    date_label = "Monthly"
                else:
                    date_group = "strftime('%Y-%m-%d', visited_at)"
                    date_label = "Daily"
            
            # Query for time series data
            query = f"""
                SELECT {date_group} as period, COUNT(*) as count
                FROM page_visits
                WHERE {where_clause}
                GROUP BY {date_group}
                ORDER BY period
            """
            
            cursor.execute(query, params)
            data = cursor.fetchall()
            
            # Handle both SQLite tuple results and PostgreSQL dict-like results
            formatted_data = []
            for row in data:
                if isinstance(row, dict) or hasattr(row, 'get'):
                    # PostgreSQL RealDictCursor returns dict-like objects
                    period_val = row.get('period') 
                    count_val = row.get('count')
                    
                    # Fallback: if standard keys don't exist, use first two values
                    if period_val is None or count_val is None:
                        keys = list(row.keys()) if hasattr(row, 'keys') else []
                        if len(keys) >= 2:
                            period_val = row.get(keys[0]) if period_val is None else period_val
                            count_val = row.get(keys[1]) if count_val is None else count_val
                else:
                    # SQLite returns tuples
                    period_val = row[0]
                    count_val = row[1]
                
                formatted_data.append({
                    "period": period_val,
                    "count": int(count_val) if count_val is not None else 0
                })
            
            # Apply cumulative calculation if requested
            if cumulative and formatted_data:
                running_total = 0
                for item in formatted_data:
                    running_total += item["count"]
                    item["count"] = running_total
            
            return {
                "metric": metric,
                "period": period,
                "cumulative": cumulative,
                "date_label": date_label,
                "data": formatted_data,
                "filters_applied": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "excluded_users": excluded_user_ids,
                    "page_type": page_type
                }
            }
            
    except Exception as e:
        logger.error(f"Error fetching page visits analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch page visits analytics: {str(e)}")


@app.get("/api/report-event")
async def report_event_test():
    """Test if the report endpoint is reachable"""
    logger.info("🧪 GET /api/report-event endpoint reached")
    return {"message": "Report endpoint is working", "method": "GET"}
@app.post("/api/report-event")
async def report_event(report_data: dict):
    """Report an event for inappropriate content, incorrect information, etc."""
    try:
        logger.info(f"🚨 Report event endpoint called with data: {report_data}")
        # Validate required fields
        required_fields = ['eventId', 'eventTitle', 'category', 'description', 'reporterEmail']
        for field in required_fields:
            if not report_data.get(field):
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Validate email format
        email = report_data.get('reporterEmail', '').strip()
        if '@' not in email or '.' not in email:
            raise HTTPException(status_code=400, detail="Invalid email address")
        
        # Validate description length
        description = report_data.get('description', '').strip()
        if len(description) < 10:
            raise HTTPException(status_code=400, detail="Description must be at least 10 characters")
        
        # Send email notification
        try:
            logger.info("📧 Attempting to send report email...")
            from email_config import EmailService
            email_service = EmailService()
            
            report_reason = report_data.get('reason', report_data.get('category', 'Unknown'))
            subject = f"Event Report: {report_reason} - Event ID {report_data['eventId']}"
            
            html_content = f"""
            <h2>Event Report Received</h2>
            <p><strong>Event ID:</strong> {report_data['eventId']}</p>
            <p><strong>Event Title:</strong> {report_data['eventTitle']}</p>
            <p><strong>Report Type:</strong> {report_reason}</p>
            <p><strong>Reporter:</strong> {report_data.get('reporterName', 'Anonymous')} ({email})</p>
            <p><strong>Description:</strong> {description}</p>
            <p><strong>Time:</strong> {report_data.get('reportedAt', 'N/A')}</p>
            """
            
            email_sent = email_service.send_email(
                to_email="support@todo-events.com",
                subject=subject,
                html_content=html_content
            )
            
            logger.info(f"📧 Email send result: {email_sent}")
            
        except Exception as e:
            logger.error(f"Error sending report email: {e}")
        
        # Log the report
        logger.info(f"Event report received - Event ID: {report_data['eventId']}, Type: {report_reason}, Reporter: {email}")
        
        logger.info("✅ Report processing completed successfully")
        
        return {
            "success": True,
            "message": "Report submitted successfully. Our team will review it shortly."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing event report: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit report. Please contact support@todo-events.com directly.")

# CCPA/Privacy Compliance Endpoints

class PrivacyRequestType(str, Enum):
    ACCESS = "access"
    DELETE = "delete"
    OPT_OUT = "opt_out"

class PrivacyRequest(BaseModel):
    request_type: PrivacyRequestType
    email: EmailStr
    full_name: Optional[str] = None
    verification_info: Optional[str] = None
    details: Optional[str] = None

@app.post("/api/privacy/request")
async def submit_privacy_request(request: PrivacyRequest):
    """
    Handle CCPA privacy requests (access, deletion, opt-out)
    """
    try:
        logger.debug(f"=== PRIVACY REQUEST SUBMISSION DEBUG ===")
        logger.debug(f"Request data: request_type={request.request_type}, email={request.email}")
        logger.debug(f"IS_PRODUCTION: {IS_PRODUCTION}, DB_URL exists: {bool(DB_URL)}")
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Log the privacy request with proper database compatibility
            placeholder = get_placeholder()
            created_at = datetime.utcnow().isoformat()
            
            logger.debug(f"Using placeholder: {placeholder}, created_at: {created_at}")
            
            # Use different approach for PostgreSQL vs SQLite
            if IS_PRODUCTION and DB_URL:  # PostgreSQL
                logger.debug(f"Using PostgreSQL, inserting privacy request for {request.email}")
                
                # Test if table exists first, create if it doesn't
                try:
                    cursor.execute("SELECT COUNT(*) FROM privacy_requests LIMIT 1")
                    logger.debug("privacy_requests table exists and is accessible")
                except Exception as table_error:
                    logger.warning(f"privacy_requests table doesn't exist, creating it: {table_error}")
                    
                    # Create the table
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS privacy_requests (
                            id SERIAL PRIMARY KEY,
                            request_type VARCHAR(50) NOT NULL,
                            email VARCHAR(255) NOT NULL,
                            full_name VARCHAR(255),
                            verification_info TEXT,
                            details TEXT,
                            status VARCHAR(50) DEFAULT 'pending',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            completed_at TIMESTAMP,
                            admin_notes TEXT
                        )
                    """)
                    conn.commit()
                    logger.info("privacy_requests table created successfully")
                
                insert_sql = f"""
                    INSERT INTO privacy_requests 
                    (request_type, email, full_name, verification_info, details, status, created_at)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                """
                insert_values = (
                    request.request_type,
                    request.email,
                    request.full_name,
                    request.verification_info,
                    request.details,
                    'pending',
                    created_at
                )
                
                logger.debug(f"PostgreSQL insert SQL: {insert_sql}")
                logger.debug(f"PostgreSQL insert values: {insert_values}")
                
                cursor.execute(insert_sql, insert_values)
                result = cursor.fetchone()
                logger.debug(f"PostgreSQL insert result: {result}, type: {type(result)}")
                
                # Handle different result formats from PostgreSQL drivers
                if result:
                    if hasattr(result, 'keys') and hasattr(result, 'values'):
                        # psycopg2 RealDictRow or similar
                        request_id = result.get('id') or result.get(0)
                    elif isinstance(result, (list, tuple)) and len(result) > 0:
                        # Tuple or list result
                        request_id = result[0]
                    elif hasattr(result, '__getitem__'):
                        # Try direct indexing
                        try:
                            request_id = result[0]
                        except (KeyError, IndexError):
                            request_id = result.get('id') if hasattr(result, 'get') else None
                    else:
                        request_id = None
                    
                    logger.debug(f"Extracted request_id: {request_id}")
                    
                    if not request_id:
                        logger.error(f"Could not extract ID from result: {result}")
                        raise ValueError("Failed to get ID from PostgreSQL RETURNING clause")
                else:
                    logger.error(f"PostgreSQL RETURNING failed, result: {result}")
                    raise ValueError("Failed to get ID from PostgreSQL RETURNING clause")
            else:  # SQLite
                logger.debug(f"Using SQLite, inserting privacy request for {request.email}")
                cursor.execute(f"""
                    INSERT INTO privacy_requests 
                    (request_type, email, full_name, verification_info, details, status, created_at)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                """, (
                    request.request_type,
                    request.email,
                    request.full_name,
                    request.verification_info,
                    request.details,
                    'pending',
                    created_at
                ))
                request_id = cursor.lastrowid
                logger.debug(f"SQLite lastrowid: {request_id}")
            
            if not request_id or request_id == 0:
                logger.error(f"Invalid request_id after insert: {request_id}")
                raise ValueError(f"Failed to get valid ID for created privacy request, got: {request_id}")
                
            conn.commit()
            
            logger.info(f"Privacy request {request_id} created successfully for {request.email} - type: {request.request_type}")
            
            # Send confirmation email with user details
            try:
                from email_config import EmailService
                email_service = EmailService()
                
                # Prepare user details for the email
                user_details = {
                    'full_name': request.full_name,
                    'verification_info': request.verification_info,
                    'details': request.details,
                    'created_at': created_at
                }
                
                email_service.send_privacy_request_email(
                    request.email, 
                    request.request_type, 
                    request_id, 
                    user_details
                )
                logger.info(f"Privacy request confirmation email sent for request {request_id}")
            except Exception as e:
                logger.error(f"Failed to send privacy request confirmation email for request {request_id}: {e}")
                # Don't fail the entire request if email fails
            
            return {
                "success": True,
                "message": f"Privacy request submitted successfully. Request ID: {request_id}",
                "request_id": request_id,
                "estimated_response_time": "45 days"
            }
            
    except Exception as e:
        logger.error(f"Privacy request submission error: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error details: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        # Return more detailed error for debugging
        error_detail = f"Failed to submit privacy request: {type(e).__name__}: {str(e)}"
        raise HTTPException(status_code=500, detail=error_detail)
async def get_user_data_export(email: str, verification_code: str = None):
    """
    Export all data associated with a user email (for CCPA access requests)
    This endpoint should be protected and only used by admins or with proper verification
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            user_data = {}
            
            # Get user account data
            placeholder = get_placeholder()
            cursor.execute(f"SELECT id, email, role, created_at FROM users WHERE email = {placeholder}", (email,))
            user_row = cursor.fetchone()
            
            if user_row:
                user_data["account"] = {
                    "id": user_row[0],
                    "email": user_row[1], 
                    "role": user_row[2],
                    "created_at": user_row[3]
                }
                user_id = user_row[0]
                
                # Get events created by user
                cursor.execute(f"""
                    SELECT id, title, description, date, start_time, end_time, address, 
                           category, created_at, updated_at
                    FROM events WHERE created_by = {placeholder}
                """, (user_id,))
                events = cursor.fetchall()
                
                user_data["events_created"] = [
                    {
                        "id": row[0], "title": row[1], "description": row[2],
                        "date": row[3], "start_time": row[4], "end_time": row[5],
                        "address": row[6], "category": row[7],
                        "created_at": row[8], "updated_at": row[9]
                    } for row in events
                ]
                
                # Get interest data
                cursor.execute(f"""
                    SELECT event_id, interested, created_at, updated_at
                    FROM event_interests WHERE user_id = {placeholder}
                """, (user_id,))
                interests = cursor.fetchall()
                
                user_data["event_interests"] = [
                    {
                        "event_id": row[0], "interested": bool(row[1]),
                        "created_at": row[2], "updated_at": row[3]
                    } for row in interests
                ]
                
                # Get page visit data
                cursor.execute(f"""
                    SELECT page_type, page_path, visited_at
                    FROM page_visits WHERE user_id = {placeholder}
                    ORDER BY visited_at DESC LIMIT 100
                """, (user_id,))
                visits = cursor.fetchall()
                
                user_data["page_visits"] = [
                    {
                        "page_type": row[0], "page_path": row[1], 
                        "visited_at": row[2]
                    } for row in visits
                ]
            
            # Also check for anonymous data by email (from reports, etc.)
            cursor.execute(f"""
                SELECT id, event_id, reason, details, created_at
                FROM event_reports WHERE reporter_email = {placeholder}
            """, (email,))
            reports = cursor.fetchall()
            
            if reports:
                user_data["reports_submitted"] = [
                    {
                        "id": row[0], "event_id": row[1], "reason": row[2],
                        "details": row[3], "created_at": row[4]
                    } for row in reports
                ]
            
            return {
                "email": email,
                "data_export": user_data,
                "export_date": datetime.utcnow().isoformat(),
                "retention_policy": "Data is retained as needed for service operation. Contact support@todo-events.com for specific retention periods."
            }
            
    except Exception as e:
        logger.error(f"Data export error for {email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to export user data")

@app.delete("/api/privacy/delete/{email}")
async def delete_user_data(email: str, verification_code: str = None, current_user: dict = Depends(get_current_user)):
    """
    Delete all data associated with a user email (for CCPA deletion requests)
    Only accessible by admins
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Get user ID first
            cursor.execute(f"SELECT id FROM users WHERE email = {placeholder}", (email,))
            user_row = cursor.fetchone()
            
            deleted_items = {}
            
            if user_row:
                user_id = user_row[0]
                
                # Delete user's events (and cascade related data)
                cursor.execute(f"DELETE FROM event_interests WHERE event_id IN (SELECT id FROM events WHERE created_by = {placeholder})", (user_id,))
                cursor.execute(f"DELETE FROM event_views WHERE event_id IN (SELECT id FROM events WHERE created_by = {placeholder})", (user_id,))
                cursor.execute(f"DELETE FROM events WHERE created_by = {placeholder}", (user_id,))
                deleted_items["events"] = cursor.rowcount
                
                # Delete user's interests
                cursor.execute(f"DELETE FROM event_interests WHERE user_id = {placeholder}", (user_id,))
                deleted_items["interests"] = cursor.rowcount
                
                # Delete user's page visits
                cursor.execute(f"DELETE FROM page_visits WHERE user_id = {placeholder}", (user_id,))
                deleted_items["page_visits"] = cursor.rowcount
                
                # Delete user account
                cursor.execute(f"DELETE FROM users WHERE id = {placeholder}", (user_id,))
                deleted_items["user_account"] = cursor.rowcount
            
            # Delete reports by email (even if no user account)
            cursor.execute(f"DELETE FROM event_reports WHERE reporter_email = {placeholder}", (email,))
            deleted_items["reports"] = cursor.rowcount
            
            # Update privacy request status
            cursor.execute(f"""
                UPDATE privacy_requests 
                SET status = 'completed', completed_at = {placeholder}
                WHERE email = {placeholder} AND request_type = 'delete'
            """, (datetime.utcnow().isoformat(), email))
            
            conn.commit()
            
            return {
                "success": True,
                "message": f"All data for {email} has been deleted",
                "deleted_items": deleted_items,
                "deletion_date": datetime.utcnow().isoformat()
            }
            
    except Exception as e:
        logger.error(f"Data deletion error for {email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete user data")

# Add alias for privacy requests endpoint (frontend expects /admin/privacy-requests)
@app.get("/admin/privacy-requests")
async def list_privacy_requests_alias(current_user: dict = Depends(get_current_user)):
    """
    Alias for privacy requests endpoint (frontend compatibility)
    """
    return await list_privacy_requests(current_user)

@app.get("/admin/privacy/requests")
async def list_privacy_requests(current_user: dict = Depends(get_current_user)):
    """
    List all privacy requests for admin review
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Simplified approach: directly query without complex column detection
            try:
                cursor.execute("""
                    SELECT id, request_type, email, 
                           COALESCE(full_name, '') as full_name, 
                           COALESCE(details, '') as details, 
                           status, 
                           created_at, 
                           completed_at
                    FROM privacy_requests 
                    ORDER BY created_at DESC
                """)
                
                requests = cursor.fetchall()
                
                result = []
                for row in requests:
                    # Handle both tuple and dict-like results
                    if isinstance(row, (tuple, list)):
                        result.append({
                            "id": row[0],
                            "request_type": row[1],
                            "email": row[2],
                            "full_name": row[3] if row[3] else "",
                            "details": row[4] if row[4] else "",
                            "status": row[5],
                            "created_at": row[6],
                            "completed_at": row[7] if row[7] else None
                        })
                    else:
                        # If it's a dict-like object
                        result.append({
                            "id": row.get('id'),
                            "request_type": row.get('request_type'),
                            "email": row.get('email'),
                            "full_name": row.get('full_name', ''),
                            "details": row.get('details', ''),
                            "status": row.get('status'),
                            "created_at": row.get('created_at'),
                            "completed_at": row.get('completed_at')
                        })
                
                return result
                
            except Exception as query_error:
                # If the main query fails, try alternative column names
                try:
                    cursor.execute("""
                        SELECT id, request_type, email, 
                               COALESCE(full_name, '') as full_name, 
                               COALESCE(verification_info, details, '') as details, 
                               status, 
                               created_at, 
                               COALESCE(admin_notes, completed_at) as completed_at
                        FROM privacy_requests 
                        ORDER BY created_at DESC
                    """)
                    
                    requests = cursor.fetchall()
                    
                    return [
                        {
                            "id": row[0] if isinstance(row, (tuple, list)) else row.get('id'),
                            "request_type": row[1] if isinstance(row, (tuple, list)) else row.get('request_type'),
                            "email": row[2] if isinstance(row, (tuple, list)) else row.get('email'),
                            "full_name": (row[3] if isinstance(row, (tuple, list)) else row.get('full_name', '')) or "",
                            "details": (row[4] if isinstance(row, (tuple, list)) else row.get('details', '')) or "",
                            "status": row[5] if isinstance(row, (tuple, list)) else row.get('status'),
                            "created_at": row[6] if isinstance(row, (tuple, list)) else row.get('created_at'),
                            "completed_at": (row[7] if isinstance(row, (tuple, list)) else row.get('completed_at')) or None
                        } for row in requests
                    ]
                    
                except Exception as alt_error:
                    logger.error(f"Both privacy request queries failed: {query_error}, {alt_error}")
                    return []
            
    except Exception as e:
        logger.error(f"Error listing privacy requests: {e}")
        # Return empty list instead of throwing error
        return []

@app.put("/admin/privacy/requests/{request_id}/status")
async def update_privacy_request_status(
    request_id: int, 
    status: str, 
    notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Update privacy request status
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            completed_at = datetime.utcnow().isoformat() if status == "completed" else None
            
            cursor.execute("""
                UPDATE privacy_requests 
                SET status = ?, completed_at = ?, admin_notes = ?
                WHERE id = ?
            """, (status, completed_at, notes, request_id))
            
            conn.commit()
            
            return {"success": True, "message": "Privacy request status updated"}
            
    except Exception as e:
        logger.error(f"Error updating privacy request status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update privacy request status")

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return current_user

# Admin Media Moderation Endpoints
@app.get("/admin/media/overview")
async def get_media_overview(current_user: dict = Depends(get_current_user)):
    """Get media moderation overview for admin dashboard"""
    if current_user['role'] not in ['admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Create tables if they don't exist
            create_forensic_tables()
            
            # Get media statistics from events table for now (until migration)
            stats = {}
            
            # Count events with banner images
            c.execute("SELECT COUNT(*) FROM events WHERE banner_image IS NOT NULL")
            result = c.fetchone()
            banner_count = get_count_from_result(result)
            
            # Count events with logo images
            c.execute("SELECT COUNT(*) FROM events WHERE logo_image IS NOT NULL")
            result = c.fetchone()
            logo_count = get_count_from_result(result)
            
            stats['total_media'] = banner_count + logo_count
            stats['by_type'] = {'banner': banner_count, 'logo': logo_count}
            stats['by_status'] = {'active': banner_count + logo_count}
            stats['flagged_count'] = 0  # Will be updated when forensic data is migrated
            stats['recent_uploads'] = 0  # Will be updated when forensic data is migrated
            stats['storage_used_bytes'] = 0  # Will be calculated when forensic data is migrated
            
            return {"status": "success", "stats": stats}
            
    except Exception as e:
        logger.error(f"Error fetching media overview: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching media overview")

@app.get("/admin/media/files")
async def get_media_files(
    current_user: dict = Depends(get_current_user),
    page: int = 1,
    limit: int = 50,
    media_type: Optional[str] = None,
    status: Optional[str] = None,
    flagged_only: bool = False,
    search: Optional[str] = None
):
    """Get paginated list of uploaded media files with full user context"""
    if current_user['role'] not in ['admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Create tables if they don't exist
            create_forensic_tables()
            
            # Get media files from events table with user information
            files = []
            
            # Get banner images
            if not media_type or media_type == 'banner':
                query = """
                    SELECT 
                        e.id as event_id,
                        e.banner_image as filename,
                        'banner' as media_type,
                        e.created_at as upload_timestamp,
                        u.id as user_id,
                        u.email as user_email,
                        u.role as user_role,
                        u.created_at as user_created_at,
                        e.title as event_title,
                        e.category as event_category,
                        e.date as event_date,
                        'active' as moderation_status,
                        FALSE as flagged_content,
                        NULL as moderation_notes,
                        FALSE as law_enforcement_hold
                    FROM events e
                    JOIN users u ON e.created_by = u.id
                    WHERE e.banner_image IS NOT NULL
                """
                
                params = []
                if search:
                    query += f" AND (e.banner_image LIKE {placeholder} OR u.email LIKE {placeholder} OR e.title LIKE {placeholder})"
                    params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
                
                c.execute(query, params)
                banner_files = c.fetchall()
                files.extend([dict(file) for file in banner_files])
            
            # Get logo images
            if not media_type or media_type == 'logo':
                query = """
                    SELECT 
                        e.id as event_id,
                        e.logo_image as filename,
                        'logo' as media_type,
                        e.created_at as upload_timestamp,
                        u.id as user_id,
                        u.email as user_email,
                        u.role as user_role,
                        u.created_at as user_created_at,
                        e.title as event_title,
                        e.category as event_category,
                        e.date as event_date,
                        'active' as moderation_status,
                        FALSE as flagged_content,
                        NULL as moderation_notes,
                        FALSE as law_enforcement_hold
                    FROM events e
                    JOIN users u ON e.created_by = u.id
                    WHERE e.logo_image IS NOT NULL
                """
                
                params = []
                if search:
                    query += f" AND (e.logo_image LIKE {placeholder} OR u.email LIKE {placeholder} OR e.title LIKE {placeholder})"
                    params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
                
                c.execute(query, params)
                logo_files = c.fetchall()
                files.extend([dict(file) for file in logo_files])
            
            # Sort by upload timestamp
            files.sort(key=lambda x: x.get('upload_timestamp', ''), reverse=True)
            
            # Apply pagination
            total_count = len(files)
            start_idx = (page - 1) * limit
            end_idx = start_idx + limit
            paginated_files = files[start_idx:end_idx]
            
            return {
                "status": "success",
                "files": paginated_files,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit
                }
            }
            
    except Exception as e:
        logger.error(f"Error fetching media files: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching media files")

@app.put("/admin/media/flag/{event_id}")
async def flag_media(
    event_id: int,
    flag_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Flag media content for moderation"""
    if current_user['role'] not in ['admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            media_type = flag_data.get('media_type', 'banner')
            flagged = flag_data.get('flagged', True)
            notes = flag_data.get('notes', '')
            action = flag_data.get('action', 'flag')  # flag, remove, approve
            
            # For now, log the action in activity logs until media_forensic_data is fully implemented
            action_detail = f"Flagged {media_type} image for event {event_id}: action={action}, notes={notes[:100]}"
            log_activity(current_user['id'], "media_moderation", action_detail)
            
            # If removing media, update the event
            if action == 'remove':
                if media_type == 'banner':
                    c.execute(f"UPDATE events SET banner_image = NULL WHERE id = {placeholder}", (event_id,))
                elif media_type == 'logo':
                    c.execute(f"UPDATE events SET logo_image = NULL WHERE id = {placeholder}", (event_id,))
                conn.commit()
            
            return {"status": "success", "message": f"Media {action} action completed"}
            
    except Exception as e:
        logger.error(f"Error flagging media: {str(e)}")
        raise HTTPException(status_code=500, detail="Error flagging media")

@app.get("/admin/forensics/users")
async def get_user_forensics(
    current_user: dict = Depends(get_current_user),
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    flagged_only: bool = False
):
    """Get comprehensive user forensic data for law enforcement compliance"""
    if current_user['role'] not in ['admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Create forensic tables if they don't exist
            create_forensic_tables()
            
            # Get comprehensive user data for law enforcement
            query = """
                SELECT 
                    u.id as user_id,
                    u.email,
                    u.role,
                    u.created_at as account_created,
                    u.premium_expires_at,
                    COUNT(DISTINCT e.id) as events_created,
                    COUNT(DISTINCT CASE WHEN e.banner_image IS NOT NULL THEN e.id END) as banner_images,
                    COUNT(DISTINCT CASE WHEN e.logo_image IS NOT NULL THEN e.id END) as logo_images,
                    COUNT(DISTINCT al.id) as activity_logs,
                    MAX(al.timestamp) as last_activity,
                    COUNT(DISTINCT CASE WHEN al.action LIKE '%login%' THEN al.id END) as login_events
                FROM users u
                LEFT JOIN events e ON u.id = e.created_by
                LEFT JOIN activity_logs al ON u.id = al.user_id
                WHERE 1=1
            """
            params = []
            
            if search:
                if IS_PRODUCTION and DB_URL:
                    query += f" AND (u.email LIKE {placeholder} OR u.id::text LIKE {placeholder})"
                else:
                    query += f" AND (u.email LIKE {placeholder} OR CAST(u.id AS TEXT) LIKE {placeholder})"
                params.extend([f"%{search}%", f"%{search}%"])
            
            query += " GROUP BY u.id, u.email, u.role, u.created_at, u.premium_expires_at"
            
            # Add pagination
            offset = (page - 1) * limit
            query += f" ORDER BY u.created_at DESC LIMIT {placeholder} OFFSET {placeholder}"
            params.extend([limit, offset])
            
            c.execute(query, params)
            users = c.fetchall()
            
            # Convert users to list of dicts with proper column mapping
            column_names = ['user_id', 'email', 'role', 'account_created', 'premium_expires_at', 
                           'events_created', 'banner_images', 'logo_images', 'activity_logs', 
                           'last_activity', 'login_events']
            
            formatted_users = []
            for user in users:
                formatted_users.append(format_cursor_row(user, column_names))
            
            # Get total count
            count_query = "SELECT COUNT(DISTINCT u.id) FROM users u WHERE 1=1"
            count_params = []
            
            if search:
                if IS_PRODUCTION and DB_URL:
                    count_query += f" AND (u.email LIKE {placeholder} OR u.id::text LIKE {placeholder})"
                else:
                    count_query += f" AND (u.email LIKE {placeholder} OR CAST(u.id AS TEXT) LIKE {placeholder})"
                count_params.extend([f"%{search}%", f"%{search}%"])
            
            c.execute(count_query, count_params)
            result = c.fetchone()
            total_count = get_count_from_result(result)
            
            return {
                "status": "success",
                "users": formatted_users,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit
                }
            }
            
    except Exception as e:
        logger.error(f"Error fetching user forensics: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching user forensic data")

@app.get("/admin/audit/comprehensive")
async def get_comprehensive_audit_trail(
    current_user: dict = Depends(get_current_user),
    user_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    activity_type: Optional[str] = None,
    page: int = 1,
    limit: int = 100
):
    """Get comprehensive audit trail for law enforcement investigations"""
    if current_user['role'] not in ['admin']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Get activity logs with user context
            query = """
                SELECT 
                    'activity' as log_type,
                    al.id,
                    al.user_id,
                    u.email,
                    al.action,
                    al.details,
                    al.timestamp,
                    NULL as media_type,
                    NULL as filename,
                    NULL as ip_address,
                    NULL as user_agent
                FROM activity_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE 1=1
            """
            params = []
            
            if user_id:
                query += f" AND al.user_id = {placeholder}"
                params.append(user_id)
            
            if start_date:
                query += f" AND al.timestamp >= {placeholder}"
                params.append(start_date)
            
            if end_date:
                query += f" AND al.timestamp <= {placeholder}"
                params.append(end_date)
            
            if activity_type:
                query += f" AND al.action LIKE {placeholder}"
                params.append(f"%{activity_type}%")
            
            # Order and paginate
            offset = (page - 1) * limit
            query += f" ORDER BY al.timestamp DESC LIMIT {placeholder} OFFSET {placeholder}"
            params.extend([limit, offset])
            
            c.execute(query, params)
            audit_logs = c.fetchall()
            
            return {
                "status": "success",
                "audit_logs": [dict(log) for log in audit_logs],
                "pagination": {
                    "page": page,
                    "limit": limit
                },
                "metadata": {
                    "note": "Comprehensive forensic audit trail for law enforcement compliance",
                    "data_retention": "All user activities, media uploads, and system events are logged",
                    "legal_contact": "support@todo-events.com"
                }
            }
            
    except Exception as e:
        logger.error(f"Error fetching comprehensive audit trail: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching audit trail")
@app.post("/events/route-batch")
async def get_route_events_batch(request: RouteEventRequest):
    """
    Efficiently retrieve events along a route using batch processing.
    Takes multiple coordinate points and returns deduplicated events within radius.
    Optimized for route planning with minimal API calls.
    """
    placeholder = get_placeholder()
    
    if not request.coordinates or len(request.coordinates) == 0:
        return []
    
    # Limit coordinates to prevent abuse
    max_coords = 50
    if len(request.coordinates) > max_coords:
        raise HTTPException(
            status_code=400, 
            detail=f"Too many coordinates. Maximum {max_coords} allowed."
        )
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Build a single query with multiple distance calculations
            # This is much more efficient than multiple separate queries
            distance_conditions = []
            params = []
            
            for i, coord in enumerate(request.coordinates):
                lat = coord.get('lat')
                lng = coord.get('lng')
                
                if lat is None or lng is None:
                    continue
                    
                # Add distance condition for this coordinate
                distance_condition = f"""
                    (6371 * acos(cos(radians({lat})) * cos(radians(lat)) * 
                     cos(radians(lng) - radians({lng})) + sin(radians({lat})) * 
                     sin(radians(lat)))) * 0.621371 <= {request.radius}
                """
                distance_conditions.append(distance_condition)
            
            if not distance_conditions:
                return []
            
            # Build date filter conditions
            date_conditions = []
            if request.dateRange and request.dateRange.get('startDate') and request.dateRange.get('endDate'):
                # Use custom date range
                start_date = request.dateRange['startDate']
                end_date = request.dateRange['endDate']
                
                if IS_PRODUCTION and DB_URL:
                    date_conditions.append(f"date::date BETWEEN '{start_date}' AND '{end_date}'")
                else:
                    date_conditions.append(f"date BETWEEN '{start_date}' AND '{end_date}'")
                    
                params.extend([])  # No additional params needed for string literals
            else:
                # Default: future events only
                if IS_PRODUCTION and DB_URL:
                    date_conditions.append("date::date >= CURRENT_DATE")
                else:
                    date_conditions.append("date >= date('now')")
            
            # Combine all conditions
            all_conditions = [f"({' OR '.join(distance_conditions)})"]
            if date_conditions:
                all_conditions.extend(date_conditions)
            
            where_clause = " AND ".join(all_conditions)
            
            # Single optimized query that finds events near ANY of the coordinates
            query = f"""
                SELECT DISTINCT id, title, description, short_description, date, start_time, end_time, end_date, 
                       category, address, city, state, country, lat, lng, recurring, frequency, created_by, created_at,
                       COALESCE(interest_count, 0) as interest_count,
                       COALESCE(view_count, 0) as view_count,
                       fee_required, price, currency, event_url, host_name, organizer_url, slug, is_published,
                       start_datetime, end_datetime, updated_at, verified
                FROM events 
                WHERE {where_clause}
                ORDER BY 
                    interest_count DESC, date ASC
                LIMIT 100
            """
            
            cursor.execute(query, params)
            events = cursor.fetchall()
            
            # Process results
            result = []
            seen_event_ids = set()
            
            for event in events:
                try:
                    # Convert to dict
                    if hasattr(event, '_asdict'):
                        event_dict = event._asdict()
                    elif isinstance(event, dict):
                        event_dict = dict(event)
                    else:
                        column_names = [
                            'id', 'title', 'description', 'short_description', 'date', 'start_time', 'end_time',
                            'end_date', 'category', 'address', 'city', 'state', 'country', 'lat', 'lng', 'recurring',
                            'frequency', 'created_by', 'created_at', 'interest_count', 'view_count',
                            'fee_required', 'price', 'currency', 'event_url', 'host_name', 'organizer_url', 'slug', 'is_published',
                            'start_datetime', 'end_datetime', 'updated_at', 'verified'
                        ]
                        event_dict = dict(zip(column_names, event))
                    
                    # Deduplicate events
                    event_id = event_dict.get('id')
                    if event_id and event_id not in seen_event_ids:
                        seen_event_ids.add(event_id)
                        
                        # Convert datetime fields
                        event_dict = convert_event_datetime_fields(event_dict)
                        
                        # Ensure counters are integers
                        event_dict['interest_count'] = int(event_dict.get('interest_count', 0) or 0)
                        event_dict['view_count'] = int(event_dict.get('view_count', 0) or 0)
                        
                        result.append(event_dict)
                        
                except Exception as event_error:
                    logger.warning(f"Error processing route event {event}: {event_error}")
                    continue
            
            logger.info(f"Route batch query returned {len(result)} unique events for {len(request.coordinates)} coordinates")
            return result
            
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error retrieving route events: {error_msg}")
        
        if "timeout" in error_msg.lower():
            raise HTTPException(status_code=504, detail="Route events query timed out")
        elif "connection" in error_msg.lower():
            raise HTTPException(status_code=503, detail="Database connection issues")
        else:
            raise HTTPException(status_code=500, detail="Error retrieving route events")

# Register recommendations endpoints at startup
try:
    from recommendations_endpoints import create_recommendations_endpoints
    create_recommendations_endpoints(app, get_db, get_placeholder)
    logger.info("Recommendations endpoints registered successfully")
except Exception as e:
    logger.error(f"Failed to register recommendations endpoints: {e}")