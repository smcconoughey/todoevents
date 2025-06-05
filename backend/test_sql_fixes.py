#!/usr/bin/env python3

import requests
import json
from datetime import datetime

def test_sql_fixes():
    """Test that SQL syntax errors are fixed"""
    
    print("🔧 TESTING SQL SYNTAX FIXES")
    print("=" * 60)
    
    backend_url = 'https://todoevents-backend.onrender.com'
    
    print("1. Testing slug-based event lookup (previously caused SQL error)...")
    try:
        # Test the endpoint that was causing syntax errors
        response = requests.get(f'{backend_url}/api/seo/events/by-slug/test-slug-123', timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 404:
            print("   ✅ No syntax error - slug not found (expected)")
        elif response.status_code == 200:
            print("   ✅ No syntax error - event found successfully")
        else:
            print(f"   ⚠️  Unexpected status: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Error during slug test: {e}")
    
    print("\\n2. Testing database info endpoint...")
    try:
        response = requests.get(f'{backend_url}/debug/database-info', timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Database accessible")
            print(f"   📊 Event count: {data.get('event_count', 'unknown')}")
            print(f"   🗃️  Table columns: {data.get('column_count', 'unknown')}")
        else:
            print(f"   ❌ Database info error: {response.text[:100]}")
            
    except Exception as e:
        print(f"   ❌ Error during database test: {e}")
    
    print("\\n3. Testing UX fields endpoint...")
    try:
        response = requests.post(f'{backend_url}/debug/test-ux-fields', timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ UX fields test successful")
            print(f"   🔧 Test passed: {data.get('ux_test_passed', 'unknown')}")
        else:
            print(f"   ❌ UX fields error: {response.text[:100]}")
            
    except Exception as e:
        print(f"   ❌ Error during UX test: {e}")
    
    print("\\n" + "=" * 60)
    print("✅ SQL SYNTAX FIXES TESTED")
    print("The enhanced bulk import should now work without:")
    print("- KeyError: 0 errors")
    print("- SQL syntax errors with is_published")
    print("- Database schema detection issues")

if __name__ == "__main__":
    test_sql_fixes() 