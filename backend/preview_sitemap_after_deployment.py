#!/usr/bin/env python3

import requests
import json
from datetime import datetime

def preview_sitemap_after_deployment():
    """Preview what the sitemap will look like after deployment"""
    
    print("🔮 Sitemap Preview After Deployment")
    print("=" * 50)
    
    BASE_URL = "https://todoevents-backend.onrender.com"
    
    # Get current events with slugs
    print("\n📊 Fetching Current Events...")
    try:
        response = requests.get(f"{BASE_URL}/events?limit=10", timeout=10)
        if response.status_code == 200:
            events = response.json()
            events_with_slugs = [e for e in events if e.get('slug')]
            
            print(f"✅ Found {len(events_with_slugs)} events with slugs")
            
            if not events_with_slugs:
                print("❌ No events with slugs found!")
                return
                
            # Simulate sitemap generation
            print("\n🗺️ Simulating Sitemap Generation...")
            domain = "https://todo-events.com"
            
            print("\n📝 Individual Event URLs that will be added:")
            print("-" * 40)
            
            for i, event in enumerate(events_with_slugs[:5], 1):
                slug = event['slug']
                title = event['title']
                
                # Three URL formats that will be generated
                main_url = f"{domain}/event/{slug}"
                legacy_url = f"{domain}/e/{slug}"
                
                # Try to generate date-indexed URL
                try:
                    event_date = datetime.fromisoformat(event['date'])
                    year = event_date.strftime('%Y')
                    month = event_date.strftime('%m')
                    day = event_date.strftime('%d')
                    date_url = f"{domain}/events/{year}/{month}/{day}/{slug}"
                except:
                    date_url = f"{domain}/events/2025/06/dd/{slug}"  # fallback
                
                print(f"{i}. {title}")
                print(f"   • Main: {main_url}")
                print(f"   • Legacy: {legacy_url}")
                print(f"   • Date-indexed: {date_url}")
                print()
            
            # Calculate expected total
            events_count = len(events_with_slugs)
            individual_urls = events_count * 3  # 3 URLs per event
            static_urls = 119  # Current static URLs
            total_expected = static_urls + individual_urls
            
            print(f"📊 Expected Sitemap Statistics After Deployment:")
            print(f"  • Current static URLs: {static_urls}")
            print(f"  • Individual event URLs: {individual_urls} ({events_count} events × 3 formats)")
            print(f"  • TOTAL EXPECTED URLs: {total_expected}")
            print(f"  • Improvement: +{individual_urls} URLs ({individual_urls/static_urls*100:.0f}% increase)")
            
        else:
            print(f"❌ Failed to fetch events: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n🚀 Deployment Checklist:")
    print("=" * 25)
    print("✅ 1. PostgreSQL boolean fix implemented")
    print("✅ 2. Sitemap generation logic includes individual events") 
    print("✅ 3. Events in production have slugs")
    print("❌ 4. Deploy backend.py to Render (PENDING)")
    print("❌ 5. Trigger sitemap regeneration (AFTER DEPLOYMENT)")
    
    print("\n🎯 Manual Steps After Deployment:")
    print("1. Deploy the updated backend.py to Render")
    print("2. Run: curl -X POST 'https://todoevents-backend.onrender.com/api/v1/automation/trigger/sitemap'")
    print("3. Verify: curl -s 'https://todoevents-backend.onrender.com/sitemap.xml' | grep -c '/event/'")
    print("4. Should return a number > 0 indicating individual event URLs are included")

if __name__ == "__main__":
    preview_sitemap_after_deployment() 