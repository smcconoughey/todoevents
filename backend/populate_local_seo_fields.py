#!/usr/bin/env python3
"""
Populate SEO fields for existing events in local SQLite database
"""

import sqlite3
import re
from contextlib import contextmanager

@contextmanager
def get_db():
    """Get SQLite database connection"""
    conn = sqlite3.connect('events.db')
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def slugify(title, city=""):
    """Generate URL-friendly slug from title and city"""
    text = f"{title} {city}".strip()
    slug = re.sub(r'[^\w\s-]', '', text.lower())
    slug = re.sub(r'[-\s]+', '-', slug)
    slug = slug.strip('-')
    if len(slug) > 80:
        slug = slug[:80].rstrip('-')
    return slug

def extract_city_state_enhanced(address):
    """Extract city, state, and country from address"""
    if not address:
        return {"city": None, "state": None, "country": "USA"}
    
    clean_address = address.strip()
    
    # Pattern 1: City, STATE, USA format
    match = re.search(r'([^,]+),\s*([A-Z]{2}),\s*USA', clean_address, re.IGNORECASE)
    if match:
        city = match.group(1).strip()
        state = match.group(2).upper()
        return {"city": city, "state": state, "country": "USA"}
    
    # Pattern 2: City, STATE format (no USA)
    match = re.search(r'([^,]+),\s*([A-Z]{2})(?:\s|$)', clean_address, re.IGNORECASE)
    if match:
        city = match.group(1).strip()
        state = match.group(2).upper()
        return {"city": city, "state": state, "country": "USA"}
    
    # Pattern 3: Look for any 2-letter state code
    state_codes = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']
    
    for state_code in state_codes:
        if re.search(rf'\b{state_code}\b', clean_address, re.IGNORECASE):
            parts = clean_address.split(',')
            for i, part in enumerate(parts):
                if re.search(rf'\b{state_code}\b', part, re.IGNORECASE):
                    if i > 0:
                        city = parts[i-1].strip()
                        city = re.sub(r'^\d+\s+', '', city)
                        return {"city": city, "state": state_code, "country": "USA"}
                    break
    
    return {"city": None, "state": None, "country": "USA"}

def make_short_description_enhanced(description):
    """Generate short description from long description (max 160 chars)"""
    if not description:
        return ""
    
    clean_desc = description.strip()
    if len(clean_desc) <= 160:
        return clean_desc
    
    max_length = 157
    sentences = re.split(r'[.!?]+', clean_desc)
    if len(sentences[0]) <= max_length:
        return sentences[0].strip() + "."
    
    words = clean_desc.split()
    short_desc = ""
    for word in words:
        if len(short_desc + " " + word) <= max_length:
            short_desc += (" " + word) if short_desc else word
        else:
            break
    
    return short_desc.strip() + "..." if short_desc else ""

def build_datetimes_enhanced(date_str, start_time_str, end_time_str, end_date_str=None):
    """Generate start_datetime and end_datetime"""
    if not date_str or not start_time_str:
        return {"start_datetime": None, "end_datetime": None}
    
    try:
        # Build start datetime
        start_dt_str = f"{date_str}T{start_time_str}:00"
        
        # Build end datetime
        end_dt_str = None
        if end_time_str:
            if end_date_str:
                end_dt_str = f"{end_date_str}T{end_time_str}:00"
            else:
                end_dt_str = f"{date_str}T{end_time_str}:00"
        
        return {"start_datetime": start_dt_str, "end_datetime": end_dt_str}
    except Exception:
        return {"start_datetime": None, "end_datetime": None}

def ensure_unique_slug(cursor, base_slug, event_id=None):
    """Ensure slug is unique in the database"""
    original_slug = base_slug
    counter = 1
    
    while counter <= 1000:
        if event_id:
            cursor.execute(
                "SELECT id FROM events WHERE slug = ? AND id != ? LIMIT 1",
                (base_slug, event_id)
            )
        else:
            cursor.execute(
                "SELECT id FROM events WHERE slug = ? LIMIT 1",
                (base_slug,)
            )
        
        if not cursor.fetchone():
            return base_slug
        
        base_slug = f"{original_slug}-{counter}"
        counter += 1
    
    return base_slug

