#!/usr/bin/env python3
"""
Test SEO Auto-Population for New Events
Creates a test event and verifies that SEO fields are automatically populated
"""

import requests
import json

def test_seo_auto_population():
    """Test that new events get SEO fields auto-populated"""
    
    # Test event data - missing SEO fields that should be auto-populated
    import random
    unique_id = random.randint(1000, 9999)
    
    test_event = {
        "title": f"Test SEO Auto-Population Event {unique_id}",
        "description": "This is a test event to verify that SEO fields are automatically populated when creating new events through the API. The system should extract city/state from address, normalize the price, generate a slug, create datetime fields, and generate a short description.",
        "date": "2025-06-10",
        "start_time": f"{14 + (unique_id % 3)}:30",  # Vary the time
        "end_time": "16:00",
        "category": "community",
        "address": "123 Main Street, Midland, MI, USA",
        "lat": 43.6155 + (unique_id % 100) * 0.0001,  # Slightly vary coordinates
        "lng": -84.2373 + (unique_id % 100) * 0.0001,
        "recurring": False,
        "fee_required": "$15 suggested donation",
        "event_url": "https://example.com/test-event",
        "host_name": "Test Organization"
    }
    
    print("🧪 Testing SEO Auto-Population...")
    print(f"📝 Test event: {test_event['title']}")
    print(f"📍 Address: {test_event['address']}")
    print(f"💰 Fee: {test_event['fee_required']}")
    
    # First, create a test user (if needed)
    print("\n👤 Creating test user...")
    register_data = {
        "email": "test.seo@example.com",
        "password": "TestPassword123!"
    }
    
    try:
        register_response = requests.post(
            "http://localhost:8000/users",
            json=register_data,
            timeout=10
        )
        print(f"   Registration status: {register_response.status_code}")
    except:
        print("   Registration failed (user might already exist)")
    
    # Login to get token
    print("\n🔐 Logging in...")
    login_data = {
        "username": register_data["email"],
        "password": register_data["password"]
    }
    
    try:
        login_response = requests.post(
            "http://localhost:8000/token",
            data=login_data,
            timeout=10
        )
        
        if login_response.status_code == 200:
            token = login_response.json()["access_token"]
            print("   ✅ Login successful")
        else:
            print(f"   ❌ Login failed: {login_response.status_code}")
            return
    except Exception as e:
        print(f"   ❌ Login error: {e}")
        return
    
    # Create the event
    print("\n📅 Creating test event...")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        create_response = requests.post(
            "http://localhost:8000/events",
            json=test_event,
            headers=headers,
            timeout=10
        )
        
        if create_response.status_code == 200:
            created_event = create_response.json()
            print("   ✅ Event created successfully")
            
            # Analyze the SEO fields
            print("\n🔍 Analyzing Auto-Populated SEO Fields:")
            
            print(f"   📝 Slug: {created_event.get('slug', 'MISSING')}")
            print(f"   🏙️ City: {created_event.get('city', 'MISSING')}")
            print(f"   🏛️ State: {created_event.get('state', 'MISSING')}")
            print(f"   💰 Price: {created_event.get('price', 'MISSING')}")
            print(f"   💱 Currency: {created_event.get('currency', 'MISSING')}")
            print(f"   📅 Start DateTime: {created_event.get('start_datetime', 'MISSING')}")
            print(f"   📅 End DateTime: {created_event.get('end_datetime', 'MISSING')}")
            print(f"   📄 Short Description: {created_event.get('short_description', 'MISSING')[:50]}...")
            
            # Check if all expected fields are populated
            expected_fields = [
                'slug', 'city', 'state', 'price', 'currency', 
                'start_datetime', 'end_datetime', 'short_description'
            ]
            
            missing_fields = []
            for field in expected_fields:
                if not created_event.get(field):
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"\n❌ Missing SEO fields: {', '.join(missing_fields)}")
            else:
                print("\n✅ All SEO fields successfully auto-populated!")
            
            # Verify specific values
            print("\n🧐 Verifying Auto-Population Logic:")
            
            # Check city/state extraction
            if created_event.get('city') == 'Midland' and created_event.get('state') == 'MI':
                print("   ✅ City/State extraction working correctly")
            else:
                print(f"   ❌ City/State extraction failed: got {created_event.get('city')}, {created_event.get('state')}")
            
            # Check price normalization
            if created_event.get('price') == 15.0:
                print("   ✅ Price normalization working correctly")
            else:
                print(f"   ❌ Price normalization failed: got {created_event.get('price')}")
            
            # Check slug generation
            expected_slug_start = "test-seo-auto-population-event"
            if created_event.get('slug', '').startswith(expected_slug_start):
                print("   ✅ Slug generation working correctly")
            else:
                print(f"   ❌ Slug generation unexpected: got {created_event.get('slug')}")
            
            # Clean up - delete the test event
            print(f"\n🧹 Cleaning up test event (ID: {created_event['id']})...")
            delete_response = requests.delete(
                f"http://localhost:8000/events/{created_event['id']}",
                headers=headers,
                timeout=10
            )
            
            if delete_response.status_code == 200:
                print("   ✅ Test event cleaned up")
            else:
                print(f"   ⚠️ Cleanup failed: {delete_response.status_code}")
            
        else:
            print(f"   ❌ Event creation failed: {create_response.status_code}")
            try:
                error_detail = create_response.json()
                print(f"   Error details: {error_detail}")
            except:
                print(f"   Error text: {create_response.text}")
    
    except Exception as e:
        print(f"   ❌ Event creation error: {e}")

if __name__ == "__main__":
    test_seo_auto_population() 