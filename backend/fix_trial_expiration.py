#!/usr/bin/env python3
"""
Script to fix trial expiration dates for users who have premium role but no expiration
"""

import os
import sys
from datetime import datetime, timedelta

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from shared_utils import get_db, get_placeholder, DB_URL, IS_PRODUCTION

def fix_user_trial_expiration(email, days=7):
    """Fix trial expiration for a specific user"""
    
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # First, check the user's current status
            c.execute(f"""
                SELECT id, email, role, premium_expires_at, premium_granted_by 
                FROM users 
                WHERE email = {placeholder}
            """, (email,))
            
            user = c.fetchone()
            
            if not user:
                print(f"❌ User {email} not found")
                return False
            
            # Handle different database return formats
            if isinstance(user, dict):
                user_id = user['id']
                current_role = user['role']
                current_expires = user.get('premium_expires_at')
                current_granted_by = user.get('premium_granted_by')
            else:
                user_id, email, current_role, current_expires, current_granted_by = user
            
            print(f"Found user: {email}")
            print(f"  ID: {user_id}")
            print(f"  Role: {current_role}")
            print(f"  Current expiration: {current_expires}")
            print(f"  Granted by: {current_granted_by}")
            
            # Check if this is the issue we're looking for
            if current_role == 'premium' and not current_expires:
                print(f"\n🎯 FIXING: Premium user with no expiration date")
                
                # Set trial expiration
                trial_expires = datetime.utcnow() + timedelta(days=days)
                granted_by = f"Trial Fix - {days}d trial from {datetime.utcnow().strftime('%Y-%m-%d')}"
                
                c.execute(f"""
                    UPDATE users 
                    SET premium_expires_at = {placeholder}, premium_granted_by = {placeholder}
                    WHERE id = {placeholder}
                """, (trial_expires.isoformat(), granted_by, user_id))
                
                conn.commit()
                
                print(f"✅ SUCCESS: Set trial expiration to {trial_expires.strftime('%Y-%m-%d %H:%M:%S')} UTC")
                print(f"✅ Trial will last {days} days from now")
                return True
                
            elif current_role == 'premium' and current_expires:
                print(f"\n✅ User already has trial expiration set")
                
                # Check if expired
                try:
                    if isinstance(current_expires, str):
                        exp_date = datetime.fromisoformat(current_expires.replace('Z', '+00:00'))
                    else:
                        exp_date = current_expires
                    
                    if exp_date < datetime.utcnow():
                        days_ago = (datetime.utcnow() - exp_date).days
                        print(f"⚠️  Trial expired {days_ago} days ago")
                    else:
                        days_remaining = (exp_date - datetime.utcnow()).days
                        print(f"✅ Trial active with {days_remaining} days remaining")
                        
                except Exception as e:
                    print(f"❌ Error parsing expiration date: {e}")
                
                return True
                
            elif current_role != 'premium':
                print(f"\nℹ️  User role is '{current_role}', not premium - no action needed")
                return True
            
            else:
                print(f"\n❓ Unexpected state - role: {current_role}, expires: {current_expires}")
                return False
                
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def list_problematic_users():
    """List users who have premium role but no expiration date"""
    
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Find premium users without expiration dates
            c.execute(f"""
                SELECT id, email, role, premium_expires_at, premium_granted_by 
                FROM users 
                WHERE role = 'premium' AND (premium_expires_at IS NULL OR premium_expires_at = '')
                ORDER BY id DESC
            """)
            
            problematic_users = c.fetchall()
            
            if not problematic_users:
                print("✅ No problematic users found (all premium users have expiration dates)")
                return []
            
            print(f"\n🚨 Found {len(problematic_users)} premium users WITHOUT expiration dates:")
            print("-" * 80)
            
            for user in problematic_users:
                if isinstance(user, dict):
                    print(f"ID: {user['id']:3} | {user['email']:30} | {user['role']:10} | No expiration")
                else:
                    user_id, email, role, expires_at, granted_by = user
                    print(f"ID: {user_id:3} | {email:30} | {role:10} | No expiration")
            
            return problematic_users
            
    except Exception as e:
        print(f"❌ Error listing users: {e}")
        return []

def main():
    print("=== TodoEvents Trial Expiration Fix Tool ===")
    print(f"Environment: {'Production' if IS_PRODUCTION else 'Development'}")
    print(f"Database: {'PostgreSQL' if DB_URL else 'SQLite'}")
    print()
    
    # List problematic users
    problematic_users = list_problematic_users()
    
    if not problematic_users:
        return
    
    # Ask if we should fix them
    print(f"\nOptions:")
    print(f"1. Fix specific user by email")
    print(f"2. Fix all problematic users")
    print(f"3. Exit")
    
    choice = input("\nChoice (1-3): ").strip()
    
    if choice == "1":
        email = input("Enter email to fix: ").strip()
        if email:
            days = input("Enter trial days (default 7): ").strip()
            days = int(days) if days.isdigit() else 7
            fix_user_trial_expiration(email, days)
    
    elif choice == "2":
        confirm = input(f"Fix all {len(problematic_users)} users with 7-day trials? (y/n): ").strip()
        if confirm.lower() == 'y':
            for user in problematic_users:
                if isinstance(user, dict):
                    email = user['email']
                else:
                    email = user[1]  # email is second column
                print(f"\nFixing {email}...")
                fix_user_trial_expiration(email, 7)
    
    else:
        print("Exiting...")

if __name__ == "__main__":
    main() 