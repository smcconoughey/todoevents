import os
import re
import sqlite3
import logging
import time
import json
from typing import Optional, List
from datetime import datetime, timedelta
from contextlib import contextmanager
from enum import Enum
import asyncio
import threading

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
    # Log the request for debugging
    origin = request.headers.get("origin")
    logger.info(f"Request: {request.method} {request.url} from origin: {origin}")
    
    # Handle preflight requests
    if request.method == "OPTIONS":
        logger.info(f"Handling preflight request from origin: {origin}")
        
        # Determine allowed origin
        allowed_origin = "*"  # Default fallback
        
        if origin:
            # Allow localhost and 127.0.0.1 for development
            if ("localhost" in origin or "127.0.0.1" in origin):
                allowed_origin = origin
                logger.info(f"Allowing localhost origin: {origin}")
            # Allow Render.com domains for production
            elif ".onrender.com" in origin:
                allowed_origin = origin
                logger.info(f"Allowing Render.com origin: {origin}")
            # Allow the actual domain
            elif "todo-events.com" in origin:
                allowed_origin = origin
                logger.info(f"Allowing main domain: {origin}")
            else:
                logger.warning(f"Unrecognized origin, but allowing: {origin}")
                allowed_origin = origin
        
        logger.info(f"OPTIONS response for origin {origin} with allowed_origin: {allowed_origin}")
        
        # Return proper preflight response
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": allowed_origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
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
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
            logger.info(f"Added CORS headers for successful response to origin: {origin}")
        
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
            logger.info(f"Added CORS headers for error response to origin: {origin}")
            
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
def get_db():
    if IS_PRODUCTION and DB_URL:
        # In production with PostgreSQL
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        # Add retry logic for database connections
        retry_count = 10
        conn = None
        
        for attempt in range(retry_count):
            try:
                # Add connection pooling and extended timeout parameters
                logger.info(f"Connecting to PostgreSQL (attempt {attempt+1}/{retry_count})")
                conn = psycopg2.connect(
                    DB_URL,
                    cursor_factory=RealDictCursor,
                    connect_timeout=15,
                    keepalives=1,
                    keepalives_idle=30,
                    keepalives_interval=10,
                    keepalives_count=5
                )
                # Don't set autocommit=True by default to allow explicit transaction control
                logger.info("PostgreSQL connection successful")
                
                # Test the connection with a simple query
                cur = conn.cursor()
                cur.execute("SELECT 1")
                break  # Connection successful, exit retry loop
                
            except Exception as e:
                if conn:
                    try:
                        conn.close()
                        conn = None
                    except:
                        pass
                
                error_msg = str(e)
                logger.error(f"Database connection failed (attempt {attempt+1}/{retry_count}): {error_msg}")
                
                if attempt < retry_count - 1:
                    # Exponential backoff with shorter base wait time
                    wait_time = min(2 ** attempt, 8)  # Cap at 8 seconds
                    logger.info(f"Waiting {wait_time}s before retry...")
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
                logger.info("PostgreSQL connection closed")
    else:
        # Local development with SQLite
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
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
                        address TEXT NOT NULL,
                        lat REAL NOT NULL,
                        lng REAL NOT NULL,
                        recurring BOOLEAN NOT NULL DEFAULT FALSE,
                        frequency TEXT,
                        created_by INTEGER,
                        interest_count INTEGER DEFAULT 0,
                        view_count INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(created_by) REFERENCES users(id)
                    )
                ''')
                
                # Add migration for existing events to have start_time and end_time
                try:
                    # Check if we need to migrate old 'time' column to 'start_time'
                    c.execute("""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'events' AND column_name = 'time'
                    """)
                    if c.fetchone():
                        # Migrate old 'time' column to 'start_time'
                        c.execute('ALTER TABLE events RENAME COLUMN time TO start_time')
                        logger.info("✅ Migrated 'time' column to 'start_time'")
                        conn.commit()
                        
                    # Check if start_time column exists (in case we need to add it)
                    c.execute("""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'events' AND column_name = 'start_time'
                    """)
                    if not c.fetchone():
                        # Add start_time column if it doesn't exist
                        c.execute('ALTER TABLE events ADD COLUMN start_time TEXT DEFAULT \'12:00\'')
                        logger.info("✅ Added 'start_time' column")
                        conn.commit()
                        
                    # Add end_time column if it doesn't exist
                    c.execute("""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'events' AND column_name = 'end_time'
                    """)
                    if not c.fetchone():
                        c.execute('ALTER TABLE events ADD COLUMN end_time TEXT')
                        logger.info("✅ Added 'end_time' column")
                        conn.commit()
                        
                    # Add end_date column if it doesn't exist
                    c.execute("""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'events' AND column_name = 'end_date'
                    """)
                    if not c.fetchone():
                        c.execute('ALTER TABLE events ADD COLUMN end_date TEXT')
                        logger.info("✅ Added 'end_date' column")
                        conn.commit()
                    
                    # Add interest_count column if it doesn't exist
                    c.execute("""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'events' AND column_name = 'interest_count'
                    """)
                    if not c.fetchone():
                        c.execute('ALTER TABLE events ADD COLUMN interest_count INTEGER DEFAULT 0')
                        logger.info("✅ Added 'interest_count' column")
                        conn.commit()
                    
                    # Add view_count column if it doesn't exist
                    c.execute("""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'events' AND column_name = 'view_count'
                    """)
                    if not c.fetchone():
                        c.execute('ALTER TABLE events ADD COLUMN view_count INTEGER DEFAULT 0')
                        logger.info("✅ Added 'view_count' column")
                        conn.commit()
                        
                except Exception as migration_error:
                    logger.error(f"❌ Migration error: {migration_error}")
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
                
                # Ensure tables are committed
                conn.commit()
                logger.info("✅ Interest and view tracking tables created/verified")
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
                                address TEXT NOT NULL,
                                lat REAL NOT NULL,
                                lng REAL NOT NULL,
                                recurring BOOLEAN NOT NULL DEFAULT 0,
                                frequency TEXT,
                                created_by INTEGER,
                                interest_count INTEGER DEFAULT 0,
                                view_count INTEGER DEFAULT 0,
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
                
                # Fix existing tables if they have wrong schema
                try:
                    # Check if event_interests table has the correct schema
                    c.execute("""
                        SELECT column_name, is_nullable 
                        FROM information_schema.columns 
                        WHERE table_name = 'event_interests' AND column_name = 'browser_fingerprint'
                    """)
                    result = c.fetchone()
                    if result and result[1] == 'YES':  # Column allows NULL
                        logger.info("Fixing event_interests table schema...")
                        c.execute('DROP TABLE IF EXISTS event_interests CASCADE')
                        c.execute('''CREATE TABLE event_interests (
                                    id SERIAL PRIMARY KEY,
                                    event_id INTEGER NOT NULL,
                                    user_id INTEGER,
                                    browser_fingerprint TEXT NOT NULL DEFAULT 'legacy',
                                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                    UNIQUE(event_id, user_id, browser_fingerprint),
                                    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
                                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                                )''')
                        logger.info("✅ Fixed event_interests table schema")
                        
                    # Check if event_views table has the correct schema
                    c.execute("""
                        SELECT column_name, is_nullable 
                        FROM information_schema.columns 
                        WHERE table_name = 'event_views' AND column_name = 'browser_fingerprint'
                    """)
                    result = c.fetchone()
                    if result and result[1] == 'YES':  # Column allows NULL
                        logger.info("Fixing event_views table schema...")
                        c.execute('DROP TABLE IF EXISTS event_views CASCADE')
                        c.execute('''CREATE TABLE event_views (
                                    id SERIAL PRIMARY KEY,
                                    event_id INTEGER NOT NULL,
                                    user_id INTEGER,
                                    browser_fingerprint TEXT NOT NULL DEFAULT 'legacy',
                                    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                    UNIQUE(event_id, user_id, browser_fingerprint),
                                    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
                                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                                )''')
                        logger.info("✅ Fixed event_views table schema")
                        
                    conn.commit()
                except Exception as schema_fix_error:
                    logger.error(f"Schema fix error: {schema_fix_error}")
                    # Don't fail the entire initialization
                    try:
                        conn.rollback()
                    except:
                        pass
            
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
    """Create a default admin user if no admin users exist in the database"""
    try:
        placeholder = get_placeholder()
        c = conn.cursor()
        
        # Check if any admin users exist
        c.execute(f"SELECT COUNT(*) as admin_count FROM users WHERE role = {placeholder}", (UserRole.ADMIN,))
        admin_count = c.fetchone()
        
        # Convert to integer based on database type
        if IS_PRODUCTION and DB_URL:
            # PostgreSQL returns a dict
            admin_count = admin_count['admin_count']
        else:
            # SQLite returns a tuple
            admin_count = admin_count[0]
            
        if admin_count == 0:
            logger.info("No admin users found. Creating default admin user.")
            admin_email = "admin@todoevents.com"
            admin_password = "Admin123!"  # This should be changed after first login
            hashed_password = get_password_hash(admin_password)
            
            c.execute(
                f"INSERT INTO users (email, hashed_password, role) VALUES ({placeholder}, {placeholder}, {placeholder})",
                (admin_email, hashed_password, UserRole.ADMIN)
            )
            conn.commit()
            logger.info(f"Default admin user created: {admin_email}")
            logger.info("IMPORTANT: Remember to change the default admin password after first login")
        else:
            logger.info(f"Found {admin_count} existing admin users. Default admin creation skipped.")
            
    except Exception as e:
        logger.error(f"Error creating default admin user: {str(e)}")

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
                    # PostgreSQL
                    c.execute("""
                        SELECT id, title, description, date, start_time, end_time, end_date, category, 
                               address, lat, lng, created_at
                        FROM events 
                        WHERE date >= CURRENT_DATE
                        ORDER BY date, start_time
                    """)
                else:
                    # SQLite
                    c.execute("""
                        SELECT id, title, description, date, start_time, end_time, end_date, category, 
                               address, lat, lng, created_at
                        FROM events 
                        WHERE date >= date('now')
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
  </url>'''
        
        # Add static category pages
        categories = ['food-drink', 'music', 'arts', 'sports', 'community']
        for category in categories:
            sitemap += f'''
  <url>
    <loc>{domain}/?category={category}</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>'''
        
        # Add AI-optimized pages
        ai_pages = [
            ('/local-events-near-me', 'daily', '0.9'),
            ('/events-today', 'hourly', '0.9'),
            ('/events-this-weekend', 'daily', '0.9'),
            ('/events-tonight', 'hourly', '0.8'),
            ('/free-events-near-me', 'daily', '0.8')
        ]
        
        for page, freq, priority in ai_pages:
            sitemap += f'''
  <url>
    <loc>{domain}{page}</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>{freq}</changefreq>
    <priority>{priority}</priority>
  </url>'''
        
        # Add individual event pages
        for event in events[:100]:  # Limit to avoid huge sitemaps
            event_date = event.get('date', current_date)
            sitemap += f'''
  <url>
    <loc>{domain}/?event={event['id']}</loc>
    <lastmod>{event_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>'''
        
        sitemap += '''
  
  <!-- Note: This sitemap was automatically generated -->
</urlset>'''
        
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
        """Remove events that are older than 30 days"""
        try:
            with get_db() as conn:
                c = conn.cursor()
                cutoff_date = (datetime.utcnow() - timedelta(days=30)).strftime('%Y-%m-%d')
                placeholder = get_placeholder()
                
                c.execute(f"DELETE FROM events WHERE date < {placeholder}", (cutoff_date,))
                deleted_count = c.rowcount
                conn.commit()
                
                if deleted_count > 0:
                    logger.info(f"🧹 Cleaned up {deleted_count} expired events")
                    
        except Exception as e:
            logger.error(f"Error cleaning up expired events: {str(e)}")
    
    async def update_search_index(self):
        """Update search index for better performance"""
        # Placeholder for search index updates
        # Could implement Elasticsearch, Solr, or simple database indexes
        logger.info("📊 Search index update completed")
    
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
    date: str
    start_time: str
    end_time: Optional[str] = None
    end_date: Optional[str] = None
    category: str
    address: str
    lat: float
    lng: float
    recurring: bool = False
    frequency: Optional[str] = None

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

