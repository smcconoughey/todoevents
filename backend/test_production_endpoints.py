#!/usr/bin/env python3

import requests
import json

def test_production_endpoints():
    """Test the production interest and view tracking endpoints"""
    
    base_url = "https://todoevents-backend.onrender.com"
    
    print("🧪 Testing Production Interest & View Tracking Endpoints")
    print("=" * 60)
    
    # Test health endpoint first
    print("\n1. Testing health endpoint...")
    try:
        response = requests.get(f"{base_url}/health")
        print(f"Health: {response.status_code} - {response.json()}")
    except Exception as e:
        print(f"Health error: {e}")
    
    # Test events list (to get a valid event ID)
    print("\n2. Getting event list...")
    try:
        response = requests.get(f"{base_url}/events")
        events = response.json()
        if events:
            event_id = events[0]['id']
            print(f"Using event ID: {event_id}")
        else:
            print("No events found")
            return
    except Exception as e:
        print(f"Events error: {e}")
        return
    
    # Test interest status endpoint (GET)
    print(f"\n3. Testing interest status for event {event_id}...")
    try:
        response = requests.get(f"{base_url}/events/{event_id}/interest")
        print(f"Interest GET: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Interest GET error: {e}")
    
    # Test view tracking endpoint (POST)
    print(f"\n4. Testing view tracking for event {event_id}...")
    try:
        response = requests.post(f"{base_url}/events/{event_id}/view")
        print(f"View POST: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"View POST error: {e}")
    
    # Test interest toggle endpoint (POST)
    print(f"\n5. Testing interest toggle for event {event_id}...")
    try:
        response = requests.post(f"{base_url}/events/{event_id}/interest")
        print(f"Interest POST: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Interest POST error: {e}")
    
    # Test if events now include counters
    print(f"\n6. Checking if events include interest/view counters...")
    try:
        response = requests.get(f"{base_url}/events")
        events = response.json()
        if events:
            first_event = events[0]
            print(f"Event fields: {list(first_event.keys())}")
            interest_count = first_event.get('interest_count', 'MISSING')
            view_count = first_event.get('view_count', 'MISSING')
            print(f"Interest count: {interest_count}, View count: {view_count}")
        else:
            print("No events found to check counters")
    except Exception as e:
        print(f"Events counter check error: {e}")
    
    print("\n✅ Production endpoint testing completed!")

if __name__ == "__main__":
    test_production_endpoints() 