#!/usr/bin/env python3
"""
Production Database Check and Sitemap Trigger
Standalone script to diagnose and fix sitemap generation
"""
import os
import psycopg2
from datetime import datetime
import requests

# Production database URL (from environment)
DATABASE_URL = os.getenv('DATABASE_URL')

def check_production_database():
    """Check how many events are actually in the production database"""
    if not DATABASE_URL:
        print("❌ No DATABASE_URL found - using local database")
        return check_local_database()
    
    try:
        # Connect to production PostgreSQL
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Count total events
        cursor.execute("SELECT COUNT(*) FROM events")
        total_events = cursor.fetchone()[0]
        print(f"📊 Total events in production: {total_events}")
        
        # Count future events
        cursor.execute("SELECT COUNT(*) FROM events WHERE CAST(date AS DATE) >= CURRENT_DATE")
        future_events = cursor.fetchone()[0]
        print(f"📅 Future events: {future_events}")
        
        # Count events with slugs
        cursor.execute("SELECT COUNT(*) FROM events WHERE slug IS NOT NULL AND slug != ''")
        with_slugs = cursor.fetchone()[0]
        print(f"🏷️ Events with slugs: {with_slugs}")
        
        # Count future events with slugs (what sitemap should contain)
        cursor.execute("SELECT COUNT(*) FROM events WHERE CAST(date AS DATE) >= CURRENT_DATE AND slug IS NOT NULL AND slug != ''")
        sitemap_events = cursor.fetchone()[0]
        print(f"🗺️ Events that should be in sitemap: {sitemap_events}")
        
        # Sample events without slugs
        cursor.execute("SELECT id, title FROM events WHERE slug IS NULL OR slug = '' LIMIT 10")
        no_slug_events = cursor.fetchall()
        if no_slug_events:
            print(f"⚠️ Found {len(no_slug_events)} events without slugs (samples):")
            for event_id, title in no_slug_events:
                print(f"   - ID {event_id}: {title[:50]}...")
        
        conn.close()
        return sitemap_events
        
    except Exception as e:
        print(f"❌ Error connecting to production database: {e}")
        return 0

def check_local_database():
    """Fallback to check local SQLite database"""
    try:
        import sqlite3
        conn = sqlite3.connect('events.db')
        c = conn.cursor()
        
        c.execute('SELECT COUNT(*) FROM events')
        total = c.fetchone()[0]
        print(f"📊 Total events in local DB: {total}")
        
        c.execute("SELECT COUNT(*) FROM events WHERE date >= date('now')")
        future = c.fetchone()[0]
        print(f"📅 Future events in local DB: {future}")
        
        conn.close()
        return future
        
    except Exception as e:
        print(f"❌ Error with local database: {e}")
        return 0

def trigger_sitemap_regeneration():
    """Trigger sitemap regeneration via API"""
    try:
        # Try to ping the regeneration endpoint
        response = requests.post("https://www.todo-events.com/api/sitemap/regenerate", timeout=30)
        print(f"🔄 Sitemap regeneration triggered: {response.status_code}")
        return True
    except Exception as e:
        print(f"❌ Failed to trigger sitemap regeneration: {e}")
        return False

def check_current_sitemap():
    """Check current sitemap content"""
    try:
        response = requests.get("https://www.todo-events.com/sitemap.xml", timeout=30)
        content = response.text
        
        # Count URLs
        total_urls = content.count('<loc>')
        event_urls = len([line for line in content.split('\n') if '/e/' in line or ('/events/' in line and not 'todo-events.com/events</loc>' in line)])
        
        print(f"🗺️ Current sitemap: {total_urls} total URLs, ~{event_urls} event URLs")
        
        # Extract some sample event URLs
        import re
        event_url_pattern = r'<loc>https://todo-events\.com/e/([^<]+)</loc>'
        matches = re.findall(event_url_pattern, content)
        if matches:
            print(f"📋 Sample event slugs in sitemap:")
            for slug in matches[:5]:
                print(f"   - {slug}")
        
        return event_urls
        
    except Exception as e:
        print(f"❌ Error checking sitemap: {e}")
        return 0

if __name__ == "__main__":
    print("🔍 TodoEvents Production Database & Sitemap Diagnostic")
    print("=" * 60)
    
    # Check database
    expected_events = check_production_database()
    
    print("\n" + "=" * 60)
    
    # Check current sitemap
    current_events = check_current_sitemap()
    
    print("\n" + "=" * 60)
    
    # Compare and report
    if expected_events > current_events:
        print(f"❌ ISSUE: Expected {expected_events} events in sitemap, but found {current_events}")
        print("🔄 Attempting to regenerate sitemap...")
        if trigger_sitemap_regeneration():
            print("✅ Sitemap regeneration triggered - check again in a few minutes")
        else:
            print("❌ Failed to trigger regeneration")
    else:
        print(f"✅ Sitemap looks correct: {current_events} events (expected: {expected_events})")
    
    print(f"\n🔗 Check sitemap: https://www.todo-events.com/sitemap.xml") 