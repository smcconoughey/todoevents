#!/usr/bin/env python3
"""
Comprehensive Bulk Import Fix
Addresses both UX fields and PostgreSQL syntax issues
"""
import requests
import time

BASE_URL = "https://todoevents-backend.onrender.com"

def run_all_fixes():
    """Run all available fixes in the correct order"""
    print("🚀 Comprehensive Bulk Import Fix")
    print("=" * 50)
    
    fixes = [
        {
            "name": "Database Migration",
            "endpoint": "/admin/migrate-database",
            "description": "Ensures all required columns exist"
        },
        {
            "name": "Production Database Fix", 
            "endpoint": "/admin/fix-production-database",
            "description": "Adds missing UX fields and fixes schema"
        },
        {
            "name": "Cache Clear",
            "endpoint": "/api/v1/automation/trigger/events", 
            "description": "Clears event cache"
        },
        {
            "name": "Database Cleanup",
            "endpoint": "/api/v1/automation/trigger/cleanup",
            "description": "Removes expired events and optimizes"
        },
        {
            "name": "Sitemap Regeneration",
            "endpoint": "/api/v1/automation/trigger/sitemap",
            "description": "Updates sitemap with current events"
        }
    ]
    
    successful_fixes = 0
    total_fixes = len(fixes)
    
    for i, fix in enumerate(fixes, 1):
        print(f"\n{i}. {fix['name']}")
        print(f"   {fix['description']}")
        
        try:
            response = requests.post(f"{BASE_URL}{fix['endpoint']}", timeout=60)
            
            if response.status_code == 200:
                print(f"   ✅ Success!")
                successful_fixes += 1
                
                # Show response details for important fixes
                if fix['name'] in ['Database Migration', 'Production Database Fix']:
                    try:
                        result = response.json()
                        if 'message' in result:
                            print(f"   📋 {result['message']}")
                    except:
                        pass
            else:
                print(f"   ⚠️ Returned status {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Failed: {e}")
    
    print(f"\n📊 Fix Summary: {successful_fixes}/{total_fixes} successful")
    return successful_fixes

def test_current_status():
    """Test the current status of bulk import functionality"""
    print("\n🔍 Testing Current Status...")
    
    try:
        # Test database info
        response = requests.get(f"{BASE_URL}/debug/database-info", timeout=15)
        if response.status_code == 200:
            info = response.json()
            print(f"   Database: {info.get('database_type')} (Production: {info.get('is_production')})")
            print(f"   Event count: {info.get('event_count', 'unknown')}")
            
            ux_present = info.get('ux_fields_present', False)
            print(f"   UX fields: {'✅' if ux_present else '❌'}")
            
            return ux_present
        else:
            print(f"   ❌ Database info check failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"   ❌ Status check failed: {e}")
        return None

def test_api_functionality():
    """Test basic API functionality"""
    print("\n🧪 Testing API Functionality...")
    
    try:
        # Test events endpoint
        response = requests.get(f"{BASE_URL}/events?limit=10", timeout=15)
        if response.status_code == 200:
            events = response.json()
            print(f"   ✅ Events API: {len(events)} events returned")
            
            # Check if recent events have UX fields
            if events:
                recent_event = events[0]
                has_fee_info = recent_event.get('fee_required') is not None
                has_event_url = recent_event.get('event_url') is not None  
                has_host_name = recent_event.get('host_name') is not None
                
                ux_field_count = sum([has_fee_info, has_event_url, has_host_name])
                print(f"   📊 Recent event UX fields: {ux_field_count}/3 present")
                
                if ux_field_count == 0:
                    print("   ⚠️ No UX fields in recent events - bulk import may be failing")
                else:
                    print("   ✅ UX fields present in recent events")
                    
            return True
        else:
            print(f"   ❌ Events API failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ API test failed: {e}")
        return False

def provide_recommendations():
    """Provide specific recommendations based on findings"""
    print("\n📋 Recommendations for Bulk Import Success:")
    print("   1. ALWAYS run this script after making backend changes")
    print("   2. Monitor backend logs during bulk imports for errors")
    print("   3. Use the /debug/database-info endpoint to verify schema")
    print("   4. Test with small bulk imports before large ones")
    print("   5. Run post_bulk_import_update.py after every bulk import")
    
    print("\n🔧 Manual Troubleshooting Steps:")
    print("   • If UX fields still missing: Check Render environment logs")
    print("   • If syntax errors persist: PostgreSQL/SQLite mismatch in code")
    print("   • If cache issues: Clear browser cache and try again")
    print("   • If events don't appear: Check pagination and date filters")

def main():
    """Main comprehensive fix function"""
    
    # 1. Test initial status
    print("📊 INITIAL STATUS CHECK")
    initial_ux_status = test_current_status()
    api_working = test_api_functionality()
    
    # 2. Run fixes
    print("\n📊 RUNNING FIXES")
    successful_fixes = run_all_fixes()
    
    # 3. Wait for changes to propagate
    print("\n⏳ Waiting for changes to propagate...")
    time.sleep(5)
    
    # 4. Test final status
    print("\n📊 FINAL STATUS CHECK")
    final_ux_status = test_current_status()
    final_api_working = test_api_functionality()
    
    # 5. Summary and recommendations
    print("\n🎯 SUMMARY")
    print("=" * 30)
    
    if final_ux_status is True and final_api_working is True:
        print("✅ SUCCESS! Bulk import functionality should now work correctly.")
        print("   • UX fields are present in database")
        print("   • API is responding correctly") 
        print("   • All automation fixes applied")
    elif final_ux_status is True:
        print("⚠️ PARTIAL SUCCESS: UX fields fixed but API issues remain")
    elif final_api_working is True:
        print("⚠️ PARTIAL SUCCESS: API working but UX fields still missing")
    else:
        print("❌ ISSUES REMAIN: Manual intervention may be required")
    
    provide_recommendations()
    
    print(f"\n🔢 Fixes Applied: {successful_fixes} successful")
    print("🎉 Fix attempt complete!")

if __name__ == "__main__":
    main() 