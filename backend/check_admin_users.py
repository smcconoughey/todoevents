#!/usr/bin/env python3

import sqlite3
import os

def check_admin_users():
    """Check existing admin users in the database"""
    
    # Connect to the SQLite database
    db_path = "events.db"
    if not os.path.exists(db_path):
        print(f"❌ Database file {db_path} not found")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all admin users
        cursor.execute("SELECT id, email, role FROM users WHERE role = 'admin'")
        admin_users = cursor.fetchall()
        
        print(f"Found {len(admin_users)} admin users:")
        for user_id, email, role in admin_users:
            print(f"  - ID: {user_id}, Email: {email}, Role: {role}")
            
        if not admin_users:
            print("❌ No admin users found!")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error checking admin users: {e}")

if __name__ == "__main__":
    check_admin_users() 