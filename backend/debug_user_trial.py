#!/usr/bin/env python3
"""
Debug script to check and fix trial expiration dates for users
"""

import sqlite3
import os
from datetime import datetime, timedelta

def check_and_fix_user_trial(email):
    """Check if a user has proper trial expiration and fix if needed"""
    
    # Connect to local database
    conn = sqlite3.connect('events.db')
    c = conn.cursor()
    
    try:
        # Check if user exists and their current status
        c.execute("""
            SELECT id, email, role, premium_expires_at, premium_granted_by 
            FROM users 
            WHERE email = ?
        """, (email,))
        
        user = c.fetchone()
        
        if not user:
            print(f"User {email} not found in local database")
            return False
        
        user_id, email, role, expires_at, granted_by = user
        
        print(f"User found:")
        print(f"  ID: {user_id}")
        print(f"  Email: {email}")
        print(f"  Role: {role}")
        print(f"  Premium expires: {expires_at}")
        print(f"  Granted by: {granted_by}")
        
        # If user is premium but has no expiration date, this is the issue
        if role == 'premium' and not expires_at:
            print(f"\n🚨 ISSUE FOUND: User {email} has premium role but no expiration date!")
            
            # Ask if we should fix it
            response = input("Fix by setting 7-day trial expiration? (y/n): ")
            if response.lower() == 'y':
                # Set 7-day trial from now
                trial_expires = datetime.utcnow() + timedelta(days=7)
                trial_granted_by = "Manual Trial Fix"
                
                c.execute("""
                    UPDATE users 
                    SET premium_expires_at = ?, premium_granted_by = ?
                    WHERE id = ?
                """, (trial_expires.isoformat(), trial_granted_by, user_id))
                
                conn.commit()
                print(f"✅ Fixed! Set trial expiration to: {trial_expires.isoformat()}")
                return True
            else:
                print("No changes made")
                return False
        
        elif role == 'premium' and expires_at:
            # Check if expired
            try:
                exp_date = datetime.fromisoformat(expires_at.replace('Z', '+00:00')) if 'Z' in expires_at else datetime.fromisoformat(expires_at)
                if exp_date < datetime.utcnow():
                    print(f"\n⚠️  Trial has expired: {exp_date}")
                else:
                    days_remaining = (exp_date - datetime.utcnow()).days
                    print(f"\n✅ Trial is active with {days_remaining} days remaining")
            except Exception as e:
                print(f"\n❌ Error parsing expiration date: {e}")
                
        elif role != 'premium':
            print(f"\nℹ️  User has role '{role}', not premium")
            
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    finally:
        conn.close()

def list_premium_users():
    """List all premium users and their trial status"""
    conn = sqlite3.connect('events.db')
    c = conn.cursor()
    
    try:
        c.execute("""
            SELECT id, email, role, premium_expires_at, premium_granted_by 
            FROM users 
            WHERE role IN ('premium', 'admin', 'enterprise')
            ORDER BY id DESC
        """)
        
        users = c.fetchall()
        
        if not users:
            print("No premium users found")
            return
        
        print("\nPremium Users:")
        print("-" * 80)
        for user_id, email, role, expires_at, granted_by in users:
            status = "No expiration" if not expires_at else expires_at
            print(f"ID: {user_id:3} | {email:30} | {role:10} | {status}")
        
    except Exception as e:
        print(f"Error listing users: {e}")
    finally:
        conn.close()

def main():
    print("=== TodoEvents Trial Debug Tool ===\n")
    
    # List current premium users
    list_premium_users()
    
    # Check specific user
    email = input("\nEnter email to check (or press Enter to skip): ").strip()
    if email:
        check_and_fix_user_trial(email)

if __name__ == "__main__":
    main() 