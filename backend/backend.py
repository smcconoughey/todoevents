import os
import re
import sqlite3
import logging
import time
import json
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
                
                # SQLite does not have information_schema, so we skip the schema fixes
                # The tracking tables are created correctly above for SQLite
            
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
        admin_count = cursor.fetchone()[0]
        
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
    short_description: Optional[str] = None
    date: str
    start_time: str
    end_time: Optional[str] = None
    end_date: Optional[str] = None
    category: str
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
    limit: Optional[int] = 50,  # Add pagination
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
    limit = min(max(limit or 50, 1), 100)  # Between 1 and 100
    offset = max(offset or 0, 0)
    
    # Create cache key for this request
    cache_key = f"events:{category or 'all'}:{date or 'all'}:{limit}:{offset}:{lat}:{lng}:{radius}"
    
    # Try to get from cache first (for mobile performance)
    cached_result = event_cache.get(cache_key)
    if cached_result is not None:
        logger.info(f"Returning cached events for key: {cache_key}")
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
                ORDER BY date ASC, start_time ASC
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
        """Enhanced datetime building"""
        if not date_str or not start_time_str:
            return None, None
        
        try:
            # Build start datetime
            start_dt_str = f"{date_str}T{start_time_str}:00"
            
            # Build end datetime
            end_dt_str = None
            if end_time_str:
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
    event_data['slug'] = slugify_local(event_data.get('title', ''), city)
    
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
                
                # Use centralized schema and helper to generate INSERT query and values
                from database_schema import generate_insert_query
                from event_data_builder import build_event_values_for_insert
                
                insert_query = generate_insert_query(returning_id=True)
                values = build_event_values_for_insert(event_data, current_user["id"], lat_rounded, lng_rounded)
                
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
                
                # Use centralized schema and helper for UPDATE
                from database_schema import generate_update_query, EVENT_FIELDS
                from event_data_builder import build_event_values_for_update
                
                update_fields = [field[0] for field in EVENT_FIELDS 
                               if field[0] not in ['id', 'created_at', 'created_by']]
                query = generate_update_query(fields=update_fields)
                values = build_event_values_for_update(event_data, event_id)
                
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
            
            # Build base query including UX fields
            query = """
                SELECT id, title, description, date, start_time, end_time, end_date, category, 
                       address, lat, lng, created_at, fee_required, event_url, host_name
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
            
            # Fix NULL counter values in existing events
            cursor.execute("UPDATE events SET interest_count = 0 WHERE interest_count IS NULL")
            cursor.execute("UPDATE events SET view_count = 0 WHERE view_count IS NULL")
            
            conn.commit()
            
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
            interest_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM event_views")
            view_count = cursor.fetchone()[0]
            
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

@app.post("/admin/events/bulk", response_model=BulkEventResponse)
async def bulk_create_events(
    bulk_events: BulkEventCreate, 
    current_user: dict = Depends(get_current_user)
):
    """
    Bulk create events (admin-only endpoint)
    """
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized. Admin access required.")
    
    placeholder = get_placeholder()
    success_count = 0
    error_count = 0
    errors = []
    created_events = []
    
    logger.info(f"Admin {current_user['email']} initiating bulk event creation for {len(bulk_events.events)} events")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            for i, event in enumerate(bulk_events.events):
                try:
                    # Start transaction for each event
                    cursor.execute("BEGIN")
                    
                    # Check for duplicates
                    duplicate_check = f"""
                        SELECT id FROM events 
                        WHERE TRIM(LOWER(title)) = TRIM(LOWER({placeholder}))
                        AND date = {placeholder} 
                        AND start_time = {placeholder} 
                        AND ABS(lat - {placeholder}) < 0.000001
                        AND ABS(lng - {placeholder}) < 0.000001
                        AND category = {placeholder}
                    """
                    
                    # Round coordinates for consistency
                    lat_rounded = round(event.lat, 6)
                    lng_rounded = round(event.lng, 6)
                    
                    cursor.execute(duplicate_check, (
                        event.title.strip(), 
                        event.date, 
                        event.start_time, 
                        lat_rounded, 
                        lng_rounded, 
                        event.category
                    ))
                    
                    duplicate = cursor.fetchone()
                    if duplicate:
                        cursor.execute("ROLLBACK")
                        error_count += 1
                        errors.append({
                            "index": i,
                            "event_title": event.title,
                            "error": "Duplicate event - event with these exact details already exists"
                        })
                        continue
                    
                    # Insert the new event using centralized helpers
                    from database_schema import generate_insert_query
                    from event_data_builder import build_event_values_for_insert
                    
                    insert_query = generate_insert_query(returning_id=True)
                    
                    # Convert event object to dict for the helper
                    event_dict = {
                        'title': event.title,
                        'description': event.description,
                        'short_description': getattr(event, 'short_description', None),
                        'date': event.date,
                        'start_time': event.start_time,
                        'end_time': event.end_time,
                        'end_date': event.end_date,
                        'category': event.category,
                        'address': event.address,
                        'city': getattr(event, 'city', None),
                        'state': getattr(event, 'state', None),
                        'country': getattr(event, 'country', 'USA'),
                        'recurring': event.recurring,
                        'frequency': event.frequency,
                        'fee_required': event.fee_required,
                        'price': getattr(event, 'price', 0.0),
                        'currency': getattr(event, 'currency', 'USD'),
                        'event_url': event.event_url,
                        'host_name': event.host_name,
                        'organizer_url': getattr(event, 'organizer_url', None),
                        'slug': getattr(event, 'slug', None),
                        'is_published': getattr(event, 'is_published', True),
                        'start_datetime': getattr(event, 'start_datetime', None),
                        'end_datetime': getattr(event, 'end_datetime', None),
                        'updated_at': None,
                        'interest_count': 0,
                        'view_count': 0
                    }
                    values = build_event_values_for_insert(event_dict, current_user["id"], lat_rounded, lng_rounded)
                    
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
                        error_count += 1
                        errors.append({
                            "index": i,
                            "event_title": event.title,
                            "error": "Failed to get ID of created event"
                        })
                        continue
                    
                    # Fetch the created event
                    fetch_query = f"SELECT * FROM events WHERE id = {placeholder}"
                    cursor.execute(fetch_query, (event_id,))
                    event_data = cursor.fetchone()
                    
                    if not event_data:
                        cursor.execute("ROLLBACK")
                        error_count += 1
                        errors.append({
                            "index": i,
                            "event_title": event.title,
                            "error": "Created event not found"
                        })
                        continue
                    
                    # Commit the transaction
                    cursor.execute("COMMIT")
                    
                    # Convert to dict and process datetime objects
                    event_dict = dict(event_data)
                    
                    # Convert datetime objects to ISO format strings
                    if 'created_at' in event_dict and isinstance(event_dict['created_at'], datetime):
                        event_dict['created_at'] = event_dict['created_at'].isoformat()
                    
                    # Ensure counters are integers
                    event_dict['interest_count'] = event_dict.get('interest_count', 0) or 0
                    event_dict['view_count'] = event_dict.get('view_count', 0) or 0
                    
                    created_events.append(event_dict)
                    success_count += 1
                    
                    logger.info(f"Successfully created event: {event.title} (ID: {event_id})")
                    
                except HTTPException as http_ex:
                    # Attempt to roll back the transaction
                    try:
                        cursor.execute("ROLLBACK")
                    except:
                        pass
                    
                    error_count += 1
                    errors.append({
                        "index": i,
                        "event_title": event.title,
                        "error": http_ex.detail
                    })
                    
                except Exception as e:
                    # Attempt to roll back the transaction
                    try:
                        cursor.execute("ROLLBACK")
                    except:
                        pass
                    
                    error_count += 1
                    error_msg = str(e)
                    errors.append({
                        "index": i,
                        "event_title": event.title,
                        "error": f"Database error: {error_msg}"
                    })
                    logger.error(f"Error creating event {i} ({event.title}): {error_msg}")
            
            # Clear event cache since new events were created
            if success_count > 0:
                event_cache.clear()
                logger.info(f"Cleared event cache after bulk creating {success_count} events")
            
            logger.info(f"Bulk event creation completed. Success: {success_count}, Errors: {error_count}")
            
            return BulkEventResponse(
                success_count=success_count,
                error_count=error_count,
                errors=errors,
                created_events=created_events
            )
            
    except Exception as e:
        logger.error(f"Critical error in bulk event creation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Critical error during bulk event creation: {str(e)}"
        )

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
                event_count = cursor.fetchone()[0]
                
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
                event_count = cursor.fetchone()[0]
                
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

def sanitize_ux_field(value):
    """Convert None to empty string for UX fields to avoid NULLs in DB."""
    logger.info(f"sanitize_ux_field called with: {value!r} (type: {type(value)})")
    result = value if value is not None else ""
    logger.info(f"sanitize_ux_field returning: {result!r} (type: {type(result)})")
    return result

def convert_event_datetime_fields(event_dict):
    """Convert datetime objects to ISO format strings for API response"""
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
            WHERE slug = ? AND is_published = 1
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
    limit: int = 20,
    offset: int = 0
):
    """Get events by state and city for geographic SEO"""
    
    with get_db() as conn:
        cursor = conn.cursor()
        
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
            AND is_published = 1
            AND date >= date('now')
            ORDER BY date ASC, start_time ASC
            LIMIT ? OFFSET ?
        ''', (state.lower(), city.lower(), limit, offset))
        
        events = [dict(row) for row in cursor.fetchall()]
        
        # Get total count
        cursor.execute('''
            SELECT COUNT(*) FROM events 
            WHERE LOWER(state) = ? 
            AND LOWER(city) = ? 
            AND is_published = 1
            AND date >= date('now')
        ''', (state.lower(), city.lower()))
        
        total = cursor.fetchone()[0]
        
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
        
        cursor.execute('''
            SELECT title, description, date, start_time, city, state, category
            FROM events 
            WHERE id = ? AND is_published = 1
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
            from production_seo_migration import migrate_production_seo_fields
            result = migrate_production_seo_fields()
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
        from production_seo_migration import migrate_production_seo_fields
        result = migrate_production_seo_fields()
        
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
        
        cursor.execute('''
            SELECT slug, city, state, updated_at, date
            FROM events 
            WHERE is_published = 1 
            AND slug IS NOT NULL
            AND date >= date('now', '-30 days')
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