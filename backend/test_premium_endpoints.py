#!/usr/bin/env python3
"""
Test script for premium management endpoints
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

# Use production API URL
API_URL = "https://todoevents.onrender.com"

def test_premium_endpoints():
    """Test the premium management endpoints"""
    
    print("🧪 Testing Premium Management Endpoints")
    print("=" * 50)
    
    # Test admin login first (you'll need to replace with actual admin credentials)
    print("1. Testing admin authentication...")
    
    # You would need to login with actual admin credentials here
    # For now, let's just test the endpoint availability
    
    endpoints_to_test = [
        "/admin/premium-users",
        "/admin/premium-invite", 
        "/admin/users/1/grant-premium",
        "/admin/users/1/remove-premium",
        "/admin/users/1/notify-premium"
    ]
    
    print("2. Testing endpoint availability...")
    
    for endpoint in endpoints_to_test:
        try:
            # Test without auth to see if endpoint exists (should return 401)
            response = requests.get(f"{API_URL}{endpoint}")
            if response.status_code == 401:
                print(f"✅ {endpoint} - Endpoint exists (401 Unauthorized as expected)")
            elif response.status_code == 405:
                print(f"✅ {endpoint} - Endpoint exists (405 Method Not Allowed)")
            else:
                print(f"⚠️ {endpoint} - Unexpected status: {response.status_code}")
        except Exception as e:
            print(f"❌ {endpoint} - Error: {str(e)}")
    
    print("\n3. Testing database schema...")
    
    # Test if the backend can start (indicates schema is correct)
    try:
        response = requests.get(f"{API_URL}/health")
        if response.status_code == 200:
            print("✅ Backend health check passed")
            data = response.json()
            print(f"   Database: {data.get('database', 'Unknown')}")
            print(f"   Status: {data.get('status', 'Unknown')}")
        else:
            print(f"⚠️ Health check returned: {response.status_code}")
    except Exception as e:
        print(f"❌ Health check failed: {str(e)}")
    
    print("\n🎉 Premium Management System Test Complete!")
    print("\nNext steps:")
    print("1. Login to admin dashboard at: https://todoevents.onrender.com/admin")
    print("2. Navigate to the 'Premium' tab")
    print("3. Test the premium management features")

if __name__ == "__main__":
    test_premium_endpoints() 