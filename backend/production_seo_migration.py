#!/usr/bin/env python3
"""
Production SEO Migration for Render Deployment
Migrates all existing events to populate missing SEO fields including slugs
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import sqlite3
from contextlib import contextmanager
import re
from urllib.parse import urlparse
import datetime

def get_database_url():
    """Get the appropriate database URL for the environment"""
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        # Production PostgreSQL on Render
        return database_url
    else:
        # Local SQLite for development
        return None

@contextmanager
def get_db_connection():
    """Get database connection based on environment"""
    database_url = get_database_url()
    
    if database_url:
        # Production PostgreSQL
        print(f"🐘 Connecting to PostgreSQL database...")
        
        # Parse the database URL
        parsed = urlparse(database_url)
        
        # Handle both postgres:// and postgresql:// schemes
        if parsed.scheme == 'postgres':
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        
        conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor)
        try:
            yield conn
        finally:
            conn.close()
    else:
        # Local SQLite
        print(f"📁 Connecting to local SQLite database...")
        conn = sqlite3.connect('events.db')
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

def slugify(title, city=""):
    """Generate URL-friendly slug from title and city"""
    text = f"{title} {city}".strip()
    
    # Convert to lowercase
    text = text.lower()
    
    # Remove special characters and replace with hyphens
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    text = text.strip('-')
    
    # Limit length
    if len(text) > 50:
        text = text[:47] + '...'
        # Try to end at word boundary
        last_dash = text.rfind('-')
        if last_dash > 20:
            text = text[:last_dash]
    
    return text

def extract_city_state_enhanced(address):
    """Extract city and state from address using multiple strategies"""
    if not address:
        return {'city': None, 'state': None, 'country': None}
    
    # Strategy 1: "City, STATE, USA" format
    match = re.search(r'([^,]+),\s*([A-Z]{2}),?\s*USA', address, re.IGNORECASE)
    if match:
        city = match.group(1).strip()
        state = match.group(2).upper()
        return {'city': city, 'state': state, 'country': 'USA'}
    
    # Strategy 2: "City, STATE" format (at end of string)
    match = re.search(r'([^,]+),\s*([A-Z]{2})\s*$', address, re.IGNORECASE)
    if match:
        city = match.group(1).strip()
        state = match.group(2).upper()
        return {'city': city, 'state': state, 'country': 'USA'}
    
    # Strategy 3: Find any 2-letter state code
    state_match = re.search(r'\b([A-Z]{2})\b', address)
    if state_match:
        state = state_match.group(1).upper()
        
        # Try to extract city (text before the state)
        parts = address.split(state)[0].split(',')
        if parts:
            city = parts[-1].strip()
            if city and len(city) > 2:
                return {'city': city, 'state': state, 'country': 'USA'}
        
        return {'city': None, 'state': state, 'country': 'USA'}
    
    return {'city': None, 'state': None, 'country': 'USA'}

def normalize_price_enhanced(fee_required):
    """Extract numeric price from fee_required text"""
    if not fee_required:
        return 0.0
    
    fee_text = str(fee_required).lower()
    
    # Check for free indicators
    free_indicators = ['free', 'no charge', 'no cost', 'gratis', 'complimentary']
    if any(indicator in fee_text for indicator in free_indicators):
        return 0.0
    
    # Extract numeric value
    price_match = re.search(r'\$?(\d+(?:\.\d{2})?)', fee_text)
    if price_match:
        return float(price_match.group(1))
    
    return 0.0

def build_datetimes_enhanced(date_str, start_time_str, end_time_str, end_date_str=None):
    """Build ISO datetime strings from date/time components"""
    if not date_str or not start_time_str:
        return None, None
    
    try:
        # Parse the date
        date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        
        # Parse start time
        start_time_obj = datetime.datetime.strptime(start_time_str, '%H:%M').time()
        start_datetime = datetime.datetime.combine(date_obj, start_time_obj)
        
        # Parse end time
        end_datetime = None
        if end_time_str:
            try:
                end_time_obj = datetime.datetime.strptime(end_time_str, '%H:%M').time()
                
                # Use end_date if provided, otherwise same day
                if end_date_str:
                    end_date_obj = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
                else:
                    end_date_obj = date_obj
                
                end_datetime = datetime.datetime.combine(end_date_obj, end_time_obj)
                
                # If end time is before start time on same day, assume next day
                if end_date_obj == date_obj and end_datetime <= start_datetime:
                    end_datetime += datetime.timedelta(days=1)
                    
            except ValueError:
                pass
        
        # Convert to ISO format with timezone
        timezone_offset = '-04:00'  # Eastern Time
        start_iso = start_datetime.isoformat() + timezone_offset
        end_iso = end_datetime.isoformat() + timezone_offset if end_datetime else None
        
        return start_iso, end_iso
        
    except ValueError as e:
        print(f"    ⚠️ Date/time parsing error: {e}")
        return None, None

def make_short_description_enhanced(description):
    """Generate short description from long description (max 160 chars)"""
    if not description:
        return ""
    
    clean_desc = description.strip()
    
    if len(clean_desc) <= 160:
        return clean_desc
    
    # Find the best truncation point (prefer sentence or word boundaries)
    max_length = 157  # Leave room for "..."
    
    # Try to find sentence boundary
    sentence_endings = ['. ', '! ', '? ']
    best_cut = 0
    
    for ending in sentence_endings:
        pos = clean_desc.rfind(ending, 0, max_length)
        if pos > best_cut:
            best_cut = pos + 1  # Include the punctuation
    
    # If no sentence boundary, try word boundary
    if best_cut == 0:
        pos = clean_desc.rfind(' ', 0, max_length)
        if pos > 0:
            best_cut = pos
        else:
            best_cut = max_length
    
    # Truncate and add ellipsis if needed
    result = clean_desc[:best_cut]
    if best_cut < len(clean_desc):
        result += "..."
    
    return result

def ensure_unique_slug(cursor, base_slug, event_id=None, is_postgres=False):
    """Ensure slug is unique by appending numbers if needed"""
    if not base_slug:
        return "event"
    
    original_slug = base_slug
    counter = 1
    
    while True:
        # Check if slug exists (excluding current event if updating)
        if is_postgres:
            if event_id:
                cursor.execute("SELECT id FROM events WHERE slug = %s AND id != %s", (base_slug, event_id))
            else:
                cursor.execute("SELECT id FROM events WHERE slug = %s", (base_slug,))
        else:
            if event_id:
                cursor.execute("SELECT id FROM events WHERE slug = ? AND id != ?", (base_slug, event_id))
            else:
                cursor.execute("SELECT id FROM events WHERE slug = ?", (base_slug,))
        
        if not cursor.fetchone():
            return base_slug
        
        # Slug exists, try with counter
        base_slug = f"{original_slug}-{counter}"
        counter += 1
        
        # Prevent infinite loop
        if counter > 1000:
            base_slug = f"{original_slug}-{int(datetime.datetime.now().timestamp())}"
            break
    
    return base_slug

def migrate_production_seo_fields():
    """Migrate all existing events to populate missing SEO fields"""
    print("🚀 Starting Production SEO Migration...")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        is_postgres = get_database_url() is not None
        
        # Find events that are missing key SEO fields
        print("🔍 Finding events that need SEO field updates...")
        
        cursor.execute("""
            SELECT * FROM events 
            WHERE slug IS NULL 
               OR city IS NULL 
               OR state IS NULL 
               OR price IS NULL 
               OR start_datetime IS NULL 
               OR short_description IS NULL
               OR short_description = ''
            ORDER BY id
        """)
        
        events_to_update = cursor.fetchall()
        total_events = len(events_to_update)
        
        print(f"📊 Found {total_events} events that need SEO field updates")
        
        if total_events == 0:
            print("✅ All events already have SEO fields populated!")
            return {"success": True, "updated_count": 0, "message": "No events needed updating"}
        
        # Also get total event count for progress tracking
        cursor.execute("SELECT COUNT(*) FROM events")
        total_in_db = cursor.fetchone()[0]
        
        print(f"🗃️ Processing {total_events} events out of {total_in_db} total events in database")
        
        updated_count = 0
        errors = []
        
        for i, event in enumerate(events_to_update, 1):
            try:
                event_dict = dict(event)
                event_id = event_dict['id']
                
                print(f"\n🔧 [{i}/{total_events}] Processing event {event_id}: {event_dict['title'][:50]}...")
                
                # Generate missing fields
                updates = {}
                
                # Generate slug if missing
                if not event_dict.get('slug'):
                    city = event_dict.get('city') or ''
                    base_slug = slugify(event_dict['title'], city)
                    unique_slug = ensure_unique_slug(cursor, base_slug, event_id, is_postgres)
                    updates['slug'] = unique_slug
                    print(f"  📝 Generated slug: {unique_slug}")
                
                # Extract city/state if missing
                if not event_dict.get('city') or not event_dict.get('state'):
                    location_data = extract_city_state_enhanced(event_dict['address'])
                    city = location_data.get('city')
                    state = location_data.get('state')
                    if city and not event_dict.get('city'):
                        updates['city'] = city
                        print(f"  🏙️ Extracted city: {city}")
                    if state and not event_dict.get('state'):
                        updates['state'] = state
                        print(f"  🏛️ Extracted state: {state}")
                
                # Normalize price if missing
                if event_dict.get('price') is None:
                    price = normalize_price_enhanced(event_dict.get('fee_required', ''))
                    updates['price'] = price
                    print(f"  💰 Normalized price: {price}")
                
                # Generate datetime fields if missing
                if not event_dict.get('start_datetime') or not event_dict.get('end_datetime'):
                    start_dt, end_dt = build_datetimes_enhanced(
                        event_dict['date'],
                        event_dict['start_time'],
                        event_dict.get('end_time', ''),
                        event_dict.get('end_date')
                    )
                    if start_dt:
                        updates['start_datetime'] = start_dt
                        print(f"  📅 Generated start_datetime: {start_dt}")
                    if end_dt:
                        updates['end_datetime'] = end_dt
                        print(f"  📅 Generated end_datetime: {end_dt}")
                
                # Generate short description if missing
                if not event_dict.get('short_description') or event_dict.get('short_description') == '':
                    short_desc = make_short_description_enhanced(event_dict['description'])
                    updates['short_description'] = short_desc
                    print(f"  📄 Generated short description: {short_desc[:50]}...")
                
                # Set default currency if missing
                if not event_dict.get('currency'):
                    updates['currency'] = 'USD'
                    print(f"  💱 Set default currency: USD")
                
                # Update the event if we have changes
                if updates:
                    # Build UPDATE query dynamically
                    set_clauses = []
                    values = []
                    
                    for field, value in updates.items():
                        if is_postgres:
                            set_clauses.append(f"{field} = %s")
                        else:
                            set_clauses.append(f"{field} = ?")
                        values.append(value)
                    
                    values.append(event_id)  # For WHERE clause
                    
                    update_query = f"""
                        UPDATE events 
                        SET {', '.join(set_clauses)}
                        WHERE id = {'%s' if is_postgres else '?'}
                    """
                    
                    cursor.execute(update_query, values)
                    updated_count += 1
                    print(f"  ✅ Updated {len(updates)} fields")
                
                # Progress update every 10 events
                if i % 10 == 0:
                    print(f"📈 Progress: {i}/{total_events} events processed ({updated_count} updated)")
                
            except Exception as e:
                error_msg = f"Event {event_id}: {str(e)}"
                errors.append(error_msg)
                print(f"  ❌ Error processing event {event_id}: {e}")
                continue
        
        # Commit all changes
        conn.commit()
        print(f"\n🎉 Migration completed! Successfully updated {updated_count} events")
        
        if errors:
            print(f"\n⚠️ Encountered {len(errors)} errors:")
            for error in errors[:5]:  # Show first 5 errors
                print(f"  • {error}")
            if len(errors) > 5:
                print(f"  ... and {len(errors) - 5} more errors")
        
        # Verify the results
        print(f"\n📊 Running final verification...")
        cursor.execute("""
            SELECT COUNT(*) as total,
                   COUNT(slug) as with_slug,
                   COUNT(city) as with_city,
                   COUNT(state) as with_state,
                   COUNT(CASE WHEN price IS NOT NULL THEN 1 END) as with_price,
                   COUNT(start_datetime) as with_start_dt,
                   COUNT(CASE WHEN short_description IS NOT NULL AND short_description != '' THEN 1 END) as with_short_desc
            FROM events
        """)
        
        stats = cursor.fetchone()
        print(f"\n📊 Final Statistics:")
        print(f"  Total events: {stats['total']}")
        print(f"  With slug: {stats['with_slug']} ({stats['with_slug']/stats['total']*100:.1f}%)")
        print(f"  With city: {stats['with_city']} ({stats['with_city']/stats['total']*100:.1f}%)")
        print(f"  With state: {stats['with_state']} ({stats['with_state']/stats['total']*100:.1f}%)")
        print(f"  With price: {stats['with_price']} ({stats['with_price']/stats['total']*100:.1f}%)")
        print(f"  With start_datetime: {stats['with_start_dt']} ({stats['with_start_dt']/stats['total']*100:.1f}%)")
        print(f"  With short_description: {stats['with_short_desc']} ({stats['with_short_desc']/stats['total']*100:.1f}%)")
        
        return {
            "success": True,
            "updated_count": updated_count,
            "total_processed": total_events,
            "total_in_database": stats['total'],
            "errors": errors,
            "final_stats": dict(stats)
        }

if __name__ == "__main__":
    try:
        result = migrate_production_seo_fields()
        print(f"\n✅ Migration completed successfully!")
        print(f"📈 Result: {result}")
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise 