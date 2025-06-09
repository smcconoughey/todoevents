#!/usr/bin/env python3

import os
import sys
from datetime import datetime
import psycopg2
from contextlib import contextmanager

# Database connection
DB_URL = os.getenv('DATABASE_URL')

@contextmanager
def get_db():
    if DB_URL:
        # Production PostgreSQL
        conn = psycopg2.connect(DB_URL)
        try:
            yield conn
        finally:
            conn.close()
    else:
        print("No DATABASE_URL found")
        sys.exit(1)

def test_page_visits():
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'page_visits'
                )
            """)
            table_exists = cursor.fetchone()[0]
            print(f"Table exists: {table_exists}")
            
            if not table_exists:
                print("Creating page_visits table...")
                cursor.execute("""
                    CREATE TABLE page_visits (
                        id SERIAL PRIMARY KEY,
                        page_type VARCHAR(100) NOT NULL,
                        page_path TEXT NOT NULL,
                        user_id INTEGER,
                        browser_fingerprint TEXT NOT NULL DEFAULT 'anonymous',
                        visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                conn.commit()
                print("Table created successfully")
            
            # Test insert
            print("Testing insert...")
            cursor.execute("""
                INSERT INTO page_visits (page_type, page_path, user_id, browser_fingerprint, visited_at)
                VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
            """, ('test_script', '/test-script', None, 'test-fingerprint'))
            
            conn.commit()
            print("Insert successful")
            
            # Check count
            cursor.execute("SELECT COUNT(*) FROM page_visits")
            count = cursor.fetchone()[0]
            print(f"Total page visits: {count}")
            
            # Get recent visits
            cursor.execute("SELECT * FROM page_visits ORDER BY visited_at DESC LIMIT 3")
            visits = cursor.fetchall()
            print(f"Recent visits:")
            for visit in visits:
                print(f"  {visit}")
                
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_page_visits() 