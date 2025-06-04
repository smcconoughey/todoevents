#!/usr/bin/env python3
"""
SEO Schema Migration for Todo Events
Migrates events table to production-ready schema with SEO fields
"""

import sqlite3
import re
import json
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

def slugify(text):
    """Convert text to URL-friendly slug"""
    # Convert to lowercase and replace spaces/special chars with hyphens
    slug = re.sub(r'[^\w\s-]', '', text.lower())
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug.strip('-')

def parse_address_components(address):
    """Extract city, state, country from address string"""
    if not address:
        return {"city": "", "state": "", "country": "USA"}
    
    # Common patterns for US addresses
    parts = address.split(',')
    city = ""
    state = ""
    country = "USA"
    
    if len(parts) >= 2:
        # Last part often contains country
        if "USA" in parts[-1].upper() or "US" in parts[-1].upper():
            country = "USA"
            parts = parts[:-1]
        
        # Second to last often contains state
        if len(parts) >= 2:
            state_part = parts[-1].strip()
            # Look for state abbreviation (2 letters) or common state names
            state_match = re.search(r'\b([A-Z]{2})\b', state_part)
            if state_match:
                state = state_match.group(1)
            elif len(state_part) <= 20:  # Likely a state name
                state = state_part
        
        # City is usually the first or second part
        if len(parts) >= 1:
            city_part = parts[0].strip()
            # Remove common prefixes
            city = re.sub(r'^.*?,\s*', '', city_part)
            city = city.strip()
    
    return {"city": city, "state": state, "country": country}

def normalize_fee_to_price(fee_required):
    """Convert fee_required string to price float"""
    if not fee_required:
        return 0.0
    
    fee_str = str(fee_required).lower().strip()
    
    # Free events
    if fee_str in ['free', 'no', 'none', '0', '']:
        return 0.0
    
    # Extract numeric value
    price_match = re.search(r'[\d,]+\.?\d*', fee_str)
    if price_match:
        price_str = price_match.group().replace(',', '')
        try:
            return float(price_str)
        except ValueError:
            return 0.0
    
    return 0.0

def generate_short_description(description, max_length=160):
    """Generate short description for meta tags"""
    if not description:
        return ""
    
    # Clean up description
    clean_desc = re.sub(r'\s+', ' ', description.strip())
    
    if len(clean_desc) <= max_length:
        return clean_desc
    
    # Truncate at word boundary
    truncated = clean_desc[:max_length]
    last_space = truncated.rfind(' ')
    if last_space > max_length * 0.8:  # Only truncate if we don't lose too much
        truncated = truncated[:last_space]
    
    return truncated.rstrip('.,!?;:') + '...'

