#!/usr/bin/env python3
"""
Populate SEO fields for existing events in Render PostgreSQL production database
"""

import os
import psycopg2
import re
import unicodedata
from contextlib import contextmanager

def get_production_db():
    """Get PostgreSQL database connection from Render environment"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not found")
    
    # Parse the database URL for Render PostgreSQL
    conn = psycopg2.connect(database_url)
    return conn

@contextmanager
def get_db():
    """Context manager for database connections"""
    conn = get_production_db()
    try:
        yield conn
    finally:
        conn.close()

def slugify(title, city=""):
    """Generate URL-friendly slug from title and city"""
    if not title:
        return ""
    
    # Combine title and city for better uniqueness
    base = f"{title} {city}".lower() if city else title.lower()
    
    # Normalize Unicode characters
    base = unicodedata.normalize('NFKD', base)
    
    # Remove non-word characters (keep letters, numbers, spaces, hyphens)
    base = re.sub(r'[^\w\s-]', '', base)
    
    # Replace multiple spaces/underscores/hyphens with single hyphen
    base = re.sub(r'[-\s_]+', '-', base)
    
    # Strip leading/trailing hyphens
    slug = base.strip('-')
    
    # Limit length and ensure valid slug
    if len(slug) > 80:
        slug = slug[:80].rstrip('-')
    
    return slug or "event"

def extract_city_state_enhanced(address):
    """Extract city, state, and country from address with enhanced parsing"""
    if not address:
        return "", "", "USA"
    
    # Clean up the address
    address = address.strip()
    
    # Common patterns for US addresses
    patterns = [
        # City, State ZIP, USA
        r'([^,]+),\s*([A-Z]{2})\s*\d{5}(?:-\d{4})?,?\s*(?:USA?)?$',
        # City, State, USA
        r'([^,]+),\s*([A-Z]{2}),?\s*(?:USA?)?$',
        # City, State
        r'([^,]+),\s*([A-Z]{2})(?:\s|$)',
        # Just city with state mention
        r'([^,]+),\s*([A-Z]{2})',
    ]
    
    city = ""
    state = ""
    country = "USA"
    
    for pattern in patterns:
        match = re.search(pattern, address, re.IGNORECASE)
        if match:
            city = match.group(1).strip()
            state = match.group(2).upper() if match.group(2) else ""
            break
    
    # If no pattern matched, try to extract the last meaningful part as city
    if not city:
        parts = [p.strip() for p in address.split(',') if p.strip()]
        if parts:
            # Take the first part as city if it looks like a city name
            potential_city = parts[0]
            if len(potential_city) > 2 and not potential_city.isdigit():
                city = potential_city
    
    # Clean up city name
    if city:
        # Remove common prefixes/suffixes
        city = re.sub(r'\b(at|in|near|downtown|city of|the)\s+', '', city, flags=re.IGNORECASE)
        city = re.sub(r'\s+(area|region|downtown|district)$', '', city, flags=re.IGNORECASE)
        city = city.strip()
    
    return city, state, country

def make_short_description_enhanced(description):
    """Generate short description from full description"""
    if not description:
        return ""
    
    # Clean up the description
    desc = description.strip()
    
    # Take first sentence or first 100 characters, whichever is shorter
    sentences = re.split(r'[.!?]+', desc)
    if sentences and len(sentences[0]) <= 100:
        short = sentences[0].strip()
    else:
        # Take first 100 characters and break at word boundary
        if len(desc) <= 100:
            short = desc
        else:
            short = desc[:100]
            # Find last complete word
            last_space = short.rfind(' ')
            if last_space > 50:  # Ensure we have a reasonable length
                short = short[:last_space]
    
    # Clean up
    short = short.strip()
    if short and not short.endswith(('.', '!', '?')):
        short += '...'
    
    return short

def build_datetimes_enhanced(date_str, start_time_str, end_time_str, end_date_str=None):
    """Build start_datetime and end_datetime from date and time components"""
    from datetime import datetime, time
    
    start_datetime = None
    end_datetime = None
    
    try:
        # Parse the date
        if date_str:
            event_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            
            # Parse start time
            if start_time_str:
                try:
                    start_time = datetime.strptime(start_time_str, '%H:%M').time()
                    start_datetime = datetime.combine(event_date, start_time)
                except ValueError:
                    # Try alternative time format
                    try:
                        start_time = datetime.strptime(start_time_str, '%H:%M:%S').time()
                        start_datetime = datetime.combine(event_date, start_time)
                    except ValueError:
                        pass
            
            # Parse end time
            if end_time_str:
                try:
                    end_time = datetime.strptime(end_time_str, '%H:%M').time()
                    # Use end_date if provided, otherwise same as start_date
                    end_date = event_date
                    if end_date_str:
                        try:
                            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        except ValueError:
                            pass
                    end_datetime = datetime.combine(end_date, end_time)
                except ValueError:
                    # Try alternative time format
                    try:
                        end_time = datetime.strptime(end_time_str, '%H:%M:%S').time()
                        end_date = event_date
                        if end_date_str:
                            try:
                                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                            except ValueError:
                                pass
                        end_datetime = datetime.combine(end_date, end_time)
                    except ValueError:
                        pass
    
    except Exception as e:
        print(f"    ⚠️ Error building datetime: {e}")
    
    return start_datetime, end_datetime

def ensure_unique_slug(cursor, base_slug, event_id=None):
    """Ensure slug is unique by adding counter if needed"""
    slug = base_slug
    counter = 1
    
    while True:
        # Check if slug exists (excluding current event if updating)
        if event_id:
            cursor.execute("SELECT id FROM events WHERE slug = %s AND id != %s", (slug, event_id))
        else:
            cursor.execute("SELECT id FROM events WHERE slug = %s", (slug,))
        
        if not cursor.fetchone():
            return slug
        
        # Generate new slug with counter
        slug = f"{base_slug}-{counter}"
        counter += 1
        
        # Prevent infinite loop
        if counter > 1000:
            return f"{base_slug}-{event_id or 'unique'}"

def populate_seo_data():
    """Populate SEO data for all events in production database"""
    print("🚀 Starting SEO data population for PRODUCTION database...")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # First, check if the SEO columns exist
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'events' 
                AND column_name IN ('slug', 'city', 'state', 'short_description', 'start_datetime', 'end_datetime')
            """)
            existing_columns = [row[0] for row in cursor.fetchall()]
            print(f"📋 Found SEO columns: {existing_columns}")
            
            # Get all events that need SEO data populated
            cursor.execute("""
                SELECT id, title, description, address, date, start_time, end_time, end_date
                FROM events 
                WHERE slug IS NULL OR slug = '' OR city IS NULL OR city = ''
                ORDER BY id
            """)
            
            events = cursor.fetchall()
            print(f"📊 Found {len(events)} events to process")
            
            if not events:
                print("✅ All events already have SEO data populated!")
                return
            
            updated_count = 0
            
            for event in events:
                event_id, title, description, address, date, start_time, end_time, end_date = event
                
                print(f"\n📝 Processing Event {event_id}: {title[:50]}...")
                
                try:
                    # Extract city and state
                    city, state, country = extract_city_state_enhanced(address or "")
                    if city:
                        print(f"  🏙️ Extracted city: {city}")
                    if state:
                        print(f"  🏛️ Extracted state: {state}")
                    
                    # Generate slug
                    base_slug = slugify(title or "", city)
                    slug = ensure_unique_slug(cursor, base_slug, event_id)
                    print(f"  🏷️ Generated slug: {slug}")
                    
                    # Generate short description
                    short_description = make_short_description_enhanced(description or "")
                    if short_description:
                        print(f"  📝 Generated short description: {short_description[:50]}...")
                    
                    # Build datetime fields
                    start_datetime, end_datetime = build_datetimes_enhanced(date, start_time, end_time, end_date)
                    if start_datetime:
                        print(f"  ⏰ Generated start_datetime: {start_datetime}")
                    
                    # Update the event with all SEO fields
                    update_query = """
                        UPDATE events 
                        SET slug = %s, 
                            city = %s, 
                            state = %s, 
                            short_description = %s,
                            start_datetime = %s,
                            end_datetime = %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    """
                    
                    cursor.execute(update_query, (
                        slug,
                        city or "",
                        state or "",
                        short_description or "",
                        start_datetime,
                        end_datetime,
                        event_id
                    ))
                    
                    updated_count += 1
                    print(f"  ✅ Updated event {event_id}")
                    
                except Exception as e:
                    print(f"  ❌ Error processing event {event_id}: {e}")
                    continue
            
            # Commit all changes
            conn.commit()
            print(f"\n🎉 Successfully populated SEO data for {updated_count} events!")
            print(f"✅ Data population completed: Updated {updated_count} events")
            
    except Exception as e:
        print(f"❌ Error populating SEO data: {e}")
        raise

def main():
    """Main function"""
    print("🔧 Production SEO Field Population Script")
    print("=" * 50)
    
    # Check if we're in production environment
    if not os.getenv('DATABASE_URL'):
        print("❌ No DATABASE_URL found. This script requires production environment variables.")
        print("   Set DATABASE_URL to your Render PostgreSQL connection string.")
        return
    
    try:
        populate_seo_data()
        print("\n🎉 PRODUCTION SEO POPULATION COMPLETE!")
    except Exception as e:
        print(f"\n❌ PRODUCTION MIGRATION FAILED: {e}")
        raise

if __name__ == "__main__":
    main() 