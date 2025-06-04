#!/usr/bin/env python3
"""
Enhanced SEO Schema Migration for Todo Events
Migrates events table to production-ready schema with improved auto-population
"""

import sqlite3
import re
import json
import unicodedata
from datetime import datetime, timezone
from contextlib import contextmanager
from urllib.parse import quote

@contextmanager
def get_db():
    """Database connection context manager"""
    conn = sqlite3.connect('events.db')
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def slugify(title, city=""):
    """
    Enhanced slugify function using title and city
    Ensures SEO-friendly URLs with proper Unicode handling
    """
    if not title:
        return ""
    
    # Combine title and city for better uniqueness
    base = f"{title} {city}".lower() if city else title.lower()
    
    # Normalize Unicode characters
    base = unicodedata.normalize('NFKD', base)
    
    # Remove non-word characters (keep letters, numbers, spaces, hyphens)
    base = re.sub(r'[^\w\s-]', '', base)
    
    # Replace multiple spaces/underscores/hyphens with single hyphen
    base = re.sub(r'[\s_-]+', '-', base)
    
    # Remove leading/trailing hyphens
    return base.strip('-')

def extract_city_state_enhanced(address):
    """
    Enhanced city/state extraction using multiple regex strategies
    """
    if not address:
        return {"city": None, "state": None, "country": "USA"}
    
    address = address.strip()
    
    # Strategy A: Look for pattern ending with City, STATE, USA
    match = re.search(r",\s*([^,]+),\s*([A-Z]{2}),\s*USA", address)
    if match:
        city = match.group(1).strip()
        state = match.group(2).strip()
        return {"city": city, "state": state, "country": "USA"}
    
    # Strategy B: Look for pattern ending with City, STATE (without USA)
    match = re.search(r",\s*([^,]+),\s*([A-Z]{2})\s*$", address)
    if match:
        city = match.group(1).strip()
        state = match.group(2).strip()
        return {"city": city, "state": state, "country": "USA"}
    
    # Strategy C: Look for any 2-letter state code in the address
    state_match = re.search(r'\b([A-Z]{2})\b', address)
    if state_match:
        state = state_match.group(1)
        
        # Try to extract city before the state
        city_pattern = rf",\s*([^,]+)(?=.*\b{state}\b)"
        city_match = re.search(city_pattern, address)
        city = city_match.group(1).strip() if city_match else None
        
        return {"city": city, "state": state, "country": "USA"}
    
    # Strategy D: Fallback to parsing by comma separation
    parts = [part.strip() for part in address.split(',')]
    
    if len(parts) >= 3:
        # Assume format: Address, City, State/Country
        city_part = parts[-2] if len(parts) >= 2 else None
        state_part = parts[-1] if len(parts) >= 1 else None
        
        # Check if state_part contains a 2-letter code
        if state_part:
            state_match = re.search(r'\b([A-Z]{2})\b', state_part)
            state = state_match.group(1) if state_match else None
        else:
            state = None
            
        return {
            "city": city_part,
            "state": state,
            "country": "USA"
        }
    
    return {"city": None, "state": None, "country": "USA"}

