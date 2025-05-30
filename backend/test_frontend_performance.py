#!/usr/bin/env python3
"""
Test frontend API performance for tracking endpoints
"""

import requests
import time

BASE_URL = "https://todoevents-backend.onrender.com"

def test_response_times():
    print("⚡ Testing API Response Times")
    print("=" * 40)
    
    # Test different endpoints
    test_event_id = 34
    
    endpoints = [
        ("GET Events List", f"{BASE_URL}/events"),
        ("GET Event Details", f"{BASE_URL}/events/{test_event_id}"), 
        ("GET Interest Status", f"{BASE_URL}/events/{test_event_id}/interest"),
        ("POST View Track", f"{BASE_URL}/events/{test_event_id}/view"),
        ("POST Interest Toggle", f"{BASE_URL}/events/{test_event_id}/interest"),
    ]
    
    for name, url in endpoints:
        try:
            start_time = time.time()
            
            if "POST" in name:
                response = requests.post(url, timeout=10)
            else:
                response = requests.get(url, timeout=10)
                
            end_time = time.time()
            response_time = (end_time - start_time) * 1000  # Convert to ms
            
            status = "✅" if response.status_code == 200 else "❌"
            print(f"{status} {name}: {response_time:.0f}ms (Status: {response.status_code})")
            
            # Add small delay between requests
            time.sleep(0.2)
            
        except Exception as e:
            print(f"❌ {name}: ERROR - {str(e)}")
    
    print(f"\n✅ Performance test completed!")

if __name__ == "__main__":
    test_response_times() 