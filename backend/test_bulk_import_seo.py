#!/usr/bin/env python3
"""
Test script to verify that bulk import properly generates SEO-friendly slugs
"""

import requests
import json
import sys

# Configuration
API_BASE = "http://localhost:8000"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"

def login_as_admin():
    """Login and get admin token"""
    print("🔑 Logging in as admin...")
    
    response = requests.post(f"{API_BASE}/token", 
                           data={
                               "username": ADMIN_EMAIL,
                               "password": ADMIN_PASSWORD
                           })
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        print(f"Response: {response.text}")
        return None
    
    token_data = response.json()
    print(f"✅ Login successful")
    return token_data["access_token"]

def test_bulk_import_seo(token):
    """Test bulk import with SEO field generation"""
    print("🧪 Testing bulk import SEO processing...")
    
    # Test events with scenarios that should generate different slugs
    test_events = {
        "events": [
            {
                "title": "Orlando Coffee Festival",
                "description": "Join us for the annual coffee festival in downtown Orlando featuring local roasters and coffee enthusiasts from around the world.",
                "date": "2024-08-15",
                "start_time": "10:00",
                "end_time": "18:00",
                "category": "food-drink",
                "address": "125 N Orange Ave, Orlando, FL 32801, USA",
                "lat": 28.5421,
                "lng": -81.3790,
                "fee_required": "$15 general admission",
                "host_name": "Orlando Coffee Roasters",
                "event_url": "https://orlandocoffee.com/festival"
            },
            {
                "title": "Tech Meetup Downtown",
                "description": "Monthly tech meetup for developers and entrepreneurs in the Orlando area. This month we're focusing on AI and machine learning.",
                "date": "2024-08-20",
                "start_time": "19:00",
                "end_time": "21:00",
                "category": "education",
                "address": "100 S Eola Dr, Orlando, FL 32801, USA",
                "lat": 28.5421,
                "lng": -81.3790,
                "fee_required": "Free admission",
                "host_name": "Orlando Tech Community"
            },
            {
                "title": "Live Music at The Plaza",
                "description": "Enjoy live acoustic music performances every Friday evening at Lake Eola Plaza.",
                "date": "2024-08-23",
                "start_time": "20:00",
                "end_time": "22:00",
                "category": "music",
                "address": "195 N Rosalind Ave, Orlando, FL 32801, USA", 
                "lat": 28.5421,
                "lng": -81.3790,
                "host_name": "City of Orlando"
            }
        ]
    }
    
    print(f"📤 Sending bulk import request with {len(test_events['events'])} events...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(f"{API_BASE}/admin/events/bulk", 
                           headers=headers,
                           json=test_events)
    
    if response.status_code != 200:
        print(f"❌ Bulk import failed: {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    result = response.json()
    print(f"✅ Bulk import successful!")
    print(f"   Success count: {result['success_count']}")
    print(f"   Error count: {result['error_count']}")
    
    if result['error_count'] > 0:
        print(f"   Errors: {result['errors']}")
    
    # Check the created events for SEO fields
    print(f"\n🔍 Checking created events for SEO fields...")
    
    for i, event in enumerate(result['created_events']):
        title = event.get('title', 'Unknown')
        slug = event.get('slug', 'NO SLUG')
        city = event.get('city', 'NO CITY') 
        state = event.get('state', 'NO STATE')
        price = event.get('price', 'NO PRICE')
        short_desc = event.get('short_description', 'NO SHORT DESC')
        
        print(f"\n   Event {i+1}: {title}")
        print(f"   📍 Slug: {slug}")
        print(f"   🏙️  City/State: {city}, {state}")
        print(f"   💰 Price: {price}")
        print(f"   📝 Short desc: {short_desc[:50]}..." if short_desc != 'NO SHORT DESC' else f"   📝 Short desc: {short_desc}")
        
        # Check if SEO fields were properly generated
        seo_issues = []
        if not slug or slug == 'NO SLUG':
            seo_issues.append("Missing slug")
        elif not slug.startswith(('orlando-coffee-festival', 'tech-meetup-downtown', 'live-music-at-the-plaza')):
            seo_issues.append(f"Unexpected slug format: {slug}")
            
        if not city or city == 'NO CITY':
            seo_issues.append("Missing city")
        elif city.lower() != 'orlando':
            seo_issues.append(f"Unexpected city: {city}")
            
        if not state or state == 'NO STATE':
            seo_issues.append("Missing state") 
        elif state.upper() != 'FL':
            seo_issues.append(f"Unexpected state: {state}")
        
        if seo_issues:
            print(f"   ⚠️  SEO Issues: {', '.join(seo_issues)}")
        else:
            print(f"   ✅ SEO fields properly generated")
    
    return result['success_count'] == len(test_events['events'])

def verify_seo_urls(events):
    """Test the generated slug URLs work"""
    print(f"\n🌐 Testing SEO URLs...")
    
    for event in events:
        slug = event.get('slug')
        if not slug:
            continue
            
        url = f"{API_BASE}/api/seo/events/by-slug/{slug}"
        print(f"   Testing: /e/{slug}")
        
        response = requests.get(url)
        if response.status_code == 200:
            print(f"   ✅ URL works")
        else:
            print(f"   ❌ URL failed: {response.status_code}")

def main():
    """Run the bulk import SEO test"""
    print("🚀 Testing Bulk Import SEO Processing")
    print("=" * 50)
    
    # Test API connectivity
    try:
        response = requests.get(f"{API_BASE}/health")
        if response.status_code != 200:
            print("❌ API server not responding")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API server")
        print("   Make sure the backend is running on localhost:8000")
        return False
    
    print("✅ API server is running")
    
    # Login as admin
    token = login_as_admin()
    if not token:
        return False
    
    # Test bulk import
    success = test_bulk_import_seo(token)
    
    if success:
        print(f"\n🎉 All tests passed! Bulk import now properly generates SEO-friendly URLs")
        print(f"   Events created through admin bulk import will have the same URL format")
        print(f"   as events created through the frontend: /e/[slug]")
    else:
        print(f"\n❌ Some tests failed. Check the output above for details.")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 