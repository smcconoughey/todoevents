#!/usr/bin/env python3
"""
Simple Bulk Import Consistency Test
Tests if events are properly saved and retrievable after bulk import
"""
import requests
import time
import json

# Configuration
BASE_URL = "https://todoevents-backend.onrender.com"

def test_api_basic():
    """Test basic API functionality"""
    print("🔍 Testing API basics...")
    
    try:
        # Test health endpoint
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"   Health: {response.status_code} ({'✅' if response.status_code == 200 else '❌'})")
        
        # Test events endpoint
        response = requests.get(f"{BASE_URL}/events?limit=10", timeout=10)
        if response.status_code == 200:
            events = response.json()
            print(f"   Events API: ✅ ({len(events)} events returned)")
            
            # Show recent events
            if events:
                print("   Recent events:")
                for i, event in enumerate(events[:3]):
                    print(f"      {i+1}. {event.get('title', 'NO TITLE')} (ID: {event.get('id', 'NO ID')})")
            else:
                print("   ⚠️ No events returned from API")
        else:
            print(f"   Events API: ❌ ({response.status_code})")
            
    except Exception as e:
        print(f"   API Test Failed: ❌ ({e})")

def test_cache_behavior():
    """Test cache clearing and consistency"""
    print("\n🧹 Testing Cache Behavior...")
    
    try:
        # Get initial event count
        response = requests.get(f"{BASE_URL}/events?limit=1000", timeout=15)
        if response.status_code == 200:
            initial_count = len(response.json())
            print(f"   Initial event count: {initial_count}")
            
            # Clear cache
            print("   Clearing cache...")
            cache_response = requests.post(f"{BASE_URL}/api/v1/automation/trigger/events", timeout=10)
            if cache_response.status_code == 200:
                print("   ✅ Cache clear triggered")
                
                # Wait a moment
                time.sleep(2)
                
                # Check event count again
                response = requests.get(f"{BASE_URL}/events?limit=1000", timeout=15)
                if response.status_code == 200:
                    after_count = len(response.json())
                    print(f"   Event count after cache clear: {after_count}")
                    
                    if after_count != initial_count:
                        print(f"   ⚠️ Cache inconsistency detected! Count changed from {initial_count} to {after_count}")
                    else:
                        print("   ✅ Cache behavior appears consistent")
                else:
                    print(f"   ❌ Events API failed after cache clear: {response.status_code}")
            else:
                print(f"   ❌ Cache clear failed: {cache_response.status_code}")
        else:
            print(f"   ❌ Initial events API call failed: {response.status_code}")
            
    except Exception as e:
        print(f"   Cache test failed: ❌ ({e})")

def test_database_info():
    """Check database schema information"""
    print("\n🔍 Testing Database Info...")
    
    try:
        response = requests.get(f"{BASE_URL}/debug/database-info", timeout=10)
        if response.status_code == 200:
            db_info = response.json()
            print(f"   Database type: {db_info.get('database_type', 'unknown')}")
            print(f"   Is production: {db_info.get('is_production', 'unknown')}")
            print(f"   Event count: {db_info.get('event_count', 'unknown')}")
            
            # Check UX fields
            ux_fields = db_info.get('ux_fields_present', False)
            print(f"   UX fields present: {'✅' if ux_fields else '❌'}")
            
            # Show some column info
            columns = db_info.get('event_columns', [])
            print(f"   Database columns: {len(columns)} total")
            if columns:
                column_names = [col.get('name') for col in columns if isinstance(col, dict)]
                important_cols = ['fee_required', 'event_url', 'host_name', 'slug']
                for col in important_cols:
                    status = '✅' if col in column_names else '❌'
                    print(f"      {col}: {status}")
        else:
            print(f"   ❌ Database info failed: {response.status_code}")
            
    except Exception as e:
        print(f"   Database info test failed: ❌ ({e})")

def check_recent_events():
    """Check recent events for completeness"""
    print("\n📋 Checking Recent Events...")
    
    try:
        response = requests.get(f"{BASE_URL}/events?limit=20", timeout=10)
        if response.status_code == 200:
            events = response.json()
            print(f"   Found {len(events)} events")
            
            if events:
                complete_events = 0
                incomplete_events = 0
                
                for event in events:
                    # Check essential fields
                    has_title = bool(event.get('title'))
                    has_description = bool(event.get('description'))
                    has_slug = bool(event.get('slug'))
                    has_city = bool(event.get('city'))
                    has_fee_info = event.get('fee_required') is not None
                    
                    if has_title and has_description and has_slug:
                        complete_events += 1
                    else:
                        incomplete_events += 1
                        print(f"      ⚠️ Incomplete: {event.get('title', 'NO TITLE')} (ID: {event.get('id')})")
                        if not has_slug:
                            print(f"         Missing slug")
                        if not has_city:
                            print(f"         Missing city")
                        if not has_fee_info:
                            print(f"         Missing fee info")
                
                print(f"   Complete events: {complete_events}")
                print(f"   Incomplete events: {incomplete_events}")
                
                if incomplete_events > 0:
                    print(f"   ⚠️ {incomplete_events} events appear incomplete - this may indicate bulk import issues")
                else:
                    print("   ✅ All recent events appear complete")
            else:
                print("   ⚠️ No events found")
        else:
            print(f"   ❌ Events check failed: {response.status_code}")
            
    except Exception as e:
        print(f"   Recent events check failed: ❌ ({e})")

def run_post_import_fixes():
    """Run the post-import update script programmatically"""
    print("\n🔧 Running Post-Import Fixes...")
    
    fixes = [
        ("cleanup", "Database cleanup"),
        ("sitemap", "Sitemap regeneration"),
        ("events", "Cache refresh")
    ]
    
    for fix_type, description in fixes:
        try:
            print(f"   Running {description}...")
            response = requests.post(f"{BASE_URL}/api/v1/automation/trigger/{fix_type}", timeout=15)
            if response.status_code == 200:
                print(f"   ✅ {description} completed")
            else:
                print(f"   ⚠️ {description} returned: {response.status_code}")
        except Exception as e:
            print(f"   ❌ {description} failed: {e}")

def main():
    """Run bulk import consistency tests"""
    print("🚀 TodoEvents Bulk Import Consistency Test")
    print("=" * 50)
    
    # Run tests in order
    test_api_basic()
    test_cache_behavior()
    test_database_info()
    check_recent_events()
    
    print("\n" + "=" * 50)
    print("📋 SUMMARY:")
    print("If you see issues above, try running:")
    print("1. python post_bulk_import_update.py")
    print("2. Check admin logs for bulk import errors")
    print("3. Verify UX fields are present in database")
    
    # Offer to run fixes
    print("\n🔧 Running automatic fixes...")
    run_post_import_fixes()
    
    print("\n🎉 Test complete!")

if __name__ == "__main__":
    main() 