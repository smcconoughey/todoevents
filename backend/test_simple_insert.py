#!/usr/bin/env python3
"""
Simple test to verify database insert with short_description
"""

import sqlite3
from contextlib import contextmanager

@contextmanager
def get_db():
    """Get database connection"""
    conn = sqlite3.connect('events.db')
    conn.row_factory = sqlite3.Row  # This allows column access by name
    try:
        yield conn
    finally:
        conn.close()

def test_simple_insert():
    """Test inserting a simple event with short_description"""
    print("🧪 Testing simple event insert with short_description...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        try:
            # Test insert
            insert_query = """
                INSERT INTO events (
                    title, description, short_description, date, start_time, 
                    category, address, lat, lng, created_by
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            """
            
            values = (
                "Test Event",
                "This is a test event description that is longer than 160 characters to check if short description works properly. " +
                "We want to see if the database accepts the short_description field without any issues.",
                "This is a short description for testing.",
                "2025-06-15",
                "10:00",
                "community",
                "123 Test St, Test City, MI",
                42.0,
                -83.0,
                1  # assuming user 1 exists
            )
            
            cursor.execute(insert_query, values)
            event_id = cursor.lastrowid
            
            # Verify the insert
            cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
            event = cursor.fetchone()
            
            if event:
                print(f"✅ Event inserted successfully with ID: {event_id}")
                print(f"   Title: {event['title']}")
                print(f"   Description: {event['description'][:50]}...")
                print(f"   Short Description: {event['short_description']}")
                
                # Clean up
                cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
                conn.commit()
                print("🧹 Test event cleaned up")
                
                return True
            else:
                print("❌ Event not found after insert")
                return False
                
        except Exception as e:
            print(f"❌ Insert failed: {e}")
            return False

def check_schema_again():
    """Double-check the schema"""
    print("\n🔍 Double-checking events table schema...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(events)")
        columns = cursor.fetchall()
        
        short_desc_exists = any(col[1] == 'short_description' for col in columns)
        print(f"short_description column exists: {short_desc_exists}")
        
        if short_desc_exists:
            # Check for any existing events with short_description
            cursor.execute("SELECT COUNT(*) FROM events WHERE short_description IS NOT NULL")
            count = cursor.fetchone()[0]
            print(f"Events with short_description: {count}")

def main():
    """Main function"""
    check_schema_again()
    test_simple_insert()

if __name__ == "__main__":
    main() 