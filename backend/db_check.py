#!/usr/bin/env python3
"""
Database connectivity test script for EventFinder app.
This script tests connectivity to the Postgres database on Render.com.
"""

import os
import sys
import time
import logging
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('db-check')

# Load environment variables
load_dotenv()
DB_URL = os.getenv("DATABASE_URL")

if not DB_URL:
    logger.error("DATABASE_URL environment variable not set")
    sys.exit(1)

def test_postgresql_connection():
    """Test PostgreSQL connection with retry logic"""
    import psycopg2
    from psycopg2.extras import RealDictCursor
    
    retry_count = 5
    connection_params = {
        "connect_timeout": 30,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5
    }
    
    logger.info(f"Testing connection to PostgreSQL database...")
    
    for attempt in range(retry_count):
        try:
            logger.info(f"Connection attempt {attempt+1}/{retry_count}")
            
            start_time = time.time()
            conn = psycopg2.connect(
                DB_URL, 
                cursor_factory=RealDictCursor,
                **connection_params
            )
            conn.autocommit = True
            
            # Test the connection with a query
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                assert result[0] == 1, "Query result is incorrect"
            
            end_time = time.time()
            conn.close()
            
            logger.info(f"Connection successful! Response time: {(end_time - start_time)*1000:.2f}ms")
            return True
            
        except Exception as e:
            logger.error(f"Connection attempt {attempt+1} failed: {str(e)}")
            
            if attempt < retry_count - 1:
                wait_time = 2 ** attempt
                logger.info(f"Waiting {wait_time}s before next attempt...")
                time.sleep(wait_time)
            else:
                logger.error("All connection attempts failed")
                return False

def test_tables():
    """Test that tables exist in the database"""
    import psycopg2
    from psycopg2.extras import RealDictCursor
    
    try:
        conn = psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)
        conn.autocommit = True
        
        with conn.cursor() as cursor:
            # Check users table
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'users'
                )
            """)
            users_exists = cursor.fetchone()[0]
            
            # Check events table
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'events'
                )
            """)
            events_exists = cursor.fetchone()[0]
            
            # Get row counts
            if users_exists:
                cursor.execute("SELECT COUNT(*) FROM users")
                users_count = cursor.fetchone()[0]
            else:
                users_count = 0
                
            if events_exists:
                cursor.execute("SELECT COUNT(*) FROM events")
                events_count = cursor.fetchone()[0]
            else:
                events_count = 0
        
        conn.close()
        
        logger.info(f"Tables check: users table exists: {users_exists} ({users_count} rows)")
        logger.info(f"Tables check: events table exists: {events_exists} ({events_count} rows)")
        
        return {
            "users_exists": users_exists,
            "events_exists": events_exists,
            "users_count": users_count,
            "events_count": events_count
        }
        
    except Exception as e:
        logger.error(f"Tables check failed: {str(e)}")
        return None

def test_registration():
    """Test user registration flow with the database"""
    import psycopg2
    from psycopg2.extras import RealDictCursor
    import hashlib
    import uuid
    
    # Generate a unique test email
    test_uuid = uuid.uuid4().hex[:8]
    test_email = f"test.{test_uuid}@example.com"
    test_password = "Test_Password_123!"
    
    try:
        conn = psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)
        conn.autocommit = True
        
        logger.info(f"Testing registration with email: {test_email}")
        
        with conn.cursor() as cursor:
            # Check if email exists (shouldn't)
            cursor.execute("SELECT id FROM users WHERE email = %s", (test_email,))
            existing_user = cursor.fetchone()
            
            if existing_user:
                logger.warning(f"Test email already exists in database: {test_email}")
                return False
            
            # Insert test user (with simple hash instead of bcrypt for testing)
            simple_hash = hashlib.sha256(test_password.encode()).hexdigest()
            
            start_time = time.time()
            cursor.execute(
                "INSERT INTO users (email, hashed_password, role) VALUES (%s, %s, %s)",
                (test_email, simple_hash, "user")
            )
            end_time = time.time()
            
            # Verify user was created
            cursor.execute("SELECT id FROM users WHERE email = %s", (test_email,))
            created_user = cursor.fetchone()
            
            # Clean up - delete test user
            if created_user:
                cursor.execute("DELETE FROM users WHERE id = %s", (created_user['id'],))
                logger.info(f"Test user created and deleted successfully")
            else:
                logger.error(f"Failed to create test user")
                return False
        
        conn.close()
        
        logger.info(f"Registration test successful! Insert time: {(end_time - start_time)*1000:.2f}ms")
        return True
        
    except Exception as e:
        logger.error(f"Registration test failed: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("Starting database connectivity tests...")
    
    # Test basic connectivity
    if not test_postgresql_connection():
        logger.error("Basic connectivity test failed, exiting")
        sys.exit(1)
    
    # Test tables existence
    tables_info = test_tables()
    if not tables_info:
        logger.error("Tables check failed, exiting")
        sys.exit(1)
    
    # Test registration flow
    if not test_registration():
        logger.error("Registration flow test failed")
    else:
        logger.info("All tests completed successfully!") 