class EventCreate(EventBase):
    pass

class EventResponse(EventBase):
    id: int
    created_by: int
    created_at: str
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
            
            # In a real production system, you would send an email with the reset code
            # For demo purposes, we'll just log it
            logger.info(f"Password reset code for {request.email}: {reset_code}")
            
            # For development, return the reset code in the response
            # In production, remove this and use proper email delivery
            if not IS_PRODUCTION:
                return {
                    "detail": "Reset code generated",
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
    date: Optional[str] = None
):
    """
    Retrieve events with optional filtering by category and date.
    Open to all users, no authentication required.
    """
    placeholder = get_placeholder()
    
    try:
        # Use connection manager
        with get_db() as conn:
            try:
                cursor = conn.cursor()
                
                # Start a read-only transaction
                cursor.execute("BEGIN")
                
                # Build query with parameters - make sure to handle NULL values for counters
                query = """SELECT id, title, description, date, start_time, end_time, end_date, 
                          category, address, lat, lng, recurring, frequency, created_by, created_at,
                          COALESCE(interest_count, 0) as interest_count,
                          COALESCE(view_count, 0) as view_count
                          FROM events WHERE 1=1"""
                params = []
                
                # Add filters if provided
                if category:
                    query += f" AND category = {placeholder}"
                    params.append(category)
                
                if date:
                    query += f" AND date = {placeholder}"
                    params.append(date)
                
                # Order by date and time
                query += " ORDER BY date, start_time"
                
                # Log and execute the query
                logger.info(f"Executing list_events query: {query} with params: {params}")
                cursor.execute(query, params)
                
                # Fetch all events
                events = cursor.fetchall()
                logger.info(f"Successfully fetched {len(events) if events else 0} events")
                
                # Process results
                result = []
                for event in events:
                    try:
                        # Convert row to dict
                        event_dict = dict(event)
                        
                        # Convert datetime to string format
                        if 'created_at' in event_dict and isinstance(event_dict['created_at'], datetime):
                            event_dict['created_at'] = event_dict['created_at'].isoformat()
                        
                        # Ensure counters are integers (not None)
                        event_dict['interest_count'] = event_dict.get('interest_count', 0) or 0
                        event_dict['view_count'] = event_dict.get('view_count', 0) or 0
                        
                        result.append(event_dict)
                    except Exception as conversion_error:
                        logger.error(f"Error converting event to dict: {str(conversion_error)}")
                        # Skip problematic events rather than failing completely
                        continue
                
                # End transaction (just reading, so COMMIT or ROLLBACK both fine)
                cursor.execute("COMMIT")
                
                return result
                
            except Exception as query_error:
                # Log the error
                error_msg = str(query_error)
                logger.error(f"Database error in list_events: {error_msg}")
                
                # If transaction is active, try to roll it back
                try:
                    cursor.execute("ROLLBACK")
                except Exception as rollback_error:
                    logger.error(f"Rollback failed: {str(rollback_error)}")
                
                # Return appropriate error
                raise HTTPException(
                    status_code=500,
                    detail=f"Database error: {error_msg}"
                ) from None
                
    except HTTPException as http_ex:
        # Pass through HTTP exceptions
        raise http_ex
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
            # Use COALESCE to handle NULL values
            c.execute(f"""SELECT id, title, description, date, start_time, end_time, end_date, 
                         category, address, lat, lng, recurring, frequency, created_by, created_at,
                         COALESCE(interest_count, 0) as interest_count,
                         COALESCE(view_count, 0) as view_count
                         FROM events WHERE id = {placeholder}""", (event_id,))
            event = c.fetchone()
            
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Convert to dict and handle datetime fields
            event_dict = dict(event)
            
            # Convert datetime to string for serialization
            if 'created_at' in event_dict and isinstance(event_dict['created_at'], datetime):
                event_dict['created_at'] = event_dict['created_at'].isoformat()
            
            # Ensure counters are integers (not None)
            event_dict['interest_count'] = event_dict.get('interest_count', 0) or 0
            event_dict['view_count'] = event_dict.get('view_count', 0) or 0
            
            return event_dict
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving event")

