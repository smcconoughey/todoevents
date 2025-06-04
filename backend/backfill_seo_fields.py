#!/usr/bin/env python3
"""
Backfill SEO Fields for Existing Events
Updates events that are missing SEO fields with auto-populated values
"""

import sqlite3
from contextlib import contextmanager
from migrate_seo_schema import (
    slugify, extract_city_state_enhanced, normalize_price_enhanced,
    build_datetimes_enhanced, make_short_description_enhanced, ensure_unique_slug
)

@contextmanager
def get_db():
    """Database connection context manager"""
    conn = sqlite3.connect('events.db')
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def backfill_seo_fields():
    """Backfill missing SEO fields for existing events"""
    print("🔄 Backfilling SEO fields for existing events...")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Find events that are missing key SEO fields
        cursor.execute("""
            SELECT * FROM events 
            WHERE slug IS NULL 
               OR city IS NULL 
               OR state IS NULL 
               OR price IS NULL 
               OR start_datetime IS NULL 
               OR short_description IS NULL
            ORDER BY id
        """)
        
        events_to_update = cursor.fetchall()
        print(f"📊 Found {len(events_to_update)} events that need SEO field updates")
        
        if not events_to_update:
            print("✅ All events already have SEO fields populated!")
            return
        
        updated_count = 0
        
        for event in events_to_update:
            try:
                event_dict = dict(event)
                event_id = event_dict['id']
                
                print(f"\n🔧 Processing event {event_id}: {event_dict['title'][:50]}...")
                
                # Generate missing fields
                updates = {}
                
                # Generate slug if missing
                if not event_dict.get('slug'):
                    city = event_dict.get('city', '') or ''
                    base_slug = slugify(event_dict['title'], city)
                    unique_slug = ensure_unique_slug(cursor, base_slug, event_id)
                    updates['slug'] = unique_slug
                    print(f"  📝 Generated slug: {unique_slug}")
                
                # Extract city/state if missing
                if not event_dict.get('city') or not event_dict.get('state'):
                    city, state = extract_city_state_enhanced(event_dict['address'])
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
                if not event_dict.get('short_description'):
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
                        set_clauses.append(f"{field} = ?")
                        values.append(value)
                    
                    values.append(event_id)  # For WHERE clause
                    
                    update_query = f"""
                        UPDATE events 
                        SET {', '.join(set_clauses)}
                        WHERE id = ?
                    """
                    
                    cursor.execute(update_query, values)
                    updated_count += 1
                    print(f"  ✅ Updated {len(updates)} fields")
                
            except Exception as e:
                print(f"  ❌ Error processing event {event_id}: {e}")
                continue
        
        # Commit all changes
        conn.commit()
        print(f"\n🎉 Successfully updated {updated_count} events!")
        
        # Verify the results
        cursor.execute("""
            SELECT COUNT(*) as total,
                   COUNT(slug) as with_slug,
                   COUNT(city) as with_city,
                   COUNT(state) as with_state,
                   COUNT(CASE WHEN price IS NOT NULL THEN 1 END) as with_price,
                   COUNT(start_datetime) as with_start_dt,
                   COUNT(short_description) as with_short_desc
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

if __name__ == "__main__":
    backfill_seo_fields() 