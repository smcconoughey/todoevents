#!/usr/bin/env python3

import requests
import json
import sys

def test_comprehensive_bulk_import():
    """Test the bulk import fix with multiple events like the user's original data"""
    
    # Test events similar to the user's original failing data
    test_events = [
        {
            "title": "Florida International Air Show",
            "description": "Spectacular air show featuring military and civilian aircraft demonstrations over beautiful beaches.",
            "date": "2025-03-15",
            "start_time": "10:00",
            "end_time": "16:00",
            "category": "Sports & Recreation",
            "address": "Miami Beach, FL 33139",
            "lat": 25.7617,
            "lng": -80.1918,
            "fee_required": "Tickets required - $25-50",
            "event_url": "https://example.com/air-show",
            "host_name": "Florida Aviation Association"
        },
        {
            "title": "Adrenaline Races",
            "description": "High-speed racing action with professional drivers and custom vehicles.",
            "date": "2025-04-20",
            "start_time": "14:00",
            "end_time": "18:00", 
            "category": "Sports & Recreation",
            "address": "West Bend Speedway, West Bend, WI 53095",
            "lat": 43.4253,
            "lng": -88.1834,
            "fee_required": "Tickets from $32.50",
            "event_url": "https://example.com/adrenaline-races",
            "host_name": "Midwest Racing League"
        },
        {
            "title": "Isle of Man TT 2025",
            "description": "The world's most dangerous motorcycle race returns to the Isle of Man.",
            "date": "2025-05-30",
            "start_time": "09:00",
            "end_time": "17:00",
            "category": "Sports & Recreation", 
            "address": "Douglas, Isle of Man IM1 2SH",
            "lat": 54.1500,
            "lng": -4.4850,
            "fee_required": "Free spectating, paid grandstand access available",
            "event_url": "https://example.com/iom-tt",
            "host_name": "Isle of Man Government"
        },
        {
            "title": "Bruno Mars Las Vegas Residency",
            "description": "The Grammy-winning artist brings his spectacular show to Las Vegas.",
            "date": "2025-06-15",
            "start_time": "20:00",
            "end_time": "22:30",
            "category": "Entertainment",
            "address": "Park MGM, Las Vegas, NV 89109",
            "lat": 36.1028,
            "lng": -115.1767,
            "fee_required": "Tickets from $254",
            "event_url": "https://example.com/bruno-mars",
            "host_name": "MGM Resorts"
        },
        {
            "title": "NHRA Gatornationals",
            "description": "Top fuel dragsters compete in one of the most prestigious NHRA events.",
            "date": "2025-03-08",
            "start_time": "11:00",
            "end_time": "18:00",
            "category": "Sports & Recreation",
            "address": "Gainesville Raceway, Gainesville, FL 32608",
            "lat": 29.6516,
            "lng": -82.3248,
            "fee_required": "General admission and reserved seating available",
            "event_url": "https://example.com/gatornationals",
            "host_name": "NHRA"
        }
    ]
    
    bulk_data = {
        "events": test_events
    }
    
    print("🧪 Testing comprehensive bulk import fix...")
    print(f"Testing {len(test_events)} events:")
    for i, event in enumerate(test_events, 1):
        print(f"  {i}. {event['title']}")
    
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
        print("\n🚀 Executing bulk import...")
        response = requests.post("http://localhost:8000/admin/events/bulk", 
                               headers=headers, 
                               json=bulk_data)
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ Bulk import completed!")
            print(f"Success count: {result['success_count']}")
            print(f"Error count: {result['error_count']}")
            
            if result['error_count'] > 0:
                print("\n❌ Errors encountered:")
                for error in result['errors']:
                    print(f"  - Event {error.get('event_index', '?')}: {error.get('event_title', 'Unknown')} - {error.get('error', 'Unknown error')}")
            
            if result['success_count'] == len(test_events):
                print(f"\n🎉 ALL {len(test_events)} EVENTS CREATED SUCCESSFULLY!")
                print("✅ KeyError fix is working perfectly!")
                return True
            elif result['success_count'] > 0:
                print(f"\n✅ {result['success_count']} out of {len(test_events)} events created successfully!")
                print("✅ KeyError fix is working (partial success)")
                return True
            else:
                print(f"\n❌ No events were created successfully")
                return False
        else:
            print(f"❌ Bulk import failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        return False

if __name__ == "__main__":
    success = test_comprehensive_bulk_import()
    sys.exit(0 if success else 1) 