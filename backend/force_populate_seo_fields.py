#!/usr/bin/env python3
"""
Force Populate ALL SEO Fields
This script aggressively populates ALL NULL SEO fields in the production database
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
        return "untitled-event"
    
    # Combine title and city
    base = f"{title} {city}".strip()
    
    # Normalize unicode
    base = unicodedata.normalize('NFKD', base)
    base = base.encode('ascii', 'ignore').decode('ascii')
    
    # Convert to lowercase and clean
    slug = re.sub(r'[^\w\s-]', '', base.lower())
    slug = re.sub(r'[-\s]+', '-', slug)
    slug = slug.strip('-')
    
    # Limit length
    if len(slug) > 80:
        slug = slug[:80].rstrip('-')
    
    return slug or "event"

def extract_city_state(address):
    """Extract city and state from address"""
    if not address:
        return None, None
    
    # Look for patterns like "City, ST" or "City, STATE"
    # Pattern 1: City, ST, USA
    match = re.search(r'([^,]+),\s*([A-Z]{2}),?\s*USA?', address, re.IGNORECASE)
    if match:
        return match.group(1).strip(), match.group(2).upper()
    
    # Pattern 2: City, ST (without USA)
    match = re.search(r'([^,]+),\s*([A-Z]{2})(?:\s|$)', address, re.IGNORECASE)
    if match:
        return match.group(1).strip(), match.group(2).upper()
    
    # Pattern 3: Try to find any state abbreviation
    state_codes = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']
    
    for state in state_codes:
        if state in address.upper():
            # Try to find the city before the state
            parts = address.split(',')
            for i, part in enumerate(parts):
                if state in part.upper():
                    if i > 0:
                        city = parts[i-1].strip()
                        # Remove any leading numbers/addresses
                        city = re.sub(r'^\d+\s+', '', city)
                        return city, state
    
    return None, None

def make_short_description(description):
    """Create short description (160 chars max)"""
    if not description:
        return ""
    
    clean_desc = description.strip()
    if len(clean_desc) <= 160:
        return clean_desc
    
    # Try to cut at sentence boundary
    sentences = re.split(r'[.!?]+', clean_desc)
    if sentences and len(sentences[0]) <= 157:
        return sentences[0].strip() + "."
    
    # Cut at word boundary
    words = clean_desc.split()
    short_desc = ""
    for word in words:
        if len(short_desc + " " + word) <= 157:
            short_desc += (" " + word) if short_desc else word
        else:
            break
    
    return (short_desc + "...") if short_desc else clean_desc[:157] + "..."

def build_datetime(date_str, time_str):
    """Build ISO datetime string"""
    if not date_str or not time_str:
        return None
    
    try:
        # Ensure time has seconds
        if len(time_str.split(':')) == 2:
            time_str += ":00"
        return f"{date_str}T{time_str}"
    except:
        return None

def ensure_unique_slug(cursor, base_slug, event_id):
    """Make sure slug is unique"""
    if not base_slug:
        return "event"
    
    original_slug = base_slug
    counter = 1
    
    while True:
        # Check if this slug exists for a different event
        cursor.execute(
            "SELECT id FROM events WHERE slug = %s AND id != %s",
            (base_slug, event_id)
        )
        
        if not cursor.fetchone():
            return base_slug
        
        # Try with counter
        base_slug = f"{original_slug}-{counter}"
        counter += 1
        
        if counter > 100:  # Prevent infinite loop
            return f"{original_slug}-{event_id}"

def main():
    """Force populate ALL SEO fields"""
    print("🚀 FORCE Populating ALL SEO Fields")
    print("=" * 60)
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            # Get ALL events - we'll populate everything
            print("🔍 Finding ALL events...")
            cursor.execute("""
                SELECT id, title, description, address, date, start_time, end_time, end_date,
                       slug, short_description, start_datetime, end_datetime, city, state
                FROM events
                ORDER BY id
            """)
            
            events = cursor.fetchall()
            total_events = len(events)
            print(f"📊 Found {total_events} events to process")
            
            if not events:
                print("❌ No events found!")
                return
            
            updated_count = 0
            
            for i, event in enumerate(events, 1):
                event_dict = dict(event)
                event_id = event_dict['id']
                title = event_dict['title'] or f"Event {event_id}"
                
                print(f"\n📝 Processing {i}/{total_events}: Event {event_id} - {title[:40]}...")
                
                # Always generate new SEO data (force overwrite)
                updates = []
                values = []
                
                # 1. Generate slug
                city, state = extract_city_state(event_dict.get('address', ''))
                base_slug = slugify(title, city or '')
                unique_slug = ensure_unique_slug(cursor, base_slug, event_id)
                updates.append("slug = %s")
                values.append(unique_slug)
                print(f"  🏷️ Slug: {unique_slug}")
                
                # 2. Set city/state
                updates.append("city = %s")
                values.append(city)
                updates.append("state = %s")
                values.append(state)
                if city:
                    print(f"  🏙️ City: {city}")
                if state:
                    print(f"  🏛️ State: {state}")
                
                # 3. Generate short description
                short_desc = make_short_description(event_dict.get('description', ''))
                updates.append("short_description = %s")
                values.append(short_desc or None)
                if short_desc:
                    print(f"  📝 Short desc: {short_desc[:40]}...")
                
                # 4. Build datetime fields
                start_dt = build_datetime(event_dict.get('date'), event_dict.get('start_time'))
                end_dt = build_datetime(
                    event_dict.get('end_date') or event_dict.get('date'), 
                    event_dict.get('end_time')
                )
                
                updates.append("start_datetime = %s")
                values.append(start_dt)
                updates.append("end_datetime = %s") 
                values.append(end_dt)
                
                if start_dt:
                    print(f"  ⏰ Start: {start_dt}")
                if end_dt:
                    print(f"  ⏰ End: {end_dt}")
                
                # 5. Set defaults
                updates.append("country = %s")
                values.append('USA')
                updates.append("currency = %s")
                values.append('USD')
                updates.append("is_published = %s")
                values.append(True)
                updates.append("updated_at = CURRENT_TIMESTAMP")
                
                # Add event ID for WHERE clause
                values.append(event_id)
                
                # Execute update
                update_query = f"""
                    UPDATE events 
                    SET {', '.join(updates)}
                    WHERE id = %s
                """
                
                cursor.execute(update_query, values)
                updated_count += 1
                print(f"  ✅ Updated event {event_id}")
            
            # Commit all changes
            conn.commit()
            
            print(f"\n🎉 SUCCESS! Updated {updated_count} events!")
            print(f"📊 Processed {total_events} total events")
            
            # Verify some results
            print("\n🔍 Verification - Sample updated events:")
            cursor.execute("""
                SELECT id, title, slug, city, state, short_description, start_datetime
                FROM events 
                WHERE slug IS NOT NULL
                ORDER BY updated_at DESC
                LIMIT 5
            """)
            
            verification = cursor.fetchall()
            for event in verification:
                print(f"  ✅ Event {event['id']}: {event['title'][:30]}...")
                print(f"     🏷️ Slug: {event['slug']}")
                print(f"     🏙️ Location: {event['city']}, {event['state']}")
                print(f"     ⏰ Start: {event['start_datetime']}")
                print(f"     📝 Short: {(event['short_description'] or '')[:40]}...")
                print()
            
            return {"status": "success", "updated": updated_count, "total": total_events}
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    result = main()
    print(f"\n📋 Final Result: {result}") 