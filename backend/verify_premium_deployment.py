#!/usr/bin/env python3
"""
Verification script for Premium Management System deployment
"""

import requests
import json
import time

API_URL = "https://todoevents-backend.onrender.com"

def test_deployment():
    """Test if the premium management system is deployed and working"""
    
    print("🔍 Premium Management System Deployment Verification")
    print("=" * 60)
    
    # Test 1: Backend Health
    print("1. Testing backend health...")
    try:
        response = requests.get(f"{API_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Backend healthy - Database: {data.get('database', 'Unknown')}")
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend unreachable: {str(e)}")
        return False
    
    # Test 2: Premium endpoints exist
    print("\n2. Testing premium endpoint availability...")
    
    premium_endpoints = [
        ("GET", "/admin/premium-users"),
        ("POST", "/admin/premium-invite"),
        ("POST", "/admin/users/1/grant-premium"),
        ("DELETE", "/admin/users/1/remove-premium"),
        ("POST", "/admin/users/1/notify-premium")
    ]
    
    endpoints_working = 0
    
    for method, endpoint in premium_endpoints:
        try:
            if method == "GET":
                response = requests.get(f"{API_URL}{endpoint}", timeout=5)
            else:
                response = requests.post(f"{API_URL}{endpoint}", timeout=5)
            
            # We expect 401 (Not authenticated) or 403 (Not authorized)
            # 404 (Not Found) means the endpoint doesn't exist
            if response.status_code in [401, 403]:
                print(f"✅ {method} {endpoint} - Endpoint exists")
                endpoints_working += 1
            elif response.status_code == 404:
                print(f"❌ {method} {endpoint} - Endpoint not found")
            elif response.status_code == 422:
                print(f"✅ {method} {endpoint} - Endpoint exists (validation error)")
                endpoints_working += 1
            else:
                print(f"⚠️ {method} {endpoint} - Unexpected status: {response.status_code}")
                
        except Exception as e:
            print(f"❌ {method} {endpoint} - Error: {str(e)}")
    
    # Test 3: Database schema
    print(f"\n3. Premium endpoints status: {endpoints_working}/{len(premium_endpoints)} working")
    
    if endpoints_working == len(premium_endpoints):
        print("✅ All premium endpoints are deployed and accessible!")
        print("\n🎉 Premium Management System is ready!")
        print("\nNext steps:")
        print("1. Open admin dashboard: https://todoevents.onrender.com/admin")
        print("2. Login with admin credentials")
        print("3. Click on the 'Premium' tab")
        print("4. Test premium management features")
        return True
    elif endpoints_working > 0:
        print("⚠️ Some premium endpoints are working, deployment may still be in progress")
        return False
    else:
        print("❌ Premium endpoints not yet deployed")
        print("💡 The deployment may still be in progress. Try again in a few minutes.")
        return False

def wait_for_deployment(max_wait_minutes=10):
    """Wait for deployment to complete"""
    print(f"\n⏳ Waiting for deployment to complete (max {max_wait_minutes} minutes)...")
    
    for minute in range(max_wait_minutes):
        print(f"\n--- Attempt {minute + 1}/{max_wait_minutes} ---")
        
        if test_deployment():
            return True
        
        if minute < max_wait_minutes - 1:
            print(f"⏳ Waiting 60 seconds before next check...")
            time.sleep(60)
    
    print(f"\n⏰ Deployment verification timed out after {max_wait_minutes} minutes")
    print("💡 The deployment may take longer. You can:")
    print("1. Check Render dashboard for deployment status")
    print("2. Run this script again later")
    print("3. Test manually at the admin dashboard")
    
    return False

if __name__ == "__main__":
    print("🚀 Starting Premium Management System verification...")
    
    # First quick test
    success = test_deployment()
    
    if not success:
        # Wait for deployment if needed
        success = wait_for_deployment()
    
    if success:
        print("\n🎊 Premium Management System verification completed successfully!")
    else:
        print("\n📋 Manual verification steps:")
        print("1. Check https://dashboard.render.com for deployment status")
        print("2. Verify backend logs for any errors")
        print("3. Test admin dashboard manually")
        print("4. Run this script again once deployment completes") 