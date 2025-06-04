#!/usr/bin/env python3
"""
Verify Database Changes
Check what's actually in the production database vs what the API returns
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import requests

def get_production_db():
    """Get production PostgreSQL connection"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise Exception("DATABASE_URL environment variable not found")
    
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def check_database_directly():
    """Check what's actually in the database"""
    print("🔍 Checking database directly...")
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            # Get a few events to check
            cursor.execute("""
                SELECT id, title, slug, city, state, short_description, 
                       start_datetime, end_datetime, updated_at
                FROM events 
                WHERE id IN (170, 169, 60, 172, 24)
                ORDER BY id
            """)
            
            events = cursor.fetchall()
            
            print(f"\n📊 Found {len(events)} events in database:")
            for event in events:
                print(f"\n  Event {event['id']}: {event['title']}")
                print(f"    🏷️ Slug: {event['slug']}")
                print(f"    🏙️ City: {event['city']}")
                print(f"    🏛️ State: {event['state']}")
                print(f"    📝 Short desc: {(event['short_description'] or 'NULL')[:50]}...")
                print(f"    ⏰ Start: {event['start_datetime']}")
                print(f"    ⏰ End: {event['end_datetime']}")
                print(f"    🕒 Updated: {event['updated_at']}")
                
            return events
            
    except Exception as e:
        print(f"❌ Database check failed: {e}")
        return []

def check_api_response():
    """Check what the API returns"""
    print("\n🌐 Checking API response...")
    
    try:
        # Check the API endpoints
        base_url = "https://todoevents-backend.onrender.com"
        
        response = requests.get(f"{base_url}/events", timeout=30)
        if response.status_code == 200:
            events = response.json()
            
            # Filter to the same events we checked in database
            test_events = [e for e in events if e['id'] in [170, 169, 60, 172, 24]]
            
            print(f"\n📊 Found {len(test_events)} events from API:")
            for event in test_events:
                print(f"\n  Event {event['id']}: {event['title']}")
                print(f"    🏷️ Slug: {event.get('slug', 'NULL')}")
                print(f"    🏙️ City: {event.get('city', 'NULL')}")
                print(f"    🏛️ State: {event.get('state', 'NULL')}")
                print(f"    📝 Short desc: {(event.get('short_description') or 'NULL')[:50]}...")
                print(f"    ⏰ Start: {event.get('start_datetime', 'NULL')}")
                print(f"    ⏰ End: {event.get('end_datetime', 'NULL')}")
                print(f"    🕒 Updated: {event.get('updated_at', 'NULL')}")
                
            return test_events
        else:
            print(f"❌ API request failed: {response.status_code}")
            return []
            
    except Exception as e:
        print(f"❌ API check failed: {e}")
        return []

def compare_results(db_events, api_events):
    """Compare database vs API results"""
    print("\n🔄 Comparing database vs API results:")
    
    if not db_events or not api_events:
        print("❌ Cannot compare - missing data")
        return
    
    # Create lookup for API events
    api_lookup = {e['id']: e for e in api_events}
    
    mismatches = 0
    
    for db_event in db_events:
        event_id = db_event['id']
        api_event = api_lookup.get(event_id)
        
        if not api_event:
            print(f"❌ Event {event_id} not found in API response")
            continue
            
        print(f"\n📋 Event {event_id} ({db_event['title'][:30]}...):")
        
        # Compare key fields
        fields_to_compare = ['slug', 'city', 'state', 'short_description', 'start_datetime', 'end_datetime']
        
        event_mismatches = 0
        for field in fields_to_compare:
            db_value = db_event.get(field)
            api_value = api_event.get(field)
            
            if db_value != api_value:
                print(f"  ❌ {field}:")
                print(f"      DB:  {db_value}")
                print(f"      API: {api_value}")
                event_mismatches += 1
            else:
                status = "✅" if db_value is not None else "⚠️"
                print(f"  {status} {field}: {db_value}")
        
        if event_mismatches > 0:
            mismatches += 1
            
    print(f"\n📊 Summary: {mismatches}/{len(db_events)} events have mismatches")
    
    if mismatches > 0:
        print("\n🚨 ISSUE DETECTED: Database and API responses don't match!")
        print("This suggests:")
        print("  • The API might be reading from a different database")
        print("  • There might be caching issues")
        print("  • The database changes didn't commit properly")
    else:
        print("\n✅ Database and API are consistent")

def force_refresh_api():
    """Try to force refresh the API cache"""
    print("\n🔄 Attempting to refresh API cache...")
    
    try:
        base_url = "https://todoevents-backend.onrender.com"
        
        # Try hitting a debug endpoint that might refresh cache
        endpoints_to_try = [
            "/debug/schema",
            "/health", 
            "/events/1"  # Just get one event to wake up the API
        ]
        
        for endpoint in endpoints_to_try:
            try:
                response = requests.get(f"{base_url}{endpoint}", timeout=15)
                print(f"  📍 {endpoint}: {response.status_code}")
            except Exception as e:
                print(f"  ❌ {endpoint}: {e}")
                
    except Exception as e:
        print(f"❌ Cache refresh failed: {e}")

def main():
    """Main verification function"""
    print("🔍 TodoEvents Database vs API Verification")
    print("=" * 60)
    
    # Step 1: Check database directly
    db_events = check_database_directly()
    
    # Step 2: Check API response
    api_events = check_api_response()
    
    # Step 3: Compare results
    compare_results(db_events, api_events)
    
    # Step 4: Try to refresh API
    force_refresh_api()
    
    print("\n" + "=" * 60)
    print("🎯 Next steps if there are mismatches:")
    print("  1. Check if API is reading from correct database")
    print("  2. Verify DATABASE_URL environment variable")
    print("  3. Check for caching issues in the backend")
    print("  4. Restart the Render backend service")

if __name__ == "__main__":
    main() 