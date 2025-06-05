#!/usr/bin/env python3

import requests
import json
import sys

# Test the bulk import fix
def test_bulk_import_fix():
    """Test the fixed bulk import endpoint with a single event"""
    
    # Simple test event
    test_event = {
        "title": "Test Event - Bulk Import Fix",
        "description": "Testing if the bulk import KeyError is fixed",
        "date": "2025-07-01",
        "start_time": "18:00",
        "end_time": "20:00",
        "category": "Entertainment",
        "address": "123 Test Street, Test City, TC 12345",
        "lat": 40.7128,
        "lng": -74.0060,
        "fee_required": "Free event",
        "event_url": "https://example.com/test-event",
        "host_name": "Test Organizer"
    }
    
    bulk_data = {
        "events": [test_event]
    }
    
    print("🧪 Testing bulk import fix...")
    print(f"Test event: {test_event['title']}")
    
    try:
        # Login first to get token
        login_response = requests.post("http://localhost:8000/token", 
                                     data={"username": "test-admin@todo-events.com", "password": "TestAdmin123!"})
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"Response: {login_response.text}")
            return False
        
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Test bulk import
        response = requests.post("http://localhost:8000/admin/events/bulk", 
                               headers=headers, 
                               json=bulk_data)
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Bulk import successful!")
            print(f"Success count: {result['success_count']}")
            print(f"Error count: {result['error_count']}")
            
            if result['error_count'] > 0:
                print("Errors:")
                for error in result['errors']:
                    print(f"  - {error}")
            
            if result['success_count'] > 0:
                print("✅ KeyError fix successful!")
                return True
            else:
                print("❌ No events were created")
                return False
        else:
            print(f"❌ Bulk import failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        return False

if __name__ == "__main__":
    success = test_bulk_import_fix()
    sys.exit(0 if success else 1) 