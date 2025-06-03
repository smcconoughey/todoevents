#!/usr/bin/env python3

import sqlite3
from contextlib import contextmanager
import json
import requests

# Database configuration
DATABASE_PATH = "events.db"

@contextmanager
def get_db():
    """Database context manager for SQLite"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # This allows accessing columns by name
    try:
        yield conn
    finally:
        conn.close()

def test_database_schema():
    """Test that the UX enhancement fields exist in the database"""
    print("🔍 Testing database schema...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get table schema
        cursor.execute("PRAGMA table_info(events)")
        columns = cursor.fetchall()
        
        print("\n📋 Events table columns:")
        ux_fields = ['fee_required', 'event_url', 'host_name']
        found_fields = []
        
        for column in columns:
            column_name = column['name']
            column_type = column['type']
            print(f"  - {column_name} ({column_type})")
            
            if column_name in ux_fields:
                found_fields.append(column_name)
        
        print(f"\n✅ UX enhancement fields found: {found_fields}")
        missing_fields = [field for field in ux_fields if field not in found_fields]
        if missing_fields:
            print(f"❌ Missing UX enhancement fields: {missing_fields}")
        else:
            print("✅ All UX enhancement fields are present!")

def test_manual_insert():
    """Test manually inserting an event with UX enhancement fields"""
    print("\n🧪 Testing manual insert with UX enhancement fields...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Insert test event
        insert_query = """
            INSERT INTO events (
                title, description, date, start_time, end_time, category,
                address, lat, lng, recurring, created_by,
                fee_required, event_url, host_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        values = (
            "UX Test Event",
            "Testing UX enhancement fields",
            "2025-06-15",
            "15:00",
            "17:00",
            "community",
            "123 Test Street",
            37.7749,
            -122.4194,
            False,
            2,  # user_id
            "Free with RSVP required",
            "https://example.com/test-event",
            "Test Community Center"
        )
        
        try:
            cursor.execute(insert_query, values)
            event_id = cursor.lastrowid
            conn.commit()
            
            print(f"✅ Successfully inserted event with ID: {event_id}")
            
            # Fetch the inserted event
            cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
            event = cursor.fetchone()
            
            if event:
                event_dict = dict(event)
                print(f"📊 Inserted event data:")
                print(f"  - Title: {event_dict['title']}")
                print(f"  - Fee Required: {event_dict['fee_required']}")
                print(f"  - Event URL: {event_dict['event_url']}")
                print(f"  - Host Name: {event_dict['host_name']}")
                
                return event_id
            else:
                print("❌ Could not fetch inserted event")
                return None
                
        except Exception as e:
            print(f"❌ Error inserting event: {e}")
            return None

def test_manual_update(event_id):
    """Test manually updating an event with UX enhancement fields"""
    print(f"\n🔄 Testing manual update for event ID: {event_id}...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Update event with new UX fields
        update_query = """
            UPDATE events 
            SET fee_required = ?, event_url = ?, host_name = ?
            WHERE id = ?
        """
        
        values = (
            "$10 entry fee",
            "https://updated-example.com/event",
            "Updated Community Center",
            event_id
        )
        
        try:
            cursor.execute(update_query, values)
            conn.commit()
            
            print(f"✅ Successfully updated event ID: {event_id}")
            
            # Fetch the updated event
            cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
            event = cursor.fetchone()
            
            if event:
                event_dict = dict(event)
                print(f"📊 Updated event data:")
                print(f"  - Title: {event_dict['title']}")
                print(f"  - Fee Required: {event_dict['fee_required']}")
                print(f"  - Event URL: {event_dict['event_url']}")
                print(f"  - Host Name: {event_dict['host_name']}")
            else:
                print("❌ Could not fetch updated event")
                
        except Exception as e:
            print(f"❌ Error updating event: {e}")

def test_api_endpoints():
    """Test the API endpoints for creating and updating events"""
    print("\n🌐 Testing API endpoints...")
    
    base_url = "http://localhost:8000"
    
    # Test health endpoint
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running and healthy")
        else:
            print(f"⚠️  Backend health check returned: {response.status_code}")
    except Exception as e:
        print(f"❌ Could not connect to backend: {e}")
        return
    
    # Test getting events
    try:
        response = requests.get(f"{base_url}/events?limit=1", timeout=5)
        if response.status_code == 200:
            events = response.json()
            if events:
                event = events[0]
                print(f"📊 Sample event from API:")
                print(f"  - ID: {event.get('id')}")
                print(f"  - Title: {event.get('title')}")
                print(f"  - Fee Required: {event.get('fee_required')}")
                print(f"  - Event URL: {event.get('event_url')}")
                print(f"  - Host Name: {event.get('host_name')}")
            else:
                print("📭 No events found in API response")
        else:
            print(f"❌ Events API returned: {response.status_code}")
    except Exception as e:
        print(f"❌ Error calling events API: {e}")

def cleanup_test_event(event_id):
    """Clean up the test event"""
    if event_id:
        print(f"\n🧹 Cleaning up test event ID: {event_id}")
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
            conn.commit()
            print("✅ Test event cleaned up")

def main():
    print("🚀 UX Enhancement Fields Debug Script")
    print("=" * 50)
    
    test_database_schema()
    event_id = test_manual_insert()
    
    if event_id:
        test_manual_update(event_id)
    
    test_api_endpoints()
    
    if event_id:
        cleanup_test_event(event_id)
    
    print("\n✅ Debug script completed!")

if __name__ == "__main__":
    main() 