def combine_datetime(date_str, time_str, timezone_offset='-04:00'):
    """Combine date and time strings into ISO datetime"""
    try:
        if not date_str or not time_str:
            return None
        
        # Parse date and time
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        time_obj = datetime.strptime(time_str, '%H:%M').time()
        
        # Combine and format as ISO string
        dt = datetime.combine(date_obj, time_obj)
        return dt.strftime('%Y-%m-%dT%H:%M:%S') + timezone_offset
        
    except ValueError:
        return None

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
            ('geo_hash', 'TEXT'),
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
    """Migrate and compute derived fields for existing events"""
    print("🔄 Migrating existing event data...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get all events
        cursor.execute('''
            SELECT id, title, description, date, start_time, end_time, 
                   end_date, address, fee_required, created_at
            FROM events
        ''')
        
        events = cursor.fetchall()
        print(f"📊 Processing {len(events)} events...")
        
        updated_count = 0
        
        for event in events:
            try:
                event_dict = dict(event)
                
                # Generate slug
                title = event_dict.get('title', '')
                address = event_dict.get('address', '')
                address_components = parse_address_components(address)
                city = address_components['city']
                
                slug = slugify(f"{title}-{city}" if city else title)
                
                # Generate short description
                description = event_dict.get('description', '')
                short_desc = generate_short_description(description)
                
                # Parse address components
                city = address_components['city']
                state = address_components['state']
                country = address_components['country']
                
                # Convert fee to price
                fee_required = event_dict.get('fee_required')
                price = normalize_fee_to_price(fee_required)
                
                # Generate datetime fields
                date_str = event_dict.get('date')
                start_time = event_dict.get('start_time')
                end_time = event_dict.get('end_time')
                end_date = event_dict.get('end_date')
                
                start_datetime = combine_datetime(date_str, start_time)
                end_datetime = combine_datetime(end_date or date_str, end_time)
                
                # Set updated_at
                updated_at = datetime.now(timezone.utc).isoformat()
                
                # Update the event
                cursor.execute('''
                    UPDATE events SET
                        slug = ?,
                        short_description = ?,
                        start_datetime = ?,
                        end_datetime = ?,
                        city = ?,
                        state = ?,
                        country = ?,
                        price = ?,
                        currency = ?,
                        is_published = 1,
                        updated_at = ?
                    WHERE id = ?
                ''', (
                    slug,
                    short_desc,
                    start_datetime,
                    end_datetime,
                    city,
                    state,
                    country,
                    price,
                    'USD',
                    updated_at,
                    event_dict['id']
                ))
                
                updated_count += 1
                
                if updated_count % 10 == 0:
                    print(f"  📈 Processed {updated_count} events...")
                    
            except Exception as e:
                print(f"  ❌ Error processing event {event_dict.get('id', 'unknown')}: {e}")
                continue
        
        conn.commit()
        print(f"✅ Successfully migrated {updated_count} events")

def create_indexes():
    """Create indexes for new fields"""
    print("🚀 Creating indexes for performance...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        indexes = [
            'CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug)',
            'CREATE INDEX IF NOT EXISTS idx_events_city_state ON events(city, state)',
            'CREATE INDEX IF NOT EXISTS idx_events_published ON events(is_published)',
            'CREATE INDEX IF NOT EXISTS idx_events_start_datetime ON events(start_datetime)',
            'CREATE INDEX IF NOT EXISTS idx_events_updated_at ON events(updated_at)',
            'CREATE INDEX IF NOT EXISTS idx_events_price ON events(price)',
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
            print(f"  ✅ {index_sql.split('idx_')[1].split(' ')[0]}")
        
        conn.commit()
        print("✅ Indexes created successfully")

def verify_migration():
    """Verify the migration was successful"""
    print("🔍 Verifying migration...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Check schema
        cursor.execute("PRAGMA table_info(events)")
        columns = [row[1] for row in cursor.fetchall()]
        
        required_columns = [
            'id', 'title', 'slug', 'description', 'short_description',
            'date', 'start_time', 'end_time', 'start_datetime', 'end_datetime',
            'city', 'state', 'country', 'price', 'currency',
            'is_published', 'updated_at'
        ]
        
        missing_columns = [col for col in required_columns if col not in columns]
        if missing_columns:
            print(f"❌ Missing columns: {missing_columns}")
            return False
        
        # Check data quality
        cursor.execute('''
            SELECT COUNT(*) as total,
                   COUNT(slug) as with_slug,
                   COUNT(city) as with_city,
                   COUNT(start_datetime) as with_start_dt
            FROM events
        ''')
        
        stats = cursor.fetchone()
        print(f"📊 Migration stats:")
        print(f"  Total events: {stats[0]}")
        print(f"  Events with slugs: {stats[1]}")
        print(f"  Events with cities: {stats[2]}")
        print(f"  Events with start_datetime: {stats[3]}")
        
        # Show sample migrated event
        cursor.execute('''
            SELECT id, title, slug, city, state, price, start_datetime, is_published
            FROM events 
            LIMIT 1
        ''')
        
        sample = cursor.fetchone()
        if sample:
            print(f"📋 Sample migrated event:")
            for i, col in enumerate(['id', 'title', 'slug', 'city', 'state', 'price', 'start_datetime', 'is_published']):
                print(f"  {col}: {sample[i]}")
        
        print("✅ Migration verification complete")
        return True

def main():
    """Run the complete SEO schema migration"""
    print("🚀 Starting SEO Schema Migration for Todo Events")
    print("=" * 60)
    
    try:
        # Step 1: Add new columns
        add_new_columns()
        
        # Step 2: Migrate existing data
        migrate_existing_data()
        
        # Step 3: Create indexes
        create_indexes()
        
        # Step 4: Verify migration
        if verify_migration():
            print("\n🎉 SEO Schema Migration completed successfully!")
            print("💡 Your events table is now production-ready for:")
            print("   • SEO-friendly URLs with slugs")
            print("   • Structured data (JSON-LD)")
            print("   • Geographic organization")
            print("   • Price normalization")
            print("   • Server-side rendering")
        else:
            print("\n⚠️ Migration completed with some issues. Please review the output above.")
            
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise

if __name__ == "__main__":
    main() 