#!/usr/bin/env python3
"""
Script to add premium columns to production database using debug endpoint
"""

import requests
import json

def add_premium_columns():
    """Try to add premium columns using various methods"""
    
    # Try to use the debug endpoint that was added
    endpoints_to_try = [
        "https://todoevents-backend.onrender.com/debug/create-missing-tables",
        "https://todoevents-backend.onrender.com/debug/create-tables",
        "https://todoevents-backend.onrender.com/debug/privacy-requests-table"
    ]
    
    for endpoint in endpoints_to_try:
        print(f"🔍 Trying endpoint: {endpoint}")
        try:
            if "create-missing-tables" in endpoint:
                response = requests.post(endpoint)
            else:
                response = requests.get(endpoint)
            
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                
                if "create-missing-tables" in endpoint and data.get("success"):
                    print("✅ Premium columns should now be added!")
                    return True
            else:
                print(f"Error: {response.text}")
        except Exception as e:
            print(f"❌ Error with {endpoint}: {str(e)}")
    
    return False

if __name__ == "__main__":
    print("🚀 Adding premium columns to production database...")
    success = add_premium_columns()
    
    if success:
        print("✅ Premium columns added successfully!")
    else:
        print("❌ Failed to add premium columns automatically")
        print("💡 Manual database migration may be required") 