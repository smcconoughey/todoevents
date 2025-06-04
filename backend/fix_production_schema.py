#!/usr/bin/env python3
"""
Fix Production Schema - Populate Missing SEO Fields
This script connects to the production PostgreSQL database and populates missing SEO fields
for all existing events that have null values.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import re
from urllib.parse import unquote

def get_production_db():
    """Get production PostgreSQL connection"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise Exception("DATABASE_URL environment variable not found")
    
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def slugify(title, city=""):
    """Generate URL-friendly slug from title and city"""
    # Combine title and city for uniqueness
    text = f"{title} {city}".strip()
    
    # Convert to lowercase and replace spaces/special chars with hyphens
    slug = re.sub(r'[^\w\s-]', '', text.lower())
    slug = re.sub(r'[-\s]+', '-', slug)
    slug = slug.strip('-')
    
    # Limit length
    if len(slug) > 80:
        slug = slug[:80].rstrip('-')
    
    return slug

def extract_city_state_enhanced(address):
    """Extract city, state, and country from address"""
    if not address:
        return {"city": None, "state": None, "country": "USA"}
    
    # Clean the address
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
    
    # Pattern 3: Look for any 2-letter state code in the address
    state_codes = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']
    
    for state_code in state_codes:
        if re.search(rf'\b{state_code}\b', clean_address, re.IGNORECASE):
            # Try to extract city from the part before the state
            parts = clean_address.split(',')
            for i, part in enumerate(parts):
                if re.search(rf'\b{state_code}\b', part, re.IGNORECASE):
                    if i > 0:
                        city = parts[i-1].strip()
                        # Clean city name
                        city = re.sub(r'^\d+\s+', '', city)  # Remove leading numbers
                        return {"city": city, "state": state_code, "country": "USA"}
                    break
    
    return {"city": None, "state": None, "country": "USA"}

def normalize_price_enhanced(fee_required):
    """Extract and normalize price from fee_required text"""
    if not fee_required:
        return 0.0
    
    # Convert to string and clean
    fee_text = str(fee_required).lower().strip()
    
    # Check for free indicators first
    free_indicators = ['free', 'no charge', 'no cost', 'complimentary', 'no fee']
    if any(indicator in fee_text for indicator in free_indicators):
        return 0.0
    
    # Find price patterns
    price_patterns = [
        r'\$(\d+(?:\.\d{2})?)',  # $15.00 or $15
        r'(\d+(?:\.\d{2})?)\s*dollars?',  # 15 dollars
        r'(\d+(?:\.\d{2})?)\s*usd',  # 15 USD
        r'(\d+(?:\.\d{2})?)\s*\$',  # 15$
    ]
    
    for pattern in price_patterns:
        match = re.search(pattern, fee_text)
        if match:
            try:
                return float(match.group(1))
            except (ValueError, IndexError):
                continue
    
    return 0.0

def build_datetimes_enhanced(date_str, start_time_str, end_time_str, end_date_str=None):
    """Build ISO datetime strings from date and time components"""
    if not date_str or not start_time_str:
        return {"start_datetime": None, "end_datetime": None}
    
    try:
        # Build start datetime
        start_datetime = f"{date_str}T{start_time_str}:00"
        
        # Build end datetime
        end_datetime = None
        if end_time_str:
            end_date = end_date_str if end_date_str else date_str
            end_datetime = f"{end_date}T{end_time_str}:00"
        
        return {
            "start_datetime": start_datetime,
            "end_datetime": end_datetime
        }
    except Exception:
        return {"start_datetime": None, "end_datetime": None}

def make_short_description_enhanced(description):
    """Generate short description from long description (max 160 chars)"""
    if not description:
        return ""
    
    # Clean the description
    clean_desc = description.strip()
    
    if len(clean_desc) <= 160:
        return clean_desc
    
    # Find the best truncation point (prefer sentence or word boundaries)
    max_length = 157  # Leave room for "..."
    
    # Try to find sentence boundary
    sentences = re.split(r'[.!?]+', clean_desc)
    if len(sentences[0]) <= max_length:
        return sentences[0].strip() + "."
    
    # Try to find word boundary
    words = clean_desc.split()
    short_desc = ""
    for word in words:
        if len(short_desc + " " + word) <= max_length:
            short_desc += (" " + word) if short_desc else word
        else:
            break
    
    if short_desc:
        return short_desc.strip() + "..."
    
    # Fallback: hard truncate
    return clean_desc[:max_length].strip() + "..."

