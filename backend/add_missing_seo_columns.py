#!/usr/bin/env python3
"""
Add Missing SEO Columns to Production Database
This script first adds the missing SEO columns to the events table, then populates them.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import re

def get_production_db():
    """Get production PostgreSQL connection"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise Exception("DATABASE_URL environment variable not found")
    
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def check_column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table"""
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = %s AND column_name = %s
    """, (table_name, column_name))
    return cursor.fetchone() is not None

def add_missing_columns():
    """Add missing SEO columns to the events table"""
    print("🚀 Starting Production Database Schema Migration...")
    
    # Define the columns we need to add
    columns_to_add = [
        ("slug", "VARCHAR(100)"),
        ("short_description", "TEXT"),
        ("start_datetime", "TIMESTAMP"),
        ("end_datetime", "TIMESTAMP"),
        ("city", "VARCHAR(100)"),
        ("state", "VARCHAR(10)"),
        ("country", "VARCHAR(50) DEFAULT 'USA'"),
        ("fee_required", "TEXT"),
        ("price", "DECIMAL(10,2) DEFAULT 0.0"),
        ("currency", "VARCHAR(10) DEFAULT 'USD'"),
        ("event_url", "TEXT"),
        ("host_name", "TEXT"),
        ("organizer_url", "TEXT"),
        ("is_published", "BOOLEAN DEFAULT TRUE"),
        ("updated_at", "TIMESTAMP")
    ]
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            print("🔍 Checking current table structure...")
            
            # Get current columns
            cursor.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'events'
                ORDER BY ordinal_position
            """)
            
            existing_columns = {row['column_name']: row['data_type'] for row in cursor.fetchall()}
            print(f"📋 Found {len(existing_columns)} existing columns")
            
            # Check which columns need to be added
            missing_columns = []
            for col_name, col_type in columns_to_add:
                if col_name not in existing_columns:
                    missing_columns.append((col_name, col_type))
                else:
                    print(f"  ✅ {col_name} already exists ({existing_columns[col_name]})")
            
            if not missing_columns:
                print("✅ All SEO columns already exist!")
                return {"status": "success", "message": "No columns needed to be added", "added_columns": []}
            
            print(f"\n🔨 Adding {len(missing_columns)} missing columns...")
            
            added_columns = []
            for col_name, col_type in missing_columns:
                try:
                    print(f"  ➕ Adding column: {col_name} ({col_type})")
                    
                    # Add the column
                    cursor.execute(f"""
                        ALTER TABLE events 
                        ADD COLUMN IF NOT EXISTS {col_name} {col_type}
                    """)
                    
                    added_columns.append(col_name)
                    print(f"    ✅ Added {col_name}")
                    
                except Exception as e:
                    print(f"    ❌ Failed to add {col_name}: {e}")
                    # Continue with other columns
            
            # Commit the schema changes
            conn.commit()
            print(f"\n🎉 Successfully added {len(added_columns)} columns to events table!")
            
            # Create indexes for performance
            print("\n📊 Creating indexes for SEO fields...")
            indexes_to_create = [
                ("idx_events_slug", "slug"),
                ("idx_events_city_state", "city, state"),
                ("idx_events_start_datetime", "start_datetime"),
                ("idx_events_published", "is_published")
            ]
            
            for index_name, columns in indexes_to_create:
                try:
                    cursor.execute(f"""
                        CREATE INDEX IF NOT EXISTS {index_name} 
                        ON events ({columns})
                    """)
                    print(f"  ✅ Created index: {index_name}")
                except Exception as e:
                    print(f"  ⚠️ Index creation warning for {index_name}: {e}")
            
            conn.commit()
            
            return {
                "status": "success", 
                "message": f"Successfully added {len(added_columns)} columns",
                "added_columns": added_columns
            }
            
    except Exception as e:
        print(f"❌ Schema migration failed: {e}")
        return {"status": "error", "message": str(e)}

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
    
    if short_desc:
        return short_desc.strip() + "..."
    
    return clean_desc[:max_length].strip() + "..."

def build_datetimes_enhanced(date_str, start_time_str, end_time_str, end_date_str=None):
    """Build ISO datetime strings from date and time components"""
    if not date_str or not start_time_str:
        return {"start_datetime": None, "end_datetime": None}
    
    try:
        start_datetime = f"{date_str}T{start_time_str}:00"
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

def ensure_unique_slug(cursor, base_slug, event_id=None):
    """Ensure slug is unique by adding number suffix if needed"""
    if not base_slug:
        return None
    
    original_slug = base_slug
    counter = 1
    
    while True:
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
        
        base_slug = f"{original_slug}-{counter}"
        counter += 1
        
        if counter > 1000:
            base_slug = f"{original_slug}-{event_id or 'new'}"
            break
    
    return base_slug

def populate_seo_data():
    """Populate SEO data for all existing events"""
    print("\n🔄 Starting SEO Data Population...")
    
    try:
        with get_production_db() as conn:
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
                updates = {}
                values = []
                
                print(f"\n📝 Processing Event {event_id}: {event_dict['title'][:50]}...")
                
                # Generate slug
                city_data = extract_city_state_enhanced(event_dict['address'])
                city = city_data.get('city', '')
                base_slug = slugify(event_dict['title'], city)
                unique_slug = ensure_unique_slug(cursor, base_slug, event_id)
                updates['slug'] = unique_slug
                values.append(unique_slug)
                print(f"  🏷️ Generated slug: {unique_slug}")
                
                # Extract city/state
                if city_data['city']:
                    updates['city'] = city_data['city']
                    values.append(city_data['city'])
                    print(f"  🏙️ Extracted city: {city_data['city']}")
                else:
                    updates['city'] = None
                    values.append(None)
                
                if city_data['state']:
                    updates['state'] = city_data['state']
                    values.append(city_data['state'])
                    print(f"  🏛️ Extracted state: {city_data['state']}")
                else:
                    updates['state'] = None
                    values.append(None)
                
                # Generate short description
                if event_dict.get('description'):
                    short_desc = make_short_description_enhanced(event_dict['description'])
                    updates['short_description'] = short_desc
                    values.append(short_desc)
                    print(f"  📝 Generated short description: {short_desc[:50]}...")
                else:
                    updates['short_description'] = None
                    values.append(None)
                
                # Build datetime fields
                datetime_data = build_datetimes_enhanced(
                    event_dict.get('date'),
                    event_dict.get('start_time'),
                    event_dict.get('end_time'),
                    event_dict.get('end_date')
                )
                
                if datetime_data['start_datetime']:
                    updates['start_datetime'] = datetime_data['start_datetime']
                    values.append(datetime_data['start_datetime'])
                    print(f"  ⏰ Generated start_datetime: {datetime_data['start_datetime']}")
                else:
                    updates['start_datetime'] = None
                    values.append(None)
                
                if datetime_data['end_datetime']:
                    updates['end_datetime'] = datetime_data['end_datetime']
                    values.append(datetime_data['end_datetime'])
                    print(f"  ⏰ Generated end_datetime: {datetime_data['end_datetime']}")
                else:
                    updates['end_datetime'] = None
                    values.append(None)
                
                # Set default values for other fields
                updates['country'] = 'USA'
                values.append('USA')
                
                updates['currency'] = 'USD'
                values.append('USD')
                
                updates['is_published'] = True
                values.append(True)
                
                updates['updated_at'] = 'CURRENT_TIMESTAMP'
                
                # Build and execute UPDATE query
                set_clauses = []
                param_index = 1
                
                for field in ['slug', 'city', 'state', 'short_description', 'start_datetime', 'end_datetime', 'country', 'currency', 'is_published']:
                    set_clauses.append(f"{field} = ${param_index}")
                    param_index += 1
                
                set_clauses.append("updated_at = CURRENT_TIMESTAMP")
                values.append(event_id)
                
                update_query = f"""
                    UPDATE events 
                    SET {', '.join(set_clauses)}
                    WHERE id = ${param_index}
                """
                
                cursor.execute(update_query, values)
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
    """Main function to run the complete migration"""
    print("🚀 TodoEvents Production Database SEO Migration")
    print("=" * 60)
    
    # Step 1: Add missing columns
    schema_result = add_missing_columns()
    
    if schema_result["status"] != "success":
        print(f"❌ Schema migration failed: {schema_result['message']}")
        return schema_result
    
    print(f"✅ Schema migration completed: {schema_result['message']}")
    
    # Step 2: Populate SEO data
    data_result = populate_seo_data()
    
    if data_result["status"] != "success":
        print(f"❌ Data population failed: {data_result['message']}")
        return data_result
    
    print(f"✅ Data population completed: Updated {data_result['updated_count']} events")
    
    # Final summary
    final_result = {
        "status": "success",
        "schema_migration": schema_result,
        "data_population": data_result,
        "message": f"Complete migration successful: {len(schema_result.get('added_columns', []))} columns added, {data_result['updated_count']} events updated"
    }
    
    print(f"\n🎉 MIGRATION COMPLETE!")
    print(f"📊 Added columns: {schema_result.get('added_columns', [])}")
    print(f"📊 Updated events: {data_result['updated_count']}")
    
    return final_result

if __name__ == "__main__":
    result = main()
    print(f"\n📋 Final Result: {result}") 