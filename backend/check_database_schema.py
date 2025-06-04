#!/usr/bin/env python3
"""
Check database schema and identify missing columns
"""

import sqlite3
import os
from contextlib import contextmanager

@contextmanager
def get_db():
    """Get database connection"""
    conn = sqlite3.connect('events.db')
    try:
        yield conn
    finally:
        conn.close()

def check_events_table_schema():
    """Check the current events table schema"""
    print("🔍 Checking events table schema...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get current table info
        cursor.execute("PRAGMA table_info(events)")
        current_columns = cursor.fetchall()
        
        print(f"\nCurrent events table has {len(current_columns)} columns:")
        for col in current_columns:
            print(f"  {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'} {'DEFAULT ' + str(col[4]) if col[4] else ''}")
        
        # Expected columns from the backend code
        expected_columns = [
            'id', 'title', 'description', 'short_description', 'date', 'start_time', 
            'end_time', 'end_date', 'category', 'address', 'city', 'state', 'country',
            'lat', 'lng', 'recurring', 'frequency', 'fee_required', 'price', 'currency',
            'event_url', 'host_name', 'organizer_url', 'slug', 'is_published',
            'start_datetime', 'end_datetime', 'updated_at', 'created_at', 'created_by',
            'interest_count', 'view_count'
        ]
        
        current_column_names = [col[1] for col in current_columns]
        missing_columns = [col for col in expected_columns if col not in current_column_names]
        
        if missing_columns:
            print(f"\n❌ Missing columns ({len(missing_columns)}):")
            for col in missing_columns:
                print(f"  {col}")
        else:
            print("\n✅ All expected columns are present")
        
        return missing_columns

def main():
    """Main function"""
    missing_columns = check_events_table_schema()
    
    if missing_columns:
        print(f"\n💡 Need to add {len(missing_columns)} missing columns to the events table")
        print("Run the migration script to add these columns.")
    else:
        print("\n🎉 Database schema is up to date!")

if __name__ == "__main__":
    main() 