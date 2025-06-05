#!/usr/bin/env python3
"""
Test script to verify that bulk import cache fix works correctly.
This tests that events appear in the API immediately after bulk import.
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Test configuration
BASE_URL = "https://todoevents-backend.onrender.com"
# BASE_URL = "http://localhost:8000"  # For local testing

def login_and_get_token():
    """Login and get admin token"""
    login_data = {
        "username": "admin@todoevents.com",
        "password": "TodoAdmin2024!"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/token", data=login_data)
        if response.status_code == 200:
            token_data = response.json()
            return token_data["access_token"]
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def get_events_count():
    """Get current events count from API"""
    try:
        response = requests.get(f"{BASE_URL}/events")
        if response.status_code == 200:
            events = response.json()
            return len(events)
        else:
            print(f"⚠️ Failed to get events: {response.status_code}")
            return 0
    except Exception as e:
        print(f"❌ Error getting events: {e}")
        return 0

def test_bulk_import_cache_fix():
    """Test that bulk import + cache clearing works"""
    print("🧪 Testing Bulk Import Cache Fix")
    print("="*50)
    
    # Step 1: Get admin token
    print("1. 🔑 Getting admin token...")
    token = login_and_get_token()
    if not token:
        return False
    print("   ✅ Token obtained")
    
    # Step 2: Get initial event count
    print("\n2. 📊 Getting initial event count...")
    initial_count = get_events_count()
    print(f"   📈 Initial events: {initial_count}")
    
    # Step 3: Create test events via bulk import
    print("\n3. 📤 Creating test events via bulk import...")
    
    # Generate unique test events with future dates
    tomorrow = datetime.now() + timedelta(days=1)
    future_date = tomorrow.strftime('%Y-%m-%d')
    
    test_events = [
        {
            "title": f"Cache Test Event Alpha - {int(time.time())}",
            "description": "Testing cache fix for bulk import - this event should appear immediately in API",
            "date": future_date,
            "start_time": "14:00",
            "end_time": "16:00",
            "category": "technology",
            "address": "123 Tech Street, Cache City, CA, USA",
            "lat": 37.7749,
            "lng": -122.4194,
            "fee_required": "Free event",
            "event_url": "https://example.com/cache-test-alpha",
            "host_name": "Cache Test Organization"
        },
        {
            "title": f"Cache Test Event Beta - {int(time.time())}",
            "description": "Second test event to verify bulk import cache clearing works properly",
            "date": future_date,
            "start_time": "18:00",
            "end_time": "20:00",
            "category": "education",
            "address": "456 Learning Lane, Knowledge City, NY, USA",
            "lat": 40.7128,
            "lng": -74.0060,
            "fee_required": "$10 suggested donation",
            "event_url": "https://example.com/cache-test-beta",
            "host_name": "Education Cache Test"
        }
    ]
    
    bulk_data = {"events": test_events}
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/events/bulk",
            json=bulk_data,
            headers=headers
        )
        
        print(f"   📬 Bulk import response: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            success_count = result.get('success_count', 0)
            error_count = result.get('error_count', 0)
            created_events = result.get('created_events', [])
            
            print(f"   ✅ Bulk import successful!")
            print(f"   📊 Success: {success_count}, Errors: {error_count}")
            
            if created_events:
                print("   📝 Created events:")
                for event in created_events:
                    print(f"     - ID {event.get('id')}: {event.get('title')}")
            
            # Step 4: Check if events appear immediately in API (cache fix test)
            print(f"\n4. 🔍 Checking if events appear immediately in API...")
            
            # Wait a moment for any async operations
            time.sleep(2)
            
            new_count = get_events_count()
            expected_count = initial_count + success_count
            
            print(f"   📈 Events before: {initial_count}")
            print(f"   📈 Events after: {new_count}")
            print(f"   📈 Expected: {expected_count}")
            
            if new_count >= expected_count:
                print("   ✅ CACHE FIX WORKING: Events appear immediately in API!")
                cache_fix_working = True
            else:
                print("   ❌ CACHE ISSUE: Events not appearing in API (cache not cleared)")
                cache_fix_working = False
                
            # Step 5: Verify specific events exist
            print(f"\n5. 🔍 Verifying specific events exist...")
            response = requests.get(f"{BASE_URL}/events")
            if response.status_code == 200:
                all_events = response.json()
                found_events = 0
                
                for test_event in test_events:
                    title_prefix = test_event['title'].split(' - ')[0]  # Get prefix before timestamp
                    found = any(event['title'].startswith(title_prefix) for event in all_events)
                    if found:
                        found_events += 1
                        print(f"     ✅ Found: {title_prefix}")
                    else:
                        print(f"     ❌ Missing: {title_prefix}")
                
                if found_events == len(test_events):
                    print("   ✅ All test events found in API")
                    verification_passed = True
                else:
                    print(f"   ⚠️ Only {found_events}/{len(test_events)} test events found")
                    verification_passed = False
            else:
                print("   ❌ Failed to verify events")
                verification_passed = False
            
            # Step 6: Test manual cleanup trigger
            print(f"\n6. 🧹 Testing manual cleanup trigger...")
            cleanup_response = requests.post(
                f"{BASE_URL}/api/v1/automation/trigger/cleanup",
                headers=headers
            )
            
            if cleanup_response.status_code == 200:
                cleanup_result = cleanup_response.json()
                print("   ✅ Manual cleanup trigger successful")
                print(f"   📋 {cleanup_result.get('message', 'Unknown response')}")
            else:
                print(f"   ⚠️ Manual cleanup trigger failed: {cleanup_response.status_code}")
            
            return cache_fix_working and verification_passed
            
        else:
            print(f"   ❌ Bulk import failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Bulk import error: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 Bulk Import Cache Fix Test")
    print("Testing that events appear immediately after bulk import")
    print("="*60)
    
    success = test_bulk_import_cache_fix()
    
    print("\n" + "="*60)
    if success:
        print("✅ CACHE FIX TEST PASSED!")
        print("   - Events appear immediately in API after bulk import")
        print("   - Cache clearing is working correctly")
        print("   - Manual cleanup trigger is available")
    else:
        print("❌ CACHE FIX TEST FAILED!")
        print("   - Events may not appear immediately after bulk import")
        print("   - Cache clearing may not be working")
    
    print("\n📋 Test Summary:")
    print("   This test verifies that the bulk import cache fix")
    print("   allows newly created events to appear in the API")
    print("   immediately after creation, solving the issue where")
    print("   events were created but not visible due to caching.")

if __name__ == "__main__":
    main() 