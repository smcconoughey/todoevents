#!/usr/bin/env python3
"""
Database migration script to add premium management columns to users table
"""

import os
import sys
import logging
from contextlib import contextmanager
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Environment configuration 
IS_PRODUCTION = os.getenv("RENDER", False) or os.getenv("RAILWAY_ENVIRONMENT", False)
DB_URL = os.getenv("DATABASE_URL", None)

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection setup
if IS_PRODUCTION and DB_URL:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    
    @contextmanager
    def get_db():
        conn = psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)
        try:
            yield conn
        finally:
            conn.close()
    
    def get_placeholder():
        return "%s"
else:
    import sqlite3
    
    @contextmanager
    def get_db():
        DB_FILE = os.path.join(os.path.dirname(__file__), "events.db")
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def get_placeholder():
        return "?"

def column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table"""
    try:
        if IS_PRODUCTION and DB_URL:
            # PostgreSQL
            cursor.execute("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = %s AND column_name = %s
            """, (table_name, column_name))
            return cursor.fetchone() is not None
        else:
            # SQLite
            cursor.execute(f'PRAGMA table_info({table_name})')
            columns = [column[1] for column in cursor.fetchall()]
            return column_name in columns
    except Exception as e:
        logger.error(f"Error checking column existence: {e}")
        return False

def add_premium_columns():
    """Add premium management columns to users table"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            logger.info("🔧 Starting premium columns migration...")
            
            # Add premium_expires_at column
            if not column_exists(cursor, 'users', 'premium_expires_at'):
                if IS_PRODUCTION and DB_URL:
                    cursor.execute('ALTER TABLE users ADD COLUMN premium_expires_at TIMESTAMP')
                else:
                    cursor.execute('ALTER TABLE users ADD COLUMN premium_expires_at TIMESTAMP')
                logger.info("✅ Added 'premium_expires_at' column")
                conn.commit()
            else:
                logger.info("ℹ️ 'premium_expires_at' column already exists")
            
            # Add premium_granted_by column
            if not column_exists(cursor, 'users', 'premium_granted_by'):
                if IS_PRODUCTION and DB_URL:
                    cursor.execute('ALTER TABLE users ADD COLUMN premium_granted_by INTEGER')
                else:
                    cursor.execute('ALTER TABLE users ADD COLUMN premium_granted_by INTEGER')
                logger.info("✅ Added 'premium_granted_by' column")
                conn.commit()
            else:
                logger.info("ℹ️ 'premium_granted_by' column already exists")
            
            # Add premium_invited column
            if not column_exists(cursor, 'users', 'premium_invited'):
                if IS_PRODUCTION and DB_URL:
                    cursor.execute('ALTER TABLE users ADD COLUMN premium_invited BOOLEAN DEFAULT FALSE')
                else:
                    cursor.execute('ALTER TABLE users ADD COLUMN premium_invited BOOLEAN DEFAULT FALSE')
                logger.info("✅ Added 'premium_invited' column")
                conn.commit()
            else:
                logger.info("ℹ️ 'premium_invited' column already exists")
            
            logger.info("🎉 Premium columns migration completed successfully!")
            
            # Verify the columns were added
            logger.info("🔍 Verifying columns...")
            if IS_PRODUCTION and DB_URL:
                cursor.execute("""
                    SELECT column_name, data_type, is_nullable, column_default 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name LIKE 'premium%'
                    ORDER BY column_name
                """)
                columns = cursor.fetchall()
                logger.info("📋 Premium columns in users table:")
                for col in columns:
                    logger.info(f"   - {col['column_name']}: {col['data_type']} (nullable: {col['is_nullable']}, default: {col['column_default']})")
            else:
                cursor.execute('PRAGMA table_info(users)')
                columns = cursor.fetchall()
                premium_columns = [col for col in columns if col[1].startswith('premium')]
                logger.info("📋 Premium columns in users table:")
                for col in premium_columns:
                    logger.info(f"   - {col[1]}: {col[2]} (nullable: {col[3]}, default: {col[4]})")
            
            return True
            
    except Exception as e:
        logger.error(f"❌ Error during premium columns migration: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("🚀 Starting premium management database migration...")
    logger.info(f"📊 Database type: {'PostgreSQL' if IS_PRODUCTION and DB_URL else 'SQLite'}")
    
    success = add_premium_columns()
    
    if success:
        logger.info("✅ Migration completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Migration failed!")
        sys.exit(1) 