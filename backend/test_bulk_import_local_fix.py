#!/usr/bin/env python3
"""
Local Bulk Import Test
Tests the bulk import functionality against local SQLite database to verify fixes
"""

import os
import sys
import json
import requests
import subprocess
import time
import threading
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

def start_local_server():
    """Start the local FastAPI server"""
    print("🚀 Starting local development server...")
    
    # Change to backend directory
    os.chdir(backend_dir)
    
    # Start the server using uvicorn
    try:
        process = subprocess.Popen(
            ["python", "-m", "uvicorn", "backend:app", "--host", "0.0.0.0", "--port", "8000"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait for server to start
        print("⏳ Waiting for server to start...")
        time.sleep(5)
        
        # Check if server is responding
        try:
            response = requests.get("http://localhost:8000/health", timeout=5)
            if response.status_code == 200:
                print("✅ Local server started successfully")
                return process
            else:
                print(f"❌ Server health check failed: {response.status_code}")
                process.terminate()
                return None
        except requests.exceptions.RequestException as e:
            print(f"❌ Could not connect to server: {e}")
            process.terminate()
            return None
            
    except Exception as e:
        print(f"❌ Failed to start server: {e}")
        return None

def create_admin_user():
    """Create admin user for testing"""
    print("👤 Creating admin user...")
    
    admin_data = {
        "email": "test@admin.com",
        "password": "TestPassword123!",
        "role": "admin"
    }
    
    try:
        response = requests.post("http://localhost:8000/users", json=admin_data)
        if response.status_code in [200, 400]:  # 400 means user already exists
            print("✅ Admin user ready")
            return True
        else:
            print(f"❌ Failed to create admin user: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        return False

def login_admin():
    """Login as admin and get token"""
    print("🔑 Logging in as admin...")
    
    login_data = {
        "username": "test@admin.com",
        "password": "TestPassword123!"
    }
    
    try:
        response = requests.post("http://localhost:8000/token", data=login_data)
        if response.status_code == 200:
            token_data = response.json()
            print("✅ Successfully authenticated")
            return token_data["access_token"]
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_database_schema():
    """Test database schema detection"""
    print("🔍 Testing database schema detection...")
    
    try:
        response = requests.get("http://localhost:8000/debug/database-info")
        if response.status_code == 200:
            info = response.json()
            print("✅ Database Schema Information:")
            print(f"   📊 Database Type: {info.get('database_type', 'unknown')}")
            print(f"   📊 Table Count: {len(info.get('tables', []))}")
            print(f"   📊 Events Table Columns: {len(info.get('event_columns', []))}")
            print(f"   📊 UX Fields Present: {info.get('ux_fields_present', False)}")
            print(f"   📊 SEO Fields Present: {info.get('seo_fields_present', False)}")
            
            # Show some column details
            if info.get('event_columns'):
                print("   📋 Sample Columns:")
                for col in info.get('event_columns', [])[:10]:  # Show first 10
                    print(f"      - {col.get('name', 'unknown')}")
            
            return True
        else:
            print(f"❌ Could not get database info: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Database info error: {e}")
        return False

def test_bulk_import(token):
    """Test bulk import functionality"""
    print("📦 Testing bulk import functionality...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create test events
    test_events = [
        {
            "title": f"Local Test Event 1 - {int(time.time())}",
            "description": "Testing local bulk import with schema detection",
            "date": "2024-12-15",
            "start_time": "14:00",
            "end_time": "16:00",
            "category": "business",
            "address": "123 Test Street, Nashville, TN 37203, USA",
            "lat": 36.1627,
            "lng": -86.7816,
            "recurring": False,
            "fee_required": "Free admission",
            "event_url": "https://test-event.local",
            "host_name": "Local Test Host"
        },
        {
            "title": f"Local Test Event 2 - {int(time.time())}",
            "description": "Testing schema compatibility with different fields",
            "date": "2024-12-16",
            "start_time": "19:00",
            "end_time": "21:00",
            "category": "social",
            "address": "456 Development Ave, Austin, TX 78701, USA",
            "lat": 30.2672,
            "lng": -97.7431,
            "recurring": False,
            "fee_required": "$15 per person",
            "event_url": "https://another-test.local",
            "host_name": "Dev Test Organization"
        },
        {
            "title": f"Local Test Event 3 - {int(time.time())}",
            "description": "Testing edge cases and special characters: àáâã & 'quotes' \"double\" #hashtag @mention",
            "date": "2024-12-17",
            "start_time": "10:00",
            "category": "education",
            "address": "789 Unicode Lane, San Francisco, CA 94102, USA",
            "lat": 37.7749,
            "lng": -122.4194,
            "recurring": True,
            "frequency": "weekly"
        }
    ]
    
    bulk_data = {"events": test_events}
    
    try:
        print(f"📤 Sending bulk import request with {len(test_events)} events...")
        response = requests.post("http://localhost:8000/admin/events/bulk", json=bulk_data, headers=headers)
        
        print(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Bulk import completed successfully!")
            print(f"   📊 Success Count: {result.get('success_count', 0)}")
            print(f"   📊 Error Count: {result.get('error_count', 0)}")
            
            if result.get('errors'):
                print("❌ Errors encountered:")
                for error in result['errors']:
                    print(f"     - Event {error.get('index', '?')}: {error.get('error', 'Unknown error')}")
            
            if result.get('created_events'):
                print(f"✅ Successfully created {len(result['created_events'])} events:")
                for event in result['created_events']:
                    print(f"     - {event.get('title', 'Unnamed')} (ID: {event.get('id', '?')})")
                    print(f"       📍 Location: {event.get('city', '?')}, {event.get('state', '?')}")
                    print(f"       🔗 Slug: {event.get('slug', 'No slug')}")
                    print(f"       💰 Price: ${event.get('price', 0)}")
            
            return result.get('success_count', 0) == len(test_events)
        else:
            print(f"❌ Bulk import failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error Details: {error_data}")
            except:
                print(f"   Raw Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Bulk import error: {e}")
        return False

def main():
    """Main test function"""
    print("🧪 Local Bulk Import Schema Compatibility Test")
    print("=" * 60)
    
    # Start local server
    server_process = start_local_server()
    if not server_process:
        print("❌ Could not start local server")
        return False
    
    try:
        # Create admin user
        if not create_admin_user():
            print("❌ Could not create admin user")
            return False
        
        # Login and get token
        token = login_admin()
        if not token:
            print("❌ Could not authenticate")
            return False
        
        # Test database schema
        if not test_database_schema():
            print("❌ Database schema test failed")
            return False
        
        # Test bulk import
        success = test_bulk_import(token)
        
        if success:
            print("\n🎉 All tests completed successfully!")
            print("✅ Local bulk import functionality is working correctly")
            print("✅ Schema detection and compatibility fixes are operational")
            return True
        else:
            print("\n⚠️ Some tests failed")
            return False
    
    finally:
        # Clean up
        print("\n🧹 Cleaning up...")
        if server_process:
            server_process.terminate()
            print("✅ Local server stopped")

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1) 