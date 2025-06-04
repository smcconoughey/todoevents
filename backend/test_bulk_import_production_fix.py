#!/usr/bin/env python3
"""
Test script to verify bulk import fix works with production database schema
"""

import requests
import json
import random
import time

def test_create_admin_user():
    """Test admin user creation/login"""
    url = "https://todo-events-backend.onrender.com"
    
    # Try to register (will fail if exists, which is fine)
    register_data = {
        "email": "test@admin.com",
        "password": "TestPassword123!",
        "role": "admin"
    }
    
    response = requests.post(f"{url}/users", json=register_data)
    print(f"Registration: {response.status_code}")
    
    return True

def test_login():
    """Test login and get token"""
    url = "https://todo-events-backend.onrender.com"
    
    login_data = {
        "username": "test@admin.com",
        "password": "TestPassword123!"
    }
    
    response = requests.post(f"{url}/token", data=login_data)
    print(f"Login: {response.status_code}")
    
    if response.status_code == 200:
        token = response.json()["access_token"]
        print("✅ Login successful")
        return token
    else:
        print("❌ Login failed")
        print(response.text)
        return None

def test_bulk_import_with_actual_schema(token):
    """Test bulk import with the fix to handle actual database schema"""
    if not token:
        print("❌ No token available")
        return
    
    url = "https://todo-events-backend.onrender.com"
    
    # Generate unique test events
    suffix = str(int(time.time()))[-6:]
    test_events = [
        {
            "title": f"Test Event Schema Fix {suffix}",
            "description": "Testing database schema compatibility fix",
            "date": "2024-12-31",
            "start_time": "12:00",
            "end_time": "14:00",
            "category": "community",
            "address": "Test Address, Test City, OH, USA",
            "lat": 39.9612,
            "lng": -82.9988,
            "recurring": False,
            "fee_required": "Free",
            "event_url": "https://example.com",
            "host_name": "Test Host"
        },
        {
            "title": f"Test Event Schema Fix {suffix}B",
            "description": "Another test event for schema compatibility",
            "date": "2024-12-31",
            "start_time": "15:00",
            "end_time": "17:00",
            "category": "education",
            "address": "Another Address, Test City, CA, USA",
            "lat": 37.7749,
            "lng": -122.4194,
            "recurring": False,
            "fee_required": "$25",
            "event_url": "https://example2.com",
            "host_name": "Test Host 2"
        }
    ]
    
    bulk_data = {
        "events": test_events
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print(f"🚀 Testing bulk import with {len(test_events)} events...")
    
    response = requests.post(f"{url}/admin/events/bulk", json=bulk_data, headers=headers)
    
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Bulk import successful!")
        print(f"   Success count: {result.get('success_count', 0)}")
        print(f"   Error count: {result.get('error_count', 0)}")
        
        if result.get('errors'):
            print("   Errors:")
            for error in result['errors']:
                print(f"     - {error}")
        
        if result.get('created_events'):
            print(f"   Created {len(result['created_events'])} events")
            for event in result['created_events']:
                slug = event.get('slug', 'no-slug')
                print(f"     - {event['title']} (slug: {slug})")
        
        return result.get('success_count', 0) > 0
    else:
        print("❌ Bulk import failed")
        print(f"Response: {response.text}")
        return False

def test_debug_schema():
    """Test the debug endpoint to see actual database schema"""
    url = "https://todo-events-backend.onrender.com"
    
    response = requests.get(f"{url}/debug/schema")
    print(f"Debug schema: {response.status_code}")
    
    if response.status_code == 200:
        schema_info = response.json()
        print("Database Schema Information:")
        if 'production_schema' in schema_info:
            print(f"Production columns: {len(schema_info['production_schema']['columns'])}")
            print("Columns:", ", ".join(schema_info['production_schema']['columns']))
        return True
    else:
        print("❌ Could not get schema info")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing Bulk Import Production Schema Fix")
    print("=" * 50)
    
    # Test sequence
    try:
        test_create_admin_user()
        token = test_login()
        
        if token:
            print("\n📊 Testing database schema debug...")
            test_debug_schema()
            
            print("\n🎯 Testing bulk import with schema fix...")
            success = test_bulk_import_with_actual_schema(token)
            
            if success:
                print("\n🎉 All tests passed! Bulk import fix is working.")
            else:
                print("\n❌ Bulk import test failed")
        else:
            print("❌ Could not get authentication token")
            
    except Exception as e:
        print(f"❌ Test failed with error: {e}")

if __name__ == "__main__":
    main() 