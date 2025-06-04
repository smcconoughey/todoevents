#!/usr/bin/env python3
"""
Test Frontend Event Creation with SEO Auto-Population
Simulates frontend event creation and verifies SEO fields are populated
"""

import requests
import json
import random
import string

# Configuration
BASE_URL = "http://localhost:8000"  # Change to your Render URL when testing production

def generate_unique_suffix():
    """Generate a unique suffix for test events"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))

def test_user_registration_and_login():
    """Test user registration and login to get auth token"""
    suffix = generate_unique_suffix()
    email = f"test-seo-{suffix}@example.com"
    password = "SecurePassword123!"
    
    print(f"🔐 Testing with user: {email}")
    
    # Register user
    register_data = {
        "email": email,
        "password": password
    }
    
    response = requests.post(f"{BASE_URL}/users", json=register_data)
    if response.status_code != 200:
        print(f"   ⚠️ Registration failed (user might already exist): {response.status_code}")
    
    # Login to get token
    login_data = {
        "username": email,
        "password": password
    }
    
    response = requests.post(f"{BASE_URL}/token", data=login_data)
    if response.status_code == 200:
        token = response.json()["access_token"]
        print(f"   ✅ Login successful")
        return token
    else:
        print(f"   ❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_event_creation_with_seo(token):
    """Test creating an event and verify SEO fields are auto-populated"""
    suffix = generate_unique_suffix()
    
    # Event data similar to what frontend would send
    event_data = {
        "title": f"SEO Test Event {suffix}",
        "description": "This is a comprehensive test event description to verify that SEO fields are automatically populated when creating new events through the frontend. The system should extract geographic information from the address, normalize pricing from fee text, generate URL-friendly slugs, create ISO datetime fields, and generate optimized short descriptions for better search engine visibility.",
        "date": "2025-07-15",
        "start_time": "18:00",
        "end_time": "21:00",
        "category": "technology",
        "address": "456 Innovation Drive, Austin, TX, USA",
        "lat": 30.2672,
        "lng": -97.7431,
        "fee_required": "$20 early bird, $30 at the door",
        "event_url": "https://example.com/seo-test-event",
        "host_name": "Tech Innovation Hub"
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print(f"\n📝 Creating event: {event_data['title']}")
    print(f"   📍 Address: {event_data['address']}")
    print(f"   💰 Fee: {event_data['fee_required']}")
    
    response = requests.post(f"{BASE_URL}/events", json=event_data, headers=headers)
    
    if response.status_code == 200:
        created_event = response.json()
        event_id = created_event["id"]
        
        print(f"   ✅ Event created successfully with ID: {event_id}")
        
        # Verify SEO fields were auto-populated
        print(f"\n🔍 Verifying SEO auto-population:")
        print(f"   📝 Slug: {created_event.get('slug', 'NOT GENERATED')}")
        print(f"   🏙️ City: {created_event.get('city', 'NOT EXTRACTED')}")
        print(f"   🏛️ State: {created_event.get('state', 'NOT EXTRACTED')}")
        print(f"   💰 Price: {created_event.get('price', 'NOT NORMALIZED')}")
        print(f"   💱 Currency: {created_event.get('currency', 'NOT SET')}")
        print(f"   📅 Start DateTime: {created_event.get('start_datetime', 'NOT GENERATED')}")
        print(f"   📅 End DateTime: {created_event.get('end_datetime', 'NOT GENERATED')}")
        print(f"   📄 Short Description: {created_event.get('short_description', 'NOT GENERATED')[:60]}...")
        
        # Verify specific expectations
        assertions = []
        
        if created_event.get('slug'):
            assertions.append("✅ Slug generated")
        else:
            assertions.append("❌ Slug missing")
        
        if created_event.get('city') == "Austin":
            assertions.append("✅ City extracted correctly")
        else:
            assertions.append(f"❌ City extraction failed: {created_event.get('city')}")
        
        if created_event.get('state') == "TX":
            assertions.append("✅ State extracted correctly")
        else:
            assertions.append(f"❌ State extraction failed: {created_event.get('state')}")
        
        if created_event.get('price') == 20.0:  # Should extract early bird price
            assertions.append("✅ Price normalized correctly")
        else:
            assertions.append(f"❌ Price normalization failed: {created_event.get('price')}")
        
        if created_event.get('start_datetime'):
            assertions.append("✅ Start datetime generated")
        else:
            assertions.append("❌ Start datetime missing")
        
        if created_event.get('short_description') and len(created_event.get('short_description')) <= 160:
            assertions.append("✅ Short description generated")
        else:
            assertions.append("❌ Short description invalid")
        
        print(f"\n📊 SEO Verification Results:")
        for assertion in assertions:
            print(f"   {assertion}")
        
        success_count = len([a for a in assertions if a.startswith("✅")])
        total_count = len(assertions)
        
        print(f"\n🎯 Score: {success_count}/{total_count} SEO fields populated correctly")
        
        return event_id, success_count == total_count
    
    else:
        print(f"   ❌ Event creation failed: {response.status_code}")
        print(f"   Error details: {response.text}")
        return None, False

def test_event_retrieval_seo(event_id):
    """Test retrieving event via SEO endpoint"""
    print(f"\n🔎 Testing SEO event retrieval for event {event_id}...")
    
    # Test the SEO endpoint
    response = requests.get(f"{BASE_URL}/api/seo/events/{event_id}")
    
    if response.status_code == 200:
        seo_event = response.json()
        print(f"   ✅ SEO endpoint working")
        print(f"   📝 SEO Title: {seo_event.get('title', 'Missing')}")
        print(f"   🔗 Canonical URL: {seo_event.get('canonical_url', 'Missing')}")
        return True
    else:
        print(f"   ❌ SEO endpoint failed: {response.status_code}")
        return False

def cleanup_test_event(event_id, token):
    """Clean up the test event"""
    if not event_id or not token:
        return
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.delete(f"{BASE_URL}/events/{event_id}", headers=headers)
    
    if response.status_code == 200:
        print(f"\n🧹 Test event {event_id} cleaned up successfully")
    else:
        print(f"\n⚠️ Failed to cleanup test event {event_id}: {response.status_code}")

def main():
    """Main test function"""
    print("🚀 Testing Frontend Event Creation with SEO Auto-Population")
    print("=" * 60)
    
    # Test backend connectivity
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Backend is accessible")
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        print(f"   Make sure backend is running at: {BASE_URL}")
        return
    
    # Test user auth
    token = test_user_registration_and_login()
    if not token:
        print("❌ Cannot proceed without valid auth token")
        return
    
    # Test event creation with SEO
    event_id, seo_success = test_event_creation_with_seo(token)
    
    if not event_id:
        print("❌ Cannot proceed without created event")
        return
    
    # Test SEO retrieval
    seo_retrieval_success = test_event_retrieval_seo(event_id)
    
    # Cleanup
    cleanup_test_event(event_id, token)
    
    # Final results
    print("\n" + "=" * 60)
    print("📊 FINAL TEST RESULTS")
    print("=" * 60)
    
    if seo_success and seo_retrieval_success:
        print("🎉 ALL TESTS PASSED!")
        print("   ✅ Event creation with SEO auto-population works")
        print("   ✅ SEO fields are properly generated")
        print("   ✅ SEO endpoints are functional")
        print("\n💡 The frontend should work correctly with automatic SEO field population!")
    else:
        print("⚠️ SOME TESTS FAILED")
        if not seo_success:
            print("   ❌ SEO auto-population has issues")
        if not seo_retrieval_success:
            print("   ❌ SEO endpoint access failed")
        print("\n🔧 Review the logs above for specific issues to fix")

if __name__ == "__main__":
    main() 