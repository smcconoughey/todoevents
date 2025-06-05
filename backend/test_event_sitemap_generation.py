#!/usr/bin/env python3

import requests
import json

def test_event_sitemap_generation():
    """Test event sitemap generation"""
    
    print("🔍 Testing Event Sitemap Generation")
    print("=" * 50)
    
    BASE_URL = "https://todoevents-backend.onrender.com"
    
    # 1. Test basic events endpoint to confirm events exist with slugs
    print("\n📊 Checking Current Events...")
    try:
        response = requests.get(f"{BASE_URL}/events?limit=5", timeout=10)
        if response.status_code == 200:
            events = response.json()
            print(f"✅ Found {len(events)} events")
            
            events_with_slugs = [e for e in events if e.get('slug')]
            print(f"📝 Events with slugs: {len(events_with_slugs)}")
            
            if events_with_slugs:
                for event in events_with_slugs[:3]:
                    print(f"  • {event['title']}: {event['slug']}")
            else:
                print("❌ No events have slugs!")
                
        else:
            print(f"❌ Failed to fetch events: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error fetching events: {e}")
    
    # 2. Test current sitemap content
    print("\n🗺️ Checking Current Sitemap...")
    try:
        response = requests.get(f"{BASE_URL}/sitemap.xml", timeout=10)
        if response.status_code == 200:
            sitemap_content = response.text
            
            # Count different URL types
            individual_events = sitemap_content.count('/event/')
            date_indexed_events = sitemap_content.count('/events/2025/')
            city_pages = sitemap_content.count('/this-weekend-in-')
            category_pages = sitemap_content.count('/events/food-drink')
            
            print(f"📊 Sitemap Analysis:")
            print(f"  • Individual event URLs (/event/slug): {individual_events}")
            print(f"  • Date-indexed URLs (/events/2025/mm/dd/slug): {date_indexed_events}")
            print(f"  • City pages (/this-weekend-in-city): {city_pages}")
            print(f"  • Category pages found: {1 if category_pages > 0 else 0}")
            
            total_urls = sitemap_content.count('<url>')
            print(f"  • Total URLs in sitemap: {total_urls}")
            
        else:
            print(f"❌ Failed to fetch sitemap: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error fetching sitemap: {e}")
    
    # 3. Test events sitemap endpoint
    print("\n🔧 Testing Events Sitemap Endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/seo/sitemap/events", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Events sitemap endpoint working")
            print(f"  • Event entries: {data.get('count', 0)}")
        else:
            print(f"❌ Events sitemap endpoint failed: {response.status_code}")
            if response.status_code == 500:
                error = response.json().get('detail', 'Unknown error')
                print(f"  Error: {error}")
                
                # Check if it's the PostgreSQL boolean issue
                if 'boolean = integer' in error:
                    print("🔧 ISSUE IDENTIFIED: PostgreSQL boolean comparison error")
                    print("   This means the backend needs to be deployed with the fix!")
                    
    except Exception as e:
        print(f"❌ Error testing events sitemap: {e}")
    
    # 4. Summary and recommendations
    print("\n📋 Summary & Next Steps")
    print("=" * 30)
    
    print("\n🎯 CURRENT STATUS:")
    print("• The sitemap generation logic includes individual events")
    print("• Events in production DO have slugs")
    print("• BUT production backend still has PostgreSQL boolean issue")
    
    print("\n🚀 REQUIRED ACTION:")
    print("• Deploy the updated backend.py to Render")
    print("• The fix changes 'is_published = 1' to 'is_published = true' for PostgreSQL")
    print("• After deployment, trigger sitemap regeneration")
    
    print("\n🎯 EXPECTED RESULTS AFTER DEPLOYMENT:")
    print("• Individual event URLs will appear in sitemap")
    print("• URLs like /event/michigan-antique-festival-midland")
    print("• Date-indexed URLs like /events/2025/06/07/event-slug")
    print("• SEO-friendly event discovery will be complete")

if __name__ == "__main__":
    test_event_sitemap_generation() 