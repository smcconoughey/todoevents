#!/usr/bin/env python3

import sqlite3
import bcrypt
import os

def create_test_admin():
    """Create a test admin user with known credentials"""
    
    # Test admin credentials
    email = "test-admin@todo-events.com"
    password = "TestAdmin123!"
    
    # Connect to the SQLite database
    db_path = "events.db"
    if not os.path.exists(db_path):
        print(f"❌ Database file {db_path} not found")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if user already exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        existing_user = cursor.fetchone()
        
        if existing_user:
            print(f"✅ Test admin user already exists: {email}")
            return
        
        # Hash the password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Insert new admin user
        cursor.execute(
            "INSERT INTO users (email, hashed_password, role) VALUES (?, ?, ?)",
            (email, hashed_password, "admin")
        )
        conn.commit()
        
        print(f"✅ Test admin user created!")
        print(f"   📧 Email: {email}")
        print(f"   🔑 Password: {password}")
        print("   ⚠️ This is for testing only!")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error creating test admin user: {e}")

if __name__ == "__main__":
    create_test_admin() 