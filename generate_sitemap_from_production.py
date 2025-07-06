#!/usr/bin/env python3
"""
Generate sitemap from production events endpoint
Fetches all events from https://todoevents-backend.onrender.com/events
and generates a comprehensive sitemap.xml
"""

import requests
import json
from datetime import datetime
from urllib.parse import quote
import os
import time

def fetch_all_events():
    """Fetch all events from production API with pagination support"""
    print("🔄 Fetching events from production API...")
    
    all_events = []
    page = 1
    limit = 1000  # Try larger limit first
    
    while True:
        try:
            # Try different pagination approaches
            urls_to_try = [
                f"https://todoevents-backend.onrender.com/events?limit={limit}&offset={len(all_events)}",
                f"https://todoevents-backend.onrender.com/events?page={page}&limit={limit}",
                f"https://todoevents-backend.onrender.com/events?limit={limit}&skip={len(all_events)}",
                f"https://todoevents-backend.onrender.com/events?per_page={limit}&page={page}",
                "https://todoevents-backend.onrender.com/events"  # Try without pagination
            ]
            
            events_fetched = False
            for url in urls_to_try:
                try:
                    print(f"🔄 Trying: {url}")
                    response = requests.get(url, timeout=60)
                    response.raise_for_status()
                    events = response.json()
                    
                    if isinstance(events, list) and len(events) > 0:
                        # Check if we're getting new events or duplicates
                        existing_ids = {event.get('id') for event in all_events}
                        new_events = [event for event in events if event.get('id') not in existing_ids]
                        
                        if new_events:
                            all_events.extend(new_events)
                            print(f"✅ Fetched {len(new_events)} new events (total: {len(all_events)})")
                            events_fetched = True
                            break
                        elif len(events) == len(all_events):
                            # Same data returned, no pagination
                            print(f"📄 No pagination detected, got {len(events)} total events")
                            if not all_events:  # First request
                                all_events = events
                            events_fetched = True
                            break
                    elif isinstance(events, dict) and 'events' in events:
                        # Handle paginated response format
                        event_list = events['events']
                        if event_list:
                            existing_ids = {event.get('id') for event in all_events}
                            new_events = [event for event in event_list if event.get('id') not in existing_ids]
                            
                            if new_events:
                                all_events.extend(new_events)
                                print(f"✅ Fetched {len(new_events)} new events (total: {len(all_events)})")
                                events_fetched = True
                                break
                    
                except requests.exceptions.RequestException as e:
                    print(f"⚠️  Failed to fetch from {url}: {str(e)}")
                    continue
                except Exception as e:
                    print(f"⚠️  Error parsing response from {url}: {str(e)}")
                    continue
            
            if not events_fetched:
                print("🔄 No more events found, stopping pagination")
                break
                
            # If we got less than the limit, we're probably done
            if len(events) < limit:
                print("📄 Reached end of data (partial page)")
                break
                
            page += 1
            
            # Safety limit to prevent infinite loops
            if page > 50:
                print("⚠️  Reached maximum page limit (50), stopping")
                break
                
            # Small delay to be nice to the API
            time.sleep(0.1)
            
        except Exception as e:
            print(f"❌ Error in pagination loop: {str(e)}")
            break
    
    print(f"✅ Successfully fetched {len(all_events)} total events from production")
    
    # Remove any duplicates based on ID
    unique_events = {}
    for event in all_events:
        event_id = event.get('id')
        if event_id and event_id not in unique_events:
            unique_events[event_id] = event
    
    final_events = list(unique_events.values())
    if len(final_events) != len(all_events):
        print(f"🔄 Removed {len(all_events) - len(final_events)} duplicate events")
    
    return final_events

def generate_sitemap(events):
    """Generate sitemap XML from events"""
    print("🔄 Generating sitemap...")
    
    # Start sitemap XML
    sitemap_content = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
