#!/usr/bin/env python3
"""
Test script to verify the current error handling improvements in bulk import and sitemap functionality.
This will help determine if the fixes are already deployed or need deployment.
"""

import requests
import json
import traceback
from datetime import datetime

# Configuration
BACKEND_URL = "https://todoevents-backend.onrender.com"  # Production
# BACKEND_URL = "http://localhost:8000"  # Local testing

def test_error_handling_improvements():
    """Test the current status of error handling improvements"""
    print("🧪 Testing Current Error Handling Status")
    print("=" * 60)
    
    results = {}
    
    # Test 1: Check sitemap generation (should work with PostgreSQL fixes)
    print("\n1. Testing Sitemap Generation...")
    try:
        response = requests.get(f"{BACKEND_URL}/sitemap.xml", timeout=30)
        if response.status_code == 200:
            content = response.text
            url_count = content.count('<url>')
            results['sitemap'] = {
                'status': 'success',
                'url_count': url_count,
                'contains_events': 'event/' in content
            }
            print(f"   ✅ Sitemap working: {url_count} URLs found")
            if 'event/' in content:
                print("   ✅ Individual event URLs present")
            else:
                print("   ⚠️  No individual event URLs (may need deployment)")
        else:
            results['sitemap'] = {'status': 'failed', 'code': response.status_code}
            print(f"   ❌ Sitemap failed: HTTP {response.status_code}")
    except Exception as e:
        results['sitemap'] = {'status': 'error', 'error': str(e)}
        print(f"   ❌ Sitemap error: {e}")
    
    # Test 2: Check events sitemap endpoint (PostgreSQL date casting fix)
    print("\n2. Testing Events Sitemap Endpoint...")
    try:
        response = requests.get(f"{BACKEND_URL}/api/seo/sitemap/events", timeout=30)
        if response.status_code == 200:
            try:
                content = response.text
                url_count = content.count('<url>')
                results['events_sitemap'] = {
                    'status': 'success',
                    'url_count': url_count
                }
                print(f"   ✅ Events sitemap working: {url_count} URLs")
            except:
                results['events_sitemap'] = {'status': 'success', 'note': 'XML response'}
                print("   ✅ Events sitemap responding")
        else:
            results['events_sitemap'] = {'status': 'failed', 'code': response.status_code}
            print(f"   ❌ Events sitemap failed: HTTP {response.status_code}")
    except Exception as e:
        results['events_sitemap'] = {'status': 'error', 'error': str(e)}
        print(f"   ❌ Events sitemap error: {e}")
    
    # Test 3: Check if enhanced error logging is in place (simple event creation test)
    print("\n3. Testing Enhanced Error Handling (Read-only checks)...")
    try:
        # Check database info endpoint to see if enhanced functions are available
        response = requests.get(f"{BACKEND_URL}/debug/database-info", timeout=15)
        if response.status_code == 200:
            db_info = response.json()
            results['database_info'] = {
                'status': 'success',
                'is_production': db_info.get('is_production', False),
                'event_count': db_info.get('event_count', 0),
                'ux_fields_present': db_info.get('ux_fields_present', False)
            }
            print(f"   ✅ Database info available")
            print(f"   📊 Production: {db_info.get('is_production')}")
            print(f"   📊 Event count: {db_info.get('event_count')}")
            print(f"   📊 UX fields present: {db_info.get('ux_fields_present')}")
        else:
            results['database_info'] = {'status': 'failed', 'code': response.status_code}
            print(f"   ❌ Database info failed: HTTP {response.status_code}")
    except Exception as e:
        results['database_info'] = {'status': 'error', 'error': str(e)}
        print(f"   ❌ Database info error: {e}")
    
    # Test 4: Check if backend has improved column detection
    print("\n4. Testing Column Detection Improvements...")
    try:
        # This is read-only - just checking if debug endpoint shows proper column detection
        response = requests.get(f"{BACKEND_URL}/debug/schema", timeout=15)
        if response.status_code == 200:
            schema_info = response.json()
            results['schema_detection'] = {
                'status': 'success',
                'column_count': len(schema_info.get('events_columns', [])),
                'has_ux_fields': any(col in ['fee_required', 'event_url', 'host_name'] 
                                   for col in schema_info.get('events_columns', []))
            }
            print(f"   ✅ Schema detection working: {len(schema_info.get('events_columns', []))} columns")
            if results['schema_detection']['has_ux_fields']:
                print("   ✅ UX enhancement fields detected")
            else:
                print("   ⚠️  UX enhancement fields missing")
        else:
            results['schema_detection'] = {'status': 'failed', 'code': response.status_code}
            print(f"   ❌ Schema detection failed: HTTP {response.status_code}")
    except Exception as e:
        results['schema_detection'] = {'status': 'error', 'error': str(e)}
        print(f"   ❌ Schema detection error: {e}")
    
    # Generate summary
    print("\n" + "=" * 60)
    print("📋 **SUMMARY**")
    print("=" * 60)
    
    working_features = sum(1 for test in results.values() if test.get('status') == 'success')
    total_features = len(results)
    
    print(f"✅ Working features: {working_features}/{total_features}")
    
    if results.get('sitemap', {}).get('status') == 'success':
        if results['sitemap'].get('contains_events'):
            print("🎯 **SITEMAP: FULLY DEPLOYED** - Individual event URLs present")
        else:
            print("🚀 **SITEMAP: PARTIALLY DEPLOYED** - Base working, needs individual events")
    else:
        print("❌ **SITEMAP: NEEDS DEPLOYMENT** - Basic sitemap not working")
    
    if results.get('events_sitemap', {}).get('status') == 'success':
        print("🎯 **EVENTS SITEMAP: DEPLOYED** - PostgreSQL fixes working")
    else:
        print("🚀 **EVENTS SITEMAP: NEEDS DEPLOYMENT** - PostgreSQL date casting issues")
    
    if results.get('database_info', {}).get('ux_fields_present'):
        print("🎯 **UX FIELDS: PRESENT** - Production database has enhancement fields")
    else:
        print("⚠️  **UX FIELDS: MISSING** - May need manual database migration")
    
    # Provide action recommendations
    print("\n📝 **RECOMMENDATIONS:**")
    if working_features == total_features:
        print("✨ All features working! Error handling improvements are deployed.")
    elif working_features >= total_features * 0.75:
        print("🚀 Most features working. Consider deployment to complete fixes.")
    else:
        print("🔧 Multiple issues detected. Full deployment recommended.")
        print("   - Deploy latest backend code to Render")
        print("   - Verify database schema has UX enhancement fields")
        print("   - Test bulk import with improved error messages")
    
    return results

if __name__ == "__main__":
    try:
        test_results = test_error_handling_improvements()
        print(f"\n🏁 Test completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        print(f"Traceback: {traceback.format_exc()}") 