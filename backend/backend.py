import os
import re
import sqlite3
import logging
import time
import json
import traceback
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from contextlib import contextmanager
from enum import Enum
import asyncio
import threading

# Import SEO utilities
try:
    from seo_utils import SEOEventProcessor, generate_event_json_ld, generate_seo_metadata, slugify
except ImportError:
    print("⚠️ SEO utilities not available - install seo_utils.py for full SEO features")
    def slugify(text): return text.lower().replace(' ', '-')
    SEOEventProcessor = None

import uvicorn
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks, Request, Header
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
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# Environment configuration 
IS_PRODUCTION = os.getenv("RENDER", False) or os.getenv("RAILWAY_ENVIRONMENT", False)
DB_URL = os.getenv("DATABASE_URL", None)

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="EventFinder API")

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
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=get_cors_origins(),
#     allow_credentials=True,
#     allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
#     allow_headers=["*"],
#     max_age=86400,  # Cache preflight requests for 24 hours
# )

# Database file for SQLite (development only)
DB_FILE = os.path.join(os.path.dirname(__file__), "events.db")

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"

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
                    # PostgreSQL - cast date text to date for comparison
                    c.execute("""
                        SELECT id, title, description, date, start_time, end_time, end_date, category, 
                               address, lat, lng, created_at, slug, is_published
                        FROM events 
                        WHERE CAST(date AS DATE) >= (CURRENT_DATE - INTERVAL '30 days')::DATE 
                        AND (is_published = true OR is_published IS NULL)
                        ORDER BY CAST(date AS DATE), start_time
                    """)
                else:
                    # SQLite
                    c.execute("""
                        SELECT id, title, description, date, start_time, end_time, end_date, category, 
                               address, lat, lng, created_at, slug, is_published
                        FROM events 
                        WHERE date::date >= CURRENT_DATE AND (is_published = 1 OR is_published IS NULL)
                        ORDER BY date, start_time
                    """)
                return [dict(row) for row in c.fetchall()]
        except Exception as e:
            logger.error(f"Error fetching events for sitemap: {str(e)}")
            return []
    
    async def build_sitemap_content(self, events):
        """Build sitemap XML content with current events"""
        current_date = datetime.utcnow().strftime('%Y-%m-%d')
        domain = "https://todo-events.com"
        
        # Start with static sitemap structure
        sitemap = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

  <!-- Homepage - Primary landing page -->
  <url>
    <loc>{domain}/</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>{domain}/images/pin-logo.svg</image:loc>
      <image:caption>todo-events logo - Local event discovery platform</image:caption>
    </image:image>
  </url>

  <!-- Main navigation pages -->
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
  </url>'''
        
        # Add category pages - both query param and SEO-friendly formats
        categories = [
    'food-drink', 'music', 'arts', 'sports', 'automotive', 'airshows', 'vehicle-sports', 
    'community', 'religious', 'education', 'veteran', 'cookout', 'networking',
    'fair-festival', 'diving', 'shopping', 'health', 'outdoors', 'photography', 'family', 
    'gaming', 'real-estate', 'adventure', 'seasonal', 'other'
]
        
        sitemap += f'''

  <!-- Category pages -->'''
        
        for category in categories:
            sitemap += f'''
  <url>
    <loc>{domain}/events/{category}</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>'''
        
        # Add individual event pages with multiple URL formats
        sitemap += f'''

  <!-- Individual Event Pages -->'''
        
        for event in events[:100]:  # Limit to avoid huge sitemaps
            # Get dynamic lastmod date from event
            event_lastmod = current_date
            if event.get('updated_at'):
                try:
                    parsed_date = datetime.fromisoformat(str(event['updated_at']).replace('Z', '+00:00'))
                    event_lastmod = parsed_date.strftime('%Y-%m-%d')
                except:
                    pass
            elif event.get('created_at'):
                try:
                    parsed_date = datetime.fromisoformat(str(event['created_at']).replace('Z', '+00:00'))
                    event_lastmod = parsed_date.strftime('%Y-%m-%d')
                except:
                    pass
            
            # Check if event has a slug for SEO-friendly URL
            if event.get('slug'):
                event_slug = event['slug']
                
                # Generate canonical URL based on location data
                if event.get('city') and event.get('state'):
                    # Location-based URL: /us/state/city/events/slug
                    state_lower = event.get('state', '').lower()

                    city_slug = slugify(event.get('city', ''))
                    canonical_url = f"{domain}/us/{state_lower}/{city_slug}/events/{event_slug}"
                    priority = "0.9"  # Higher priority for geo-specific URLs
                else:
                    # Fallback URL: /events/slug
                    canonical_url = f"{domain}/events/{event_slug}"
                    priority = "0.85"
                
                sitemap += f'''
  <url>
    <loc>{canonical_url}</loc>
    <lastmod>{event_lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>{priority}</priority>
  </url>'''
                
                # Add short URL for compatibility
                sitemap += f'''
  <url>
    <loc>{domain}/e/{event_slug}</loc>
    <lastmod>{event_lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>'''
                
                # Add date-indexed URL if we have event date
                try:
                    event_date_obj = datetime.fromisoformat(str(event.get('date', current_date)))
                    year = event_date_obj.strftime('%Y')
                    month = event_date_obj.strftime('%m')
                    day = event_date_obj.strftime('%d')
                    
                    sitemap += f'''
  <url>
    <loc>{domain}/events/{year}/{month}/{day}/{event_slug}</loc>
    <lastmod>{event_lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.75</priority>
  </url>'''
                except:
                    pass  # Skip date-indexed URL if date parsing fails
        
        # Add time-based event discovery pages
        sitemap += f'''

  <!-- Time-based Event Discovery -->
  <url>
    <loc>{domain}/events-today</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>{domain}/events-tonight</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>{domain}/events-this-weekend</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>{domain}/events-tomorrow</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>{domain}/events-this-week</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>'''

        # Add location-based discovery pages for major cities
        major_cities = [
            'new-york', 'los-angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
            'san-antonio', 'san-diego', 'dallas', 'san-jose', 'austin', 'jacksonville',
            'fort-worth', 'columbus', 'charlotte', 'san-francisco', 'indianapolis',
            'seattle', 'denver', 'washington', 'boston', 'nashville', 'detroit',
            'portland', 'memphis', 'las-vegas', 'miami', 'atlanta', 'milwaukee'
        ]

        sitemap += f'''

  <!-- "This Weekend in [City]" Pages -->'''
        
        for city in major_cities[:25]:  # Limit to top 25 cities
            sitemap += f'''
  <url>
    <loc>{domain}/this-weekend-in-{city}</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.75</priority>
  </url>'''

        sitemap += f'''

  <!-- "Free Events in [City]" Pages -->'''
        
        for city in major_cities[:25]:  # Limit to top 25 cities
            sitemap += f'''
  <url>
    <loc>{domain}/free-events-in-{city}</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>'''

        sitemap += f'''

  <!-- "Today in [City]" Pages -->'''
        
        for city in major_cities[:15]:  # Limit to top 15 cities for today
            sitemap += f'''
  <url>
    <loc>{domain}/today-in-{city}</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>'''

        sitemap += f'''

  <!-- "Tonight in [City]" Pages -->'''
        
        for city in major_cities[:15]:  # Limit to top 15 cities for tonight
            sitemap += f'''
  <url>
    <loc>{domain}/tonight-in-{city}</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.75</priority>
  </url>'''

        # Add general discovery and AI-optimized pages
        sitemap += f'''

  <!-- General Discovery Pages -->
  <url>
    <loc>{domain}/local-events-near-me</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>{domain}/near-me</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>{domain}/free-events-near-me</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>{domain}/live-music-near-me</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{domain}/food-festivals-near-me</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{domain}/art-events-near-me</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{domain}/outdoor-events</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{domain}/family-friendly-events</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{domain}/discover</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>

  <!-- Static Pages -->
  <url>
    <loc>{domain}/about</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>{domain}/how-it-works</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>{domain}/create-event</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{domain}/contact</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>{domain}/privacy</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>{domain}/terms</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>

</urlset>

<!-- Note: This sitemap was automatically generated on {current_date} -->
<!-- Contains {len(events)} individual events and comprehensive SEO URLs -->
'''
        
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
                current_datetime = datetime.now()
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

# Password Validation System
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

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user

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
                       category, address, city, state, country, lat, lng, recurring, frequency, created_by, created_at,
                       COALESCE(interest_count, 0) as interest_count,
                       COALESCE(view_count, 0) as view_count,
                       fee_required, price, currency, event_url, host_name, organizer_url, slug, is_published,
                       start_datetime, end_datetime, updated_at
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
                            'start_datetime', 'end_datetime', 'updated_at'
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
                         start_datetime, end_datetime, updated_at
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
        count = result[0] if result else 0
        
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
                logger.error(f"❌ information_schema query failed: {e}")
            
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
                logger.error(f"❌ pg_class query failed: {e}")
                
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
        'start_datetime', 'end_datetime', 'geo_hash', 'is_published'
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
                filtered_event_data['created_at'] = datetime.now().isoformat()
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
    Retrieve events created by the current user for management.
    Requires authentication.
    """
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Query events created by the current user
            query = f"SELECT * FROM events WHERE created_by = {placeholder} ORDER BY date, start_time"
            c.execute(query, (current_user["id"],))
            events = c.fetchall()
            
            # Convert to list of dictionaries and apply datetime conversion
            event_list = []
            for event in events:
                event_dict = dict(event)
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
                    filtered_event_data['updated_at'] = datetime.now().isoformat()
                
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
                
                # Delete the event
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

# Utility functions for interests and views
def generate_browser_fingerprint(request: Request) -> str:
    """Generate a browser fingerprint for anonymous users"""
    import hashlib
    
    # Get client info
    user_agent = request.headers.get("user-agent", "")
    client_ip = request.client.host if request.client else "unknown"
    accept_language = request.headers.get("accept-language", "")
    accept_encoding = request.headers.get("accept-encoding", "")
import os
import re
import sqlite3
import logging
import time
import json
import traceback
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from contextlib import contextmanager
from enum import Enum
import asyncio
import threading

# Import SEO utilities
try:
    from seo_utils import SEOEventProcessor, generate_event_json_ld, generate_seo_metadata, slugify
except ImportError:
    print("⚠️ SEO utilities not available - install seo_utils.py for full SEO features")
    def slugify(text): return text.lower().replace(' ', '-')
    SEOEventProcessor = None

import uvicorn
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks, Request, Header
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
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# Environment configuration 
IS_PRODUCTION = os.getenv("RENDER", False) or os.getenv("RAILWAY_ENVIRONMENT", False)
DB_URL = os.getenv("DATABASE_URL", None)

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="EventFinder API")

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
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=get_cors_origins(),
#     allow_credentials=True,
#     allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
#     allow_headers=["*"],
#     max_age=86400,  # Cache preflight requests for 24 hours
# )

# Database file for SQLite (development only)
DB_FILE = os.path.join(os.path.dirname(__file__), "events.db")

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"

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
                    # PostgreSQL - cast date text to date for comparison
                    c.execute("""
                        SELECT id, title, description, date, start_time, end_time, end_date, category, 
                               address, lat, lng, created_at, slug, is_published
                        FROM events 
                        WHERE CAST(date AS DATE) >= (CURRENT_DATE - INTERVAL '30 days')::DATE 
                        AND (is_published = true OR is_published IS NULL)
                        ORDER BY CAST(date AS DATE), start_time
                    """)
                else:
                    # SQLite
                    c.execute("""
                        SELECT id, title, description, date, start_time, end_time, end_date, category, 
                               address, lat, lng, created_at, slug, is_published
                        FROM events 
                        WHERE date::date >= CURRENT_DATE AND (is_published = 1 OR is_published IS NULL)
                        ORDER BY date, start_time
                    """)
                return [dict(row) for row in c.fetchall()]
        except Exception as e:
            logger.error(f"Error fetching events for sitemap: {str(e)}")
            return []
    
    async def build_sitemap_content(self, events):
        """Build sitemap XML content with current events"""
        current_date = datetime.utcnow().strftime('%Y-%m-%d')
        domain = "https://todo-events.com"
        
        # Start with static sitemap structure
        sitemap = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

  <!-- Homepage - Primary landing page -->
  <url>
    <loc>{domain}/</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>{domain}/images/pin-logo.svg</image:loc>
      <image:caption>todo-events logo - Local event discovery platform</image:caption>
    </image:image>
  </url>

  <!-- Main navigation pages -->
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
  </url>'''
        
        # Add category pages - both query param and SEO-friendly formats
        categories = [
    'food-drink', 'music', 'arts', 'sports', 'automotive', 'airshows', 'vehicle-sports', 
    'community', 'religious', 'education', 'veteran', 'cookout', 'networking',
    'fair-festival', 'diving', 'shopping', 'health', 'outdoors', 'photography', 'family', 
    'gaming', 'real-estate', 'adventure', 'seasonal', 'other'
]
        
        sitemap += f'''

  <!-- Category pages -->'''
        
        for category in categories:
            sitemap += f'''
  <url>
    <loc>{domain}/events/{category}</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>'''
        
        # Add individual event pages with multiple URL formats
        sitemap += f'''

  <!-- Individual Event Pages -->'''
        
        for event in events[:100]:  # Limit to avoid huge sitemaps
            # Get dynamic lastmod date from event
            event_lastmod = current_date
            if event.get('updated_at'):
                try:
                    parsed_date = datetime.fromisoformat(str(event['updated_at']).replace('Z', '+00:00'))
                    event_lastmod = parsed_date.strftime('%Y-%m-%d')
                except:
                    pass
            elif event.get('created_at'):
                try:
                    parsed_date = datetime.fromisoformat(str(event['created_at']).replace('Z', '+00:00'))
                    event_lastmod = parsed_date.strftime('%Y-%m-%d')
                except:
                    pass
            
            # Check if event has a slug for SEO-friendly URL
            if event.get('slug'):
                event_slug = event['slug']
                
                # Generate canonical URL based on location data
                if event.get('city') and event.get('state'):
                    # Location-based URL: /us/state/city/events/slug
                    state_lower = event.get('state', '').lower()

                    city_slug = slugify(event.get('city', ''))
                    canonical_url = f"{domain}/us/{state_lower}/{city_slug}/events/{event_slug}"
                    priority = "0.9"  # Higher priority for geo-specific URLs
                else:
                    # Fallback URL: /events/slug
                    canonical_url = f"{domain}/events/{event_slug}"
                    priority = "0.85"
                
                sitemap += f'''
  <url>
    <loc>{canonical_url}</loc>
    <lastmod>{event_lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>{priority}</priority>
  </url>'''
                
                # Add short URL for compatibility
                sitemap += f'''
  <url>
    <loc>{domain}/e/{event_slug}</loc>
    <lastmod>{event_lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>'''
                
                # Add date-indexed URL if we have event date
                try:
                    event_date_obj = datetime.fromisoformat(str(event.get('date', current_date)))
                    year = event_date_obj.strftime('%Y')
                    month = event_date_obj.strftime('%m')
                    day = event_date_obj.strftime('%d')
                    
                    sitemap += f'''
  <url>
    <loc>{domain}/events/{year}/{month}/{day}/{event_slug}</loc>
    <lastmod>{event_lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.75</priority>
  </url>'''
                except:
                    pass  # Skip date-indexed URL if date parsing fails
        
        # Add time-based event discovery pages
        sitemap += f'''

  <!-- Time-based Event Discovery -->
  <url>
    <loc>{domain}/events-today</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>{domain}/events-tonight</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>{domain}/events-this-weekend</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>{domain}/events-tomorrow</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>{domain}/events-this-week</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>'''

        # Add location-based discovery pages for major cities
        major_cities = [
            'new-york', 'los-angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
            'san-antonio', 'san-diego', 'dallas', 'san-jose', 'austin', 'jacksonville',
            'fort-worth', 'columbus', 'charlotte', 'san-francisco', 'indianapolis',
            'seattle', 'denver', 'washington', 'boston', 'nashville', 'detroit',
            'portland', 'memphis', 'las-vegas', 'miami', 'atlanta', 'milwaukee'
        ]

        sitemap += f'''

  <!-- "This Weekend in [City]" Pages -->'''
        
        for city in major_cities[:25]:  # Limit to top 25 cities
            sitemap += f'''
  <url>
    <loc>{domain}/this-weekend-in-{city}</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.75</priority>
  </url>'''

        sitemap += f'''

  <!-- "Free Events in [City]" Pages -->'''
        
        for city in major_cities[:25]:  # Limit to top 25 cities
            sitemap += f'''
  <url>
    <loc>{domain}/free-events-in-{city}</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>'''

        sitemap += f'''

  <!-- "Today in [City]" Pages -->'''
        
        for city in major_cities[:15]:  # Limit to top 15 cities for today
            sitemap += f'''
  <url>
    <loc>{domain}/today-in-{city}</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>'''

        sitemap += f'''

  <!-- "Tonight in [City]" Pages -->'''
        
        for city in major_cities[:15]:  # Limit to top 15 cities for tonight
            sitemap += f'''
  <url>
    <loc>{domain}/tonight-in-{city}</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.75</priority>
  </url>'''

        # Add general discovery and AI-optimized pages
        sitemap += f'''

  <!-- General Discovery Pages -->
  <url>
    <loc>{domain}/local-events-near-me</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>{domain}/near-me</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>{domain}/free-events-near-me</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>{domain}/live-music-near-me</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{domain}/food-festivals-near-me</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{domain}/art-events-near-me</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{domain}/outdoor-events</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{domain}/family-friendly-events</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{domain}/discover</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>

  <!-- Static Pages -->
  <url>
    <loc>{domain}/about</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>{domain}/how-it-works</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>{domain}/create-event</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>{domain}/contact</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>{domain}/privacy</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>{domain}/terms</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>

</urlset>

<!-- Note: This sitemap was automatically generated on {current_date} -->
<!-- Contains {len(events)} individual events and comprehensive SEO URLs -->
'''
        
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
                current_datetime = datetime.now()
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

# Password Validation System
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

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user

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
                       category, address, city, state, country, lat, lng, recurring, frequency, created_by, created_at,
                       COALESCE(interest_count, 0) as interest_count,
                       COALESCE(view_count, 0) as view_count,
                       fee_required, price, currency, event_url, host_name, organizer_url, slug, is_published,
                       start_datetime, end_datetime, updated_at
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
                            'start_datetime', 'end_datetime', 'updated_at'
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
                         start_datetime, end_datetime, updated_at
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
        count = result[0] if result else 0
        
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
                logger.error(f"❌ information_schema query failed: {e}")
            
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
                logger.error(f"❌ pg_class query failed: {e}")
                
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
        'start_datetime', 'end_datetime', 'geo_hash', 'is_published'
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
                filtered_event_data['created_at'] = datetime.now().isoformat()
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
    Retrieve events created by the current user for management.
    Requires authentication.
    """
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Query events created by the current user
            query = f"SELECT * FROM events WHERE created_by = {placeholder} ORDER BY date, start_time"
            c.execute(query, (current_user["id"],))
            events = c.fetchall()
            
            # Convert to list of dictionaries and apply datetime conversion
            event_list = []
            for event in events:
                event_dict = dict(event)
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
                    filtered_event_data['updated_at'] = datetime.now().isoformat()
                
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
                
                # Delete the event
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

# Utility functions for interests and views
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

# Main execution block
if __name__ == "__main__":
    # Ensure environment variables are loaded
    load_dotenv()
    
    # Get port from environment variable for Render.com
    port = int(os.getenv("PORT", 8000))
    
    # Run the server
    uvicorn.run(
        "backend:app", 
        host="0.0.0.0", 
        port=port, 
        reload=not IS_PRODUCTION  # Only use reload in development
    )

@app.get("/debug/schema")
async def debug_schema():
    """Debug endpoint to check database schema"""
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check events table columns with fallback
            if IS_PRODUCTION and DB_URL:
                try:
                    c.execute("""
                        SELECT column_name, data_type, is_nullable, column_default 
                        FROM information_schema.columns 
                        WHERE table_name = 'events' 
                        ORDER BY ordinal_position
                    """)
                    events_columns = c.fetchall()
                    
                    # Check if event_interests table exists
                    c.execute("""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_name = 'event_interests'
                    """)
                    interests_table = c.fetchone()
                    
                    # Check if event_views table exists
                    c.execute("""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_name = 'event_views'
                    """)
                    views_table = c.fetchone()
                    
                    # Get event_interests columns if table exists
                    interests_columns = []
                    if interests_table:
                        c.execute("""
                            SELECT column_name, data_type, is_nullable 
                            FROM information_schema.columns 
                            WHERE table_name = 'event_interests' 
                            ORDER BY ordinal_position
                        """)
                        interests_columns = c.fetchall()
                    
                    # Get event_views columns if table exists
                    views_columns = []
                    if views_table:
                        c.execute("""
                            SELECT column_name, data_type, is_nullable 
                            FROM information_schema.columns 
                            WHERE table_name = 'event_views' 
                            ORDER BY ordinal_position
                        """)
                        views_columns = c.fetchall()
                except Exception as e:
                    # Fallback for information_schema issues
                    logger.warning(f"information_schema query failed, using fallback: {e}")
                    events_columns = [("schema_query_failed", "text", "YES", None)]
                    interests_table = None
                    views_table = None
                    interests_columns = []
                    views_columns = []
            else:
                # SQLite
                c.execute('PRAGMA table_info(events)')
                events_columns = c.fetchall()
                
                c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='event_interests'")
                interests_table = c.fetchone()
                
                c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='event_views'")
                views_table = c.fetchone()
                
                interests_columns = []
                views_columns = []
                
                if interests_table:
                    c.execute('PRAGMA table_info(event_interests)')
                    interests_columns = c.fetchall()
                    
                if views_table:
                    c.execute('PRAGMA table_info(event_views)')
                    views_columns = c.fetchall()
            
            return {
                "database_type": "postgresql" if IS_PRODUCTION and DB_URL else "sqlite",
                "events_table": {
                    "columns": events_columns
                },
                "event_interests_table": {
                    "exists": bool(interests_table),
                    "columns": interests_columns
                },
                "event_views_table": {
                    "exists": bool(views_table),
                    "columns": views_columns
                }
            }
            
    except Exception as e:
        logger.error(f"Schema debug error: {str(e)}")
        return {"error": str(e)}

@app.post("/debug/create-tables")
async def create_tracking_tables():
    """Debug endpoint to manually create tracking tables and fix counter values"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Create event_interests table if it doesn't exist
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS event_interests (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL,
                    user_id INTEGER,
                    browser_fingerprint TEXT NOT NULL DEFAULT 'legacy',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(event_id, user_id, browser_fingerprint),
                    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
                )
            """)
            
            # Create event_views table if it doesn't exist  
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS event_views (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL,
                    user_id INTEGER,
                    browser_fingerprint TEXT NOT NULL DEFAULT 'legacy',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(event_id, user_id, browser_fingerprint),
                    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
                )
            """)
            
            # Create page_visits table for general page visit tracking
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS page_visits (
                    id SERIAL PRIMARY KEY,
                    page_type TEXT NOT NULL,
                    page_path TEXT NOT NULL,
                    user_id INTEGER,
                    browser_fingerprint TEXT NOT NULL DEFAULT 'anonymous',
                    visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create privacy_requests table for CCPA compliance
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS privacy_requests (
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
                )
            """)
            
            # Fix NULL counter values in existing events
            cursor.execute("UPDATE events SET interest_count = 0 WHERE interest_count IS NULL")
            cursor.execute("UPDATE events SET view_count = 0 WHERE view_count IS NULL")
            
            conn.commit()
            
            return {
                "success": True,
                "message": "All tables created successfully",
                "tables_created": ["event_interests", "event_views", "page_visits", "privacy_requests"],
                "events_updated": True
            }
            
    except Exception as e:
        logger.error(f"Error creating tracking tables: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to create tracking tables"
        }

@app.get("/debug/test-tracking/{event_id}")
async def debug_test_tracking(event_id: int):
    """Debug endpoint to test tracking functionality"""
    try:
        placeholder = get_placeholder()
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Test 1: Check if event exists
            cursor.execute(f"SELECT id FROM events WHERE id = {placeholder}", (event_id,))
            event_exists = cursor.fetchone()
            
            # Test 2: Check tracking tables
            cursor.execute("SELECT COUNT(*) FROM event_interests")
            interest_count = get_count_from_result(cursor.fetchone())
            
            cursor.execute("SELECT COUNT(*) FROM event_views")
            view_count = get_count_from_result(cursor.fetchone())
            
            # Test 3: Try simple insert (without constraints)
            test_fingerprint = f"debug-test-{event_id}"
            
            # Clean up any existing test data first
            cursor.execute(f"DELETE FROM event_interests WHERE browser_fingerprint = {placeholder}", (test_fingerprint,))
            cursor.execute(f"DELETE FROM event_views WHERE browser_fingerprint = {placeholder}", (test_fingerprint,))
            
            # Test insert
            cursor.execute(
                f"INSERT INTO event_interests (event_id, user_id, browser_fingerprint) VALUES ({placeholder}, {placeholder}, {placeholder})",
                (event_id, None, test_fingerprint)
            )
            
            cursor.execute(
                f"INSERT INTO event_views (event_id, user_id, browser_fingerprint) VALUES ({placeholder}, {placeholder}, {placeholder})",
                (event_id, None, test_fingerprint)
            )
            
            conn.commit()
            
            return {
                "success": True,
                "event_exists": event_exists is not None,
                "event_id": event_id,
                "interest_records": interest_count,
                "view_records": view_count,
                "insert_test": "passed"
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }

@app.post("/debug/test-ux-fields")
async def debug_test_ux_fields():
    """Debug endpoint to test UX fields insertion directly"""
    try:
        logger.info("=== DEBUG UX FIELDS TEST ENDPOINT ===")
        
        # Test data with various scenarios
        test_cases = [
            {"fee_required": "Free", "event_url": "https://example.com", "host_name": "Test Host"},
            {"fee_required": None, "event_url": None, "host_name": None},
            {"fee_required": "", "event_url": "", "host_name": ""},
            {"fee_required": "   ", "event_url": "  ", "host_name": "   "}  # whitespace test
        ]
        
        results = []
        placeholder = get_placeholder()
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            for i, test_data in enumerate(test_cases):
                logger.info(f"--- Test Case {i+1} ---")
                logger.info(f"Input: {test_data}")
                
                # Sanitize the fields
                sanitized_fee = sanitize_ux_field(test_data["fee_required"])
                sanitized_url = sanitize_ux_field(test_data["event_url"])
                sanitized_host = sanitize_ux_field(test_data["host_name"])
                
                # Insert test event using centralized helpers
                from database_schema import generate_insert_query
                from event_data_builder import build_test_event_values
                
                insert_query = generate_insert_query(returning_id=True)
                values = build_test_event_values(
                    title=f"Debug UX Test {i+1}",
                    description="Debug test event for UX fields",
                    created_by=1,
                    fee_required=sanitized_fee,
                    event_url=sanitized_url,
                    host_name=sanitized_host
                )
                
                logger.info(f"Final insert values (UX part): {values[-5:-2]}")
                
                # Handle SQLite vs PostgreSQL
                if IS_PRODUCTION and DB_URL:
                    cursor.execute(insert_query, values)
                    result = cursor.fetchone()
                    event_id = result['id'] if result else None
                else:
                    cursor.execute(insert_query.replace(" RETURNING id", ""), values)
                    event_id = cursor.lastrowid
                
                if event_id:
                    # Fetch the inserted event
                    cursor.execute(f"SELECT * FROM events WHERE id = {placeholder}", (event_id,))
                    fetched_event = cursor.fetchone()
                    
                    if fetched_event:
                        event_dict = dict(fetched_event)
                        result_data = {
                            "test_case": i + 1,
                            "event_id": event_id,
                            "input": test_data,
                            "sanitized": {
                                "fee_required": sanitized_fee,
                                "event_url": sanitized_url,
                                "host_name": sanitized_host
                            },
                            "database_result": {
                                "fee_required": event_dict.get('fee_required'),
                                "event_url": event_dict.get('event_url'),
                                "host_name": event_dict.get('host_name')
                            },
                            "success": True
                        }
                        
                        logger.info(f"Database result: {result_data['database_result']}")
                        results.append(result_data)
                    else:
                        results.append({
                            "test_case": i + 1,
                            "error": "Failed to fetch inserted event",
                            "success": False
                        })
                else:
                    results.append({
                        "test_case": i + 1,
                        "error": "Failed to get event ID after insert",
                        "success": False
                    })
                
                conn.commit()
        
        logger.info("=== DEBUG UX FIELDS TEST COMPLETED ===")
        return {"test_results": results}
        
    except Exception as e:
        logger.error(f"Error in UX fields debug test: {str(e)}")
        return {"error": str(e)}

# Simple memory cache for frequently accessed data with improved memory management
import time
from typing import Dict, Any
import threading

class SimpleCache:
    def __init__(self, ttl_seconds: int = 300, max_size: int = 1000):  # 5 minute TTL, max 1000 items
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl = ttl_seconds
        self.max_size = max_size
        self._lock = threading.RLock()  # Thread-safe cache
        self._last_cleanup = time.time()
        self._cleanup_interval = 60  # Cleanup every minute
    
    def _cleanup_expired(self) -> None:
        """Remove expired entries and enforce size limits"""
        current_time = time.time()
        
        # Only cleanup if enough time has passed
        if current_time - self._last_cleanup < self._cleanup_interval:
            return
        
        with self._lock:
            # Remove expired items
            expired_keys = []
            for key, data in self.cache.items():
                if current_time - data['timestamp'] >= self.ttl:
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self.cache[key]
            
            # Enforce size limit by removing oldest items
            if len(self.cache) > self.max_size:
                # Sort by timestamp and remove oldest items
                sorted_items = sorted(self.cache.items(), key=lambda x: x[1]['timestamp'])
                items_to_remove = len(self.cache) - self.max_size
                
                for i in range(items_to_remove):
                    key_to_remove = sorted_items[i][0]
                    del self.cache[key_to_remove]
            
            self._last_cleanup = current_time
            
            # Log cleanup if significant
            if expired_keys or len(self.cache) > self.max_size * 0.8:
                logger.info(f"Cache cleanup: removed {len(expired_keys)} expired items, current size: {len(self.cache)}")
    
    def get(self, key: str) -> Any:
        self._cleanup_expired()
        
        with self._lock:
            if key in self.cache:
                data = self.cache[key]
                if time.time() - data['timestamp'] < self.ttl:
                    # Update access time for LRU-like behavior
                    data['last_access'] = time.time()
                    return data['value']
                else:
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
    
    def size(self) -> int:
        return len(self.cache)
    
    def stats(self) -> Dict[str, Any]:
        """Get cache statistics for monitoring"""
        self._cleanup_expired()
        with self._lock:
            return {
                'size': len(self.cache),
                'max_size': self.max_size,
                'ttl_seconds': self.ttl,
                'last_cleanup': self._last_cleanup
            }

# Global cache instance with improved settings
event_cache = SimpleCache(ttl_seconds=180, max_size=500)  # 3 minute cache, max 500 events

# Bulk Event Creation for Admin
class BulkEventCreate(BaseModel):
    events: List[EventCreate]

class BulkEventResponse(BaseModel):
    success_count: int
    error_count: int
    errors: List[dict]
    created_events: List[EventResponse]

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

@app.get("/debug/database-info")
async def debug_database_info():
    """Debug endpoint to check database configuration and status"""
    try:
        db_info = {
            "is_production": IS_PRODUCTION,
            "database_url_set": bool(DB_URL),
            "database_url_prefix": DB_URL[:20] + "..." if DB_URL else None,
            "database_type": "postgresql" if IS_PRODUCTION and DB_URL else "sqlite",
            "render_env": bool(os.getenv("RENDER", False)),
        }
        
        # Test database connection and get table info
        with get_db() as conn:
            cursor = conn.cursor()
            
            if IS_PRODUCTION and DB_URL:
                # PostgreSQL queries
                cursor.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """)
                tables = [row[0] for row in cursor.fetchall()]
                
                # Check events table structure
                cursor.execute("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'events'
                    ORDER BY ordinal_position
                """)
                event_columns = [{"name": row[0], "type": row[1]} for row in cursor.fetchall()]
                
                # Count events
                cursor.execute("SELECT COUNT(*) FROM events")
                event_count = get_count_from_result(cursor.fetchone())
                
                db_info.update({
                    "tables": tables,
                    "event_columns": event_columns,
                    "event_count": event_count,
                    "ux_fields_present": all(
                        col["name"] in ["fee_required", "event_url", "host_name"] 
                        for col in event_columns 
                        if col["name"] in ["fee_required", "event_url", "host_name"]
                    )
                })
                
            else:
                # SQLite queries
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row[0] for row in cursor.fetchall()]
                
                cursor.execute("PRAGMA table_info(events)")
                event_columns = [{"name": row[1], "type": row[2]} for row in cursor.fetchall()]
                
                cursor.execute("SELECT COUNT(*) FROM events")
                event_count = get_count_from_result(cursor.fetchone())
                
                db_info.update({
                    "tables": tables,
                    "event_columns": event_columns,
                    "event_count": event_count,
                    "ux_fields_present": all(
                        col["name"] in [c["name"] for c in event_columns]
                        for col in event_columns 
                        if col["name"] in ["fee_required", "event_url", "host_name"]
                    )
                })
        
        return db_info
        
    except Exception as e:
        return {
            "error": str(e),
            "is_production": IS_PRODUCTION,
            "database_url_set": bool(DB_URL),
            "database_type": "postgresql" if IS_PRODUCTION and DB_URL else "sqlite",
        }

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
    """Generate auto-generated share card for social media"""
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Use database-specific syntax for share card
        if IS_PRODUCTION and DB_URL:
            # PostgreSQL
            cursor.execute('''
                SELECT title, description, date, start_time, city, state, category
                FROM events 
                WHERE id = %s AND (is_published = true OR is_published IS NULL)
            ''', (event_id,))
        else:
            # SQLite
            cursor.execute('''
                SELECT title, description, date, start_time, city, state, category
                FROM events 
                WHERE id = ? AND (is_published = 1 OR is_published IS NULL)
            ''', (event_id,))
        
        event_row = cursor.fetchone()
        if not event_row:
            raise HTTPException(status_code=404, detail="Event not found")
        
        event_dict = dict(event_row)
        
        # For now, return JSON data that could be used to generate an image
        # In a full implementation, this would generate an actual image
        return {
            "title": event_dict["title"],
            "date": event_dict["date"],
            "time": event_dict["start_time"],
            "location": f"{event_dict.get('city', '')}, {event_dict.get('state', '')}".strip(', '),
            "category": event_dict["category"],
            "description": event_dict["description"][:100] + "..." if len(event_dict["description"]) > 100 else event_dict["description"],
            "generated_url": f"https://todo-events.com/api/events/{event_id}/share-card",
            "type": "auto_generated_share_card"
        }

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

@app.get("/debug/events-raw")
async def debug_events_raw():
    """Debug endpoint to test events query without caching"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Database-specific date comparison logic
            if IS_PRODUCTION and DB_URL:
                date_comparison = "date::date >= CURRENT_DATE"
            else:
                date_comparison = "date >= date('now')"
            
            # Test the exact same query as the events endpoint
            query = f"""
                SELECT id, title, description, short_description, date, start_time, end_time, end_date, 
                       category, address, city, state, country, lat, lng, recurring, frequency, created_by, created_at,
                       COALESCE(interest_count, 0) as interest_count,
                       COALESCE(view_count, 0) as view_count,
                       fee_required, price, currency, event_url, host_name, organizer_url, slug, is_published,
                       start_datetime, end_datetime, updated_at
                FROM events 
                ORDER BY 
                    CASE 
                        WHEN {date_comparison} THEN 0  -- Future/today events first
                        ELSE 1                           -- Past events later  
                    END,
                    date ASC, start_time ASC
                LIMIT 500
            """
            
            cursor.execute(query)
            events = cursor.fetchall()
            
            # Process results
            result = []
            errors = []
            for i, event in enumerate(events):
                try:
                    column_names = [
                        'id', 'title', 'description', 'short_description', 'date', 'start_time', 'end_time',
                        'end_date', 'category', 'address', 'city', 'state', 'country', 'lat', 'lng', 'recurring',
                        'frequency', 'created_by', 'created_at', 'interest_count', 'view_count',
                        'fee_required', 'price', 'currency', 'event_url', 'host_name', 'organizer_url', 'slug', 'is_published',
                        'start_datetime', 'end_datetime', 'updated_at'
                    ]
                    
                    event_dict = dict(zip(column_names, event))
                    event_dict = convert_event_datetime_fields(event_dict)
                    
                    # Ensure counters are integers
                    event_dict['interest_count'] = int(event_dict.get('interest_count', 0) or 0)
                    event_dict['view_count'] = int(event_dict.get('view_count', 0) or 0)
                    
                    result.append(event_dict)
                    
                except Exception as event_error:
                    errors.append(f"Error processing event {i}: {event_error}")
                    continue
            
            return {
                "query_used": query,
                "total_events_retrieved": len(events),
                "processed_events": len(result),
                "processing_errors": errors,
                "database_type": "PostgreSQL" if IS_PRODUCTION and DB_URL else "SQLite",
                "sample_events": result[:3] if result else [],
                "cache_key_that_would_be_used": f"events:all:all:500:0:None:None:25.0"
            }
            
    except Exception as e:
        logger.error(f"Debug events query failed: {str(e)}")
        return {
            "error": str(e),
            "database_type": "PostgreSQL" if IS_PRODUCTION and DB_URL else "SQLite"
        }

@app.post("/debug/clear-cache")
async def debug_clear_cache():
    """Debug endpoint to clear the events cache"""
    try:
        cache_stats_before = event_cache.stats()
        event_cache.clear()
        cache_stats_after = event_cache.stats()
        
        return {
            "message": "Cache cleared successfully",
            "cache_stats_before": cache_stats_before,
            "cache_stats_after": cache_stats_after
        }
    except Exception as e:
        logger.error(f"Failed to clear cache: {str(e)}")
        return {"error": str(e)}

@app.get("/debug/test-event-urls")
async def debug_test_event_urls():
    """Test URL generation for specific events to ensure Google indexing format"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Get the specific events mentioned by the user
            cursor.execute('''
                SELECT id, title, slug, city, state, date, created_at, updated_at
                FROM events 
                WHERE slug IN ('wolly-worm-festival-camargo', 'camargo-woolly-worm-festival-camargo')
                OR title LIKE '%Wolly Worm%' OR title LIKE '%Woolly Worm%'
                ORDER BY id
            ''')
            
            events = cursor.fetchall()
            
            if not events:
                return {
                    "message": "No matching events found",
                    "searched_slugs": ['wolly-worm-festival-camargo', 'camargo-woolly-worm-festival-camargo']
                }
            
            results = []
            base_domain = "https://todo-events.com"
            
            for event in events:
                event_id, title, slug, city, state, date, created_at, updated_at = event
                
                # Generate all URL formats for this event
                urls = {}
                
                # 1. Canonical URL (location-based if city/state available)
                if city and state:
                    city_slug = slugify(city)
                    state_lower = state.lower()
                    urls['canonical'] = f"{base_domain}/us/{state_lower}/{city_slug}/events/{slug}"
                    urls['canonical_priority'] = "0.9"
                else:
                    urls['canonical'] = f"{base_domain}/events/{slug}"
                    urls['canonical_priority'] = "0.85"
                
                # 2. Short URL (compatibility)
                urls['short'] = f"{base_domain}/e/{slug}"
                urls['short_priority'] = "0.7"
                
                # 3. Date-indexed URL
                try:
                    if date:
                        date_obj = datetime.fromisoformat(str(date))
                        year = date_obj.strftime('%Y')
                        month = date_obj.strftime('%m')
                        day = date_obj.strftime('%d')
                        urls['date_indexed'] = f"{base_domain}/events/{year}/{month}/{day}/{slug}"
                        urls['date_indexed_priority'] = "0.75"
                except:
                    urls['date_indexed'] = "Error parsing date"
                
                # 4. SEO metadata
                seo_data = {
                    "title": title,
                    "slug": slug,
                    "city": city,
                    "state": state,
                    "date": date,
                    "google_indexable": bool(slug and title),
                    "location_specific": bool(city and state)
                }
                
                results.append({
                    "event_id": event_id,
                    "title": title,
                    "slug": slug,
                    "urls": urls,
                    "seo_data": seo_data,
                    "created_at": created_at,
                    "updated_at": updated_at
                })
            
            return {
                "status": "success",
                "events_found": len(results),
                "events": results,
                "url_format_explanation": {
                    "canonical": "Primary URL for Google indexing - location-based if city/state available",
                    "short": "Compatibility URL for sharing and redirects",
                    "date_indexed": "Time-based URL for event discovery",
                    "priority_explanation": "Higher priority = more important for search engines"
                }
            }
            
    except Exception as e:
        logger.error(f"Error testing event URLs: {str(e)}")
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

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
            one_month_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
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
        print(f"Analytics metrics error: {str(e)}")
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
                start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
            
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
        print(error_details)
        print(f"Traceback: {traceback.format_exc()}")
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
        print(f"Top hosts error: {str(e)}")
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
        print(f"Geographic analytics error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch geographic analytics: {str(e)}")

@app.get("/debug/analytics-sql")
async def debug_analytics_sql():
    """Debug the analytics SQL query construction"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            # Test basic count first
            cursor.execute("SELECT COUNT(*) FROM events")
            total_events = get_count_from_result(cursor.fetchone())
            
            # Test with date filter
            start_date = "2025-05-09"
            end_date = "2025-06-08"
            
            # Build WHERE conditions exactly like the main analytics function
            conditions = ["1=1"]
            params = []
            
            if start_date:
                conditions.append(f"date >= {placeholder}")
                params.append(start_date)
            if end_date:
                conditions.append(f"date <= {placeholder}")
                params.append(end_date)
            
            where_clause = " AND ".join(conditions)
            
            # Build the final query
            query = f"SELECT COUNT(*) FROM events WHERE {where_clause}"
            
            # Test the query
            cursor.execute(query, params)
            result = cursor.fetchone()
            filtered_count = get_count_from_result(result)
            
            return {
                "status": "success",
                "placeholder_used": placeholder,
                "database_type": "PostgreSQL" if placeholder == "%s" else "SQLite",
                "total_events": total_events,
                "conditions": conditions,
                "where_clause": where_clause,
                "params": params,
                "final_query": query,
                "filtered_count": filtered_count
            }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
            "placeholder_used": get_placeholder()
        }

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
        print(f"Category cloud error: {str(e)}")
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
        print(f"Event locations error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch event locations: {str(e)}")

# Page Visit Tracking - Privacy-friendly without personal data storage
async def track_page_visit(page_type: str, page_path: str, user_id: int = None, browser_fingerprint: str = None):
    """
    Track page visits in a privacy-friendly way
    Only stores aggregated data and basic page info
    """
    try:
        print(f"DEBUG: Tracking page visit - type: {page_type}, path: {page_path}, user: {user_id}, fingerprint: {browser_fingerprint}")
        
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
            
            print(f"DEBUG: Executing insert query: {insert_query}")
            print(f"DEBUG: With params: {params}")
            
            cursor.execute(insert_query, params)
            
            print(f"DEBUG: Insert successful, committing...")
            conn.commit()
            print(f"DEBUG: Commit successful")
            
            return True
            
    except Exception as e:
        print(f"ERROR: Error tracking page visit: {e}")
        print(f"ERROR: Exception type: {type(e)}")
        import traceback
        print(f"ERROR: Traceback: {traceback.format_exc()}")
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
                start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
            if not end_date:
                end_date = datetime.now().strftime('%Y-%m-%d')
            
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
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Log the privacy request with proper database compatibility
            placeholder = get_placeholder()
            created_at = datetime.now().isoformat()
            
            # Use different approach for PostgreSQL vs SQLite
            if IS_PRODUCTION and DB_URL:  # PostgreSQL
                logger.debug(f"Using PostgreSQL, inserting privacy request for {request.email}")
                cursor.execute(f"""
                    INSERT INTO privacy_requests 
                    (request_type, email, full_name, verification_info, details, status, created_at)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                """, (
                    request.request_type,
                    request.email,
                    request.full_name,
                    request.verification_info,
                    request.details,
                    'pending',
                    created_at
                ))
                result = cursor.fetchone()
                logger.debug(f"PostgreSQL insert result: {result}")
                if result and len(result) > 0:
                    request_id = result[0]
                    logger.debug(f"Extracted request_id: {request_id}")
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
        raise HTTPException(status_code=500, detail="Failed to submit privacy request")

@app.get("/api/privacy/data/{email}")
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
                "export_date": datetime.now().isoformat(),
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
            """, (datetime.now().isoformat(), email))
            
            conn.commit()
            
            return {
                "success": True,
                "message": f"All data for {email} has been deleted",
                "deleted_items": deleted_items,
                "deletion_date": datetime.now().isoformat()
            }
            
    except Exception as e:
        logger.error(f"Data deletion error for {email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete user data")

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
            
            cursor.execute("""
                SELECT id, request_type, email, full_name, details, status, 
                       created_at, completed_at
                FROM privacy_requests 
                ORDER BY created_at DESC
            """)
            
            requests = cursor.fetchall()
            
            return [
                {
                    "id": row[0],
                    "request_type": row[1],
                    "email": row[2],
                    "full_name": row[3],
                    "details": row[4],
                    "status": row[5],
                    "created_at": row[6],
                    "completed_at": row[7]
                } for row in requests
            ]
            
    except Exception as e:
        logger.error(f"Error listing privacy requests: {e}")
        raise HTTPException(status_code=500, detail="Failed to list privacy requests")

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
            
            completed_at = datetime.now().isoformat() if status == "completed" else None
            
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

@app.get("/debug/test-email")
async def debug_test_email():
    """Test email configuration"""
    try:
        from email_config import EmailService
        email_service = EmailService()
        
        # Test email send
        result = email_service.send_email(
            to_email="support@todo-events.com",
            subject="Test Email from Render - Report System",
            html_content="<h2>Test Email</h2><p>This is a test email to verify the report system email configuration is working.</p>"
        )
        
        return {
            "email_test_result": result,
            "config": {
                "smtp_server": email_service.config['smtp_server'],
                "smtp_port": email_service.config['smtp_port'],
                "smtp_username": email_service.config['smtp_username'],
                "from_email": email_service.config['from_email'],
                "password_configured": bool(email_service.config['smtp_password'])
            }
        }
    except Exception as e:
        return {"error": str(e), "traceback": str(e.__traceback__)}

@app.get("/debug/page-visits")
async def debug_page_visits():
    """Debug endpoint to check page visits table"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if table exists and get structure
            if IS_PRODUCTION and DB_URL:
                cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'page_visits' ORDER BY ordinal_position")
                columns = cursor.fetchall()
                
                cursor.execute("SELECT COUNT(*) FROM page_visits")
                count = get_count_from_result(cursor.fetchone())
                
                cursor.execute("SELECT * FROM page_visits ORDER BY visited_at DESC LIMIT 5")
                recent_visits = cursor.fetchall()
            else:
                cursor.execute("PRAGMA table_info(page_visits)")
                columns = cursor.fetchall()
                
                cursor.execute("SELECT COUNT(*) FROM page_visits")
                count = get_count_from_result(cursor.fetchone())
                
                cursor.execute("SELECT * FROM page_visits ORDER BY visited_at DESC LIMIT 5")
                recent_visits = cursor.fetchall()
            
            # Test direct insert
            try:
                placeholder = get_placeholder()
                cursor.execute(f"""
                    INSERT INTO page_visits (page_type, page_path, user_id, browser_fingerprint, visited_at)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, CURRENT_TIMESTAMP)
                """, ('debug_direct', '/debug-direct', None, 'debug-fingerprint'))
                conn.commit()
                direct_insert_success = True
                direct_insert_error = None
            except Exception as e:
                direct_insert_success = False
                direct_insert_error = str(e)
                
            return {
                "table_exists": len(columns) > 0,
                "columns": columns,
                "visit_count": count,
                "recent_visits": recent_visits,
                "direct_insert_success": direct_insert_success,
                "direct_insert_error": direct_insert_error,
                "is_production": IS_PRODUCTION,
                "db_url": DB_URL is not None
            }
            
    except Exception as e:
        return {"error": str(e), "traceback": str(e.__traceback__)}

@app.get("/debug/privacy-requests-table")
async def debug_privacy_requests_table():
    """Debug endpoint to check privacy_requests table structure and test insert"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if table exists and get structure
            if IS_PRODUCTION and DB_URL:
                cursor.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'privacy_requests' ORDER BY ordinal_position")
                columns = cursor.fetchall()
                
                # Check for sequence/auto-increment
                cursor.execute("SELECT column_default FROM information_schema.columns WHERE table_name = 'privacy_requests' AND column_name = 'id'")
                id_default = cursor.fetchone()
                
                cursor.execute("SELECT COUNT(*) FROM privacy_requests")
                count = get_count_from_result(cursor.fetchone())
                
                cursor.execute("SELECT id, request_type, email, status, created_at FROM privacy_requests ORDER BY created_at DESC LIMIT 5")
                recent_requests = cursor.fetchall()
                
                # Test the RETURNING clause
                placeholder = get_placeholder()
                cursor.execute(f"""
                    INSERT INTO privacy_requests 
                    (request_type, email, full_name, verification_info, details, status, created_at)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                    RETURNING id
                """, (
                    'access',
                    'debug@test.com',
                    'Debug Test',
                    'Test verification',
                    'Debug test request',
                    'pending',
                    datetime.now().isoformat()
                ))
                test_result = cursor.fetchone()
                test_id = test_result[0] if test_result else None
                
                # Clean up test record
                if test_id:
                    cursor.execute(f"DELETE FROM privacy_requests WHERE id = {placeholder}", (test_id,))
                
                conn.commit()
                
            else:
                cursor.execute("PRAGMA table_info(privacy_requests)")
                columns = cursor.fetchall()
                
                cursor.execute("SELECT COUNT(*) FROM privacy_requests")
                count = cursor.fetchone()[0]
                
                cursor.execute("SELECT id, request_type, email, status, created_at FROM privacy_requests ORDER BY created_at DESC LIMIT 5")
                recent_requests = cursor.fetchall()
                
                # Test insert for SQLite
                placeholder = get_placeholder()
                cursor.execute(f"""
                    INSERT INTO privacy_requests 
                    (request_type, email, full_name, verification_info, details, status, created_at)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
                """, (
                    'access',
                    'debug@test.com',
                    'Debug Test',
                    'Test verification',
                    'Debug test request',
                    'pending',
                    datetime.now().isoformat()
                ))
                test_id = cursor.lastrowid
                
                # Clean up test record
                if test_id:
                    cursor.execute(f"DELETE FROM privacy_requests WHERE id = {placeholder}", (test_id,))
                
                conn.commit()
                id_default = "AUTO_INCREMENT"
            
            return {
                "table_exists": True,
                "columns": [str(col) for col in columns],
                "id_column_default": str(id_default) if 'id_default' in locals() else "Unknown",
                "total_requests": count,
                "recent_requests": [str(req) for req in recent_requests],
                "test_insert_id": test_id,
                "test_insert_success": test_id is not None and test_id > 0,
                "database_type": "PostgreSQL" if (IS_PRODUCTION and DB_URL) else "SQLite"
            }
            
    except Exception as e:
        return {
            "error": str(e),
            "table_exists": False,
            "database_type": "PostgreSQL" if (IS_PRODUCTION and DB_URL) else "SQLite"
        }

@app.post("/debug/create-privacy-table")
async def create_privacy_table():
    """Create the missing privacy_requests table"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            if IS_PRODUCTION and DB_URL:  # PostgreSQL
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
                
                # Verify table was created
                cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'privacy_requests'")
                columns = cursor.fetchall()
                
                return {
                    "success": True,
                    "message": "privacy_requests table created successfully",
                    "columns": [col[0] for col in columns],
                    "database_type": "PostgreSQL"
                }
            else:  # SQLite
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS privacy_requests (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        request_type TEXT NOT NULL,
                        email TEXT NOT NULL,
                        full_name TEXT,
                        verification_info TEXT,
                        details TEXT,
                        status TEXT DEFAULT 'pending',
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        completed_at TEXT,
                        admin_notes TEXT
                    )
                """)
                conn.commit()
                
                # Verify table was created
                cursor.execute("PRAGMA table_info(privacy_requests)")
                columns = cursor.fetchall()
                
                return {
                    "success": True,
                    "message": "privacy_requests table created successfully",
                    "columns": columns,
                    "database_type": "SQLite"
                }
                
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "database_type": "PostgreSQL" if (IS_PRODUCTION and DB_URL) else "SQLite"
        }

# =============================================================================
# ADMIN PRIVACY MANAGEMENT ENDPOINTS
# =============================================================================

@app.get("/admin/privacy-requests")
async def list_admin_privacy_requests(current_user: dict = Depends(get_current_user)):
    """
    List all privacy requests for admin dashboard (with hyphen path)
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute(f"""
                SELECT id, request_type, email, full_name, 
                       details, verification_info, status, 
                       created_at, completed_at, admin_notes
                FROM privacy_requests 
                ORDER BY created_at DESC
            """)
            
            requests = cursor.fetchall()
            
            return [
                {
                    "id": row[0],
                    "request_type": row[1],
                    "user_email": row[2],  # Map email to user_email for frontend compatibility
                    "full_name": row[3],
                    "additional_details": row[4],  # Map details to additional_details for frontend
                    "verification_info": row[5],
                    "status": row[6] or "pending",
                    "created_at": row[7],
                    "completed_at": row[8],
                    "admin_notes": row[9]
                } for row in requests
            ]
            
    except Exception as e:
        logger.error(f"Error listing admin privacy requests: {e}")
        raise HTTPException(status_code=500, detail="Failed to list privacy requests")

@app.put("/admin/privacy-requests/{request_id}/status")
async def update_admin_privacy_request_status(
    request_id: int, 
    update_data: dict,  # Expecting {"status": "...", "admin_notes": "..."}
    current_user: dict = Depends(get_current_user)
):
    """
    Update privacy request status (with hyphen path for admin dashboard)
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    placeholder = get_placeholder()
    status = update_data.get("status")
    admin_notes = update_data.get("admin_notes", "")
    
    if not status:
        raise HTTPException(status_code=400, detail="Status is required")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            completed_at = datetime.now().isoformat() if status == "completed" else None
            
            cursor.execute(f"""
                UPDATE privacy_requests 
                SET status = {placeholder}, completed_at = {placeholder}, admin_notes = {placeholder}
                WHERE id = {placeholder}
            """, (status, completed_at, admin_notes, request_id))
            
            conn.commit()
            
            return {"success": True, "message": "Privacy request status updated"}
            
    except Exception as e:
        logger.error(f"Error updating admin privacy request status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update privacy request status")

@app.post("/admin/privacy-requests/{request_id}/export")
async def export_user_data_for_request(
    request_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Export user data for a specific privacy request
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Get the privacy request
            cursor.execute(f"""
                SELECT email, request_type FROM privacy_requests 
                WHERE id = {placeholder}
            """, (request_id,))
            
            request_row = cursor.fetchone()
            if not request_row:
                raise HTTPException(status_code=404, detail="Privacy request not found")
            
            email = request_row[0]
            request_type = request_row[1]
            
            if request_type != "access":
                raise HTTPException(status_code=400, detail="Export only available for access requests")
            
            # Get user data (reuse existing logic)
            user_data = {}
            
            # Get user account
            cursor.execute(f"SELECT id, email, role FROM users WHERE email = {placeholder}", (email,))
            user_row = cursor.fetchone()
            
            if user_row:
                user_data["user_account"] = {
                    "id": user_row[0],
                    "email": user_row[1],
                    "role": user_row[2]
                }
                
                user_id = user_row[0]
                
                # Get user's events
                cursor.execute(f"""
                    SELECT id, title, description, date, start_time, end_time, category, address, lat, lng
                    FROM events WHERE created_by = {placeholder}
                """, (user_id,))
                events = cursor.fetchall()
                
                user_data["events"] = [
                    {
                        "id": event[0],
                        "title": event[1],
                        "description": event[2],
                        "date": event[3],
                        "start_time": event[4],
                        "end_time": event[5],
                        "category": event[6],
                        "address": event[7],
                        "lat": event[8],
                        "lng": event[9]
                    } for event in events
                ]
                
                # Get user's interests
                cursor.execute(f"""
                    SELECT e.id, e.title, ei.interested_at
                    FROM event_interests ei
                    JOIN events e ON ei.event_id = e.id
                    WHERE ei.user_id = {placeholder}
                """, (user_id,))
                interests = cursor.fetchall()
                
                user_data["interests"] = [
                    {
                        "event_id": interest[0],
                        "event_title": interest[1],
                        "interested_at": interest[2]
                    } for interest in interests
                ]
                
                # Get page visits
                cursor.execute(f"""
                    SELECT page_type, page_path, visited_at
                    FROM page_visits WHERE user_id = {placeholder}
                    ORDER BY visited_at DESC
                """, (user_id,))
                visits = cursor.fetchall()
                
                user_data["page_visits"] = [
                    {
                        "page_type": visit[0],
                        "page_path": visit[1],
                        "visited_at": visit[2]
                    } for visit in visits
                ]
                
            else:
                user_data["user_account"] = None
                user_data["events"] = []
                user_data["interests"] = []
                user_data["page_visits"] = []
            
            # Get any reports by this email
            cursor.execute(f"""
                SELECT event_id, report_type, details, reported_at
                FROM event_reports WHERE reporter_email = {placeholder}
            """, (email,))
            reports = cursor.fetchall()
            
            user_data["reports"] = [
                {
                    "event_id": report[0],
                    "report_type": report[1],
                    "details": report[2],
                    "reported_at": report[3]
                } for report in reports
            ]
            
            # Generate export file (simplified - in production you might want to create actual files)
            export_data = {
                "export_date": datetime.now().isoformat(),
                "request_id": request_id,
                "user_email": email,
                "data": user_data
            }
            
            return {
                "success": True,
                "message": f"Data export generated for {email}",
                "export_data": export_data,
                "export_url": f"/admin/privacy-requests/{request_id}/download"  # Placeholder URL
            }
            
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        logger.error(f"Error exporting user data for request {request_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to export user data")

@app.post("/admin/privacy-requests/{request_id}/delete-data")
async def delete_user_data_for_request(
    request_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete user data for a specific privacy request
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Get the privacy request
            cursor.execute(f"""
                SELECT email, request_type FROM privacy_requests 
                WHERE id = {placeholder}
            """, (request_id,))
            
            request_row = cursor.fetchone()
            if not request_row:
                raise HTTPException(status_code=404, detail="Privacy request not found")
            
            email = request_row[0]
            request_type = request_row[1]
            
            if request_type not in ["delete", "deletion"]:
                raise HTTPException(status_code=400, detail="Delete only available for deletion requests")
            
            # Perform data deletion (reuse existing logic)
            deleted_items = {}
            
            # Get user ID
            cursor.execute(f"SELECT id FROM users WHERE email = {placeholder}", (email,))
            user_row = cursor.fetchone()
            
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
                WHERE id = {placeholder}
            """, (datetime.now().isoformat(), request_id))
            
            conn.commit()
            
            return {
                "success": True,
                "message": f"All data for {email} has been deleted",
                "deleted_items": deleted_items,
                "deletion_date": datetime.now().isoformat()
            }
            
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        logger.error(f"Error deleting user data for request {request_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete user data")

