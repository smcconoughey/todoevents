#!/usr/bin/env python3
"""
Production Sitemap Update Script for TodoEvents
Updates frontend sitemap with production database events via API

This script:
1. Fetches events from production backend API
2. Generates proper URL formats that match Google Search Console expectations
3. Updates frontend sitemap directly
"""

import os
import sys
import json
import requests
from datetime import datetime, timedelta
from pathlib import Path
import re
from urllib.parse import quote

def slugify(text):
    """Convert text to URL-friendly slug"""
    if not text:
        return ""
    # Convert to lowercase and replace spaces/special chars with hyphens
    slug = re.sub(r'[^\w\s-]', '', text.lower())
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug.strip('-')

def get_production_events():
    """Fetch all future events from production API with pagination"""
    api_base = "https://todoevents-backend.onrender.com"
    
    try:
        print("🔗 Fetching ALL future events from production API...")
        
        all_events = []
        limit = 1000  # Max limit per request
        offset = 0
        
        while True:
            # Use the main events endpoint with higher limits and pagination
            response = requests.get(
                f"{api_base}/events?limit={limit}&offset={offset}", 
                timeout=60
            )
            
            if response.status_code != 200:
                print(f"❌ API error: {response.status_code}")
                break
            
            batch_events = response.json()
            
            if not batch_events or not isinstance(batch_events, list) or len(batch_events) == 0:
                print(f"📊 No more events at offset {offset}")
                break
            
            print(f"📊 Fetched {len(batch_events)} events (offset {offset})")
            all_events.extend(batch_events)
            
            # If we got fewer events than the limit, we've reached the end
            if len(batch_events) < limit:
                break
                
            offset += limit
            
        print(f"📊 Found {len(all_events)} total events from API")
        
        # Filter for future events only - events after July 2nd, 2025
        cutoff_date = datetime(2025, 7, 2).date()
        print(f"📅 Filtering for events after {cutoff_date}")
        future_events = []
        
        for event in all_events:
            if not isinstance(event, dict):
                continue
                
            event_date_str = event.get('date')
            if event_date_str:
                try:
                    event_date = datetime.strptime(event_date_str, '%Y-%m-%d').date()
                    if event_date > cutoff_date:  # Events AFTER July 2nd, 2025
                        future_events.append(event)
                except:
                    continue
        
        print(f"📅 Found {len(future_events)} future events after {cutoff_date}")
        
        # Show date range statistics
        if future_events:
            event_dates = []
            for event in future_events:
                date_str = event.get('date')
                if date_str:
                    try:
                        event_dates.append(datetime.strptime(date_str, '%Y-%m-%d').date())
                    except:
                        continue
            
            if event_dates:
                min_date = min(event_dates)
                max_date = max(event_dates)
                print(f"📊 Date range: {min_date} to {max_date}")
                print(f"📊 Total days span: {(max_date - min_date).days} days")
        
        # Reduce duplicates by title, date, and location
        unique_events = reduce_duplicates(future_events)
        print(f"🔄 After duplicate reduction: {len(unique_events)} unique events")
        
        # Extract city/state from address if not directly available
        for event in unique_events:
            if not event.get('city') or not event.get('state'):
                address = event.get('address') or event.get('location', {}).get('address', '')
                if address and isinstance(address, str):
                    # Try to extract city and state from address
                    # Format: "Address, City, State, Country"
                    parts = [part.strip() for part in address.split(',')]
                    if len(parts) >= 3:
                        event['city'] = parts[-3] if not event.get('city') else event['city']
                        state_part = parts[-2].strip()
                        # Extract just the state abbreviation (first 2 characters if it looks like "CA USA")
                        if ' ' in state_part:
                            state_part = state_part.split()[0]
                        event['state'] = state_part if not event.get('state') else event['state']
        
        # Show breakdown
        with_slugs = sum(1 for e in unique_events if e.get('slug'))
        with_location = sum(1 for e in unique_events if e.get('city') and e.get('state'))
        
        print(f"   🏷️ Events with slugs: {with_slugs}")
        print(f"   📍 Events with city/state: {with_location}")
        print(f"   🔧 Events needing slugs: {len(unique_events) - with_slugs}")
        
        return unique_events
        
    except Exception as e:
        print(f"❌ API error: {e}")
        return []

