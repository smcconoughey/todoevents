#!/usr/bin/env python3
"""
Fix Duplicate Slugs and Display Migrated Data
Fixes duplicate slugs in the database and shows properly formatted migrated events
"""

import sqlite3
import json
from contextlib import contextmanager
from datetime import datetime

@contextmanager
def get_db():
    """Database connection context manager"""
    conn = sqlite3.connect('events.db')
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def fix_duplicate_slugs():
    """Fix duplicate slugs by making them unique"""
    print("🔧 Fixing duplicate slugs...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Find duplicate slugs
        cursor.execute('''
            SELECT slug, COUNT(*) as count, GROUP_CONCAT(id) as ids
            FROM events 
            WHERE slug IS NOT NULL 
            GROUP BY slug 
            HAVING COUNT(*) > 1
            ORDER BY slug
        ''')
        
        duplicates = cursor.fetchall()
        
        if not duplicates:
            print("✅ No duplicate slugs found")
            return
        
        print(f"📊 Found {len(duplicates)} duplicate slug groups")
        
        fixed_count = 0
        
        for duplicate in duplicates:
            slug = duplicate['slug']
            count = duplicate['count']
            ids = [int(id) for id in duplicate['ids'].split(',')]
            
            print(f"\n🔄 Fixing slug '{slug}' ({count} duplicates)")
            
            # Keep the first occurrence, rename others
            for i, event_id in enumerate(ids[1:], 1):  # Skip first one
                new_slug = f"{slug}-{i}"
                
                # Ensure this new slug doesn't already exist
                cursor.execute("SELECT id FROM events WHERE slug = ?", (new_slug,))
                while cursor.fetchone():
                    i += 1
                    new_slug = f"{slug}-{i}"
                    cursor.execute("SELECT id FROM events WHERE slug = ?", (new_slug,))
                
                # Update the event
                cursor.execute("UPDATE events SET slug = ? WHERE id = ?", (new_slug, event_id))
                print(f"  ✅ Event {event_id}: '{slug}' -> '{new_slug}'")
                fixed_count += 1
        
        conn.commit()
        print(f"\n✅ Fixed {fixed_count} duplicate slugs")

def display_migrated_events():
    """Display migrated events in proper JSON format"""
    print("\n📝 Sample Migrated Events (Production-Ready Format)")
    print("=" * 60)
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get a few sample migrated events
        cursor.execute('''
            SELECT id, title, description, short_description, date, start_time, 
                   end_time, end_date, category, address, city, state, country,
                   lat, lng, recurring, frequency, fee_required, price, currency,
                   event_url, host_name, organizer_url, slug, is_published,
                   created_by, created_at, updated_at, start_datetime, end_datetime,
                   interest_count, view_count
            FROM events 
            WHERE slug IS NOT NULL 
            LIMIT 3
        ''')
        
        events = cursor.fetchall()
        
        migrated_events = []
        
        for event in events:
            event_dict = dict(event)
            
            # Convert boolean values
            event_dict['recurring'] = bool(event_dict['recurring'])
            event_dict['is_published'] = bool(event_dict['is_published'])
            
            # Ensure null values are properly handled
            for key, value in event_dict.items():
                if value == "":
                    event_dict[key] = None
            
            migrated_events.append(event_dict)
        
        # Display as formatted JSON
        print(json.dumps(migrated_events, indent=2, default=str))

def verify_migration_quality():
    """Verify the quality of the migration"""
    print("\n🔍 Migration Quality Assessment")
    print("=" * 50)
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Check overall stats
        cursor.execute("SELECT COUNT(*) FROM events")
        total = cursor.fetchone()[0]
        
        quality_checks = [
            ("Unique slugs", "SELECT COUNT(DISTINCT slug) FROM events WHERE slug IS NOT NULL"),
            ("Events with cities", "SELECT COUNT(*) FROM events WHERE city IS NOT NULL AND city != ''"),
            ("Events with states", "SELECT COUNT(*) FROM events WHERE state IS NOT NULL AND state != ''"),
            ("Events with descriptions", "SELECT COUNT(*) FROM events WHERE short_description IS NOT NULL AND short_description != ''"),
            ("Events with ISO datetimes", "SELECT COUNT(*) FROM events WHERE start_datetime IS NOT NULL AND end_datetime IS NOT NULL"),
            ("Events with normalized prices", "SELECT COUNT(*) FROM events WHERE price IS NOT NULL"),
            ("Published events", "SELECT COUNT(*) FROM events WHERE is_published = 1"),
        ]
        
        for check_name, query in quality_checks:
            cursor.execute(query)
            count = cursor.fetchone()[0]
            percentage = (count / total * 100) if total > 0 else 0
            print(f"📈 {check_name}: {count}/{total} ({percentage:.1f}%)")
        
        # Check for potential issues
        print("\n⚠️ Potential Issues:")
        
        # Events without geographic data
        cursor.execute("SELECT COUNT(*) FROM events WHERE city IS NULL OR city = '' OR state IS NULL OR state = ''")
        missing_geo = cursor.fetchone()[0]
        if missing_geo > 0:
            print(f"  • {missing_geo} events missing city/state data")
            
            # Show sample addresses that couldn't be parsed
            cursor.execute('''
                SELECT address, title FROM events 
                WHERE (city IS NULL OR city = '' OR state IS NULL OR state = '') 
                AND address IS NOT NULL 
                LIMIT 3
            ''')
            samples = cursor.fetchall()
            for sample in samples:
                print(f"    - '{sample[1]}': '{sample[0]}'")
        
        # Events with very short descriptions
        cursor.execute("SELECT COUNT(*) FROM events WHERE LENGTH(short_description) < 50")
        short_desc = cursor.fetchone()[0]
        if short_desc > 0:
            print(f"  • {short_desc} events with very short descriptions")
        
        # Events with missing URLs
        cursor.execute("SELECT COUNT(*) FROM events WHERE (event_url IS NULL OR event_url = '') AND (host_name IS NULL OR host_name = '')")
        missing_org = cursor.fetchone()[0]
        if missing_org > 0:
            print(f"  • {missing_org} events missing organization details")

def show_seo_urls():
    """Show example SEO-friendly URLs that can now be generated"""
    print("\n🔗 Example SEO-Friendly URLs")
    print("=" * 40)
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT slug, city, state, title, start_datetime
            FROM events 
            WHERE slug IS NOT NULL AND city IS NOT NULL AND state IS NOT NULL
            LIMIT 5
        ''')
        
        events = cursor.fetchall()
        
        if events:
            print("📍 Geographic URL patterns:")
            for event in events:
                # Convert state to lowercase for URLs
                state_lower = event['state'].lower() if event['state'] else 'unknown'
                city_lower = event['city'].lower().replace(' ', '-') if event['city'] else 'unknown'
                
                # Extract year from datetime
                year = event['start_datetime'][:4] if event['start_datetime'] else '2025'
                
                url_patterns = [
                    f"/us/{state_lower}/{city_lower}/events/{event['slug']}",
                    f"/events/{year}/{event['slug']}",
                    f"/{state_lower}/events/{event['slug']}",
                ]
                
                print(f"\n📝 {event['title'][:30]}...")
                for pattern in url_patterns:
                    print(f"   {pattern}")
        else:
            print("⚠️ No events with complete geographic data found")

def main():
    """Run the slug fix and display results"""
    print("🚀 Fix Duplicate Slugs & Show Migration Results")
    print("=" * 55)
    
    # Step 1: Fix duplicate slugs
    fix_duplicate_slugs()
    
    # Step 2: Display migrated events
    display_migrated_events()
    
    # Step 3: Verify migration quality
    verify_migration_quality()
    
    # Step 4: Show SEO URL examples
    show_seo_urls()
    
    print("\n🎉 Migration analysis complete!")
    print("💡 Your events are now ready for:")
    print("   • SEO-friendly URLs with unique slugs")
    print("   • Structured data (JSON-LD)")
    print("   • Geographic organization") 
    print("   • Server-side rendering")
    print("   • Search engine optimization")

if __name__ == "__main__":
    main() 