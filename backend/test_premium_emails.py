#!/usr/bin/env python3
"""
Test script for premium email functionality
"""

import os
import sys
from datetime import datetime, timedelta

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from email_config import email_service

def test_premium_invitation_email():
    """Test premium invitation email"""
    print("🧪 Testing Premium Invitation Email...")
    
    result = email_service.send_premium_invitation_email(
        to_email="test@example.com",
        months=3,
        message="Welcome to our premium trial! We think you'll love the advanced features.",
        invited_by="admin@todo-events.com"
    )
    
    print(f"✅ Invitation email test result: {result}")
    return result

def test_premium_notification_email():
    """Test premium notification email"""
    print("🧪 Testing Premium Notification Email...")
    
    expires_at = (datetime.now() + timedelta(days=90)).isoformat()
    
    result = email_service.send_premium_notification_email(
        to_email="test@example.com",
        user_name="John Doe",
        expires_at=expires_at,
        granted_by="admin@todo-events.com"
    )
    
    print(f"✅ Notification email test result: {result}")
    return result

def test_premium_expiration_reminder_email():
    """Test premium expiration reminder email"""
    print("🧪 Testing Premium Expiration Reminder Email...")
    
    expires_at = (datetime.now() + timedelta(days=7)).isoformat()
    
    result = email_service.send_premium_expiration_reminder_email(
        to_email="test@example.com",
        user_name="John Doe",
        expires_at=expires_at,
        days_remaining=7
    )
    
    print(f"✅ Expiration reminder email test result: {result}")
    return result

def test_enterprise_notification_email():
    """Test enterprise notification email"""
    print("🧪 Testing Enterprise Notification Email...")
    
    expires_at = (datetime.now() + timedelta(days=365)).isoformat()
    
    result = email_service.send_enterprise_notification_email(
        to_email="test@example.com",
        user_name="Jane Smith",
        expires_at=expires_at,
        granted_by="admin@todo-events.com"
    )
    
    print(f"✅ Enterprise notification email test result: {result}")
    return result

def main():
    """Run all email tests"""
    print("🚀 Starting Premium Email Tests...")
    print(f"📧 Email service configured with: {email_service.config['smtp_server']}")
    print(f"👤 From: {email_service.config['from_email']}")
    print(f"🔑 Password configured: {bool(email_service.config['smtp_password'])}")
    print()
    
    # Test all email functions
    tests = [
        test_premium_invitation_email,
        test_premium_notification_email,
        test_premium_expiration_reminder_email,
        test_enterprise_notification_email
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"❌ Test failed: {str(e)}")
            results.append(False)
        print()
    
    # Summary
    print("📊 Test Summary:")
    print(f"✅ Passed: {sum(results)}")
    print(f"❌ Failed: {len(results) - sum(results)}")
    print(f"📈 Success Rate: {(sum(results) / len(results)) * 100:.1f}%")
    
    if all(results):
        print("🎉 All premium email functions are working correctly!")
    else:
        print("⚠️ Some email functions may need attention.")
        if not email_service.config['smtp_password']:
            print("💡 Tip: Set SMTP_PASSWORD environment variable for actual email sending")

if __name__ == "__main__":
    main() 