def reduce_duplicates(events):
    """Reduce duplicate events based on title, date, and location similarity"""
    if not events:
        return events
    
    # Create a mapping of potential duplicates
    seen_events = {}
    unique_events = []
    
    for event in events:
        # Create a normalized signature for the event
        title = (event.get('title') or '').lower().strip()
        date = event.get('date') or ''
        address = (event.get('address') or '').lower().strip()
        
        # Normalize title for comparison (remove common words, extra spaces)
        normalized_title = re.sub(r'\b(the|a|an|and|or|at|in|on|for|with|by)\b', '', title)
        normalized_title = re.sub(r'\s+', ' ', normalized_title).strip()
        
        # Create signature
        signature = f"{normalized_title}|{date}|{address[:50]}"  # First 50 chars of address
        
        # Check for similar signatures
        is_duplicate = False
        for existing_sig, existing_event in seen_events.items():
            # Check if this might be a duplicate
            if (date == existing_event.get('date') and 
                similarity_score(normalized_title, existing_sig.split('|')[0]) > 0.8):
                # This is likely a duplicate, keep the one with more complete data
                if event_completeness_score(event) > event_completeness_score(existing_event):
                    # Replace the existing event with this more complete one
                    seen_events[signature] = event
                    # Update the unique_events list
                    for i, unique_event in enumerate(unique_events):
                        if unique_event['id'] == existing_event['id']:
                            unique_events[i] = event
                            break
                is_duplicate = True
                break
        
        if not is_duplicate:
            seen_events[signature] = event
            unique_events.append(event)
    
    return unique_events

def similarity_score(str1, str2):
    """Calculate similarity score between two strings (0.0 to 1.0)"""
    if not str1 or not str2:
        return 0.0
    
    # Simple Jaccard similarity using word sets
    words1 = set(str1.split())
    words2 = set(str2.split())
    
    if not words1 and not words2:
        return 1.0
    if not words1 or not words2:
        return 0.0
    
    intersection = len(words1.intersection(words2))
    union = len(words1.union(words2))
    
    return intersection / union if union > 0 else 0.0

