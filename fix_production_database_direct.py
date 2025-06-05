#!/usr/bin/env python3

import requests
import json
from datetime import datetime

def fix_production_database():
    """Direct fix for production database schema issues"""
    
    print("🔧 DIRECT PRODUCTION DATABASE FIX")
    print("=" * 60)
    print("This will add missing UX enhancement columns to the PostgreSQL database")
    print("")
    
    backend_url = 'https://todoevents-backend.onrender.com'
    
    # Step 1: Test current connection
    print("1. Testing production backend connection...")
    try:
        response = requests.get(f'{backend_url}/health', timeout=30)
        if response.status_code == 200:
            print("   ✅ Backend is responsive")
        else:
            print(f"   ❌ Backend health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Connection failed: {e}")
        return False
    
    # Step 2: Trigger table creation/migration
    print("\n2. Triggering database table creation...")
    try:
        response = requests.post(f'{backend_url}/debug/create-tables', timeout=60)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Result: {data.get('message', 'Tables created/updated')}")
        else:
            print(f"   ⚠️ Response: {response.text}")
    except Exception as e:
        print(f"   ⚠️ Table creation error: {e}")
    
    # Step 3: Test UX fields directly
    print("\n3. Testing UX field handling...")
    try:
        response = requests.post(f'{backend_url}/debug/test-ux-fields', timeout=30)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   📊 Available columns: {data.get('available_columns', 0)}")
            print(f"   🎯 UX fields working: {data.get('ux_test_passed', False)}")
            
            if data.get('missing_columns'):
                print(f"   ❌ Missing columns: {data.get('missing_columns')}")
            
        else:
            print(f"   ❌ UX test failed: {response.text}")
    except Exception as e:
        print(f"   ❌ UX test error: {e}")
    
    # Step 4: Use the specific column addition endpoint
    print("\n4. Adding missing SEO/UX columns...")
    try:
        response = requests.post(f'{backend_url}/api/seo/populate-production-fields', timeout=120)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ SEO population: {data.get('message', 'Completed')}")
            if data.get('updated_events'):
                print(f"   📊 Updated events: {data.get('updated_events')}")
        else:
            print(f"   ⚠️ SEO population response: {response.text}")
    except Exception as e:
        print(f"   ⚠️ SEO population error: {e}")
    
    # Step 5: Test a simple event creation
    print("\n5. Testing event creation with UX fields...")
    test_event = {
        "title": "Database Test Event",
        "description": "Testing if UX fields work after migration",
        "date": "2025-12-31",
        "start_time": "23:59",
        "category": "technology",
        "address": "Test Location",
        "lat": 40.7128,
        "lng": -74.0060,
        "fee_required": "Test fee",
        "event_url": "https://test.com",
        "host_name": "Test Host"
    }
    
    # Note: This would require admin authentication, so we'll just test the endpoint
    print("   ⚠️ Event creation test requires admin authentication")
    print("   🎯 Test manually: POST /events with admin token")
    
    print("\n" + "=" * 60)
    print("🧪 VERIFICATION TEST")
    print("=" * 60)
    
    # Final verification
    try:
        response = requests.get(f'{backend_url}/debug/database-info', timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data.get('error') == '0':
                print("❌ **SCHEMA ISSUE STILL EXISTS**")
                print("   The database info endpoint still returns error '0'")
                print("   This indicates the schema detection is failing")
            else:
                print("✅ **DATABASE INFO WORKING**")
                print(f"   Database type: {data.get('database_type')}")
                print(f"   Event count: {data.get('event_count')}")
        else:
            print(f"❌ Database info endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Verification error: {e}")
    
    print("\n" + "=" * 60)
    print("📋 SUMMARY & NEXT STEPS")
    print("=" * 60)
    print("✅ **ACTIONS TAKEN:**")
    print("   1. Triggered table creation endpoint")
    print("   2. Tested UX field handling")
    print("   3. Ran SEO field population")
    print("   4. Verified database status")
    print("")
    print("🧪 **TO TEST IF FIXED:**")
    print("   1. Try your bulk import again with the same JSON")
    print("   2. Look for elimination of 'KeyError: 0' messages")
    print("   3. Check for successful event creation")
    print("")
    print("❌ **IF STILL FAILING:**")
    print("   The issue may require direct PostgreSQL database access")
    print("   Consider contacting Render support for database schema inspection")
    
    print(f"\n🏁 Fix attempt completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    fix_production_database() 