def populate_seo_data():
    """Populate SEO data for all existing events"""
    print("\n🔄 Starting SEO Data Population...")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Get all events that need SEO data
            cursor.execute("""
                SELECT id, title, description, address, date, start_time, end_time, end_date
                FROM events
                ORDER BY id
            """)
            
            events = cursor.fetchall()
            print(f"📊 Found {len(events)} events to process")
            
            if not events:
                return {"status": "success", "updated_count": 0}
            
            updated_count = 0
            
            for event in events:
                event_dict = dict(event)
                event_id = event_dict['id']
                
                print(f"\n📝 Processing Event {event_id}: {event_dict['title'][:50]}...")
                
                # Generate slug
                city_data = extract_city_state_enhanced(event_dict['address'])
                city = city_data.get('city', '')
                base_slug = slugify(event_dict['title'], city)
                unique_slug = ensure_unique_slug(cursor, base_slug, event_id)
                print(f"  🏷️ Generated slug: {unique_slug}")
                
                # Extract city/state
                extracted_city = city_data['city']
                extracted_state = city_data['state']
                
                if extracted_city:
                    print(f"  🏙️ Extracted city: {extracted_city}")
                if extracted_state:
                    print(f"  🏛️ Extracted state: {extracted_state}")
                
                # Generate short description
                short_desc = None
                if event_dict.get('description'):
                    short_desc = make_short_description_enhanced(event_dict['description'])
                    print(f"  📝 Generated short description: {short_desc[:50]}...")
                
                # Build datetime fields
                datetime_data = build_datetimes_enhanced(
                    event_dict.get('date'),
                    event_dict.get('start_time'),
                    event_dict.get('end_time'),
                    event_dict.get('end_date')
                )
                
                start_datetime = datetime_data['start_datetime']
                end_datetime = datetime_data['end_datetime']
                
                if start_datetime:
                    print(f"  ⏰ Generated start_datetime: {start_datetime}")
                if end_datetime:
                    print(f"  ⏰ Generated end_datetime: {end_datetime}")
                
                # Update the event with SEO data
                cursor.execute("""
                    UPDATE events 
                    SET slug = ?, 
                        city = ?, 
                        state = ?, 
                        short_description = ?, 
                        start_datetime = ?, 
                        end_datetime = ?, 
                        country = 'USA', 
                        currency = 'USD', 
                        is_published = 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (
                    unique_slug,
                    extracted_city,
                    extracted_state,
                    short_desc,
                    start_datetime,
                    end_datetime,
                    event_id
                ))
                
                updated_count += 1
                print(f"  ✅ Updated event {event_id}")
            
            # Commit all changes
            conn.commit()
            
            print(f"\n🎉 Successfully populated SEO data for {updated_count} events!")
            return {
                "status": "success", 
                "updated_count": updated_count,
                "total_processed": len(events)
            }
            
    except Exception as e:
        print(f"❌ Data population failed: {e}")
        return {"status": "error", "message": str(e)}

def main():
    """Main function to run the SEO population"""
    print("🚀 TodoEvents Local Database SEO Population")
    print("=" * 50)
    
    # Populate SEO data
    result = populate_seo_data()
    
    if result["status"] != "success":
        print(f"❌ SEO population failed: {result['message']}")
        return result
    
    print(f"✅ SEO population completed: Updated {result['updated_count']} events")
    
    # Final summary
    print(f"\n🎉 POPULATION COMPLETE!")
    print(f"📊 Updated events: {result['updated_count']}")
    
    return result

if __name__ == "__main__":
    result = main()
    print(f"\n📋 Final Result: {result}") 