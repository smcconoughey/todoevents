#!/usr/bin/env python3

import asyncio
import aiohttp
import json
import time
from datetime import datetime, timedelta

# Test configuration
API_BASE_URL = "http://localhost:8000"
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "TestPassword123!"

# Test event data
TEST_EVENT = {
    "title": "Duplicate Test Event",
    "description": "This is a test event to verify duplicate prevention",
    "date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
    "start_time": "14:00",
    "end_time": "16:00",
    "category": "community",
    "address": "123 Test Street, Test City",
    "lat": 40.7128,
    "lng": -74.0060,
    "recurring": False,
    "frequency": None
}

# Slightly different coordinates (should still be detected as duplicate)
TEST_EVENT_VARIANT = {
    **TEST_EVENT,
    "title": "duplicate test event",  # Different case
    "lat": 40.712801,  # Very close coordinate
    "lng": -74.006001,  # Very close coordinate
}

async def create_test_user(session):
    """Create a test user for authentication"""
    try:
        async with session.post(f"{API_BASE_URL}/users", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }) as response:
            if response.status == 200:
                print("✅ Test user created successfully")
                return True
            elif response.status == 400:
                # User might already exist
                print("ℹ️ Test user might already exist, continuing...")
                return True
            else:
                print(f"❌ Failed to create test user: {response.status}")
                return False
    except Exception as e:
        print(f"❌ Error creating test user: {e}")
        return False

async def login_user(session):
    """Login and get authentication token"""
    try:
        form_data = aiohttp.FormData()
        form_data.add_field('username', TEST_USER_EMAIL)
        form_data.add_field('password', TEST_USER_PASSWORD)
        
        async with session.post(f"{API_BASE_URL}/token", data=form_data) as response:
            if response.status == 200:
                data = await response.json()
                token = data.get('access_token')
                print(f"✅ Successfully logged in, token: {token[:20]}...")
                return token
            else:
                print(f"❌ Login failed: {response.status}")
                text = await response.text()
                print(f"Response: {text}")
                return None
    except Exception as e:
        print(f"❌ Error during login: {e}")
        return None

async def create_event(session, token, event_data, test_name=""):
    """Create an event and return the response"""
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        async with session.post(f"{API_BASE_URL}/events", 
                              json=event_data, 
                              headers=headers) as response:
            
            status = response.status
            try:
                data = await response.json()
            except:
                data = await response.text()
            
            print(f"  {test_name}: Status {status}")
            if status == 200 or status == 201:
                print(f"    ✅ Event created successfully (ID: {data.get('id', 'unknown')})")
                return True, data
            elif status == 409:
                print(f"    🚫 Duplicate prevented: {data.get('detail', 'No message')}")
                return False, data
            else:
                print(f"    ❌ Unexpected status: {data}")
                return False, data
                
    except Exception as e:
        print(f"    ❌ Error creating event: {e}")
        return False, str(e)

async def test_concurrent_creation(session, token, event_data, num_requests=5):
    """Test concurrent event creation to check for race conditions"""
    print(f"\n🔄 Testing concurrent creation ({num_requests} simultaneous requests)...")
    
    tasks = []
    for i in range(num_requests):
        task = create_event(session, token, event_data, f"Request {i+1}")
        tasks.append(task)
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    successes = sum(1 for success, _ in results if success)
    failures = len(results) - successes
    
    print(f"  Results: {successes} successes, {failures} duplicates prevented")
    
    if successes == 1 and failures == num_requests - 1:
        print("  ✅ Perfect! Only 1 event created, rest were prevented")
        return True
    elif successes > 1:
        print(f"  ❌ DUPLICATE BUG: {successes} events were created!")
        return False
    else:
        print(f"  ⚠️ Unexpected result: {successes} successes")
        return False

async def cleanup_test_events(session, token):
    """Clean up any test events that were created"""
    try:
        headers = {'Authorization': f'Bearer {token}'}
        
        # Get user's events
        async with session.get(f"{API_BASE_URL}/events/manage", headers=headers) as response:
            if response.status == 200:
                events = await response.json()
                
                # Delete any test events
                for event in events:
                    if "test" in event.get('title', '').lower():
                        async with session.delete(f"{API_BASE_URL}/events/{event['id']}", headers=headers) as del_response:
                            if del_response.status == 200:
                                print(f"  🗑️ Cleaned up test event: {event['title']} (ID: {event['id']})")
                            else:
                                print(f"  ⚠️ Failed to delete event {event['id']}")
                                
    except Exception as e:
        print(f"  ⚠️ Error during cleanup: {e}")

async def main():
    """Main test function"""
    print("=" * 80)
    print("DUPLICATE PREVENTION TEST")
    print("=" * 80)
    print(f"Testing against: {API_BASE_URL}")
    print(f"Test user: {TEST_USER_EMAIL}")
    print()
    
    async with aiohttp.ClientSession() as session:
        # Step 1: Create test user
        print("📝 Step 1: Setting up test user...")
        if not await create_test_user(session):
            print("❌ Failed to set up test user. Aborting.")
            return
        
        # Step 2: Login
        print("\n🔑 Step 2: Authenticating...")
        token = await login_user(session)
        if not token:
            print("❌ Failed to authenticate. Aborting.")
            return
        
        # Step 3: Clean up any existing test events
        print("\n🧹 Step 3: Cleaning up existing test events...")
        await cleanup_test_events(session, token)
        
        # Step 4: Test basic duplicate prevention
        print("\n🔍 Step 4: Testing basic duplicate prevention...")
        print("  Creating first event...")
        success1, data1 = await create_event(session, token, TEST_EVENT, "First attempt")
        
        print("  Attempting to create identical event...")
        success2, data2 = await create_event(session, token, TEST_EVENT, "Duplicate attempt")
        
        if success1 and not success2:
            print("  ✅ Basic duplicate prevention works!")
        else:
            print("  ❌ Basic duplicate prevention failed!")
            return
        
        # Step 5: Test case-insensitive and coordinate tolerance
        print("\n🔍 Step 5: Testing case-insensitive and coordinate tolerance...")
        success3, data3 = await create_event(session, token, TEST_EVENT_VARIANT, "Variant attempt")
        
        if not success3:
            print("  ✅ Case-insensitive and coordinate tolerance works!")
        else:
            print("  ❌ Case-insensitive or coordinate tolerance failed!")
            return
        
        # Step 6: Test concurrent creation (race condition)
        print("\n🏃 Step 6: Testing concurrent creation for race conditions...")
        
        # First clean up the test event
        await cleanup_test_events(session, token)
        
        # Create a different test event for concurrent testing
        concurrent_test_event = {
            **TEST_EVENT,
            "title": "Concurrent Test Event",
            "lat": 41.7128,  # Different location
            "lng": -75.0060,
            "start_time": "15:00"  # Different time
        }
        
        # Test concurrent creation
        concurrent_success = await test_concurrent_creation(session, token, concurrent_test_event, 5)
        
        if not concurrent_success:
            print("  ❌ Concurrent creation test failed!")
            return
        
        # Final cleanup
        print("\n🧹 Final cleanup...")
        await cleanup_test_events(session, token)
        
        print("\n" + "=" * 80)
        print("✅ ALL TESTS PASSED! Duplicate prevention is working correctly.")
        print("=" * 80)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️ Test interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Test failed with error: {e}") 