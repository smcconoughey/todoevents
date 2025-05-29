#!/usr/bin/env python3
"""
Production Database Migration Script for Start/End Time Fields
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migration():
    """Run the database migration for production"""
    
    # Get database URL from environment
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        logger.error("❌ DATABASE_URL not found in environment variables")
        return False
    
    logger.info("🚀 Starting production database migration...")
    
    try:
        # Connect to PostgreSQL
        conn = psycopg2.connect(
            db_url,
            cursor_factory=RealDictCursor,
            connect_timeout=30
        )
        
        # Disable autocommit to control transactions
        conn.autocommit = False
        cursor = conn.cursor()
        
        logger.info("✅ Connected to production database")
        
        # Check current schema
        logger.info("📋 Checking current database schema...")
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'events'
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        column_names = [col['column_name'] for col in columns]
        
        logger.info(f"📊 Current columns in events table: {column_names}")
        
        # Step 1: Check if we need to migrate 'time' to 'start_time'
        if 'time' in column_names and 'start_time' not in column_names:
            logger.info("🔄 Migrating 'time' column to 'start_time'...")
            cursor.execute('ALTER TABLE events RENAME COLUMN time TO start_time')
            logger.info("✅ Successfully renamed 'time' to 'start_time'")
        elif 'start_time' in column_names:
            logger.info("✅ 'start_time' column already exists")
        else:
            # Add start_time column if neither exists
            logger.info("➕ Adding 'start_time' column...")
            cursor.execute("ALTER TABLE events ADD COLUMN start_time TEXT DEFAULT '12:00'")
            logger.info("✅ Added 'start_time' column")
        
        # Step 2: Add end_time column if it doesn't exist
        if 'end_time' not in column_names:
            logger.info("➕ Adding 'end_time' column...")
            cursor.execute("ALTER TABLE events ADD COLUMN end_time TEXT")
            logger.info("✅ Added 'end_time' column")
        else:
            logger.info("✅ 'end_time' column already exists")
        
        # Step 3: Add end_date column if it doesn't exist
        if 'end_date' not in column_names:
            logger.info("➕ Adding 'end_date' column...")
            cursor.execute("ALTER TABLE events ADD COLUMN end_date TEXT")
            logger.info("✅ Added 'end_date' column")
        else:
            logger.info("✅ 'end_date' column already exists")
        
        # Commit all changes
        conn.commit()
        logger.info("💾 All changes committed successfully")
        
        # Verify the final schema
        logger.info("🔍 Verifying final schema...")
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'events'
            ORDER BY ordinal_position
        """)
        
        final_columns = cursor.fetchall()
        
        print("\n📋 Final Events Table Schema:")
        print("=" * 50)
        for col in final_columns:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            print(f"  {col['column_name']:<15} {col['data_type']:<15} {nullable}")
        
        # Check if we have any existing events to verify
        cursor.execute("SELECT COUNT(*) as event_count FROM events")
        event_count = cursor.fetchone()['event_count']
        logger.info(f"📊 Total events in database: {event_count}")
        
        if event_count > 0:
            # Show a sample event to verify the migration
            cursor.execute("""
                SELECT id, title, date, start_time, end_time, end_date
                FROM events 
                ORDER BY id DESC 
                LIMIT 1
            """)
            sample_event = cursor.fetchone()
            
            print(f"\n📝 Sample Event (ID {sample_event['id']}):")
            print(f"  Title: {sample_event['title']}")
            print(f"  Date: {sample_event['date']}")
            print(f"  Start Time: {sample_event['start_time']}")
            print(f"  End Time: {sample_event['end_time']}")
            print(f"  End Date: {sample_event['end_date']}")
        
        logger.info("🎉 Migration completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {str(e)}")
        try:
            conn.rollback()
            logger.info("🔄 Rolled back transaction")
        except:
            pass
        return False
        
    finally:
        try:
            conn.close()
            logger.info("🔌 Database connection closed")
        except:
            pass

if __name__ == "__main__":
    print("🔧 Production Database Migration Tool")
    print("=" * 40)
    print("This script will add start_time, end_time, and end_date columns")
    print("to the events table in your production database.")
    print()
    
    # Check if DATABASE_URL is set
    if not os.getenv("DATABASE_URL"):
        print("❌ Error: DATABASE_URL environment variable not set")
        print("Please set it with your production database URL")
        exit(1)
    
    # Run the migration
    success = run_migration()
    
    if success:
        print("\n✅ Migration completed! Your production database is now ready.")
        print("You can restart your backend service to use the new schema.")
    else:
        print("\n❌ Migration failed. Please check the logs above.")
        exit(1) 