def ensure_unique_slug(cursor, base_slug, event_id=None):
    """Ensure slug is unique by adding number suffix if needed"""
    if not base_slug:
        return None
    
    original_slug = base_slug
    counter = 1
    
    while True:
        # Check if slug exists for other events
        if event_id:
            cursor.execute(
                "SELECT id FROM events WHERE slug = %s AND id != %s LIMIT 1",
                (base_slug, event_id)
            )
        else:
            cursor.execute(
                "SELECT id FROM events WHERE slug = %s LIMIT 1",
                (base_slug,)
            )
        
        if not cursor.fetchone():
            return base_slug
        
        # Generate new slug with counter
        base_slug = f"{original_slug}-{counter}"
        counter += 1
        
        # Prevent infinite loop
        if counter > 1000:
            base_slug = f"{original_slug}-{event_id or 'new'}"
            break
    
    return base_slug

def fix_production_seo_fields():
    """Fix missing SEO fields in production database"""
    print("🚀 Starting Production SEO Field Population...")
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            # Find events that need SEO field updates
            print("🔍 Finding events that need SEO field updates...")
            cursor.execute("""
                SELECT id, title, description, address, date, start_time, end_time, end_date, fee_required,
                       slug, city, state, short_description, start_datetime, end_datetime
                FROM events
                WHERE slug IS NULL 
                   OR city IS NULL 
                   OR state IS NULL 
                   OR short_description IS NULL 
                   OR start_datetime IS NULL
                ORDER BY id
            """)
            
            events_to_update = cursor.fetchall()
            print(f"📊 Found {len(events_to_update)} events that need SEO field updates")
            
            if not events_to_update:
                print("✅ All events already have complete SEO fields")
                return {"status": "success", "updated_count": 0, "message": "No updates needed"}
            
            updated_count = 0
            
            for event in events_to_update:
                event_dict = dict(event)
                event_id = event_dict['id']
                updates = {}
                
                print(f"\n📝 Processing Event {event_id}: {event_dict['title'][:50]}...")
                
                # Generate slug if missing
                if not event_dict.get('slug'):
                    city = event_dict.get('city') or ''
                    base_slug = slugify(event_dict['title'], city)
                    unique_slug = ensure_unique_slug(cursor, base_slug, event_id)
                    updates['slug'] = unique_slug
                    print(f"  🏷️ Generated slug: {unique_slug}")
                
                # Extract city/state if missing
                if not event_dict.get('city') or not event_dict.get('state'):
                    location_data = extract_city_state_enhanced(event_dict['address'])
                    if location_data['city'] and not event_dict.get('city'):
                        updates['city'] = location_data['city']
                        print(f"  🏙️ Extracted city: {location_data['city']}")
                    if location_data['state'] and not event_dict.get('state'):
                        updates['state'] = location_data['state']
                        print(f"  🏛️ Extracted state: {location_data['state']}")
                
                # Generate short description if missing
                if not event_dict.get('short_description') and event_dict.get('description'):
                    short_desc = make_short_description_enhanced(event_dict['description'])
                    updates['short_description'] = short_desc
                    print(f"  📝 Generated short description: {short_desc[:50]}...")
                
                # Build datetime fields if missing
                if not event_dict.get('start_datetime'):
                    datetime_data = build_datetimes_enhanced(
                        event_dict.get('date'),
                        event_dict.get('start_time'),
                        event_dict.get('end_time'),
                        event_dict.get('end_date')
                    )
                    if datetime_data['start_datetime']:
                        updates['start_datetime'] = datetime_data['start_datetime']
                        print(f"  ⏰ Generated start_datetime: {datetime_data['start_datetime']}")
                    if datetime_data['end_datetime']:
                        updates['end_datetime'] = datetime_data['end_datetime']
                        print(f"  ⏰ Generated end_datetime: {datetime_data['end_datetime']}")
                
                # Normalize price if needed (though this might already be done)
                if event_dict.get('fee_required') and not event_dict.get('price'):
                    price = normalize_price_enhanced(event_dict['fee_required'])
                    if price > 0:
                        updates['price'] = price
                        print(f"  💰 Normalized price: ${price}")
                
                # Apply updates if any
                if updates:
                    # Build UPDATE query
                    set_clauses = []
                    values = []
                    
                    for field, value in updates.items():
                        set_clauses.append(f"{field} = %s")
                        values.append(value)
                    
                    values.append(event_id)
                    
                    update_query = f"""
                        UPDATE events 
                        SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    """
                    
                    cursor.execute(update_query, values)
                    updated_count += 1
                    print(f"  ✅ Updated event {event_id}")
                else:
                    print(f"  ⏭️ No updates needed for event {event_id}")
            
            # Commit all changes
            conn.commit()
            
            print(f"\n🎉 Successfully updated {updated_count} events with SEO fields!")
            return {
                "status": "success", 
                "updated_count": updated_count,
                "total_checked": len(events_to_update),
                "message": f"Successfully populated SEO fields for {updated_count} events"
            }
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    result = fix_production_seo_fields()
    print(f"\n📋 Final Result: {result}") 