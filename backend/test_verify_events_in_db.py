#!/usr/bin/env python3
"""
Script to verify that events are actually being inserted into the database
and check cache behavior after bulk import.
"""

import requests
import sqlite3
import os
from datetime import datetime

# Configuration
BASE_URL = "https://todoevents-backend.onrender.com"
LOCAL_DB_PATH = "events.db"

def check_production_events():
    """Check events via production API"""
    try:
        print("🔍 Checking production events via API...")
        response = requests.get(f"{BASE_URL}/events", timeout=30)
        
        if response.status_code == 200:
            events = response.json()
            print(f"✅ API returned {len(events)} events")
            
            # Show recent events (latest 5)
            recent_events = sorted(events, key=lambda x: x.get('id', 0), reverse=True)[:5]
            print("\n📊 Most recent events:")
            for event in recent_events:
                print(f"  ID: {event.get('id')}, Title: {event.get('title')[:50]}...")
                
            return events
        else:
            print(f"❌ API request failed: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error checking production events: {e}")
        return None

def check_specific_event_ids():
    """Check for specific event IDs that were mentioned in logs"""
    event_ids = [452, 453, 444, 443, 442, 441]  # From the logs
    
    print(f"\n🎯 Checking specific event IDs: {event_ids}")
    
    found_events = []
    for event_id in event_ids:
        try:
            response = requests.get(f"{BASE_URL}/events/{event_id}", timeout=10)
            if response.status_code == 200:
                event = response.json()
                found_events.append(event)
                print(f"✅ Found event {event_id}: {event.get('title')}")
            elif response.status_code == 404:
                print(f"❌ Event {event_id} not found")
            else:
                print(f"⚠️ Event {event_id} - Status: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error checking event {event_id}: {e}")
    
    return found_events

def test_cache_behavior():
    """Test cache behavior with different parameters"""
    print(f"\n🧪 Testing cache behavior...")
    
    # Test with different parameter combinations
    test_params = [
        {},  # No parameters
        {"limit": 100},  # Different limit
        {"category": "music"},  # With category
        {"limit": 50, "offset": 0}  # Default parameters
    ]
    
    for i, params in enumerate(test_params):
        try:
            response = requests.get(f"{BASE_URL}/events", params=params, timeout=30)
            if response.status_code == 200:
                events = response.json()
                print(f"✅ Test {i+1} ({params}): {len(events)} events")
            else:
                print(f"❌ Test {i+1} failed: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Test {i+1} error: {e}")

def trigger_cache_clear():
    """Trigger cache clear via automation endpoint"""
    print(f"\n🧹 Triggering cache clear...")
    
    try:
        # Try to trigger event refresh which should clear cache
        response = requests.post(f"{BASE_URL}/api/v1/automation/trigger/events", timeout=30)
        if response.status_code == 200:
            print("✅ Cache clear triggered successfully")
            return True
        else:
            print(f"❌ Cache clear failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error triggering cache clear: {e}")
        return False

def main():
    """Main test function"""
    print("🔍 TodoEvents Database Verification Tool")
    print("=" * 50)
    
    # Step 1: Check current events via API
    events = check_production_events()
    
    # Step 2: Check specific event IDs from logs
    found_events = check_specific_event_ids()
    
    # Step 3: Test cache behavior
    test_cache_behavior()
    
    # Step 4: Try to clear cache and recheck
    if trigger_cache_clear():
        print(f"\n🔄 Rechecking after cache clear...")
        import time
        time.sleep(2)  # Wait for cache clear
        
        events_after = check_production_events()
        if events_after and events:
            if len(events_after) != len(events):
                print(f"📈 Event count changed: {len(events)} → {len(events_after)}")
            else:
                print(f"📊 Event count unchanged: {len(events)}")
    
    # Summary
    print(f"\n📋 Summary:")
    print(f"  - Total events via API: {len(events) if events else 'Unknown'}")
    print(f"  - Specific events found: {len(found_events)}")
    print(f"  - Cache clear attempted: {'Yes' if trigger_cache_clear else 'No'}")
    
    if found_events:
        print(f"\n✅ Found specific events from logs - events ARE in the database!")
    else:
        print(f"\n❌ Could not find specific events from logs")

if __name__ == "__main__":
    main() 