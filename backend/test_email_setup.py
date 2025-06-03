#!/usr/bin/env python3
"""
Email Setup Test Script for Todo Events
Run this script to test your Zoho Mail configuration
"""

import os
import sys
from email_config import EmailService

def test_email_configuration():
    """Test the email configuration and send a test email"""
    
    print("🧪 Testing Todo Events Email Configuration")
    print("=" * 50)
    
    # Initialize email service
    try:
        email_service = EmailService()
        print("✅ Email service initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize email service: {e}")
        return False
    
    # Check environment variables
    print("\n📋 Configuration Check:")
    print(f"SMTP Server: {os.getenv('SMTP_SERVER', 'Not set')}")
    print(f"SMTP Port: {os.getenv('SMTP_PORT', 'Not set')}")
    print(f"From Email: {os.getenv('FROM_EMAIL', 'Not set')}")
    print(f"Username: {os.getenv('SMTP_USERNAME', 'Not set')}")
    print(f"Password: {'Set' if os.getenv('SMTP_PASSWORD') else 'Not set'}")
    
    # Get test email from user
    test_email = input("\n📧 Enter your email address to receive a test email: ").strip()
    
    if not test_email or '@' not in test_email:
        print("❌ Invalid email address")
        return False
    
    # Test password reset email
    print(f"\n📤 Sending test password reset email to {test_email}...")
    
    try:
        result = email_service.send_password_reset_email(
            to_email=test_email,
            reset_code="TEST123",
            user_name="Test User"
        )
        
        if result:
            print("✅ Password reset email sent successfully!")
            print("📬 Check your inbox (and spam folder)")
        else:
            print("❌ Failed to send password reset email")
            return False
            
    except Exception as e:
        print(f"❌ Error sending password reset email: {e}")
        return False
    
    # Test welcome email  
    print(f"\n📤 Sending test welcome email to {test_email}...")
    
    try:
        result = email_service.send_welcome_email(
            to_email=test_email,
            user_name="Test User"
        )
        
        if result:
            print("✅ Welcome email sent successfully!")
            print("📬 Check your inbox for both emails")
        else:
            print("❌ Failed to send welcome email")
            return False
            
    except Exception as e:
        print(f"❌ Error sending welcome email: {e}")
        return False
    
    print("\n🎉 Email configuration test completed successfully!")
    print("\n📋 Next Steps:")
    print("1. Check your email inbox")
    print("2. Verify emails look professional") 
    print("3. Test the password reset flow in the app")
    print("4. Configure any additional email settings needed")
    
    return True

def check_prerequisites():
    """Check if all prerequisites are met"""
    
    print("🔍 Checking Prerequisites...")
    
    # Check if .env file exists
    if not os.path.exists('.env'):
        print("❌ .env file not found")
        print("📋 Create .env file using env_template_zoho.txt as reference")
        return False
    
    # Check required environment variables
    required_vars = [
        'SMTP_SERVER',
        'SMTP_PORT', 
        'SMTP_USERNAME',
        'SMTP_PASSWORD',
        'FROM_EMAIL'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        print("📋 Update your .env file with the missing values")
        return False
    
    print("✅ Prerequisites check passed")
    return True

if __name__ == "__main__":
    print("🚀 Todo Events Email Setup Tester")
    print("=" * 40)
    
    # Check prerequisites first
    if not check_prerequisites():
        print("\n❌ Prerequisites not met. Please fix the issues above and try again.")
        sys.exit(1)
    
    # Run email tests
    success = test_email_configuration()
    
    if success:
        print("\n🎯 Email setup is working correctly!")
        sys.exit(0)
    else:
        print("\n❌ Email setup has issues. Please check the errors above.")
        sys.exit(1) 