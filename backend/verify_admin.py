#!/usr/bin/env python3
"""
Verify admin user credentials
"""
import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from passlib.context import CryptContext

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Get the database URL from environment or command line
DB_URL = os.getenv("DATABASE_URL")
if len(sys.argv) > 1:
    DB_URL = sys.argv[1]

if not DB_URL:
    print("No DATABASE_URL provided!")
    print("Please set DATABASE_URL environment variable or provide it as an argument")
    sys.exit(1)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# Connect to database
try:
    conn = psycopg2.connect(
        DB_URL,
        cursor_factory=RealDictCursor
    )
    
    with conn.cursor() as cur:
        # Find the admin user
        cur.execute("SELECT * FROM users WHERE email = 'admin@todoevents.com'")
        admin = cur.fetchone()
        
        if not admin:
            print("❌ Admin user not found!")
            # Create admin user
            print("Creating admin user...")
            admin_email = "admin@todoevents.com"
            admin_password = "Admin123!"
            hashed_password = pwd_context.hash(admin_password)
            
            cur.execute(
                "INSERT INTO users (email, hashed_password, role) VALUES (%s, %s, %s)",
                (admin_email, hashed_password, "admin")
            )
            conn.commit()
            print("✅ Admin user created")
            print(f"Email: {admin_email}")
            print(f"Password: {admin_password}")
            sys.exit(0)
        
        print("✅ Found admin user")
        print(f"Email: {admin['email']}")
        
        # Test password
        test_password = "Admin123!"
        if verify_password(test_password, admin["hashed_password"]):
            print(f"✅ Password verification successful for 'Admin123!'")
        else:
            print(f"❌ Password verification failed for 'Admin123!'")
            print("Storing password hash in database:", admin["hashed_password"])
            
            # Reset the admin password
            print("Resetting admin password...")
            new_password = "Admin123!"
            new_hashed_password = pwd_context.hash(new_password)
            
            cur.execute(
                "UPDATE users SET hashed_password = %s WHERE email = 'admin@todoevents.com'",
                (new_hashed_password,)
            )
            conn.commit()
            print("✅ Admin password reset to 'Admin123!'")
            
except Exception as e:
    print(f"❌ Error: {str(e)}")
finally:
    if 'conn' in locals():
        conn.close() 