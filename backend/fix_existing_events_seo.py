#!/usr/bin/env python3
"""
Fix SEO Fields for Existing Events
Simple script to populate SEO data for events that have null values
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import re
import unicodedata

def get_production_db():
    """Get production PostgreSQL connection"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise Exception("DATABASE_URL environment variable not found")
    
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def slugify(title, city=""):
    """Create URL-friendly slug"""
    if not title:
        return ""
    
    # Combine title and city
    base = f"{title} {city}".lower() if city else title.lower()
    
    # Normalize and clean
    base = unicodedata.normalize('NFKD', base)
    base = re.sub(r'[^\w\s-]', '', base)
    base = re.sub(r'[\s_-]+', '-', base)
    
    return base.strip('-')

def extract_city_state(address):
    """Extract city and state from address"""
    if not address:
        return None, None
    
    # Try: City, STATE, USA
    match = re.search(r'([^,]+),\s*([A-Z]{2}),?\s*USA?$', address, re.IGNORECASE)
    if match:
        return match.group(1).strip(), match.group(2).upper()
    
    # Try: City, STATE
    match = re.search(r'([^,]+),\s*([A-Z]{2})$', address, re.IGNORECASE)
    if match:
        return match.group(1).strip(), match.group(2).upper()
    
    return None, None

def make_short_description(description):
    """Create short description for SEO"""
    if not description:
        return ""
    
    cleaned = ' '.join(description.split())
    
    if len(cleaned) <= 160:
        return cleaned
    
    truncated = cleaned[:157]
    last_space = truncated.rfind(' ')
    if last_space > 120:
        return cleaned[:last_space] + "..."
    else:
        return cleaned[:157] + "..."

def build_datetime(date_str, time_str):
    """Build ISO datetime string"""
    if not date_str or not time_str:
        return None
    
    try:
        return f"{date_str}T{time_str}:00"
    except:
        return None

def main():
    """Fix SEO fields for existing events"""
    print("🚀 Fixing SEO Fields for Existing Events")
    print("=" * 50)
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            # Find events with null SEO fields
            cursor.execute("""
                SELECT id, title, description, address, date, start_time, end_time
                FROM events 
                WHERE slug IS NULL 
                OR short_description IS NULL
                OR start_datetime IS NULL
                ORDER BY id
            """)
            
            events = cursor.fetchall()
            
            if not events:
                print("✅ No events need SEO field updates!")
                return
            
            print(f"📊 Found {len(events)} events to update")
            
            updated_count = 0
            
            for event in events:
                event_dict = dict(event)
                event_id = event_dict['id']
                
                print(f"\n📝 Updating Event {event_id}: {event_dict['title'][:50]}...")
                
                # Extract city/state
                city, state = extract_city_state(event_dict['address'])
                
                # Generate fields
                slug = slugify(event_dict['title'], city or "")
                short_desc = make_short_description(event_dict['description'])
                start_dt = build_datetime(event_dict['date'], event_dict['start_time'])
                end_dt = build_datetime(event_dict['date'], event_dict['end_time'])
                
                # Update the event
                cursor.execute("""
                    UPDATE events 
                    SET slug = %s,
                        city = %s,
                        state = %s,
                        short_description = %s,
                        start_datetime = %s,
                        end_datetime = %s,
                        country = 'USA',
                        currency = 'USD',
                        is_published = true,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (slug, city, state, short_desc, start_dt, end_dt, event_id))
                
                print(f"  ✅ Slug: {slug}")
                print(f"  ✅ City: {city}")
                print(f"  ✅ State: {state}")
                print(f"  ✅ Short Description: {short_desc[:50] if short_desc else 'None'}...")
                print(f"  ✅ Start DateTime: {start_dt}")
                print(f"  ✅ End DateTime: {end_dt}")
                
                updated_count += 1
            
            # Commit all changes
            conn.commit()
            
            print(f"\n🎉 Successfully updated {updated_count} events!")
            
            # Verify the updates
            print(f"\n🔍 Verification - Checking updated events...")
            cursor.execute("""
                SELECT id, title, slug, city, state, short_description, start_datetime
                FROM events 
                WHERE updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'
                ORDER BY id
                LIMIT 5
            """)
            
            recent_updates = cursor.fetchall()
            
            for event in recent_updates:
                print(f"  ✅ Event {event['id']}: {event['title'][:30]}...")
                print(f"    🏷️ Slug: {event['slug']}")
                print(f"    🏙️ City: {event['city']}")
                print(f"    ⏰ Start: {event['start_datetime']}")
            
            print(f"\n🎯 Migration Complete! Updated {updated_count} events with SEO data.")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        raise

if __name__ == "__main__":
    main() 