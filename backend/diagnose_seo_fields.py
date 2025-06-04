#!/usr/bin/env python3
"""
Diagnose SEO Fields in Production Database
Check what's actually in the database and why the script thinks no updates are needed
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import json

def get_production_db():
    """Get production PostgreSQL connection"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise Exception("DATABASE_URL environment variable not found")
    
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def check_database_tables():
    """Check what tables exist"""
    print("🔍 Checking database tables...")
    
    with get_production_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        
        tables = cursor.fetchall()
        print(f"📋 Found {len(tables)} tables:")
        for table in tables:
            print(f"  - {table['table_name']}")

def check_events_table_schema():
    """Check the events table schema"""
    print("\n🔍 Checking events table schema...")
    
    with get_production_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'events'
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        print(f"📋 Events table has {len(columns)} columns:")
        
        seo_fields = ['slug', 'short_description', 'start_datetime', 'end_datetime', 'city', 'state']
        
        for column in columns:
            name = column['column_name']
            is_seo = "🎯" if name in seo_fields else "  "
            print(f"  {is_seo} {name}: {column['data_type']} (nullable: {column['is_nullable']})")

def count_events_by_status():
    """Count events by their SEO field status"""
    print("\n📊 Counting events by SEO field status...")
    
    with get_production_db() as conn:
        cursor = conn.cursor()
        
        # Total events
        cursor.execute("SELECT COUNT(*) as total FROM events")
        total = cursor.fetchone()['total']
        print(f"📈 Total events: {total}")
        
        # Events with NULL slug
        cursor.execute("SELECT COUNT(*) as count FROM events WHERE slug IS NULL")
        null_slug = cursor.fetchone()['count']
        print(f"🏷️ Events with NULL slug: {null_slug}")
        
        # Events with empty slug
        cursor.execute("SELECT COUNT(*) as count FROM events WHERE slug = ''")
        empty_slug = cursor.fetchone()['count']
        print(f"🏷️ Events with empty slug: {empty_slug}")
        
        # Events with NULL short_description
        cursor.execute("SELECT COUNT(*) as count FROM events WHERE short_description IS NULL")
        null_desc = cursor.fetchone()['count']
        print(f"📝 Events with NULL short_description: {null_desc}")
        
        # Events with empty short_description
        cursor.execute("SELECT COUNT(*) as count FROM events WHERE short_description = ''")
        empty_desc = cursor.fetchone()['count']
        print(f"📝 Events with empty short_description: {empty_desc}")
        
        # Events with NULL start_datetime
        cursor.execute("SELECT COUNT(*) as count FROM events WHERE start_datetime IS NULL")
        null_start = cursor.fetchone()['count']
        print(f"⏰ Events with NULL start_datetime: {null_start}")
        
        # Events with empty start_datetime
        cursor.execute("SELECT COUNT(*) as count FROM events WHERE start_datetime = ''")
        empty_start = cursor.fetchone()['count']
        print(f"⏰ Events with empty start_datetime: {empty_start}")
        
        # Events with NULL city
        cursor.execute("SELECT COUNT(*) as count FROM events WHERE city IS NULL")
        null_city = cursor.fetchone()['count']
        print(f"🏙️ Events with NULL city: {null_city}")
        
        # Events with empty city
        cursor.execute("SELECT COUNT(*) as count FROM events WHERE city = ''")
        empty_city = cursor.fetchone()['count']
        print(f"🏙️ Events with empty city: {empty_city}")

