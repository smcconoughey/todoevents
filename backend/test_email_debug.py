#!/usr/bin/env python3
"""
Email Configuration Debug Script
Run this to test and diagnose email issues
"""

import os
import sys
import socket
import smtplib
from email_config import EmailService

def test_network_connectivity():
    """Test basic network connectivity and DNS resolution"""
    print("\n🌐 Network & DNS Test")
    print("=" * 50)
    
    # Test DNS resolution
    try:
        ip = socket.gethostbyname('smtp.zoho.com')
        print(f"✅ DNS Resolution: smtp.zoho.com -> {ip}")
    except socket.gaierror as e:
        print(f"❌ DNS Resolution failed: {e}")
        return False
    
    # Test port connectivity
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        result = sock.connect_ex(('smtp.zoho.com', 587))
        if result == 0:
            print("✅ Port 587 is reachable")
        else:
            print("❌ Port 587 is not reachable")
        sock.close()
    except Exception as e:
        print(f"❌ Port test failed: {e}")
        return False
    
    return True

def test_environment_variables():
    """Test if environment variables are set"""
    print("\n📋 Environment Variables")
    print("=" * 50)
    
    required_vars = ['SMTP_SERVER', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'FROM_EMAIL']
    missing_vars = []
    
    for var in required_vars:
        value = os.getenv(var)
        if value:
            if 'PASSWORD' in var:
                print(f"✅ {var}: ***SET*** ({len(value)} chars)")
            else:
                print(f"✅ {var}: {value}")
        else:
            print(f"❌ {var}: NOT SET")
            missing_vars.append(var)
    
    if missing_vars:
        print(f"\n⚠️ Missing variables: {', '.join(missing_vars)}")
        print("\n💡 Solutions:")
        print("1. Set environment variables in your deployment platform (Render)")
        print("2. Create a .env file for local development")
        print("3. Export variables in your shell: export SMTP_PASSWORD='your-password'")
        return False
    
    return True

def test_smtp_connection():
    """Test SMTP connection and authentication"""
    print("\n🔌 SMTP Connection Test")
    print("=" * 50)
    
    config = {
        'smtp_server': os.getenv('SMTP_SERVER', 'smtp.zoho.com'),
        'smtp_port': int(os.getenv('SMTP_PORT', '587')),
        'smtp_username': os.getenv('SMTP_USERNAME', 'support@todo-events.com'),
        'smtp_password': os.getenv('SMTP_PASSWORD', ''),
    }
    
    if not config['smtp_password']:
        print("❌ Cannot test SMTP: No password configured")
        return False
    
    try:
        print(f"🔌 Connecting to {config['smtp_server']}:{config['smtp_port']}")
        server = smtplib.SMTP(config['smtp_server'], config['smtp_port'])
        
        print("🔐 Starting TLS...")
        server.starttls()
        
        print(f"🔑 Authenticating as {config['smtp_username']}")
        server.login(config['smtp_username'], config['smtp_password'])
        
        print("✅ SMTP connection successful!")
        server.quit()
        return True
        
    except Exception as e:
        print(f"❌ SMTP connection failed: {e}")
        
        if "Name or service not known" in str(e):
            print("   🔍 This is a DNS resolution issue")
        elif "Authentication failed" in str(e):
            print("   🔑 Check your username and password")
        elif "Connection refused" in str(e):
            print("   🚫 Server refused connection - check server/port")
        
        return False

def test_email_service():
    """Test the EmailService class"""
    print("\n📧 Email Service Test")
    print("=" * 50)
    
    try:
        email_service = EmailService()
        print("✅ EmailService initialized successfully")
        return True
    except Exception as e:
        print(f"❌ EmailService initialization failed: {e}")
        return False

def interactive_test():
    """Run an interactive email test"""
    print("\n🧪 Interactive Email Test")
    print("=" * 50)
    
    if not os.getenv('SMTP_PASSWORD'):
        print("❌ Cannot send test email: SMTP_PASSWORD not set")
        return
    
    test_email = input("Enter your email to receive a test message (or press Enter to skip): ").strip()
    
    if not test_email:
        print("⏭️ Skipping email test")
        return
    
    try:
        email_service = EmailService()
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
            print("❌ Test email failed to send")
            
    except Exception as e:
        print(f"❌ Test email error: {e}")

def main():
    """Run all diagnostic tests"""
    print("🚀 Todo Events Email Debug Tool")
    print("=" * 50)
    
    tests = [
        ("Network Connectivity", test_network_connectivity),
        ("Environment Variables", test_environment_variables),
        ("SMTP Connection", test_smtp_connection),
        ("Email Service", test_email_service),
    ]
    
    results = {}
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results[test_name] = False
    
    print("\n📊 Test Results Summary")
    print("=" * 50)
    
    all_passed = True
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print("\n🎉 All tests passed! Email system should work.")
        interactive_test()
    else:
        print("\n⚠️ Some tests failed. Please fix the issues above.")
        print("\n💡 Quick fixes:")
        print("• Set missing environment variables")
        print("• Check your internet connection")
        print("• Verify Zoho Mail credentials")

if __name__ == "__main__":
    main() 