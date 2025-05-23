#!/usr/bin/env python3
"""
Database verification and repair script for todoevents backend
"""
import os
import sys
import time
import psycopg2
from psycopg2.extras import RealDictCursor

# Get the database URL from environment or use the provided URL
DB_URL = os.getenv("DATABASE_URL", "postgresql://todoevents_user:todoevents@localhost/todoevents")
if len(sys.argv) > 1:
    DB_URL = sys.argv[1]

# Check tables required for the app
REQUIRED_TABLES = ["users", "events", "activity_logs"]

def check_connection():
    """Test basic connectivity to the database"""
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
        
        conn.close()
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"\n✅ Connection successful!")
        print(f"Query result: {result['test']}")
        print(f"Connection time: {duration:.2f} seconds")
        
        return True
        
    except Exception as e:
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"\n❌ Connection failed!")
        print(f"Error: {str(e)}")
        print(f"Time elapsed: {duration:.2f} seconds")
        
        return False

def check_tables():
    """Check if required tables exist, and create them if they don't"""
    print("\nChecking required tables...")
    
    try:
        conn = psycopg2.connect(
            DB_URL,
            cursor_factory=RealDictCursor
        )
        conn.autocommit = True
        
        # Check for each required table
        missing_tables = []
        with conn.cursor() as cur:
            for table in REQUIRED_TABLES:
                cur.execute(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}')")
                if not cur.fetchone()['exists']:
                    missing_tables.append(table)
        
        if not missing_tables:
            print("✅ All required tables exist.")
            
            # Count rows in the users table
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) as user_count FROM users")
                user_count = cur.fetchone()['user_count']
                print(f"Users in database: {user_count}")
                
            return True
        
        # Create missing tables
        print(f"❌ Missing tables: {', '.join(missing_tables)}")
        print("Creating missing tables...")
        
        with conn.cursor() as cur:
            # Create users table if missing
            if "users" in missing_tables:
                cur.execute('''
                    CREATE TABLE users (
                        id SERIAL PRIMARY KEY,
                        email TEXT UNIQUE NOT NULL,
                        hashed_password TEXT NOT NULL,
                        role TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                print("Created users table")
            
            # Create events table if missing
            if "events" in missing_tables:
                cur.execute('''
                    CREATE TABLE events (
                        id SERIAL PRIMARY KEY,
                        title TEXT NOT NULL,
                        description TEXT NOT NULL,
                        date TEXT NOT NULL,
                        time TEXT NOT NULL,
                        category TEXT NOT NULL,
                        address TEXT NOT NULL,
                        lat REAL NOT NULL,
                        lng REAL NOT NULL,
                        recurring BOOLEAN NOT NULL DEFAULT FALSE,
                        frequency TEXT,
                        end_date TEXT,
                        created_by INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(created_by) REFERENCES users(id)
                    )
                ''')
                print("Created events table")
            
            # Create activity_logs table if missing
            if "activity_logs" in missing_tables:
                cur.execute('''
                    CREATE TABLE activity_logs (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER,
                        action TEXT NOT NULL,
                        details TEXT,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(user_id) REFERENCES users(id)
                    )
                ''')
                print("Created activity_logs table")
        
        print("✅ All missing tables have been created")
        return True
        
    except Exception as e:
        print(f"❌ Error checking/creating tables: {str(e)}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

def create_admin_user():
    """Create an admin user if no users exist"""
    try:
        conn = psycopg2.connect(
            DB_URL,
            cursor_factory=RealDictCursor
        )
        conn.autocommit = True
        
        # Check if any users exist
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as user_count FROM users")
            user_count = cur.fetchone()['user_count']
            
            if user_count > 0:
                print("\n✅ Users already exist in the database")
                return True
            
            # No users exist, create an admin
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            
            admin_email = "admin@todoevents.com"
            admin_password = "Admin123!"  # Would be better to generate this
            hashed_password = pwd_context.hash(admin_password)
            
            cur.execute(
                "INSERT INTO users (email, hashed_password, role) VALUES (%s, %s, %s)",
                (admin_email, hashed_password, "admin")
            )
            
            print("\n✅ Created admin user")
            print(f"Email: {admin_email}")
            print(f"Password: {admin_password}")
            print("IMPORTANT: Change this password after first login!")
            
            return True
    except Exception as e:
        print(f"\n❌ Error creating admin user: {str(e)}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    print("=" * 50)
    print(" DATABASE VERIFICATION AND REPAIR")
    print("=" * 50)
    
    # Step 1: Test connection
    if not check_connection():
        print("\nFailed to connect to the database. Please check the URL and credentials.")
        sys.exit(1)
    
    # Step 2: Check and create tables
    if not check_tables():
        print("\nFailed to verify/create tables. Please check database permissions.")
        sys.exit(1)
    
    # Step 3: Create admin user if needed
    create_admin_user()
    
    print("\n" + "=" * 50)
    print(" DATABASE VERIFICATION COMPLETE")
    print("=" * 50) 