def event_completeness_score(event):
    """Calculate completeness score for an event (higher = more complete)"""
    score = 0
    
    # Required fields
    if event.get('title'): score += 10
    if event.get('date'): score += 10
    if event.get('address'): score += 10
    
    # Optional but valuable fields
    if event.get('description'): score += 5
    if event.get('start_time'): score += 3
    if event.get('end_time'): score += 2
    if event.get('category'): score += 3
    if event.get('slug'): score += 5
    if event.get('city'): score += 3
    if event.get('state'): score += 3
    if event.get('lat') and event.get('lng'): score += 5
    if event.get('event_url'): score += 2
    if event.get('host_name'): score += 2
    if event.get('verified'): score += 5
    
    # Popularity indicators
    score += min(int(event.get('interest_count', 0) or 0), 10)
    score += min(int(event.get('view_count', 0) or 0) // 10, 5)
    
    return score

def generate_missing_slugs_for_display(events):
    """Generate slugs for events that don't have them (for sitemap only)"""
    events_needing_slugs = [e for e in events if not e.get('slug')]
    
    print(f"🔧 Generating slugs for {len(events_needing_slugs)} events...")
    
    for event in events_needing_slugs:
        # Generate slug from title and ID
        title = event.get('title', 'event')
        event_id = event.get('id')
        
        slug = f"{slugify(title)}-{event_id}"
        event['slug'] = slug
    
    print(f"✅ Generated {len(events_needing_slugs)} display slugs")
    return events

def generate_sitemap_xml(events):
    """Generate complete sitemap XML with proper URL formats"""
    current_date = datetime.utcnow().strftime('%Y-%m-%d')
    domain = "https://todo-events.com"
    
    # Start sitemap
    sitemap = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Homepage -->
  <url>
    <loc>{domain}/</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Main pages -->
  <url>
    <loc>{domain}/hosts</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>{domain}/creators</loc>
    <lastmod>{current_date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>

  <!-- Events - Multiple URL formats for each event -->'''
    
    url_count = 3  # Homepage + 2 main pages
    event_count = 0
    geographic_url_count = 0
    
    for event in events:
        slug = event.get('slug')
        if not slug:
            continue
            
        event_count += 1
        
        # Determine lastmod date
        lastmod = current_date
        for date_field in ['updated_at', 'created_at']:
            if event.get(date_field):
                try:
                    if isinstance(event[date_field], str):
                        parsed_date = datetime.fromisoformat(event[date_field].replace('Z', '+00:00'))
                    else:
                        parsed_date = event[date_field]
                    lastmod = parsed_date.strftime('%Y-%m-%d')
                    break
                except:
                    continue
        
        # 1. Short URL format: /e/{slug}
        sitemap += f'''
  <url>
    <loc>{domain}/e/{slug}</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>'''
        url_count += 1
        
        # 2. Geographic URL format: /us/{state}/{city}/events/{slug}
        # This is the format Google Search Console is showing as failing
        city = event.get('city')
        state = event.get('state')
        
        if city and state:
            state_slug = slugify(state.lower())
            city_slug = slugify(city.lower())
            
            sitemap += f'''
  <url>
    <loc>{domain}/us/{state_slug}/{city_slug}/events/{slug}</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>'''
            url_count += 1
            geographic_url_count += 1
        
        # 3. Simple events URL: /events/{slug}
        sitemap += f'''
  <url>
    <loc>{domain}/events/{slug}</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.85</priority>
  </url>'''
        url_count += 1
    
    # Close sitemap
    sitemap += '''

</urlset>'''
    
    print(f"📊 Generated sitemap with {url_count} URLs from {event_count} events")
    print(f"📍 Geographic URLs (Google's failing format): {geographic_url_count}")
    return sitemap

def save_sitemap_to_frontend(sitemap_content):
    """Save sitemap to frontend public directory"""
    frontend_sitemap_path = Path(__file__).parent.parent / 'frontend' / 'public' / 'sitemap.xml'
    
    try:
        # Ensure directory exists
        frontend_sitemap_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write sitemap
        frontend_sitemap_path.write_text(sitemap_content, encoding='utf-8')
        
        print(f"✅ Sitemap saved to: {frontend_sitemap_path}")
        
        # Count URLs for verification
        url_count = sitemap_content.count('<url>')
        print(f"📊 Total URLs in sitemap: {url_count}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error saving sitemap: {e}")
        return False

def ping_search_engines(sitemap_url="https://todo-events.com/sitemap.xml"):
    """Notify search engines about sitemap update"""
    import urllib.request
    import urllib.parse
    
    search_engines = [
        f"https://www.google.com/ping?sitemap={urllib.parse.quote(sitemap_url)}",
        f"https://www.bing.com/ping?sitemap={urllib.parse.quote(sitemap_url)}"
    ]
    
    print("🔔 Notifying search engines...")
    
    for engine_url in search_engines:
        try:
            response = urllib.request.urlopen(engine_url, timeout=10)
            engine_name = "Google" if "google" in engine_url else "Bing"
            if response.getcode() == 200:
                print(f"✅ {engine_name} notified successfully")
            else:
                print(f"⚠️ {engine_name} returned status {response.getcode()}")
        except Exception as e:
            engine_name = "Google" if "google" in engine_url else "Bing"
            print(f"❌ Failed to notify {engine_name}: {e}")

def main():
    """Main script execution"""
    print("🚀 TodoEvents Production Sitemap Update")
    print("=" * 50)
    
    # Step 1: Fetch all future events from production API
    events = get_production_events()
    if not events:
        print("❌ No events found - exiting")
        return
    
    # Step 2: Generate missing slugs for display
    events = generate_missing_slugs_for_display(events)
    
    # Step 3: Generate sitemap XML
    sitemap_content = generate_sitemap_xml(events)
    
    # Step 4: Save to frontend
    if save_sitemap_to_frontend(sitemap_content):
        print("✅ Frontend sitemap updated successfully")
        
        # Step 5: Notify search engines
        ping_search_engines()
        
        print("\n🎉 Sitemap update complete!")
        print("🔗 View at: https://todo-events.com/sitemap.xml")
        print("📊 Check Google Search Console for indexing status")
        print("\n💡 Note: This addresses the geographic URL format issue:")
        print("   https://www.todo-events.com/us/{state}/{city}/events/{slug}")
        
    else:
        print("❌ Failed to update frontend sitemap")

if __name__ == "__main__":
    main() 