def normalize_price_enhanced(fee_required):
    """
    Enhanced price normalization from fee_required field
    """
    if not fee_required:
        return 0.0
    
    fee_str = str(fee_required).lower().strip()
    
    # Handle explicit free indicators
    if fee_str in ['free', 'no charge', 'no fee', 'none', '0', '', 'n/a', 'na']:
        return 0.0
    
    # Remove currency symbols and common text
    fee_str = re.sub(r'[\$£€¥₹]', '', fee_str)
    fee_str = re.sub(r'\b(usd|dollars?|cents?)\b', '', fee_str)
    
    # Extract numeric value (handle decimals and commas)
    price_match = re.search(r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', fee_str)
    if price_match:
        price_str = price_match.group(1).replace(',', '')
        try:
            return float(price_str)
        except ValueError:
            return 0.0
    
    # Try to extract any number
    number_match = re.search(r'(\d+(?:\.\d{2})?)', fee_str)
    if number_match:
        try:
            return float(number_match.group(1))
        except ValueError:
            return 0.0
    
    return 0.0

def build_datetimes_enhanced(date_str, start_time_str, end_time_str, end_date_str=None, timezone_offset='-04:00'):
    """
    Enhanced datetime building with better error handling
    """
    try:
        if not date_str or not start_time_str:
            return None, None
        
        # Parse start datetime
        start_dt = datetime.strptime(f"{date_str} {start_time_str}", "%Y-%m-%d %H:%M")
        start_iso = start_dt.isoformat() + timezone_offset
        
        # Parse end datetime
        if end_date_str and end_time_str:
            # Multi-day event
            end_dt = datetime.strptime(f"{end_date_str} {end_time_str}", "%Y-%m-%d %H:%M")
        elif end_time_str:
            # Same day event
            end_dt = datetime.strptime(f"{date_str} {end_time_str}", "%Y-%m-%d %H:%M")
        else:
            # Default to 1 hour duration if no end time
            end_dt = start_dt.replace(hour=start_dt.hour + 1)
        
        end_iso = end_dt.isoformat() + timezone_offset
        
        return start_iso, end_iso
        
    except ValueError as e:
        print(f"⚠️ DateTime parsing error: {e}")
        return None, None

def make_short_description_enhanced(description):
    """
    Enhanced short description generation with better truncation
    """
    if not description:
        return ""
    
    # Clean up the description
    clean_desc = re.sub(r'\s+', ' ', description.strip())
    
    # If already short enough, return as-is
    if len(clean_desc) <= 160:
        return clean_desc
    
    # Truncate at sentence boundary if possible
    sentences = re.split(r'[.!?]+', clean_desc)
    if sentences and len(sentences[0]) <= 140:
        return sentences[0].strip() + '.'
    
    # Truncate at word boundary
    truncated = clean_desc[:157]
    last_space = truncated.rfind(' ')
    if last_space > 120:  # Don't lose too much content
        truncated = truncated[:last_space]
    
    return truncated.rstrip('.,!?;:') + '...'

def ensure_unique_slug(cursor, base_slug, event_id=None):
    """
    Ensure slug uniqueness by appending numbers if needed
    """
    slug = base_slug
    counter = 1
    
    while True:
        # Check if slug exists (excluding current event if updating)
        if event_id:
            cursor.execute("SELECT id FROM events WHERE slug = ? AND id != ?", (slug, event_id))
        else:
            cursor.execute("SELECT id FROM events WHERE slug = ?", (slug,))
        
        if not cursor.fetchone():
            return slug
        
        # Try with counter
        slug = f"{base_slug}-{counter}"
        counter += 1
        
        # Prevent infinite loops
        if counter > 1000:
            return f"{base_slug}-{datetime.now().timestamp():.0f}"

def check_column_exists(cursor, table_name, column_name):
    """Check if column exists in table"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns

def add_new_columns():
    """Add new columns to events table"""
    print("🔧 Adding new columns to events table...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        new_columns = [
            ('slug', 'TEXT'),
            ('short_description', 'TEXT'),
            ('start_datetime', 'TEXT'),
            ('end_datetime', 'TEXT'),
            ('city', 'TEXT'),
            ('state', 'TEXT'),
            ('country', 'TEXT DEFAULT "USA"'),
            ('price', 'REAL DEFAULT 0.0'),
            ('currency', 'TEXT DEFAULT "USD"'),
            ('organizer_url', 'TEXT'),
            ('is_published', 'BOOLEAN DEFAULT 1'),
            ('updated_at', 'TEXT'),
        ]
        
        for column_name, column_type in new_columns:
            if not check_column_exists(cursor, 'events', column_name):
                print(f"  ✅ Adding column: {column_name}")
                cursor.execute(f'ALTER TABLE events ADD COLUMN {column_name} {column_type}')
            else:
                print(f"  ⏭️ Column already exists: {column_name}")
        
        conn.commit()
        print("✅ Column additions complete")

def migrate_existing_data():
    """Enhanced migration with auto-population of all missing fields"""
    print("🔄 Migrating existing event data with enhanced auto-population...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get all events that need migration
        cursor.execute('''
            SELECT id, title, description, date, start_time, end_time, 
                   end_date, address, fee_required, created_at,
                   slug, short_description, city, state, start_datetime, 
                   end_datetime, price, updated_at
            FROM events
        ''')
        
        events = cursor.fetchall()
        print(f"📊 Processing {len(events)} events...")
        
        updated_count = 0
        
        for event in events:
            try:
                event_dict = dict(event)
                event_id = event_dict['id']
                updates = {}
                
                # 1. Extract city and state from address if missing
                if not event_dict.get('city') or not event_dict.get('state'):
                    address_components = extract_city_state_enhanced(event_dict.get('address', ''))
                    if address_components['city']:
                        updates['city'] = address_components['city']
                    if address_components['state']:
                        updates['state'] = address_components['state']
                    if not event_dict.get('country'):
                        updates['country'] = 'USA'
                
                # 2. Generate slug if missing
                if not event_dict.get('slug'):
                    title = event_dict.get('title', '')
                    city = updates.get('city') or event_dict.get('city', '')
                    base_slug = slugify(title, city)
                    if base_slug:
                        unique_slug = ensure_unique_slug(cursor, base_slug, event_id)
                        updates['slug'] = unique_slug
                
                # 3. Generate short description if missing
                if not event_dict.get('short_description'):
                    description = event_dict.get('description', '')
                    short_desc = make_short_description_enhanced(description)
                    if short_desc:
                        updates['short_description'] = short_desc
                
                # 4. Build datetime fields if missing
                if not event_dict.get('start_datetime') or not event_dict.get('end_datetime'):
                    start_iso, end_iso = build_datetimes_enhanced(
                        event_dict.get('date'),
                        event_dict.get('start_time'),
                        event_dict.get('end_time'),
                        event_dict.get('end_date')
                    )
                    if start_iso:
                        updates['start_datetime'] = start_iso
                    if end_iso:
                        updates['end_datetime'] = end_iso
                
                # 5. Normalize price if missing or zero
                if not event_dict.get('price') or event_dict.get('price') == 0:
                    price = normalize_price_enhanced(event_dict.get('fee_required'))
                    updates['price'] = price
                    if not event_dict.get('currency'):
                        updates['currency'] = 'USD'
                
                # 6. Set updated_at timestamp
                if not event_dict.get('updated_at'):
                    updates['updated_at'] = datetime.utcnow().isoformat()
                
                # 7. Ensure is_published is set
                if 'is_published' not in event_dict or event_dict.get('is_published') is None:
                    updates['is_published'] = 1
                
                # Apply updates if any
                if updates:
                    set_clause = ', '.join([f"{key} = ?" for key in updates.keys()])
                    values = list(updates.values()) + [event_id]
                    
                    cursor.execute(f'''
                        UPDATE events 
                        SET {set_clause}
                        WHERE id = ?
                    ''', values)
                    
                    updated_count += 1
                    print(f"  ✅ Updated event {event_id}: {event_dict.get('title', 'Unknown')[:50]}")
                    print(f"     🔧 Applied: {', '.join(updates.keys())}")
                
            except Exception as e:
                print(f"  ❌ Error processing event {event_dict.get('id', 'Unknown')}: {e}")
                continue
        
        conn.commit()
        print(f"✅ Migration complete: {updated_count} events updated")

def create_indexes():
    """Create performance indexes for SEO fields"""
    print("📊 Creating performance indexes...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        indexes = [
            ("idx_events_slug", "CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug)"),
            ("idx_events_city_state", "CREATE INDEX IF NOT EXISTS idx_events_city_state ON events(city, state)"),
            ("idx_events_location", "CREATE INDEX IF NOT EXISTS idx_events_location ON events(lat, lng)"),
            ("idx_events_datetime", "CREATE INDEX IF NOT EXISTS idx_events_datetime ON events(start_datetime, end_datetime)"),
            ("idx_events_published", "CREATE INDEX IF NOT EXISTS idx_events_published ON events(is_published)"),
            ("idx_events_price", "CREATE INDEX IF NOT EXISTS idx_events_price ON events(price)"),
        ]
        
        for index_name, query in indexes:
            try:
                cursor.execute(query)
                print(f"  ✅ Created index: {index_name}")
            except Exception as e:
                print(f"  ⚠️ Index {index_name} error: {e}")
        
        conn.commit()
        print("✅ Index creation complete")

def verify_migration():
    """Comprehensive verification of migration results"""
    print("🔍 Verifying migration results...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Check total events
        cursor.execute("SELECT COUNT(*) FROM events")
        total_events = cursor.fetchone()[0]
        print(f"📊 Total events: {total_events}")
        
        # Check field population rates
        checks = [
            ("slug", "SELECT COUNT(*) FROM events WHERE slug IS NOT NULL AND slug != ''"),
            ("city", "SELECT COUNT(*) FROM events WHERE city IS NOT NULL AND city != ''"),
            ("state", "SELECT COUNT(*) FROM events WHERE state IS NOT NULL AND state != ''"),
            ("short_description", "SELECT COUNT(*) FROM events WHERE short_description IS NOT NULL AND short_description != ''"),
            ("start_datetime", "SELECT COUNT(*) FROM events WHERE start_datetime IS NOT NULL"),
            ("end_datetime", "SELECT COUNT(*) FROM events WHERE end_datetime IS NOT NULL"),
            ("price", "SELECT COUNT(*) FROM events WHERE price IS NOT NULL"),
            ("updated_at", "SELECT COUNT(*) FROM events WHERE updated_at IS NOT NULL"),
        ]
        
        for field_name, query in checks:
            cursor.execute(query)
            populated_count = cursor.fetchone()[0]
            percentage = (populated_count / total_events * 100) if total_events > 0 else 0
            print(f"  📈 {field_name}: {populated_count}/{total_events} ({percentage:.1f}%)")
        
        # Check for duplicate slugs
        cursor.execute("SELECT slug, COUNT(*) FROM events WHERE slug IS NOT NULL GROUP BY slug HAVING COUNT(*) > 1")
        duplicates = cursor.fetchall()
        if duplicates:
            print(f"  ⚠️ Found {len(duplicates)} duplicate slugs")
            for slug, count in duplicates:
                print(f"     🔄 '{slug}': {count} occurrences")
        else:
            print(f"  ✅ No duplicate slugs found")
        
        # Show sample migrated event
        cursor.execute('''
            SELECT id, title, slug, city, state, short_description, 
                   start_datetime, end_datetime, price
            FROM events 
            WHERE slug IS NOT NULL 
            LIMIT 1
        ''')
        
        sample = cursor.fetchone()
        if sample:
            print(f"\n📝 Sample migrated event:")
            sample_dict = dict(sample)
            for key, value in sample_dict.items():
                print(f"  {key}: {value}")
        
        print("✅ Verification complete")

def main():
    """Run the enhanced SEO schema migration"""
    print("🚀 Starting Enhanced SEO Schema Migration")
    print("=" * 50)
    
    try:
        # Step 1: Add new columns
        add_new_columns()
        
        # Step 2: Migrate existing data with enhanced auto-population
        migrate_existing_data()
        
        # Step 3: Create performance indexes
        create_indexes()
        
        # Step 4: Verify migration
        verify_migration()
        
        print("\n🎉 Enhanced SEO Schema Migration Complete!")
        print("📋 Summary:")
        print("  • Added all SEO-required columns")
        print("  • Auto-populated city/state from addresses")
        print("  • Generated unique slugs for all events")
        print("  • Created short descriptions")
        print("  • Built ISO datetime fields")
        print("  • Normalized pricing data")
        print("  • Created performance indexes")
        print("  • Verified data integrity")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise

if __name__ == "__main__":
    main() 