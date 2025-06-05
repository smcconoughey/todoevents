#!/usr/bin/env python3

import requests
import json
import time

def test_sitemap_generation():
    """Test sitemap generation to ensure PostgreSQL date casting works"""
    print("🗺️ Testing Sitemap Generation")
    print("=" * 50)
    
    BASE_URL = "https://todoevents-backend.onrender.com"
    
    # 1. Test sitemap trigger
    print("\n📊 Testing sitemap trigger...")
    try:
        response = requests.post(f"{BASE_URL}/api/v1/automation/trigger/sitemap", timeout=30)
        if response.status_code == 200:
            print("✅ Sitemap trigger successful")
        else:
            print(f"❌ Sitemap trigger failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Sitemap trigger error: {e}")
        return False
    
    # 2. Wait a moment then check sitemap
    print("\n⏰ Waiting for sitemap generation...")
    time.sleep(5)
    
    try:
        response = requests.get(f"{BASE_URL}/sitemap.xml", timeout=15)
        if response.status_code == 200:
            sitemap_content = response.text
            
            # Count URLs
            url_count = sitemap_content.count('<url>')
            print(f"✅ Sitemap accessible with {url_count} URLs")
            
            # Check for individual event URLs
            event_urls = sitemap_content.count('/event/')
            legacy_urls = sitemap_content.count('/e/')
            date_urls = sitemap_content.count('/events/2025/')
            
            print(f"📝 Individual event URLs:")
            print(f"   - Main format (/event/): {event_urls}")
            print(f"   - Legacy format (/e/): {legacy_urls}")
            print(f"   - Date-indexed (/events/2025/): {date_urls}")
            
            # Check for city URLs
            city_urls = sitemap_content.count('this-weekend-in-')
            free_urls = sitemap_content.count('free-events-in-')
            
            print(f"🏙️ City-based URLs:")
            print(f"   - This weekend: {city_urls}")
            print(f"   - Free events: {free_urls}")
            
            return url_count > 100  # Should have substantial URLs
        else:
            print(f"❌ Sitemap not accessible: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Sitemap access error: {e}")
        return False

def test_events_sitemap_endpoint():
    """Test the events sitemap endpoint specifically"""
    print("\n📊 Testing Events Sitemap Endpoint")
    print("=" * 50)
    
    BASE_URL = "https://todoevents-backend.onrender.com"
    
    try:
        response = requests.get(f"{BASE_URL}/api/seo/sitemap/events", timeout=15)
        if response.status_code == 200:
            data = response.json()
            count = data.get('count', 0)
            print(f"✅ Events sitemap endpoint working")
            print(f"📊 {count} event entries found")
            
            if count > 0:
                entries = data.get('entries', [])
                sample_entry = entries[0] if entries else {}
                print(f"📝 Sample entry: {sample_entry.get('url', 'N/A')}")
            
            return True
        else:
            print(f"❌ Events sitemap endpoint failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Events sitemap endpoint error: {e}")
        return False

def test_bulk_import_simple():
    """Test a simple bulk import to see if the error handling is improved"""
    print("\n📦 Testing Bulk Import")
    print("=" * 50)
    
    BASE_URL = "https://todoevents-backend.onrender.com"
    
    # First get a token
    print("🔐 Getting authentication token...")
    try:
        auth_response = requests.post(f"{BASE_URL}/token", data={
            "username": "admin@todoevents.com", 
            "password": "admin123"
        })
        
        if auth_response.status_code != 200:
            print(f"❌ Authentication failed: {auth_response.status_code}")
            return False
            
        token = auth_response.json()["access_token"]
        print("✅ Authentication successful")
    except Exception as e:
        print(f"❌ Authentication error: {e}")
        return False
    
    # Test bulk import with single event
    print("\n📦 Testing bulk import...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    bulk_data = {
        "events": [
            {
                "title": "Test Bulk Import Fix",
                "description": "Testing bulk import error handling improvements",
                "date": "2025-07-15",
                "start_time": "18:00:00",
                "category": "networking", 
                "address": "123 Test Street, Test City, TX 12345",
                "lat": 32.7767,
                "lng": -96.7970,
                "recurring": False
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/events/bulk",
            headers=headers,
            json=bulk_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            success_count = result.get('success_count', 0)
            error_count = result.get('error_count', 0)
            errors = result.get('errors', [])
            
            print(f"✅ Bulk import completed")
            print(f"📊 Success: {success_count}, Errors: {error_count}")
            
            if errors:
                print("❌ Errors found:")
                for error in errors:
                    print(f"   - {error}")
            else:
                print("✅ No errors reported")
            
            return success_count > 0
        else:
            print(f"❌ Bulk import failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Bulk import error: {e}")
        return False

def main():
    print("🧪 Testing Bulk Import and Sitemap Fixes")
    print("=" * 60)
    
    results = {}
    
    # Test sitemap generation
    results['sitemap_generation'] = test_sitemap_generation()
    
    # Test events sitemap endpoint
    results['events_sitemap'] = test_events_sitemap_endpoint()
    
    # Test bulk import
    results['bulk_import'] = test_bulk_import_simple()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Results Summary")
    print("=" * 60)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All fixes working correctly!")
    else:
        print("⚠️ Some issues remain")

if __name__ == "__main__":
    main() 