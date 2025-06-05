#!/usr/bin/env python3
"""
Trigger UX Fields Fix via API
Uses existing API endpoints to fix missing UX fields in production
"""
import requests
import time

BASE_URL = "https://todoevents-backend.onrender.com"

def test_database_status():
    """Check current database status"""
    print("🔍 Checking current database status...")
    
    try:
        response = requests.get(f"{BASE_URL}/debug/database-info", timeout=15)
        if response.status_code == 200:
            info = response.json()
            print(f"   Database type: {info.get('database_type')}")
            print(f"   Event count: {info.get('event_count', 'unknown')}")
            
            ux_present = info.get('ux_fields_present', False)
            print(f"   UX fields present: {'✅' if ux_present else '❌'}")
            
            if not ux_present:
                print("   ⚠️ UX fields missing - this explains bulk import issues!")
                return False
            else:
                print("   ✅ UX fields are present")
                return True
        else:
            print(f"   ❌ Database info check failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"   ❌ Database status check failed: {e}")
        return None

def trigger_database_migration():
    """Trigger the database migration endpoint"""
    print("\n🔧 Triggering database migration...")
    
    try:
        response = requests.post(f"{BASE_URL}/admin/migrate-database", timeout=60)
        print(f"   Migration response: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Migration completed: {result}")
            return True
        else:
            print(f"   ⚠️ Migration response: {response.status_code}")
            if response.text:
                print(f"   Response: {response.text[:200]}...")
            return False
    except Exception as e:
        print(f"   ❌ Migration trigger failed: {e}")
        return False

def trigger_production_database_fix():
    """Trigger the production database fix endpoint"""
    print("\n🔧 Triggering production database fix...")
    
    try:
        response = requests.post(f"{BASE_URL}/admin/fix-production-database", timeout=60)
        print(f"   Fix response: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Production fix completed: {result}")
            return True
        else:
            print(f"   ⚠️ Production fix response: {response.status_code}")
            if response.text:
                print(f"   Response: {response.text[:200]}...")
            return False
    except Exception as e:
        print(f"   ❌ Production fix trigger failed: {e}")
        return False

def test_ux_fields_endpoint():
    """Test the UX fields test endpoint"""
    print("\n🧪 Testing UX fields endpoint...")
    
    try:
        response = requests.post(f"{BASE_URL}/debug/test-ux-fields", timeout=30)
        print(f"   UX test response: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ UX fields test: {result}")
            return True
        else:
            print(f"   ⚠️ UX test response: {response.status_code}")
            if response.text:
                print(f"   Response: {response.text[:200]}...")
            return False
    except Exception as e:
        print(f"   ❌ UX fields test failed: {e}")
        return False

def verify_fix_success():
    """Verify that the fix was successful"""
    print("\n✅ Verifying fix success...")
    
    # Wait a moment for changes to take effect
    time.sleep(3)
    
    # Check database status again
    ux_present = test_database_status()
    
    if ux_present is True:
        print("   ✅ UX fields fix successful!")
        return True
    elif ux_present is False:
        print("   ❌ UX fields still missing")
        return False
    else:
        print("   ⚠️ Could not verify fix status")
        return None

def run_comprehensive_fix():
    """Run all available fix methods"""
    print("\n🔧 Running comprehensive fix...")
    
    fixes_attempted = 0
    fixes_successful = 0
    
    # Method 1: Database migration
    fixes_attempted += 1
    if trigger_database_migration():
        fixes_successful += 1
    
    # Method 2: Production database fix
    fixes_attempted += 1
    if trigger_production_database_fix():
        fixes_successful += 1
    
    # Method 3: UX fields test (may also fix)
    fixes_attempted += 1
    if test_ux_fields_endpoint():
        fixes_successful += 1
    
    print(f"\n📊 Fix Summary: {fixes_successful}/{fixes_attempted} methods successful")
    return fixes_successful > 0

def main():
    """Main function to fix UX fields via API"""
    print("🚀 TodoEvents UX Fields Fix (via API)")
    print("=" * 50)
    
    # 1. Check initial status
    initial_status = test_database_status()
    
    if initial_status is True:
        print("\n✅ UX fields already present! No fix needed.")
        print("   This means the bulk import issues are caused by something else.")
        return
    elif initial_status is False:
        print("\n⚠️ UX fields missing - proceeding with fix...")
    else:
        print("\n⚠️ Could not determine initial status - attempting fix anyway...")
    
    # 2. Attempt fixes
    fix_success = run_comprehensive_fix()
    
    # 3. Verify results
    if fix_success:
        final_status = verify_fix_success()
        
        if final_status is True:
            print("\n🎉 SUCCESS! UX fields have been added to production database!")
            print("\n📋 Next Steps:")
            print("1. Test bulk import functionality")
            print("2. Run: python test_bulk_import_consistency.py")
            print("3. Try a small bulk import to verify it works")
        elif final_status is False:
            print("\n❌ Fix attempts completed but UX fields still missing")
            print("   This may require manual database intervention")
        else:
            print("\n⚠️ Fix completed but verification inconclusive")
            print("   Try testing bulk import to see if it works now")
    else:
        print("\n❌ All fix attempts failed")
        print("   This may require manual database schema updates")
    
    print("\n📊 Bulk Import Troubleshooting:")
    print("   • If UX fields are missing, bulk imports will partially fail")
    print("   • Events may be created but without UX data (fee, URL, host)")
    print("   • This leads to 'inconsistent' behavior where some data is saved")

if __name__ == "__main__":
    main() 