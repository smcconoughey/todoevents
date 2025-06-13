#!/usr/bin/env python3
"""
Test script for Stripe integration endpoints
Run this to verify the Stripe integration is working correctly
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
BASE_URL = "https://todoevents.onrender.com"  # Change to localhost if testing locally
TEST_USER_EMAIL = "test@example.com"  # Change to your test user email
TEST_USER_PASSWORD = "testpassword123"  # Change to your test user password

def test_stripe_config():
    """Test if Stripe config endpoint is accessible"""
    print("🧪 Testing Stripe config endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}/stripe/config")
        if response.status_code == 200:
            config = response.json()
            if 'publishable_key' in config:
                print(f"✅ Stripe config endpoint working")
                print(f"📝 Publishable key starts with: {config['publishable_key'][:12]}...")
                return True
            else:
                print("❌ No publishable key in response")
                return False
        else:
            print(f"❌ Stripe config endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error testing Stripe config: {str(e)}")
        return False

def test_stripe_checkout_creation():
    """Test creating a Stripe checkout session (requires authentication)"""
    print("\n🧪 Testing Stripe checkout session creation...")
    
    # First, try to authenticate
    try:
        auth_response = requests.post(f"{BASE_URL}/token", data={
            "username": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if auth_response.status_code != 200:
            print(f"⚠️ Cannot test checkout creation - authentication failed: {auth_response.status_code}")
            print("💡 Create a test user account first or update the credentials in this script")
            return False
        
        auth_data = auth_response.json()
        token = auth_data.get('access_token')
        
        if not token:
            print("❌ No access token received")
            return False
        
        # Test checkout session creation
        checkout_response = requests.post(
            f"{BASE_URL}/stripe/create-checkout-session",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )
        
        if checkout_response.status_code == 200:
            checkout_data = checkout_response.json()
            if 'checkout_url' in checkout_data:
                print("✅ Stripe checkout session creation working")
                print(f"📝 Checkout URL: {checkout_data['checkout_url'][:50]}...")
                return True
            else:
                print("❌ No checkout URL in response")
                return False
        else:
            print(f"❌ Checkout creation failed: {checkout_response.status_code}")
            try:
                error_data = checkout_response.json()
                print(f"📝 Error: {error_data.get('detail', 'Unknown error')}")
            except:
                pass
            return False
            
    except Exception as e:
        print(f"❌ Error testing checkout creation: {str(e)}")
        return False

def test_webhook_endpoint():
    """Test if webhook endpoint is accessible (without signature verification)"""
    print("\n🧪 Testing Stripe webhook endpoint accessibility...")
    
    try:
        # Send a test POST request to webhook endpoint
        # This should fail with signature verification error, but endpoint should be accessible
        response = requests.post(
            f"{BASE_URL}/stripe/webhook",
            data=json.dumps({"test": "data"}),
            headers={"Content-Type": "application/json"}
        )
        
        # We expect a 400 error due to missing/invalid signature
        if response.status_code == 400:
            print("✅ Webhook endpoint accessible (signature validation working)")
            return True
        elif response.status_code == 404:
            print("❌ Webhook endpoint not found")
            return False
        else:
            print(f"⚠️ Unexpected response from webhook endpoint: {response.status_code}")
            return True  # Endpoint exists, just different response
            
    except Exception as e:
        print(f"❌ Error testing webhook endpoint: {str(e)}")
        return False

def check_environment_variables():
    """Check if required environment variables are set"""
    print("🧪 Checking environment variables...")
    
    required_vars = [
        "STRIPE_SECRET_KEY",
        "STRIPE_PUBLISHABLE_KEY", 
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_PRICE_ID"
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        print("💡 Add these to your Render deployment environment variables")
        return False
    else:
        print("✅ All required environment variables are set")
        return True

def main():
    """Run all tests"""
    print("🚀 Testing TodoEvents Stripe Integration")
    print("=" * 50)
    
    tests_passed = 0
    total_tests = 4
    
    # Test 1: Environment variables
    if check_environment_variables():
        tests_passed += 1
    
    # Test 2: Stripe config endpoint
    if test_stripe_config():
        tests_passed += 1
    
    # Test 3: Webhook endpoint
    if test_webhook_endpoint():
        tests_passed += 1
    
    # Test 4: Checkout creation (optional - requires auth)
    if test_stripe_checkout_creation():
        tests_passed += 1
    
    # Summary
    print("\n" + "=" * 50)
    print(f"🎯 Test Results: {tests_passed}/{total_tests} tests passed")
    
    if tests_passed == total_tests:
        print("🎉 All tests passed! Stripe integration is ready for testing.")
        print("\n💡 Next steps:")
        print("1. Go to your app's /account page")
        print("2. Click 'Upgrade to Premium'")
        print("3. Use test card: 4242 4242 4242 4242")
        print("4. Check webhook events in Stripe dashboard")
    elif tests_passed >= 2:
        print("⚠️ Basic integration working. Some advanced features may need attention.")
    else:
        print("❌ Integration needs work. Check environment variables and deployment.")

if __name__ == "__main__":
    main()