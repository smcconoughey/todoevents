#!/usr/bin/env python3

import sqlite3

def cleanup_test_events():
    """Clean up any test events from the database"""
    try:
        conn = sqlite3.connect('events.db')
        cursor = conn.cursor()
        
        # Delete events with test-related titles
        cursor.execute('''
            DELETE FROM events 
            WHERE LOWER(title) LIKE '%test%' 
            OR LOWER(title) LIKE '%duplicate%'
            OR LOWER(title) LIKE '%concurrent%'
        ''')
        
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        
        print(f'✅ Deleted {deleted} test events from database')
        return deleted
        
    except Exception as e:
        print(f'❌ Error cleaning up test events: {e}')
        return 0

if __name__ == "__main__":
    cleanup_test_events() 