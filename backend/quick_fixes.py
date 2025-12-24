#!/usr/bin/env python3
"""
Quick fixes for TodoEvents issues:
1. Fix premium users with no expiration date
2. Clean up event media data to prevent foreign key constraint violations
"""

import sys
import os
import logging
from datetime import datetime, timedelta
from typing import Optional

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from shared_utils import get_db, get_placeholder

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_premium_expiration(user_id: int, trial_months: int = 1) -> bool:
    """Fix premium user who has no expiration date set"""
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Get user info
            c.execute(f"SELECT email, role, premium_expires_at FROM users WHERE id = {placeholder}", (user_id,))
            user = c.fetchone()
            
            if not user:
                logger.error(f"User {user_id} not found")
                return False
            
            if user['role'] not in ['premium', 'admin']:
                logger.error(f"User {user['email']} is not premium (role: {user['role']})")
                return False
            
            # Calculate expiration date (trial_months from now)
            expiration_date = datetime.utcnow() + timedelta(days=30 * trial_months)
            
            # Update the user's expiration date
            c.execute(f"""
                UPDATE users 
                SET premium_expires_at = {placeholder}
                WHERE id = {placeholder}
            """, (expiration_date.isoformat(), user_id))
            
            conn.commit()
            
            logger.info(f"✅ Fixed premium expiration for {user['email']} (ID: {user_id})")
            logger.info(f"   New expiration: {expiration_date.isoformat()}")
            logger.info(f"   Trial months: {trial_months}")
            
            return True
            
    except Exception as e:
        logger.error(f"Error fixing premium expiration: {str(e)}")
        return False

def cleanup_event_media(event_id: int) -> bool:
    """Clean up media audit logs and forensic data for an event to allow deletion"""
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Delete media audit logs
            c.execute(f"DELETE FROM media_audit_logs WHERE event_id = {placeholder}", (event_id,))
            deleted_audit_logs = c.rowcount
            
            # Delete media forensic data
            c.execute(f"DELETE FROM media_forensic_data WHERE event_id = {placeholder}", (event_id,))
            deleted_forensic_data = c.rowcount
            
            conn.commit()
            
            logger.info(f"✅ Media cleanup completed for event {event_id}")
            logger.info(f"   Deleted audit logs: {deleted_audit_logs}")
            logger.info(f"   Deleted forensic data: {deleted_forensic_data}")
            
            return True
            
    except Exception as e:
        logger.error(f"Error cleaning up event media: {str(e)}")
        return False

def fix_cdolan_premium():
    """Fix the specific user cdolan0407@gmail.com (ID: 7) premium expiration"""
    logger.info("🔧 Fixing cdolan0407@gmail.com premium expiration...")
    return fix_premium_expiration(7, trial_months=1)

def cleanup_problem_event():
    """Clean up the specific event (1441) that was causing deletion issues"""
    logger.info("🧹 Cleaning up event 1441 media data...")
    return cleanup_event_media(1441)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python quick_fixes.py fix-premium <user_id> [months]")
        print("  python quick_fixes.py cleanup-event <event_id>")
        print("  python quick_fixes.py fix-cdolan")
        print("  python quick_fixes.py cleanup-1441")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "fix-premium":
        if len(sys.argv) < 3:
            print("Please provide user_id")
            sys.exit(1)
        user_id = int(sys.argv[2])
        months = int(sys.argv[3]) if len(sys.argv) > 3 else 1
        success = fix_premium_expiration(user_id, months)
        sys.exit(0 if success else 1)
        
    elif command == "cleanup-event":
        if len(sys.argv) < 3:
            print("Please provide event_id")
            sys.exit(1)
        event_id = int(sys.argv[2])
        success = cleanup_event_media(event_id)
        sys.exit(0 if success else 1)
        
    elif command == "fix-cdolan":
        success = fix_cdolan_premium()
        sys.exit(0 if success else 1)
        
    elif command == "cleanup-1441":
        success = cleanup_problem_event()
        sys.exit(0 if success else 1)
        
    else:
        print(f"Unknown command: {command}")
        sys.exit(1) 