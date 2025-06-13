#!/usr/bin/env python3
"""
Production migration script for premium columns
"""

import os
import sys
import requests
import json

def run_production_migration():
    """Run the premium columns migration in production"""
    base_url = "https://todoevents-backend.onrender.com"
    
    try:
        print("🚀 Running premium columns migration in production...")
        
        # First check current schema
        print("📊 Checking current users table schema...")
        response = requests.get(f"{base_url}/debug/users-schema", timeout=60)
        
        if response.status_code == 200:
            schema_data = response.json()
            print("✅ Schema check successful")
            
            premium_columns = schema_data.get('premium_columns', {})
            missing_columns = premium_columns.get('missing', [])
            
            if missing_columns:
                print(f"❌ Missing premium columns: {missing_columns}")
                print("🔧 Need to run migration...")
                
                # Try to trigger migration via the create-tables endpoint
                print("🔨 Attempting to create premium columns...")
                migration_response = requests.post(f"{base_url}/debug/create-premium-columns", timeout=120)
                
                if migration_response.status_code == 200:
                    print("✅ Migration completed successfully!")
                    print(migration_response.text)
                else:
                    print(f"❌ Migration failed: {migration_response.status_code}")
                    print(migration_response.text)
            else:
                print("✅ All premium columns already exist!")
                
        else:
            print(f"❌ Schema check failed: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Error running production migration: {e}")

def main():
    print("🔧 Premium Columns Production Migration")
    print("=" * 50)
    
    run_production_migration()
    
    print("\n" + "=" * 50)
    print("✅ Migration process completed")

if __name__ == "__main__":
    main() 