def show_sample_problematic_events():
    """Show sample events that need SEO field updates"""
    print("\n🎯 Sample events that need SEO updates...")
    
    with get_production_db() as conn:
        cursor = conn.cursor()
        
        # Find events with missing SEO fields (NULL or empty)
        cursor.execute("""
            SELECT id, title, slug, short_description, start_datetime, end_datetime, city, state, address
            FROM events 
            WHERE slug IS NULL 
               OR slug = ''
               OR short_description IS NULL 
               OR short_description = ''
               OR start_datetime IS NULL 
               OR start_datetime = ''
               OR city IS NULL 
               OR city = ''
               OR state IS NULL 
               OR state = ''
            ORDER BY id
            LIMIT 10
        """)
        
        events = cursor.fetchall()
        print(f"📋 Found {len(events)} events needing updates:")
        
        for event in events:
            print(f"\n🎪 Event {event['id']}: {event['title']}")
            print(f"   🏷️ slug: {repr(event['slug'])}")
            print(f"   📝 short_description: {repr(event['short_description'])}")
            print(f"   ⏰ start_datetime: {repr(event['start_datetime'])}")
            print(f"   🏙️ city: {repr(event['city'])}")
            print(f"   🏛️ state: {repr(event['state'])}")
            print(f"   📍 address: {event['address']}")

def test_specific_query():
    """Test the exact query used in the fix script"""
    print("\n🧪 Testing the exact query from fix_existing_events_seo.py...")
    
    with get_production_db() as conn:
        cursor = conn.cursor()
        
        # This is the exact query from the fix script
        cursor.execute("""
            SELECT * FROM events 
            WHERE slug IS NULL 
               OR short_description IS NULL 
               OR start_datetime IS NULL
            LIMIT 50
        """)
        
        events = cursor.fetchall()
        print(f"🔍 Query found {len(events)} events")
        
        if events:
            print("📋 Sample results:")
            for i, event in enumerate(events[:3]):
                print(f"\n🎪 Event {event['id']}: {event['title']}")
                print(f"   🏷️ slug: {repr(event['slug'])}")
                print(f"   📝 short_description: {repr(event['short_description'])}")
                print(f"   ⏰ start_datetime: {repr(event['start_datetime'])}")
        else:
            print("❌ No events found by the fix script query")
            
            # Let's try a broader query
            print("\n🔍 Trying broader query...")
            cursor.execute("""
                SELECT id, title, slug, short_description, start_datetime 
                FROM events 
                WHERE (slug IS NULL OR slug = '') 
                   OR (short_description IS NULL OR short_description = '') 
                   OR (start_datetime IS NULL OR start_datetime = '')
                LIMIT 10
            """)
            
            broader_events = cursor.fetchall()
            print(f"📋 Broader query found {len(broader_events)} events")
            
            for event in broader_events:
                print(f"\n🎪 Event {event['id']}: {event['title']}")
                print(f"   🏷️ slug: {repr(event['slug'])}")
                print(f"   📝 short_description: {repr(event['short_description'])}")
                print(f"   ⏰ start_datetime: {repr(event['start_datetime'])}")

def check_recent_events():
    """Check the most recent events"""
    print("\n🕒 Checking most recent events...")
    
    with get_production_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, title, slug, short_description, start_datetime, city, state, created_at
            FROM events 
            ORDER BY created_at DESC
            LIMIT 5
        """)
        
        events = cursor.fetchall()
        print(f"📋 Most recent {len(events)} events:")
        
        for event in events:
            print(f"\n🎪 Event {event['id']}: {event['title']}")
            print(f"   🏷️ slug: {repr(event['slug'])}")
            print(f"   📝 short_description: {repr(event['short_description'])}")
            print(f"   ⏰ start_datetime: {repr(event['start_datetime'])}")
            print(f"   🏙️ city: {repr(event['city'])}")
            print(f"   🏛️ state: {repr(event['state'])}")
            print(f"   📅 created_at: {event['created_at']}")

def main():
    print("🚀 SEO Fields Diagnostic Tool")
    print("=" * 50)
    
    try:
        check_database_tables()
        check_events_table_schema()
        count_events_by_status()
        show_sample_problematic_events()
        test_specific_query()
        check_recent_events()
        
        print("\n✅ Diagnostic complete!")
        
    except Exception as e:
        print(f"❌ Diagnostic failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 