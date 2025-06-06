#!/usr/bin/env python3

import requests
import json
import os
from datetime import datetime, timedelta

# Configuration
API_BASE_URL = "https://todoevents-backend.onrender.com"
# API_BASE_URL = "http://localhost:8000"  # For local testing

# Test admin credentials (replace with your actual admin credentials)
ADMIN_EMAIL = "admin@todoevents.com"
ADMIN_PASSWORD = "your_admin_password"

def login():
    """Login as admin to get auth token"""
    print("🔐 Logging in as admin...")
    
    login_data = {
        "username": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    response = requests.post(
        f"{API_BASE_URL}/token",
        data=login_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    if response.status_code == 200:
        token = response.json()["access_token"]
        print(f"✅ Successfully logged in")
        return token
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def create_test_events():
    """Create test event data"""
    base_date = datetime.now() + timedelta(days=1)
    
    events = [
        {
            "title": "Fixed Bulk Import Test Event 1",
            "description": "Testing the fixed bulk import functionality with proven create_event logic",
            "date": base_date.strftime("%Y-%m-%d"),
            "start_time": "18:00",
            "end_time": "20:00",
            "category": "networking",
            "address": "123 Tech Street, San Francisco, CA",
            "lat": 37.7749,
            "lng": -122.4194,
            "fee_required": "Free",
            "event_url": "https://example.com/event1",
            "host_name": "Tech Meetup Group"
        },
        {
            "title": "Fixed Bulk Import Test Event 2", 
            "description": "Second test event to verify multiple event creation works correctly",
            "date": (base_date + timedelta(days=1)).strftime("%Y-%m-%d"),
            "start_time": "19:00",
            "end_time": "21:00",
            "category": "social",
            "address": "456 Community Avenue, San Francisco, CA",
            "lat": 37.7849,
            "lng": -122.4094,
            "fee_required": "$10",
            "event_url": "https://example.com/event2",
            "host_name": "Community Center"
        }
    ]
    
    return events

def test_bulk_import_simple(token):
    """Test the bulk-simple endpoint (uses create_event logic)"""
    print("\n🧪 Testing /admin/events/bulk-simple endpoint...")
    
    events = create_test_events()
    
    bulk_data = {
        "events": events
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.post(
        f"{API_BASE_URL}/admin/events/bulk-simple",
        json=bulk_data,
        headers=headers
    )
    
    print(f"Response Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Simple bulk import successful!")
        print(f"   - Success count: {result['success_count']}")
        print(f"   - Error count: {result['error_count']}")
        
        if result['created_events']:
            print(f"   - Created event IDs: {[event['id'] for event in result['created_events']]}")
        
        if result['errors']:
            print(f"   - Errors: {result['errors']}")
            
        return result['created_events']
    else:
        print(f"❌ Simple bulk import failed: {response.text}")
        return []

def test_bulk_import_robust(token):
    """Test the bulk endpoint (now uses create_event logic too)"""
    print("\n🧪 Testing /admin/events/bulk endpoint...")
    
    events = create_test_events()
    # Modify titles to avoid duplicates
    events[0]['title'] = "Robust Bulk Import Test Event 1"
    events[1]['title'] = "Robust Bulk Import Test Event 2"
    
    bulk_data = {
        "events": events
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.post(
        f"{API_BASE_URL}/admin/events/bulk",
        json=bulk_data,
        headers=headers
    )
    
    print(f"Response Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Robust bulk import successful!")
        print(f"   - Success count: {result['success_count']}")
        print(f"   - Error count: {result['error_count']}")
        
        if result['created_events']:
            print(f"   - Created event IDs: {[event['id'] for event in result['created_events']]}")
        
        if result['errors']:
            print(f"   - Errors: {result['errors']}")
            
        return result['created_events']
    else:
        print(f"❌ Robust bulk import failed: {response.text}")
        return []

def verify_events_in_api(created_events):
    """Verify that created events appear in the main events API"""
    print(f"\n🔍 Verifying {len(created_events)} events appear in main API...")
    
    response = requests.get(f"{API_BASE_URL}/events?limit=200")
    
    if response.status_code == 200:
        all_events = response.json()
        created_ids = {event['id'] for event in created_events}
        found_ids = {event['id'] for event in all_events if event['id'] in created_ids}
        
        print(f"✅ Found {len(found_ids)}/{len(created_ids)} events in main API")
        
        missing_ids = created_ids - found_ids
        if missing_ids:
            print(f"❌ Missing event IDs: {missing_ids}")
            return False
        else:
            print(f"✅ All bulk imported events are visible in the API!")
            return True
    else:
        print(f"❌ Failed to fetch events: {response.status_code}")
        return False

def main():
    print("🚀 Testing Fixed Bulk Import Functionality")
    print("=" * 50)
    
    # Login
    token = login()
    if not token:
        return
    
    # Test both endpoints
    created_events = []
    
    # Test simple endpoint
    simple_events = test_bulk_import_simple(token)
    created_events.extend(simple_events)
    
    # Test robust endpoint  
    robust_events = test_bulk_import_robust(token)
    created_events.extend(robust_events)
    
    # Verify events appear in API
    if created_events:
        success = verify_events_in_api(created_events)
        
        if success:
            print("\n🎉 BULK IMPORT FIX VERIFICATION SUCCESSFUL!")
            print("✅ Both bulk import endpoints now work correctly")
            print("✅ Events are immediately visible in the main API")
        else:
            print("\n⚠️  Bulk import created events but they may not be visible")
    else:
        print("\n❌ No events were created - bulk import may still have issues")

if __name__ == "__main__":
    main() 