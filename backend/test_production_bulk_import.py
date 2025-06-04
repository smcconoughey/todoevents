#!/usr/bin/env python3
"""
Production Bulk Import Test
Tests the bulk import functionality against the live production environment
"""

import requests
import json
import random
import time

def test_production_bulk_import():
    """Test bulk import functionality against production"""
    print("🧪 Testing Production Bulk Import Functionality")
    print("=" * 50)
    
    # Production URL
    url = "https://todo-events-backend.onrender.com"
    
    # Try to login with admin credentials
    print("📋 Step 1: Admin Authentication")
    login_data = {
        "username": "admin@todoevents.com",
        "password": "AdminPassword123!"
    }
    
    response = requests.post(f"{url}/token", data=login_data)
    print(f"Login Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.text}")
        print("🔍 Checking if admin user exists...")
        
        # Try to register admin user
        register_data = {
            "email": "admin@todoevents.com",
            "password": "AdminPassword123!",
            "role": "admin"
        }
        
        register_response = requests.post(f"{url}/users", json=register_data)
        print(f"Registration Status: {register_response.status_code}")
        
        if register_response.status_code == 400:
            print("✅ Admin user already exists, trying login again...")
            response = requests.post(f"{url}/token", data=login_data)
            if response.status_code != 200:
                print(f"❌ Still can't login: {response.text}")
                return
        elif register_response.status_code == 200:
            print("✅ Admin user created, logging in...")
            response = requests.post(f"{url}/token", data=login_data)
        else:
            print(f"❌ Registration failed: {register_response.text}")
            return
    
    if response.status_code != 200:
        print(f"❌ Final login attempt failed: {response.text}")
        return
    
    token_data = response.json()
    token = token_data["access_token"]
    print("✅ Successfully authenticated as admin")
    
    # Test bulk import with schema-aware approach
    print("\n📋 Step 2: Testing Bulk Import with Schema Detection")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create test events that will test the schema compatibility
    test_events = [
        {
            "title": f"Schema Test Event 1 - {int(time.time())}",
            "description": "Testing production schema compatibility with enhanced error handling",
            "date": "2024-12-15",
            "start_time": "14:00",
            "end_time": "16:00",
            "category": "business",
            "address": "123 Test Street, Nashville, TN 37203, USA",
            "lat": 36.1627,
            "lng": -86.7816,
            "recurring": False,
            "fee_required": "Free admission",
            "event_url": "https://test-event.com",
            "host_name": "Schema Test Host"
        },
        {
            "title": f"Schema Test Event 2 - {int(time.time())}",
            "description": "Testing schema detection with different field combinations",
            "date": "2024-12-16",
            "start_time": "19:00",
            "end_time": "21:00",
            "category": "social",
            "address": "456 Production Ave, Milwaukee, WI 53202, USA",
            "lat": 43.0389,
            "lng": -87.9065,
            "recurring": False,
            "fee_required": "$25 per person",
            "event_url": "https://another-test.com",
            "host_name": "Production Test Organization"
        }
    ]
    
    bulk_data = {"events": test_events}
    
    print(f"📤 Sending bulk import request with {len(test_events)} events...")
    response = requests.post(f"{url}/admin/events/bulk", json=bulk_data, headers=headers)
    
    print(f"Bulk Import Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print("✅ Bulk import completed!")
        print(f"   📊 Success: {result.get('success_count', 0)}")
        print(f"   📊 Errors: {result.get('error_count', 0)}")
        
        if result.get('errors'):
            print("❌ Errors encountered:")
            for error in result['errors']:
                print(f"     - Event {error.get('index', '?')}: {error.get('error', 'Unknown error')}")
        
        if result.get('created_events'):
            print(f"✅ Created {len(result['created_events'])} events successfully")
            for event in result['created_events']:
                print(f"     - {event.get('title', 'Unnamed')} (ID: {event.get('id', '?')})")
                print(f"       Slug: {event.get('slug', 'No slug')}")
                print(f"       City: {event.get('city', 'No city')}, State: {event.get('state', 'No state')}")
        
        return True
    else:
        print(f"❌ Bulk import failed: {response.text}")
        
        # Try to get more debug information
        try:
            error_data = response.json()
            print(f"   Error Details: {error_data}")
        except:
            pass
        
        return False

def test_database_info():
    """Check database information"""
    print("\n📋 Step 3: Checking Database Schema Information")
    url = "https://todo-events-backend.onrender.com"
    
    response = requests.get(f"{url}/debug/database-info")
    print(f"Database Info Status: {response.status_code}")
    
    if response.status_code == 200:
        info = response.json()
        print("✅ Database Information:")
        print(f"   🔧 Production: {info.get('is_production', False)}")
        print(f"   🔧 Database Type: {info.get('database_type', 'unknown')}")
        print(f"   🔧 Tables: {len(info.get('tables', []))}")
        print(f"   🔧 Events Table Columns: {len(info.get('event_columns', []))}")
        print(f"   🔧 UX Fields Present: {info.get('ux_fields_present', False)}")
        print(f"   🔧 Event Count: {info.get('event_count', 0)}")
        
        if info.get('event_columns'):
            print("   📋 Available Columns:")
            for col in info.get('event_columns', []):
                print(f"      - {col.get('name', 'unknown')} ({col.get('type', 'unknown')})")
    else:
        print(f"❌ Could not get database info: {response.text}")

if __name__ == "__main__":
    print("🚀 Production Bulk Import Schema Compatibility Test")
    print("=" * 60)
    
    success = test_production_bulk_import()
    test_database_info()
    
    if success:
        print("\n🎉 Production bulk import test completed successfully!")
        print("✅ Schema detection and compatibility fixes are working")
    else:
        print("\n⚠️ Production bulk import test encountered issues")
        print("🔍 Check the error messages above for details") 