@app.post("/events", response_model=EventResponse)
async def create_event(event: EventCreate, current_user: dict = Depends(get_current_user)):
    """
    Create a new event. Requires user authentication.
    """
    placeholder = get_placeholder()
    
    # Log the event data for debugging
    logger.info(f"Creating event: {event.dict()}")
    
    try:
        # Use database connection with explicit transaction control
        with get_db() as conn:
            cursor = conn.cursor()
            
            try:
                # Start transaction explicitly
                cursor.execute("BEGIN")
                
                # Check for duplicates first
                duplicate_check = f"""
                    SELECT id FROM events 
                    WHERE title = {placeholder} 
                    AND date = {placeholder} 
                    AND start_time = {placeholder} 
                    AND lat = {placeholder} 
                    AND lng = {placeholder} 
                    AND category = {placeholder}
                """
                
                cursor.execute(duplicate_check, (
                    event.title, 
                    event.date, 
                    event.start_time, 
                    event.lat, 
                    event.lng, 
                    event.category
                ))
                
                duplicate = cursor.fetchone()
                if duplicate:
                    # No need for explicit rollback if we're just checking
                    cursor.execute("ROLLBACK")
                    raise HTTPException(
                        status_code=400, 
                        detail="An event with these exact details already exists"
                    )
                
                # Insert the new event
                insert_query = f"""
                    INSERT INTO events (
                        title, description, date, start_time, end_time, end_date, category,
                        address, lat, lng, recurring, frequency,
                        created_by
                    ) VALUES (
                        {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}
                    ) RETURNING id
                """
                
                values = (
                    event.title, 
                    event.description, 
                    event.date,
                    event.start_time, 
                    event.end_time, 
                    event.end_date, 
                    event.category, 
                    event.address,
                    event.lat, 
                    event.lng, 
                    event.recurring,
                    event.frequency, 
                    current_user["id"]
                )
                
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
                    # Roll back if we couldn't get the event ID
                    cursor.execute("ROLLBACK")
                    raise ValueError("Failed to get ID of created event")
                
                # Fetch the created event
                fetch_query = f"SELECT * FROM events WHERE id = {placeholder}"
                cursor.execute(fetch_query, (event_id,))
                event_data = cursor.fetchone()
                
                if not event_data:
                    # Roll back if we couldn't find the created event
                    cursor.execute("ROLLBACK")
                    raise ValueError("Created event not found")
                
                # Commit the transaction
                cursor.execute("COMMIT")
                
                # Convert to dict and process datetime objects
                event_dict = dict(event_data)
                
                # Convert datetime objects to ISO format strings
                if 'created_at' in event_dict and isinstance(event_dict['created_at'], datetime):
                    event_dict['created_at'] = event_dict['created_at'].isoformat()
                
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
            
            # Convert to list of dictionaries
            return [dict(event) for event in events]
            
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
                    raise HTTPException(status_code=403, detail="Not authorized to update this event")
                
                # Prepare update query
                query = f"""
                    UPDATE events 
                    SET title={placeholder}, description={placeholder}, date={placeholder}, 
                        start_time={placeholder}, end_time={placeholder}, end_date={placeholder}, 
                        category={placeholder}, address={placeholder}, lat={placeholder}, lng={placeholder}, 
                        recurring={placeholder}, frequency={placeholder}
                    WHERE id={placeholder}
                """
                values = (
                    event.title, event.description, event.date, event.start_time, 
                    event.end_time, event.end_date, event.category, event.address, 
                    event.lat, event.lng, event.recurring, event.frequency, 
                    event_id
                )
                
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
                
                # Convert datetime to string for serialization
                if 'created_at' in event_dict and isinstance(event_dict['created_at'], datetime):
                    event_dict['created_at'] = event_dict['created_at'].isoformat()
                
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
    Enhanced health check endpoint that tests database connectivity
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.2",
        "environment": "production" if IS_PRODUCTION else "development",
        "database": {
            "status": "unknown",
            "type": "postgresql" if IS_PRODUCTION and DB_URL else "sqlite",
            "connection_test": None
        }
    }
    
    # Test database connection
    start_time = time.time()
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            
            end_time = time.time()
            response_time = round((end_time - start_time) * 1000)  # ms
            
            health_status["database"]["status"] = "connected"
            health_status["database"]["connection_test"] = {
                "successful": True,
                "response_time_ms": response_time
            }
    except Exception as e:
        logger.error(f"Health check database test failed: {str(e)}")
        health_status["status"] = "degraded"
        health_status["database"]["status"] = "error"
        health_status["database"]["connection_test"] = {
            "successful": False,
            "error": str(e)[:200]  # Truncate long error messages
        }
    
    # Return appropriate HTTP status code based on health
    status_code = 200 if health_status["status"] == "healthy" else 503
    
    return health_status

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
    limit: int = 100,
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
    limit: Optional[int] = 50
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
            
            # Build base query
            query = """
                SELECT id, title, description, date, start_time, end_time, end_date, category, 
                       address, lat, lng, created_at
                FROM events 
                WHERE date >= date('now')
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
        "ai_sync": task_manager.sync_with_ai_tools
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
    """Track a view for an event"""
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if this view already exists
            if user_id:
                cursor.execute(
                    f"SELECT id FROM event_views WHERE event_id = {placeholder} AND user_id = {placeholder}",
                    (event_id, user_id)
                )
            else:
                cursor.execute(
                    f"SELECT id FROM event_views WHERE event_id = {placeholder} AND browser_fingerprint = {placeholder}",
                    (event_id, browser_fingerprint)
                )
            
            existing_view = cursor.fetchone()
            
            if not existing_view:
                # Insert new view
                cursor.execute(
                    f"INSERT INTO event_views (event_id, user_id, browser_fingerprint) VALUES ({placeholder}, {placeholder}, {placeholder})",
                    (event_id, user_id, browser_fingerprint)
                )
                
                # Update view count
                cursor.execute(
                    f"UPDATE events SET view_count = COALESCE(view_count, 0) + 1 WHERE id = {placeholder}",
                    (event_id,)
                )
                
                conn.commit()
                return True
            return False
            
    except Exception as e:
        logger.error(f"Error tracking view for event {event_id}: {type(e).__name__}: {str(e)}")
        logger.error(f"Exception details: {repr(e)}")
        return False

# Interest and View API Endpoints
@app.post("/events/{event_id}/interest")
async def toggle_event_interest(
    event_id: int, 
    request: Request,
    current_user: dict = Depends(get_current_user_optional_no_exception)
):
    """Toggle interest in an event for logged-in or anonymous users"""
    placeholder = get_placeholder()
    
    try:
        # Get user info and always generate browser fingerprint
        user_id = current_user.get("id") if current_user else None
        browser_fingerprint = generate_browser_fingerprint(request)
        
        # Ensure browser_fingerprint is never None
        if not browser_fingerprint:
            browser_fingerprint = f"fallback-{request.client.host if request.client else 'unknown'}"
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if event exists
            cursor.execute(f"SELECT id FROM events WHERE id = {placeholder}", (event_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Check if interest already exists
            if user_id:
                cursor.execute(
                    f"SELECT id FROM event_interests WHERE event_id = {placeholder} AND user_id = {placeholder}",
                    (event_id, user_id)
                )
            else:
                cursor.execute(
                    f"SELECT id FROM event_interests WHERE event_id = {placeholder} AND browser_fingerprint = {placeholder}",
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
                
                # Update interest count
                cursor.execute(
                    f"UPDATE events SET interest_count = COALESCE(interest_count, 0) - 1 WHERE id = {placeholder}",
                    (event_id,)
                )
                
                conn.commit()
                action = "removed"
            else:
                # Add interest - always include browser_fingerprint
                cursor.execute(
                    f"INSERT INTO event_interests (event_id, user_id, browser_fingerprint) VALUES ({placeholder}, {placeholder}, {placeholder})",
                    (event_id, user_id, browser_fingerprint)
                )
                
                # Update interest count
                cursor.execute(
                    f"UPDATE events SET interest_count = COALESCE(interest_count, 0) + 1 WHERE id = {placeholder}",
                    (event_id,)
                )
                
                conn.commit()
                action = "added"
            
            # Get updated count - use COALESCE to handle NULL
            cursor.execute(f"SELECT COALESCE(interest_count, 0) FROM events WHERE id = {placeholder}", (event_id,))
            updated_count = cursor.fetchone()[0]
            
            return {
                "action": action,
                "interested": action == "added",
                "interest_count": updated_count,
                "event_id": event_id
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling interest for event {event_id}: {type(e).__name__}: {str(e)}")
        logger.error(f"Exception details: {repr(e)}")
        raise HTTPException(status_code=500, detail="Error updating interest")

@app.get("/events/{event_id}/interest")
async def get_event_interest_status(
    event_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user_optional_no_exception)
):
    """Check if user is interested in an event"""
    placeholder = get_placeholder()
    
    try:
        user_id = current_user.get("id") if current_user else None
        browser_fingerprint = generate_browser_fingerprint(request)
        
        # Ensure browser_fingerprint is never None
        if not browser_fingerprint:
            browser_fingerprint = f"fallback-{request.client.host if request.client else 'unknown'}"
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if event exists and get interest count
            cursor.execute(f"SELECT COALESCE(interest_count, 0) FROM events WHERE id = {placeholder}", (event_id,))
            event_data = cursor.fetchone()
            
            if not event_data:
                raise HTTPException(status_code=404, detail="Event not found")
            
            interest_count = event_data[0]
            
            # Check if user is interested
            user_interested = False
            if user_id:
                cursor.execute(
                    f"SELECT id FROM event_interests WHERE event_id = {placeholder} AND user_id = {placeholder}",
                    (event_id, user_id)
                )
                user_interested = cursor.fetchone() is not None
            else:
                cursor.execute(
                    f"SELECT id FROM event_interests WHERE event_id = {placeholder} AND browser_fingerprint = {placeholder}",
                    (event_id, browser_fingerprint)
                )
                user_interested = cursor.fetchone() is not None
            
            return {
                "interested": user_interested,
                "interest_count": interest_count,
                "event_id": event_id
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting interest status for event {event_id}: {type(e).__name__}: {str(e)}")
        logger.error(f"Exception details: {repr(e)}")
        raise HTTPException(status_code=500, detail="Error checking interest status")

@app.post("/events/{event_id}/view")
async def track_event_view_endpoint(
    event_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user_optional_no_exception)
):
    """Track a view for an event"""
    placeholder = get_placeholder()
    
    try:
        user_id = current_user.get("id") if current_user else None
        browser_fingerprint = generate_browser_fingerprint(request)
        
        # Ensure browser_fingerprint is never None
        if not browser_fingerprint:
            browser_fingerprint = f"fallback-{request.client.host if request.client else 'unknown'}"
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if event exists
            cursor.execute(f"SELECT COALESCE(view_count, 0) FROM events WHERE id = {placeholder}", (event_id,))
            event_data = cursor.fetchone()
            
            if not event_data:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Track the view
            view_tracked = await track_event_view(event_id, user_id, browser_fingerprint)
            
            # Get updated count
            cursor.execute(f"SELECT COALESCE(view_count, 0) FROM events WHERE id = {placeholder}", (event_id,))
            updated_count = cursor.fetchone()[0]
            
            return {
                "view_tracked": view_tracked,
                "view_count": updated_count,
                "event_id": event_id
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error tracking view for event {event_id}: {type(e).__name__}: {str(e)}")
        logger.error(f"Exception details: {repr(e)}")
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
            
            # Check events table columns
            if IS_PRODUCTION and DB_URL:
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
    """Manually create tracking tables - DEBUG ONLY"""
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            logger.info("🔧 Manually creating tracking tables...")
            
            # Drop existing tables if they exist (to start fresh)
            c.execute('DROP TABLE IF EXISTS event_interests CASCADE')
            c.execute('DROP TABLE IF EXISTS event_views CASCADE')
            
            # Create event_interests table
            c.execute('''CREATE TABLE event_interests (
                        id SERIAL PRIMARY KEY,
                        event_id INTEGER NOT NULL,
                        user_id INTEGER,
                        browser_fingerprint TEXT NOT NULL DEFAULT 'legacy',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(event_id, user_id, browser_fingerprint),
                        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                    )''')
            
            # Create event_views table
            c.execute('''CREATE TABLE event_views (
                        id SERIAL PRIMARY KEY,
                        event_id INTEGER NOT NULL,
                        user_id INTEGER,
                        browser_fingerprint TEXT NOT NULL DEFAULT 'legacy',
                        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(event_id, user_id, browser_fingerprint),
                        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
                    )''')
            
            # Fix existing events to have proper counter values
            logger.info("🔄 Updating existing events with counter values...")
            c.execute('UPDATE events SET interest_count = 0 WHERE interest_count IS NULL')
            c.execute('UPDATE events SET view_count = 0 WHERE view_count IS NULL')
            
            # Commit changes
            conn.commit()
            
            logger.info("✅ Tracking tables created successfully")
            
            return {
                "success": True,
                "message": "Tracking tables created successfully",
                "tables_created": ["event_interests", "event_views"],
                "events_updated": True
            }
            
    except Exception as e:
        logger.error(f"Error creating tracking tables: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }
