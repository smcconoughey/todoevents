#!/usr/bin/env python3
"""
Production Event Creation Fix Test
Tests the dynamic schema detection fix for regular event creation
"""

import requests
import json
import time

# Production API base URL (try multiple common variations)
POSSIBLE_URLS = [
    "https://todoevents-api.onrender.com",
    "https://todoevents-backend.onrender.com", 
    "https://todoevents-1.onrender.com",
    "https://todoevents.onrender.com",
    "https://todo-events-api.onrender.com"
]

def find_working_url():
    """Find which URL is actually working"""
    for url in POSSIBLE_URLS:
        try:
            response = requests.get(f"{url}/health", timeout=5)
            if response.status_code == 200:
                print(f"✅ Found working URL: {url}")
                return url
        except:
            continue
    print("❌ No working URL found from common variations")
    return POSSIBLE_URLS[0]  # Default fallback

BASE_URL = find_working_url()

def test_api_health():
    """Test if the API is responding"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"✅ API Health Check: {response.status_code}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ API Health Check Failed: {e}")
        return False

def test_database_schema_endpoint():
    """Test the debug schema endpoint to see current database structure"""
    try:
        response = requests.get(f"{BASE_URL}/debug/schema", timeout=15)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Schema Detection: Found {len(data.get('events_columns', []))} columns")
            print(f"   Columns: {', '.join(data.get('events_columns', [])[:10])}{'...' if len(data.get('events_columns', [])) > 10 else ''}")
            return True
        else:
            print(f"❌ Schema Detection Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Schema Detection Error: {e}")
        return False

def test_user_login():
    """Test user login to get authentication token"""
    try:
        login_data = {
            "username": "cdolan0407@gmail.com",  # User from the logs
            "password": "testpassword123"  # Common test password
        }
        
        response = requests.post(
            f"{BASE_URL}/token",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10
        )
        
        if response.status_code == 200:
            token = response.json()["access_token"]
            print(f"✅ User Login: Success")
            return token
        elif response.status_code == 401:
            print(f"⚠️ User Login: Invalid credentials (expected for test)")
            return None
        else:
            print(f"❌ User Login Failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ User Login Error: {e}")
        return None

def test_event_creation_with_schema_fix(token):
    """Test event creation with the new dynamic schema detection"""
    if not token:
        print("⏭️ Skipping event creation test - no valid token")
        return False
    
    try:
        # Test event data that matches the failing events from the logs
        event_data = {
            "title": "Schema Fix Test Event",
            "description": "Testing the dynamic schema detection fix",
            "date": "2025-06-10",
            "start_time": "19:00",
            "end_time": "21:00",
            "category": "technology",
            "address": "107 S Sandusky St, Catlin, IL 61817",
            "lat": 40.0647478,
            "lng": -87.7028543,
            "fee_required": "Free",
            "host_name": "Test Host"
        }
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            f"{BASE_URL}/events",
            json=event_data,
            headers=headers,
            timeout=15
        )
        
        if response.status_code == 200:
            event = response.json()
            print(f"✅ Event Creation: Success - ID {event.get('id')}")
            print(f"   Title: {event.get('title')}")
            print(f"   Slug: {event.get('slug', 'N/A')}")
            return True
        else:
            print(f"❌ Event Creation Failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Event Creation Error: {e}")
        return False

def main():
    """Run all production fix tests"""
    print("🚀 Production Event Creation Fix Test")
    print("=" * 50)
    
    results = []
    
    # Test 1: API Health
    results.append(("API Health", test_api_health()))
    
    # Test 2: Database Schema Detection
    results.append(("Schema Detection", test_database_schema_endpoint()))
    
    # Test 3: User Login
    token = test_user_login()
    results.append(("User Login", token is not None))
    
    # Test 4: Event Creation with Fix
    results.append(("Event Creation Fix", test_event_creation_with_schema_fix(token)))
    
    print("\n📊 Test Results Summary")
    print("=" * 50)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print("\n🎉 All tests passed! Production fix is working.")
    else:
        print("\n⚠️ Some tests failed. The fix may need more work.")
        print("\n💡 Next steps:")
        print("• Check the production logs for more details")
        print("• Verify database schema compatibility")
        print("• Test with valid user credentials")

if __name__ == "__main__":
    main() 