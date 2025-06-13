#!/usr/bin/env python3
"""
Debug script to check premium columns in production database
"""

import os
import sys
import requests
import json

def check_production_schema():
    """Check if premium columns exist in production"""
    base_url = "https://todoevents-backend.onrender.com"
    
    try:
        # Check the debug schema endpoint
        response = requests.get(f"{base_url}/debug/schema", timeout=30)
        
        if response.status_code == 200:
            schema_data = response.json()
            print("✅ Production schema check successful")
            print(f"Database type: {schema_data.get('database_type', 'unknown')}")
            
            # Check users table columns
            events_columns = schema_data.get('events_table', {}).get('columns', [])
            print(f"Events table has {len(events_columns)} columns")
            
            # Look for premium columns in the response
            print("\n🔍 Looking for premium-related information...")
            print(json.dumps(schema_data, indent=2))
            
        else:
            print(f"❌ Schema check failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error checking production schema: {e}")

def check_premium_users_endpoint():
    """Check the premium users endpoint directly"""
    base_url = "https://todoevents-backend.onrender.com"
    
    try:
        # Try to access the premium users endpoint (will fail due to auth, but we can see the error)
        response = requests.get(f"{base_url}/admin/premium-users", timeout=30)
        
        print(f"\n📊 Premium users endpoint status: {response.status_code}")
        print(f"Response: {response.text}")
        
    except Exception as e:
        print(f"❌ Error checking premium users endpoint: {e}")

def main():
    print("🔍 Checking production database schema and premium endpoints...")
    print("=" * 60)
    
    check_production_schema()
    check_premium_users_endpoint()
    
    print("\n" + "=" * 60)
    print("✅ Debug check completed")

if __name__ == "__main__":
    main() 