#!/usr/bin/env python3
"""
Post-Bulk Import Database Update Script
Triggers all necessary updates after bulk importing events
"""
import requests
import time
import sys

# Configuration
BASE_URL = "https://todoevents-backend.onrender.com"
# For local development, use: BASE_URL = "http://localhost:8000"

def trigger_update(task_name, description):
    """Trigger a specific automation task"""
    try:
        print(f"🔄 {description}...")
        response = requests.post(
            f"{BASE_URL}/api/v1/automation/trigger/{task_name}",
            timeout=30
        )
        
        if response.status_code == 200:
            print(f"✅ {description} triggered successfully")
            return True
        else:
            print(f"❌ {description} failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ {description} failed: {e}")
        return False

def main():
    """Run all post-bulk import updates"""
    print("🚀 Starting post-bulk import database updates...")
    print(f"   Target: {BASE_URL}")
    print()
    
    updates = [
        ("cleanup", "Cleaning up expired events"),
        ("sitemap", "Regenerating sitemap"),
        ("events", "Refreshing event data cache"),
    ]
    
    success_count = 0
    total_count = len(updates)
    
    for task_name, description in updates:
        if trigger_update(task_name, description):
            success_count += 1
        time.sleep(2)  # Brief pause between requests
        print()
    
    print("📊 Update Summary:")
    print(f"   ✅ Successful: {success_count}/{total_count}")
    print(f"   ❌ Failed: {total_count - success_count}/{total_count}")
    
    if success_count == total_count:
        print("\n🎉 All post-bulk import updates completed successfully!")
        return 0
    else:
        print(f"\n⚠️  Some updates failed. Check logs at {BASE_URL}/api/v1/automation/status")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 