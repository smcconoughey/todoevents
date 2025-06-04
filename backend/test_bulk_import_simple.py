#!/usr/bin/env python3
"""
Simple test for bulk import functionality with database compatibility fixes
"""

import requests
import json
import sys
import time

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_ADMIN_EMAIL = "test@admin.com"
TEST_ADMIN_PASSWORD = "Admin123!Test"

def test_create_admin_user():
    """Create a test admin user for testing"""
    try:
        # Create test admin user
        response = requests.post(f"{BASE_URL}/users", json={
            "email": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD,
            "role": "admin"
        })
        
        if response.status_code == 200:
            print("✅ Test admin user created successfully")
            return True
        elif response.status_code == 400 and "User already exists" in response.text:
            print("✅ Test admin user already exists")
            return True
        else:
            print(f"❌ Failed to create test admin user: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        return False

def test_login():
    """Test admin login and get token"""
    try:
        response = requests.post(f"{BASE_URL}/token", data={
            "username": TEST_ADMIN_EMAIL,
            "password": TEST_ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            token_data = response.json()
            print("✅ Admin login successful")
            return token_data["access_token"]
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_bulk_import(token):
    """Test bulk import with simple data"""
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Simple test data with minimal events
        test_data = {
            "events": [
                {
                    "title": f"Test Event {int(time.time())}",
                    "description": "A simple test event for bulk import testing",
                    "date": "2025-06-15",
                    "start_time": "10:00",
                    "end_time": "12:00",
                    "category": "community",
                    "address": "Test City, OH, USA",
                    "lat": 41.5,
                    "lng": -81.7,
                    "recurring": False,
                    "fee_required": "Free admission",
                    "event_url": "https://example.com/test1",
                    "host_name": "Test Organization"
                },
                {
                    "title": f"Test Event {int(time.time()) + 1}",
                    "description": "Another test event for bulk import testing",
                    "date": "2025-06-16",
                    "start_time": "14:00",
                    "end_time": "16:00",
                    "category": "education",
                    "address": "Test City, CA, USA",
                    "lat": 37.7,
                    "lng": -122.4,
                    "recurring": False,
                    "fee_required": "$10 entry fee",
                    "event_url": "https://example.com/test2",
                    "host_name": "Test School"
                }
            ]
        }
        
        print(f"📤 Testing bulk import with {len(test_data['events'])} events...")
        
        response = requests.post(f"{BASE_URL}/admin/events/bulk", 
                               headers=headers, 
                               json=test_data,
                               timeout=30)
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Bulk import completed successfully!")
            print(f"   Success count: {result.get('success_count', 0)}")
            print(f"   Error count: {result.get('error_count', 0)}")
            
            if result.get('errors'):
                print("   Errors:")
                for error in result['errors']:
                    print(f"     - Event {error.get('index', 'N/A')}: {error.get('error', 'Unknown error')}")
            
            if result.get('created_events'):
                print("   Created events:")
                for event in result['created_events']:
                    print(f"     - ID {event.get('id')}: {event.get('title')} (slug: {event.get('slug', 'N/A')})")
            
            return result.get('success_count', 0) > 0
        else:
            print(f"❌ Bulk import failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Bulk import error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Testing Bulk Import Database Compatibility")
    print("=" * 50)
    
    # Test API connectivity
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ API server is running")
        else:
            print("❌ API server not responding properly")
            return
    except Exception as e:
        print(f"❌ Cannot connect to API server: {e}")
        return
    
    # Create admin user (skip if already exists)
    test_create_admin_user()  # Don't fail if user exists
    
    # Login and get token
    token = test_login()
    if not token:
        return
    
    # Test bulk import
    if test_bulk_import(token):
        print("🎉 All tests passed! Bulk import is working correctly.")
    else:
        print("❌ Bulk import test failed.")

if __name__ == "__main__":
    main() 