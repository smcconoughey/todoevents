#!/usr/bin/env python3

import os
import sys
import sqlite3
import logging
from contextlib import contextmanager

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def sanitize_ux_field(value):
    """Convert None to empty string for UX fields to avoid NULLs in DB."""
    logger.info(f"sanitize_ux_field called with: {value!r} (type: {type(value)})")
    result = value if value is not None else ""
    logger.info(f"sanitize_ux_field returning: {result!r} (type: {type(result)})")
    return result

@contextmanager
def get_db():
    """Get database connection"""
    conn = sqlite3.connect('events.db')
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def test_ux_fields_insertion():
    """Test manual insertion of UX fields"""
    print("Testing UX fields insertion...")
    
    # Test values
    test_values = [
        {
            'title': 'UX Test Event 1',
            'description': 'Test event for UX fields',
            'fee_required': 'Free',
            'event_url': 'https://example.com',
            'host_name': 'Test Host'
        },
        {
            'title': 'UX Test Event 2',
            'description': 'Test event with None values',
            'fee_required': None,
            'event_url': None,
            'host_name': None
        },
        {
            'title': 'UX Test Event 3',
            'description': 'Test event with empty strings',
            'fee_required': '',
            'event_url': '',
            'host_name': ''
        }
    ]
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        for i, test_data in enumerate(test_values):
            print(f"\n--- Test {i+1}: {test_data['title']} ---")
            
            # Log original values
            logger.info(f"Original values:")
            logger.info(f"  fee_required: {test_data['fee_required']!r}")
            logger.info(f"  event_url: {test_data['event_url']!r}")
            logger.info(f"  host_name: {test_data['host_name']!r}")
            
            # Apply sanitizer
            sanitized_fee = sanitize_ux_field(test_data['fee_required'])
            sanitized_url = sanitize_ux_field(test_data['event_url'])
            sanitized_host = sanitize_ux_field(test_data['host_name'])
            
            # Insert into database
            insert_query = """
                INSERT INTO events (
                    title, description, date, start_time, category,
                    address, lat, lng, created_by,
                    fee_required, event_url, host_name,
                    interest_count, view_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            values = (
                test_data['title'],
                test_data['description'],
                '2024-12-31',  # date
                '12:00',       # start_time
                'community',   # category
                'Test Address',# address
                37.7749,       # lat
                -122.4194,     # lng
                1,             # created_by (assuming user ID 1 exists)
                sanitized_fee,
                sanitized_url,
                sanitized_host,
                0,             # interest_count
                0              # view_count
            )
            
            logger.info(f"Final insert values (UX fields): {values[-5:-2]}")
            
            cursor.execute(insert_query, values)
            event_id = cursor.lastrowid
            conn.commit()
            
            # Fetch back the inserted event
            cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
            event_data = cursor.fetchone()
            
            if event_data:
                event_dict = dict(event_data)
                logger.info(f"Fetched from DB:")
                logger.info(f"  DB fee_required: {event_dict.get('fee_required')!r}")
                logger.info(f"  DB event_url: {event_dict.get('event_url')!r}")
                logger.info(f"  DB host_name: {event_dict.get('host_name')!r}")
                
                print(f"✅ Event {event_id} created successfully")
                print(f"   fee_required: {event_dict.get('fee_required')}")
                print(f"   event_url: {event_dict.get('event_url')}")
                print(f"   host_name: {event_dict.get('host_name')}")
            else:
                print(f"❌ Failed to fetch event {event_id}")

def cleanup_test_events():
    """Clean up test events"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM events WHERE title LIKE 'UX Test Event%'")
        deleted_count = cursor.rowcount
        conn.commit()
        print(f"Cleaned up {deleted_count} test events")

if __name__ == "__main__":
    print("UX Fields Test Script")
    print("=====================")
    
    if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
        cleanup_test_events()
    else:
        test_ux_fields_insertion()
        print("\nTo cleanup test events, run: python test_ux_fields_simple.py cleanup") 