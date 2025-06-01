#!/usr/bin/env python3

import sqlite3
import sys
from datetime import datetime

def check_duplicates():
    """Check for duplicate events in the database"""
    try:
        conn = sqlite3.connect('events.db')
        cursor = conn.cursor()

        # Find duplicate events based on title, date, start_time, lat, lng, and category
        query = '''
        SELECT title, date, start_time, lat, lng, category, COUNT(*) as count, GROUP_CONCAT(id) as ids
        FROM events 
        GROUP BY title, date, start_time, lat, lng, category 
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        '''

        cursor.execute(query)
        duplicates = cursor.fetchall()

        print(f'Found {len(duplicates)} groups of duplicate events:')
        print('-' * 80)
        
        total_duplicates = 0
        for dup in duplicates:
            title, date, start_time, lat, lng, category, count, ids = dup
            print(f'Title: "{title}"')
            print(f'Category: {category}')
            print(f'Date: {date} at {start_time}')
            print(f'Location: {lat}, {lng}')
            print(f'Copies: {count} (IDs: {ids})')
            print('-' * 40)
            total_duplicates += count - 1  # subtract 1 to get actual duplicates

        # Show total event count
        cursor.execute('SELECT COUNT(*) FROM events')
        total = cursor.fetchone()[0]
        print(f'\nTotal events in database: {total}')
        print(f'Total duplicate events that can be removed: {total_duplicates}')
        print(f'Events after deduplication: {total - total_duplicates}')

        conn.close()
        return duplicates

    except Exception as e:
        print(f"Error checking duplicates: {e}")
        return []

if __name__ == "__main__":
    check_duplicates() 