'''
    
    # Add main pages
    main_pages = [
        ("", "daily", "1.0"),  # Homepage
        ("about", "monthly", "0.8"),
        ("privacy", "yearly", "0.3"),
        ("terms", "yearly", "0.3"),
        ("contact", "monthly", "0.5"),
        ("premium", "weekly", "0.7"),
        ("enterprise", "weekly", "0.7"),
    ]
    
    for page, changefreq, priority in main_pages:
        url = f"https://todo-events.com/{page}" if page else "https://todo-events.com/"
        sitemap_content += f'''    <url>
        <loc>{url}</loc>
        <changefreq>{changefreq}</changefreq>
        <priority>{priority}</priority>
        <lastmod>{datetime.now().strftime('%Y-%m-%d')}</lastmod>
    </url>
'''
    
    # Process events
    event_count = 0
    processed_slugs = set()  # Avoid duplicate URLs
    
    for event in events:
        try:
            # Skip events without required fields
            if not event.get('slug') or not event.get('id'):
                continue
                
            # Skip unpublished events
            if not event.get('is_published', True):
                continue
            
            slug = event['slug']
            event_id = event['id']
            
            # Skip if we've already processed this slug
            if slug in processed_slugs:
                continue
            processed_slugs.add(slug)
            
            # Determine last modified date
            lastmod = event.get('updated_at', event.get('created_at', datetime.now().isoformat()))
            if isinstance(lastmod, str):
                try:
                    # Parse and format the date
                    dt = datetime.fromisoformat(lastmod.replace('Z', '+00:00'))
                    lastmod = dt.strftime('%Y-%m-%d')
                except:
                    lastmod = datetime.now().strftime('%Y-%m-%d')
            
            # Determine priority based on event properties
            priority = "0.6"  # Default
            if event.get('verified'):
                priority = "0.8"
            if event.get('is_premium_event'):
                priority = "0.9"
            
            # Determine change frequency based on event date
            changefreq = "weekly"
            try:
                event_date = event.get('date')
                if event_date:
                    event_dt = datetime.fromisoformat(event_date)
                    now = datetime.now()
                    if event_dt < now:
                        changefreq = "monthly"  # Past events change less frequently
                    elif (event_dt - now).days < 7:
                        changefreq = "daily"   # Upcoming events change more frequently
            except:
                pass
            
            # Generate multiple URL formats for better SEO coverage
            url_formats = [
                f"https://todo-events.com/event/{slug}",
                f"https://todo-events.com/events/{event_id}",
                f"https://todo-events.com/e/{slug}",
            ]
            
            for url in url_formats:
                sitemap_content += f'''    <url>
        <loc>{url}</loc>
        <changefreq>{changefreq}</changefreq>
        <priority>{priority}</priority>
        <lastmod>{lastmod}</lastmod>
    </url>
'''
                event_count += 1
                
        except Exception as e:
            print(f"⚠️  Warning: Error processing event {event.get('id', 'unknown')}: {str(e)}")
            continue
    
    # Close sitemap XML
    sitemap_content += '</urlset>'
    
    print(f"✅ Generated sitemap with {event_count} event URLs from {len(events)} total events")
    return sitemap_content

def save_sitemap(sitemap_content):
    """Save sitemap to frontend/public/sitemap.xml"""
    sitemap_path = "frontend/public/sitemap.xml"
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(sitemap_path), exist_ok=True)
    
    try:
        with open(sitemap_path, 'w', encoding='utf-8') as f:
            f.write(sitemap_content)
        
        # Get file size for confirmation
        file_size = os.path.getsize(sitemap_path)
        print(f"✅ Sitemap saved to {sitemap_path} ({file_size:,} bytes)")
        return True
    except Exception as e:
        print(f"❌ Error saving sitemap: {str(e)}")
        return False

def main():
    """Main function"""
    print("🚀 Starting sitemap generation from production events...")
    
    # Fetch events from production
    events = fetch_all_events()
    if not events:
        print("❌ No events fetched, aborting sitemap generation")
        return False
    
    # Generate sitemap
    sitemap_content = generate_sitemap(events)
    if not sitemap_content:
        print("❌ Failed to generate sitemap content")
        return False
    
    # Save sitemap
    success = save_sitemap(sitemap_content)
    if success:
        print("🎉 Sitemap generation completed successfully!")
        print("📁 Ready to commit and push to git")
        return True
    else:
        print("❌ Sitemap generation failed")
        return False

if __name__ == "__main__":
    main() 