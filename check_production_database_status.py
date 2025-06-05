#!/usr/bin/env python3

import requests
import json
from datetime import datetime

def check_production_database():
    """Check the actual production database status"""
    
    print("🔍 PRODUCTION DATABASE STATUS CHECK")
    print("=" * 60)
    
    backend_url = 'https://todoevents-backend.onrender.com'
    
    try:
        # Check database info
        print("1. Checking database information...")
        response = requests.get(f'{backend_url}/debug/database-info', timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Database Type: {data.get('database_type', 'unknown')}")
            print(f"   📊 Total Events: {data.get('event_count', 'unknown')}")
            print(f"   📋 Column Count: {data.get('column_count', 'unknown')}")
            print(f"   🎯 Has UX Fields: {data.get('ux_fields_present', 'unknown')}")
            
            # Check available columns
            columns = data.get('available_columns', [])
            print(f"   📝 Available Columns ({len(columns)}):")
            
            # Check specifically for UX enhancement fields
            required_ux_fields = [
                'fee_required', 'event_url', 'host_name',
                'slug', 'city', 'state', 'price', 'currency',
                'short_description', 'organizer_url', 'is_published'
            ]
            
            present_ux = [field for field in required_ux_fields if field in columns]
            missing_ux = [field for field in required_ux_fields if field not in columns]
            
            print(f"   ✅ Present UX Fields: {present_ux}")
            print(f"   ❌ Missing UX Fields: {missing_ux}")
            
            # Check basic required fields
            basic_fields = ['id', 'title', 'description', 'date', 'start_time', 'category', 'address', 'lat', 'lng']
            missing_basic = [field for field in basic_fields if field not in columns]
            
            if missing_basic:
                print(f"   🚨 CRITICAL: Missing basic fields: {missing_basic}")
            else:
                print(f"   ✅ All basic fields present")
                
        else:
            print(f"   ❌ Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Connection Error: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("2. Testing bulk import error reproduction...")
    
    # Test the schema detection that's failing
    try:
        response = requests.get(f'{backend_url}/debug/schema', timeout=30)
        if response.status_code == 200:
            schema_data = response.json()
            print(f"   📊 Schema Detection: {schema_data.get('total_columns', 0)} columns")
            print(f"   🔍 Detection Method: {schema_data.get('detection_method', 'unknown')}")
        else:
            print(f"   ⚠️ Schema endpoint error: {response.status_code}")
    except Exception as e:
        print(f"   ⚠️ Schema check failed: {e}")
    
    print("\n" + "=" * 60)
    print("🎯 DIAGNOSIS:")
    print("=" * 60)
    
    if missing_ux:
        print("❌ **ROOT CAUSE IDENTIFIED**")
        print(f"   The production PostgreSQL database is missing {len(missing_ux)} UX enhancement fields")
        print(f"   Missing: {', '.join(missing_ux)}")
        print("")
        print("🔧 **REQUIRED ACTION:**")
        print("   1. Add missing columns to production database")
        print("   2. Set appropriate default values")
        print("   3. Update database schema to match backend expectations")
    else:
        print("✅ **UX FIELDS PRESENT**")
        print("   The database schema appears complete")
        print("   The KeyError issue may be in the code logic")
        
    print(f"\n🏁 Check completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    return len(missing_ux) == 0

if __name__ == "__main__":
    check_production_database() 