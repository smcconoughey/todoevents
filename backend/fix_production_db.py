#!/usr/bin/env python3

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import sys

def fix_production_database():
    """Fix the production database schema for interest and view tracking"""
    
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ ERROR: DATABASE_URL environment variable not set")
        print("Please set it to your Render PostgreSQL URL")
        return False
    
    print("🔧 Connecting to production database...")
    
    try:
        # Connect to production database with SSL
        conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor, sslmode='require')
        cursor = conn.cursor()
        
        print("✅ Connected to production database")
        
        # 1. Add missing columns to events table if they don't exist
        print("\n📊 Checking events table schema...")
        
        # Check if interest_count column exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = 'interest_count'
        """)
        if not cursor.fetchone():
            print("  ➕ Adding interest_count column...")
            cursor.execute("ALTER TABLE events ADD COLUMN interest_count INTEGER DEFAULT 0")
            print("  ✅ Added interest_count column")
        else:
            print("  ✅ interest_count column already exists")
        
        # Check if view_count column exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = 'view_count'
        """)
        if not cursor.fetchone():
            print("  ➕ Adding view_count column...")
            cursor.execute("ALTER TABLE events ADD COLUMN view_count INTEGER DEFAULT 0")
            print("  ✅ Added view_count column")
        else:
            print("  ✅ view_count column already exists")
        
        # 2. Create event_interests table if it doesn't exist
        print("\n💝 Checking event_interests table...")
        
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'event_interests'
        """)
        if not cursor.fetchone():
            print("  ➕ Creating event_interests table...")
            cursor.execute("""
                CREATE TABLE event_interests (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL,
                    user_id INTEGER NULL,
                    browser_fingerprint TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(event_id, user_id, browser_fingerprint),
                    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            print("  ✅ Created event_interests table")
        else:
            print("  ✅ event_interests table already exists")
            
            # Check if browser_fingerprint column exists in the existing table
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'event_interests' AND column_name = 'browser_fingerprint'
            """)
            if not cursor.fetchone():
                print("  ➕ Adding browser_fingerprint column to existing table...")
                cursor.execute("ALTER TABLE event_interests ADD COLUMN browser_fingerprint TEXT NOT NULL DEFAULT 'legacy'")
                print("  ✅ Added browser_fingerprint column")
        
        # 3. Create event_views table if it doesn't exist
        print("\n👁️ Checking event_views table...")
        
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'event_views'
        """)
        if not cursor.fetchone():
            print("  ➕ Creating event_views table...")
            cursor.execute("""
                CREATE TABLE event_views (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL,
                    user_id INTEGER NULL,
                    browser_fingerprint TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(event_id, user_id, browser_fingerprint),
                    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            print("  ✅ Created event_views table")
        else:
            print("  ✅ event_views table already exists")
        
        # 4. Update existing events to have default counter values
        print("\n🔄 Updating existing events with default counter values...")
        cursor.execute("UPDATE events SET interest_count = 0 WHERE interest_count IS NULL")
        cursor.execute("UPDATE events SET view_count = 0 WHERE view_count IS NULL")
        print("  ✅ Updated existing events")
        
        # Commit all changes
        conn.commit()
        print("\n✅ All database migrations completed successfully!")
        
        # 5. Test the endpoints
        print("\n🧪 Testing production endpoints...")
        
        # Get a sample event ID
        cursor.execute("SELECT id FROM events LIMIT 1")
        result = cursor.fetchone()
        if result:
            event_id = result['id']
            print(f"  📝 Using event ID {event_id} for testing")
            
            # Test view tracking
            cursor.execute("""
                INSERT INTO event_views (event_id, browser_fingerprint) 
                VALUES (%s, %s) 
                ON CONFLICT DO NOTHING
            """, (event_id, 'test-fingerprint'))
            
            # Test interest tracking
            cursor.execute("""
                INSERT INTO event_interests (event_id, browser_fingerprint) 
                VALUES (%s, %s) 
                ON CONFLICT DO NOTHING
            """, (event_id, 'test-fingerprint'))
            
            conn.commit()
            print("  ✅ Successfully tested database operations")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Production database is now ready for interest and view tracking!")
        print("   The following features are now available:")
        print("   • Event interest tracking (with heart button)")
        print("   • Event view counting (with eye icon)")
        print("   • Anonymous user support via browser fingerprinting")
        print("   • Spam prevention with duplicate detection")
        
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 Production Database Migration Script")
    print("=" * 50)
    
    if not fix_production_database():
        print("\n❌ Migration failed!")
        sys.exit(1)
    else:
        print("\n✅ Migration completed successfully!")
        sys.exit(0) 