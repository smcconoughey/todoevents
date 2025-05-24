#!/usr/bin/env python3
"""
Database verification and repair script for todoevents backend
Run automatically during container startup on Render
"""
import os
import sys
import time
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('db_setup')

# Get the database URL from environment or command line
DB_URL = os.getenv("DATABASE_URL")
if len(sys.argv) > 1:
    DB_URL = sys.argv[1]

# Check if DB_URL is set
if not DB_URL:
    logger.error("No DATABASE_URL provided!")
    logger.error("Please set DATABASE_URL environment variable or provide it as an argument")
    sys.exit(1)

# Check tables required for the app
REQUIRED_TABLES = ["users", "events", "activity_logs"]

def check_connection():
    """Test basic connectivity to the database"""
    logger.info("Testing connection to database...")
    if DB_URL.startswith("postgresql://"):
        # Only show first part for security
        parts = DB_URL.split("@")
        if len(parts) > 1:
            masked_url = f"{parts[0].split('://')[0]}://****@{parts[1]}"
            logger.info(f"Database URL: {masked_url}")
        else:
            logger.info(f"Database URL: {DB_URL[:20]}{'*' * 20}")
    else:
        logger.info(f"Database URL: {DB_URL[:20]}{'*' * 20}")
    
    start_time = time.time()
    
    # Try up to 5 times with increasing backoff
    max_retries = 5
    retry_delays = [2, 5, 10, 15, 30]  # seconds
    
    for attempt in range(max_retries):
        try:
            # Connect with timeout
            conn = psycopg2.connect(
                DB_URL,
                cursor_factory=RealDictCursor,
                connect_timeout=20  # Increased timeout for slow connections
            )
            
            # Test a simple query
            with conn.cursor() as cur:
                cur.execute("SELECT 1 as test")
                result = cur.fetchone()
            
            conn.close()
            
            end_time = time.time()
            duration = end_time - start_time
            
            logger.info(f"Connection successful! Query result: {result['test']}")
            logger.info(f"Connection time: {duration:.2f} seconds")
            
            return True
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Connection attempt {attempt+1}/{max_retries} failed: {error_msg}")
            
            if attempt < max_retries - 1:
                delay = retry_delays[attempt]
                logger.info(f"Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                logger.error("All connection attempts failed")
                return False

def check_tables():
    """Check if required tables exist, and create them if they don't"""
    logger.info("Checking required tables...")
    
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
            logger.info("All required tables exist.")
            
            # Count rows in the users table
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) as user_count FROM users")
                user_count = cur.fetchone()['user_count']
                logger.info(f"Users in database: {user_count}")
                
            return True
        
        # Create missing tables
        logger.info(f"Missing tables: {', '.join(missing_tables)}")
        logger.info("Creating missing tables...")
        
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
                logger.info("Created users table")
            
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
                logger.info("Created events table")
            
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
                logger.info("Created activity_logs table")
        
        logger.info("All missing tables have been created")
        return True
        
    except Exception as e:
        logger.error(f"Error checking/creating tables: {str(e)}")
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
                # Check specifically for admin user
                cur.execute("SELECT * FROM users WHERE email = 'admin@todoevents.com'")
                admin = cur.fetchone()
                if admin:
                    logger.info("Admin user already exists")
                    # Test the admin password in a try block
                    try:
                        from passlib.context import CryptContext
                        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
                        test_password = "Admin123!"
                        if pwd_context.verify(test_password, admin["hashed_password"]):
                            logger.info("Admin password verification successful")
                        else:
                            logger.warning("Admin password verification failed, resetting password")
                            # Reset password
                            new_hashed_password = pwd_context.hash(test_password)
                            cur.execute(
                                "UPDATE users SET hashed_password = %s WHERE email = 'admin@todoevents.com'",
                                (new_hashed_password,)
                            )
                            logger.info("Admin password has been reset to 'Admin123!'")
                    except Exception as e:
                        logger.error(f"Error verifying admin password: {str(e)}")
                        # Force reset password due to error
                        try:
                            # Use direct bcrypt import as a fallback
                            import bcrypt
                            salt = bcrypt.gensalt()
                            hashed = bcrypt.hashpw("Admin123!".encode('utf-8'), salt).decode('utf-8')
                            cur.execute(
                                "UPDATE users SET hashed_password = %s WHERE email = 'admin@todoevents.com'",
                                (hashed,)
                            )
                            logger.info("Admin password has been forcibly reset using direct bcrypt")
                        except Exception as e:
                            logger.error(f"Failed to reset admin password: {str(e)}")
                else:
                    logger.info("Users exist but no admin user found, creating one")
                    # Create admin user with direct bcrypt to avoid passlib errors
                    try:
                        import bcrypt
                        salt = bcrypt.gensalt()
                        hashed = bcrypt.hashpw("Admin123!".encode('utf-8'), salt).decode('utf-8')
                        cur.execute(
                            "INSERT INTO users (email, hashed_password, role) VALUES (%s, %s, %s)",
                            ("admin@todoevents.com", hashed, "admin")
                        )
                        logger.info("Created admin user with direct bcrypt")
                        logger.info("Email: admin@todoevents.com")
                        logger.info("Password: Admin123!")
                    except Exception as e:
                        logger.error(f"Failed to create admin user: {str(e)}")
                return True
            
            # No users exist, create an admin 
            logger.info("No users found, creating admin user")
            try:
                # Try with passlib first
                try:
                    from passlib.context import CryptContext
                    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
                    admin_email = "admin@todoevents.com"
                    admin_password = "Admin123!"
                    hashed_password = pwd_context.hash(admin_password)
                except Exception as e:
                    logger.error(f"Error with passlib: {str(e)}")
                    # Fallback to direct bcrypt
                    import bcrypt
                    salt = bcrypt.gensalt()
                    hashed_password = bcrypt.hashpw("Admin123!".encode('utf-8'), salt).decode('utf-8')
                
                cur.execute(
                    "INSERT INTO users (email, hashed_password, role) VALUES (%s, %s, %s)",
                    ("admin@todoevents.com", hashed_password, "admin")
                )
                
                logger.info("Created admin user")
                logger.info("Email: admin@todoevents.com")
                logger.info("Password: Admin123!")
            except Exception as e:
                logger.error(f"Failed to create admin user: {str(e)}")
                return False
            
            return True
    except Exception as e:
        logger.error(f"Error creating admin user: {str(e)}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    logger.info("DATABASE VERIFICATION AND REPAIR")
    
    # Step 1: Test connection
    if not check_connection():
        logger.error("Failed to connect to the database. Please check the URL and credentials.")
        # Don't exit with error - allow server to start anyway
        # This prevents the container from crashing on deployment
    
    # Step 2: Check and create tables
    if not check_tables():
        logger.error("Failed to verify/create tables. Please check database permissions.")
        # Don't exit with error - allow server to start anyway
    
    # Step 3: Create admin user if needed
    create_admin_user()
    
    logger.info("DATABASE VERIFICATION COMPLETE") 