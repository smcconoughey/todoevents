#!/usr/bin/env python3
"""
Auto-Fix Bulk Import Issues
Simple script to run after bulk imports to ensure consistency
"""
import requests
import time

BASE_URL = "https://todoevents-backend.onrender.com"

def main():
    """Quick auto-fix for bulk import issues"""
    print("🔧 Auto-Fixing Bulk Import Issues...")
    
    # Essential fixes that should be run after every bulk import
    fixes = [
        ("Cache refresh", "/api/v1/automation/trigger/events"),
        ("Database cleanup", "/api/v1/automation/trigger/cleanup"), 
        ("Sitemap update", "/api/v1/automation/trigger/sitemap"),
        ("Schema fix", "/admin/fix-production-database")
    ]
    
    success_count = 0
    
    for name, endpoint in fixes:
        try:
            print(f"   Running {name}...")
            response = requests.post(f"{BASE_URL}{endpoint}", timeout=30)
            if response.status_code == 200:
                print(f"   ✅ {name} completed")
                success_count += 1
            else:
                print(f"   ⚠️ {name} returned: {response.status_code}")
        except Exception as e:
            print(f"   ❌ {name} failed: {e}")
    
    print(f"\n📊 Completed: {success_count}/{len(fixes)} fixes successful")
    
    if success_count == len(fixes):
        print("✅ All fixes completed successfully!")
    else:
        print("⚠️ Some fixes had issues - check logs for details")
    
    print("\n💡 TIP: Run this script after every bulk import for best results!")

if __name__ == "__main__":
    main() 