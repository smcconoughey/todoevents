#!/usr/bin/env python3
"""
Test script for new interest and view tracking features
"""

import requests
import json

# Configuration
API_BASE = "http://localhost:8000"

def test_interest_endpoints():
    """Test the interest tracking endpoints"""
    print("🧪 Testing Interest Tracking...")
    
    # Test getting interest status for a non-existent event
    response = requests.get(f"{API_BASE}/events/999/interest")
    print(f"Non-existent event interest check: {response.status_code}")
    
    # Test getting interest status for event ID 1 (assuming it exists)
    response = requests.get(f"{API_BASE}/events/1/interest")
    if response.status_code == 200:
        data = response.json()
        print(f"Event 1 interest status: {data}")
    else:
        print(f"Event 1 interest check failed: {response.status_code}")
    
    # Test toggling interest for event ID 1
    response = requests.post(f"{API_BASE}/events/1/interest")
    if response.status_code == 200:
        data = response.json()
        print(f"Interest toggle result: {data}")
    else:
        print(f"Interest toggle failed: {response.status_code}")

def test_view_endpoints():
    """Test the view tracking endpoints"""
    print("\n👁️ Testing View Tracking...")
    
    # Test tracking a view for event ID 1
    response = requests.post(f"{API_BASE}/events/1/view")
    if response.status_code == 200:
        data = response.json()
        print(f"View tracking result: {data}")
    else:
        print(f"View tracking failed: {response.status_code}")
    
    # Test tracking another view (should not increment due to deduplication)
    response = requests.post(f"{API_BASE}/events/1/view")
    if response.status_code == 200:
        data = response.json()
        print(f"Duplicate view tracking result: {data}")
    else:
        print(f"Duplicate view tracking failed: {response.status_code}")

def test_events_include_counters():
    """Test that events now include interest and view counts"""
    print("\n📊 Testing Event Counter Display...")
    
    response = requests.get(f"{API_BASE}/events")
    if response.status_code == 200:
        events = response.json()
        if events:
            event = events[0]
            print(f"First event counters: interest_count={event.get('interest_count', 'MISSING')}, view_count={event.get('view_count', 'MISSING')}")
        else:
            print("No events found")
    else:
        print(f"Events list failed: {response.status_code}")

if __name__ == "__main__":
    print("🚀 Testing New Interest & View Features")
    print("=" * 50)
    
    try:
        test_interest_endpoints()
        test_view_endpoints()
        test_events_include_counters()
        print("\n✅ Tests completed!")
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to backend. Make sure it's running on localhost:8000")
    except Exception as e:
        print(f"❌ Test error: {e}") 