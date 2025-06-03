#!/usr/bin/env python3
"""
Email Setup Test Script for Todo Events
Run this script to test your Zoho Mail configuration
"""

import os
import sys
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email_config import EmailService

def test_email_configuration():
    """Test the email configuration"""
    print("\n🧪 Testing Email Configuration...")
    
    try:
        # Initialize email service
        email_service = EmailService()
        print("✅ Email service initialized")
        
        # Test SMTP connection
        smtp_server = os.getenv('SMTP_SERVER', 'smtp.zoho.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_username = os.getenv('SMTP_USERNAME')
        smtp_password = os.getenv('SMTP_PASSWORD')
        
        print(f"🔌 Testing SMTP connection to {smtp_server}:{smtp_port}")
        
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.quit()
        
        print("✅ SMTP connection successful")
        
        # Test sending a real email (optional)
        test_email = input("\n📧 Enter your email to receive a test message (or press Enter to skip): ").strip()
        
        if test_email:
            print(f"📤 Sending test email to {test_email}...")
            
            result = email_service.send_password_reset_email(
                to_email=test_email,
                reset_code="TEST123",
                user_name="Test User"
            )
            
            if result:
                print("✅ Test email sent successfully!")
                print("📬 Check your inbox (and spam folder)")
            else:
                print("❌ Failed to send test email")
        else:
            print("⏭️ Skipping test email")
            
    except Exception as e:
        print(f"❌ Email configuration test failed: {str(e)}")
        return False
    
    return True

def check_prerequisites():
    """Check if all prerequisites are met for email testing"""
    print("🔍 Checking Prerequisites...")
    issues = []
    
    # Check for .env file or environment variables
    env_file_exists = os.path.exists('.env')
    
    if not env_file_exists:
        print("ℹ️ .env file not found - checking environment variables...")
        
        # Check for required environment variables
        required_env_vars = [
            'SMTP_SERVER', 'SMTP_PORT', 'SMTP_USERNAME', 
            'SMTP_PASSWORD', 'FROM_EMAIL'
        ]
        
        missing_vars = []
        for var in required_env_vars:
            if not os.getenv(var):
                missing_vars.append(var)
        
        if missing_vars:
            issues.append(f"Missing environment variables: {', '.join(missing_vars)}")
            print("📋 Set up environment variables on Render or create .env file locally")
        else:
            print("✅ Environment variables found")
    else:
        print("✅ .env file found")
        
        # Load environment variables from .env file
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            print("⚠️ python-dotenv not installed, but .env file exists")
    
    # Check if EmailService can be imported
    try:
        email_service = EmailService()
        print("✅ EmailService imported successfully")
    except Exception as e:
        issues.append(f"EmailService import failed: {str(e)}")
    
    # Check required environment variables
    smtp_server = os.getenv('SMTP_SERVER')
    smtp_port = os.getenv('SMTP_PORT')
    smtp_username = os.getenv('SMTP_USERNAME')
    smtp_password = os.getenv('SMTP_PASSWORD')
    from_email = os.getenv('FROM_EMAIL')
    
    if not all([smtp_server, smtp_port, smtp_username, smtp_password, from_email]):
        missing = []
        if not smtp_server: missing.append('SMTP_SERVER')
        if not smtp_port: missing.append('SMTP_PORT')
        if not smtp_username: missing.append('SMTP_USERNAME')
        if not smtp_password: missing.append('SMTP_PASSWORD')
        if not from_email: missing.append('FROM_EMAIL')
        
        if missing:
            issues.append(f"Missing environment variables: {', '.join(missing)}")
            if not env_file_exists:
                print("📋 Configure these variables on Render or create local .env file")
            else:
                print("📋 Update your .env file with the missing values")
    else:
        print("✅ All required environment variables present")
        print(f"   📧 SMTP Server: {smtp_server}")
        print(f"   🔌 SMTP Port: {smtp_port}")
        print(f"   👤 Username: {smtp_username}")
        print(f"   📨 From Email: {from_email}")
        print(f"   🔑 Password: {'*' * len(smtp_password) if smtp_password else 'Not set'}")
    
    return issues

if __name__ == "__main__":
    print("🚀 Todo Events Email Setup Tester")
    print("=" * 40)
    
    # Check prerequisites
    issues = check_prerequisites()
    
    if issues:
        print(f"\n❌ Prerequisites not met. Please fix the issues above and try again.")
        for issue in issues:
            print(f"   • {issue}")
        exit(1)
    
    print("\n✅ Prerequisites met!")
    
    # Test email configuration
    if test_email_configuration():
        print("\n🎉 Email setup is working correctly!")
        print("📋 Your Todo Events email system is ready to send:")
        print("   • Password reset emails")
        print("   • Welcome emails")
        print("   • Other automated notifications")
    else:
        print("\n❌ Email setup needs attention")
        print("📋 Check your SMTP credentials and try again") 