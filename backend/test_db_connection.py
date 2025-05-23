#!/usr/bin/env python3
"""
Database connection test script
"""
import os
import time
import psycopg2
from psycopg2.extras import RealDictCursor

# Database URL from environment or hardcoded for testing
DB_URL = os.getenv("DATABASE_URL", "postgresql://eventfinder_user:J6euBSG7jS6U0aPZxMjy5CfuUnOAhjj8@dpg-d0bs2huuk2gs7383mnu0-a.oregon-postgres.render.com/eventfinder")

def test_connection():
    """Test connection to PostgreSQL database"""
    print(f"Testing connection to database...")
    print(f"Database URL: {DB_URL[:20]}{'*' * 20}")
    
    start_time = time.time()
    
    try:
        # Connect with timeout
        conn = psycopg2.connect(
            DB_URL,
            cursor_factory=RealDictCursor,
            connect_timeout=10
        )
        
        # Test a simple query
        with conn.cursor() as cur:
            cur.execute("SELECT 1 as test")
            result = cur.fetchone()
            
            # Test users table existence
            cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')")
            users_exists = cur.fetchone()['exists']
            
            # If users table exists, count rows
            if users_exists:
                cur.execute("SELECT COUNT(*) as user_count FROM users")
                user_count = cur.fetchone()['user_count']
            else:
                user_count = "N/A"
        
        # Close connection
        conn.close()
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Print results
        print("\n✅ Connection successful!")
        print(f"Query result: {result['test']}")
        print(f"Users table exists: {users_exists}")
        print(f"User count: {user_count}")
        print(f"Connection time: {duration:.2f} seconds")
        
        return True
        
    except Exception as e:
        end_time = time.time()
        duration = end_time - start_time
        
        print("\n❌ Connection failed!")
        print(f"Error: {str(e)}")
        print(f"Time elapsed: {duration:.2f} seconds")
        
        return False

if __name__ == "__main__":
    test_connection() 