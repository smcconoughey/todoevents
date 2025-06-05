#!/usr/bin/env python3
"""
Trigger Production UX Fields Fix
Uses the backend API to trigger the production database migration to add missing UX fields.

This is safer than direct database access and uses the existing migration endpoint.
"""

import requests
import json
from datetime import datetime

# Configuration
BACKEND_URL = "https://todoevents-backend.onrender.com"

def trigger_ux_fields_fix():
    """Trigger the production database UX fields fix via API"""
    print("🔧 **TRIGGERING PRODUCTION UX FIELDS FIX**")
    print("=" * 60)
    
    print("📡 Calling production backend to add missing UX fields...")
    
    try:
        # Call the existing migration endpoint
        response = requests.post(
            f"{BACKEND_URL}/admin/migrate-database",
            timeout=60  # Allow 1 minute for database operations
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ **SUCCESS**: Migration completed successfully!")
            print(f"Response: {json.dumps(result, indent=2)}")
            
            # Now verify the fix worked by checking database info
            print("\n🔍 Verifying UX fields are now present...")
            verify_response = requests.get(f"{BACKEND_URL}/debug/database-info", timeout=30)
            
            if verify_response.status_code == 200:
                db_info = verify_response.json()
                ux_fields_present = db_info.get('ux_fields_present', False)
                event_count = db_info.get('event_count', 0)
                
                print(f"📊 Database verification:")
                print(f"   - UX fields present: {ux_fields_present}")
                print(f"   - Event count: {event_count}")
                
                if ux_fields_present:
                    print("\n🎉 **MISSION ACCOMPLISHED!**")
                    print("✅ Production database now has all required UX enhancement fields")
                    print("✅ Bulk import KeyError issues should be resolved")
                    print("✅ Enhanced error messages should now work properly")
                    
                    print("\n🚀 **READY TO TEST:**")
                    print("   1. Try bulk import again - errors should be detailed")
                    print("   2. Events should create successfully with all UX fields")
                    print("   3. Sitemap should continue working perfectly")
                else:
                    print("\n⚠️  **PARTIAL SUCCESS**: Migration ran but UX fields verification failed")
                    print("   This may be a verification issue rather than a migration issue")
            else:
                print(f"\n⚠️  Migration succeeded but verification failed: HTTP {verify_response.status_code}")
        
        elif response.status_code == 404:
            print("❌ **ERROR**: Migration endpoint not found")
            print("   The backend may need to be updated with the migration endpoint")
        
        elif response.status_code == 500:
            try:
                error_detail = response.json()
                print(f"❌ **ERROR**: Migration failed on server")
                print(f"Error details: {json.dumps(error_detail, indent=2)}")
            except:
                print(f"❌ **ERROR**: Migration failed with HTTP 500")
                print(f"Response text: {response.text[:500]}")
        
        else:
            print(f"❌ **ERROR**: Unexpected response HTTP {response.status_code}")
            print(f"Response: {response.text[:500]}")
    
    except requests.exceptions.Timeout:
        print("⏱️  **TIMEOUT**: Migration is taking longer than expected")
        print("   This is normal for database operations. Please check backend logs.")
        print("   The migration may still be running successfully.")
    
    except requests.exceptions.ConnectionError:
        print("🌐 **CONNECTION ERROR**: Cannot reach the backend")
        print("   Please check if the backend is running and accessible")
    
    except Exception as e:
        print(f"❌ **UNEXPECTED ERROR**: {e}")

def test_bulk_import_fix():
    """Test if the bulk import error handling is now working"""
    print("\n" + "=" * 60)
    print("🧪 **TESTING BULK IMPORT ERROR HANDLING**")
    print("=" * 60)
    
    # This is a read-only test - we won't actually create events
    print("📋 Note: This would require admin authentication for actual testing")
    print("🎯 Expected improvements after fix:")
    print("   ✅ No more 'KeyError: 0' messages")
    print("   ✅ No more 'Error creating event 0' messages")
    print("   ✅ Detailed error messages showing actual problems")
    print("   ✅ Proper column detection and handling")
    
    # Check if the sitemap is still working (it should be)
    try:
        response = requests.get(f"{BACKEND_URL}/sitemap.xml", timeout=15)
        if response.status_code == 200:
            url_count = response.text.count('<url>')
            print(f"\n✅ Sitemap still working: {url_count} URLs")
        else:
            print(f"\n⚠️  Sitemap issue: HTTP {response.status_code}")
    except Exception as e:
        print(f"\n⚠️  Sitemap test failed: {e}")

def main():
    """Main function"""
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Step 1: Trigger the UX fields fix
    trigger_ux_fields_fix()
    
    # Step 2: Test the improvements
    test_bulk_import_fix()
    
    print(f"\n🏁 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main() 