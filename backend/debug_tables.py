#!/usr/bin/env python3

from backend import get_db, get_placeholder

def check_tables():
    print("🔍 Checking database tables...")
    
    with get_db() as conn:
        c = conn.cursor()
        
        # Get all tables
        c.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in c.fetchall()]
        print(f"Tables found: {tables}")
        
        # Check if interest table exists
        if 'event_interests' in tables:
            print("\n✅ event_interests table exists")
            c.execute("PRAGMA table_info(event_interests)")
            columns = [row[1] for row in c.fetchall()]
            print(f"Columns: {columns}")
        else:
            print("\n❌ event_interests table does not exist")
            
        # Check if view table exists  
        if 'event_views' in tables:
            print("\n✅ event_views table exists")
            c.execute("PRAGMA table_info(event_views)")
            columns = [row[1] for row in c.fetchall()]
            print(f"Columns: {columns}")
        else:
            print("\n❌ event_views table does not exist")
            
        # Check events table for new columns
        if 'events' in tables:
            print("\n📋 Checking events table...")
            c.execute("PRAGMA table_info(events)")
            columns = [row[1] for row in c.fetchall()]
            print(f"Events columns: {columns}")
            
            has_interest_count = 'interest_count' in columns
            has_view_count = 'view_count' in columns
            print(f"Has interest_count: {has_interest_count}")
            print(f"Has view_count: {has_view_count}")

if __name__ == "__main__":
    check_tables() 