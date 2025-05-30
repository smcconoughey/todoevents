#!/usr/bin/env python3
"""
Script to fix NULL interest_count and view_count values in production database
"""
import requests
import time

def fix_null_counters():
    """Fix NULL values in production database counters"""
    print("🔧 Fixing NULL counter values in production database...")
    
    try:
        # First, check current schema status
        print("1. Checking database schema...")
        schema_response = requests.get("https://todoevents-backend.onrender.com/debug/schema")
        if schema_response.status_code == 200:
            schema_data = schema_response.json()
            print("✅ Database schema check successful")
            
            # Check if events table has the counter columns
            events_columns = schema_data.get('events_table', {}).get('columns', [])
            has_interest_count = any(col['column_name'] == 'interest_count' for col in events_columns)
            has_view_count = any(col['column_name'] == 'view_count' for col in events_columns)
            
            print(f"   Interest count column: {'✅' if has_interest_count else '❌'}")
            print(f"   View count column: {'✅' if has_view_count else '❌'}")
        else:
            print("❌ Failed to check database schema")
            return
        
        # Now create tables (this should also fix NULL values)
        print("\n2. Updating database counters...")
        create_response = requests.post("https://todoevents-backend.onrender.com/debug/create-tables")
        
        if create_response.status_code == 200:
            result = create_response.json()
            print("✅ Database update successful")
            print(f"   Message: {result.get('message', 'Unknown')}")
            if 'events_updated' in result:
                print(f"   Events updated: {result['events_updated']}")
        else:
            print(f"❌ Failed to update database: {create_response.status_code}")
            print(f"   Error: {create_response.text}")
            return
        
        # Test an endpoint to see if it works now
        print("\n3. Testing endpoints...")
        test_response = requests.get("https://todoevents-backend.onrender.com/events")
        if test_response.status_code == 200:
            events = test_response.json()
            if events:
                event_id = events[0]['id']
                print(f"   Testing with event ID: {event_id}")
                
                # Test interest status
                interest_response = requests.get(f"https://todoevents-backend.onrender.com/events/{event_id}/interest")
                if interest_response.status_code == 200:
                    print("   ✅ Interest endpoint working")
                else:
                    print(f"   ❌ Interest endpoint failed: {interest_response.status_code}")
                
                # Test view tracking  
                view_response = requests.post(f"https://todoevents-backend.onrender.com/events/{event_id}/view")
                if view_response.status_code == 200:
                    print("   ✅ View tracking working")
                else:
                    print(f"   ❌ View tracking failed: {view_response.status_code}")
            else:
                print("   No events found for testing")
        else:
            print(f"   ❌ Failed to get events for testing: {test_response.status_code}")
        
        print("\n🎉 Production database fix completed!")
        
    except Exception as e:
        print(f"❌ Error fixing database: {str(e)}")

if __name__ == "__main__":
    fix_null_counters() 