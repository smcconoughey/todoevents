#!/usr/bin/env python3
"""
Debug SEO Population - Check what's happening with the database
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor

def get_production_db():
    """Get production PostgreSQL connection"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise Exception("DATABASE_URL environment variable not found")
    
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def check_database_schema():
    """Check if SEO columns exist in the database"""
    print("\n🔍 Checking Database Schema...")
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            # Check what columns exist in events table
            cursor.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'events'
                ORDER BY ordinal_position
            """)
            
            columns = cursor.fetchall()
            
            print(f"📊 Found {len(columns)} columns in events table:")
            
            seo_columns = ['slug', 'short_description', 'start_datetime', 'end_datetime', 
                          'city', 'state', 'country', 'fee_required', 'price', 'currency',
                          'event_url', 'host_name', 'organizer_url', 'is_published']
            
            existing_columns = {col['column_name'] for col in columns}
            
            for col in columns:
                status = "🔥 SEO" if col['column_name'] in seo_columns else "📝 CORE"
                print(f"  {status} {col['column_name']}: {col['data_type']} ({'NULL' if col['is_nullable'] == 'YES' else 'NOT NULL'})")
            
            missing_seo_columns = [col for col in seo_columns if col not in existing_columns]
            
            if missing_seo_columns:
                print(f"\n❌ Missing SEO columns: {missing_seo_columns}")
                return False
            else:
                print(f"\n✅ All SEO columns exist!")
                return True
                
    except Exception as e:
        print(f"❌ Schema check failed: {e}")
        return False

def check_seo_data_status():
    """Check the current status of SEO data in events"""
    print("\n📊 Checking SEO Data Status...")
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            # Count total events
            cursor.execute("SELECT COUNT(*) as total FROM events")
            total_events = cursor.fetchone()['total']
            
            print(f"📈 Total events in database: {total_events}")
            
            # Check SEO field population
            seo_checks = [
                ('slug', 'URL Slugs'),
                ('short_description', 'Short Descriptions'), 
                ('start_datetime', 'Start DateTimes'),
                ('end_datetime', 'End DateTimes'),
                ('city', 'Cities'),
                ('state', 'States')
            ]
            
            for field, label in seo_checks:
                cursor.execute(f"SELECT COUNT(*) as count FROM events WHERE {field} IS NOT NULL AND {field} != ''")
                populated = cursor.fetchone()['count']
                
                cursor.execute(f"SELECT COUNT(*) as count FROM events WHERE {field} IS NULL OR {field} = ''")
                empty = cursor.fetchone()['count']
                
                percentage = (populated / total_events * 100) if total_events > 0 else 0
                
                print(f"  📊 {label}: {populated}/{total_events} populated ({percentage:.1f}%) | {empty} empty")
            
            return True
            
    except Exception as e:
        print(f"❌ Data status check failed: {e}")
        return False

def show_sample_events():
    """Show sample events and their SEO data"""
    print("\n🔎 Sample Events Data...")
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, title, slug, city, state, short_description, 
                       start_datetime, end_datetime, updated_at
                FROM events 
                ORDER BY id DESC 
                LIMIT 5
            """)
            
            events = cursor.fetchall()
            
            for event in events:
                print(f"\n🎯 Event {event['id']}: {event['title'][:40]}...")
                print(f"   🏷️ Slug: {event['slug'] or 'NULL'}")
                print(f"   🏙️ City: {event['city'] or 'NULL'}")
                print(f"   🏛️ State: {event['state'] or 'NULL'}")
                print(f"   📝 Short Desc: {(event['short_description'][:50] + '...') if event['short_description'] else 'NULL'}")
                print(f"   ⏰ Start DateTime: {event['start_datetime'] or 'NULL'}")
                print(f"   ⏰ End DateTime: {event['end_datetime'] or 'NULL'}")
                print(f"   🔄 Updated: {event['updated_at'] or 'NULL'}")
            
            return True
            
    except Exception as e:
        print(f"❌ Sample data check failed: {e}")
        return False

def test_database_write():
    """Test if we can write to the database"""
    print("\n✍️ Testing Database Write Access...")
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            # Create a test table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS seo_test (
                    id SERIAL PRIMARY KEY,
                    test_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Insert test data
            cursor.execute("""
                INSERT INTO seo_test (test_data) 
                VALUES ('SEO migration test') 
                RETURNING id
            """)
            
            test_id = cursor.fetchone()['id']
            
            # Verify the insert
            cursor.execute("SELECT * FROM seo_test WHERE id = %s", (test_id,))
            test_record = cursor.fetchone()
            
            # Clean up
            cursor.execute("DELETE FROM seo_test WHERE id = %s", (test_id,))
            cursor.execute("DROP TABLE seo_test")
            
            # Commit the transaction
            conn.commit()
            
            print(f"✅ Database write test successful! Created and deleted test record {test_id}")
            return True
            
    except Exception as e:
        print(f"❌ Database write test failed: {e}")
        return False

def manually_populate_one_event():
    """Manually populate SEO data for one event to test"""
    print("\n🧪 Testing Manual SEO Population for One Event...")
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            # Find an event with missing SEO data
            cursor.execute("""
                SELECT id, title, description, address, date, start_time, end_time
                FROM events 
                WHERE slug IS NULL 
                LIMIT 1
            """)
            
            event = cursor.fetchone()
            
            if not event:
                print("ℹ️ No events found with missing SEO data")
                return True
            
            event_dict = dict(event)
            event_id = event_dict['id']
            
            print(f"🎯 Testing with Event {event_id}: {event_dict['title']}")
            
            # Generate test slug
            test_slug = f"test-event-{event_id}"
            test_city = "Test City"
            test_state = "TS"
            test_short_desc = "This is a test short description for SEO migration testing."
            test_start_dt = "2025-06-01T19:00:00"
            test_end_dt = "2025-06-01T22:00:00"
            
            # Update the event
            cursor.execute("""
                UPDATE events 
                SET slug = %s,
                    city = %s,
                    state = %s,
                    short_description = %s,
                    start_datetime = %s,
                    end_datetime = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (test_slug, test_city, test_state, test_short_desc, 
                  test_start_dt, test_end_dt, event_id))
            
            # Commit the change
            conn.commit()
            
            # Verify the update
            cursor.execute("""
                SELECT id, title, slug, city, state, short_description, 
                       start_datetime, end_datetime, updated_at
                FROM events 
                WHERE id = %s
            """, (event_id,))
            
            updated_event = cursor.fetchone()
            
            print(f"✅ Manual update successful!")
            print(f"   🏷️ Slug: {updated_event['slug']}")
            print(f"   🏙️ City: {updated_event['city']}")
            print(f"   🏛️ State: {updated_event['state']}")
            print(f"   📝 Short Desc: {updated_event['short_description'][:50]}...")
            print(f"   ⏰ Start DateTime: {updated_event['start_datetime']}")
            print(f"   ⏰ End DateTime: {updated_event['end_datetime']}")
            print(f"   🔄 Updated: {updated_event['updated_at']}")
            
            return True
            
    except Exception as e:
        print(f"❌ Manual population test failed: {e}")
        return False

def main():
    """Run all diagnostic checks"""
    print("🚀 TodoEvents SEO Population Diagnostics")
    print("=" * 50)
    
    checks = [
        ("Schema Check", check_database_schema),
        ("Data Status Check", check_seo_data_status),
        ("Sample Events", show_sample_events),
        ("Database Write Test", test_database_write),
        ("Manual Population Test", manually_populate_one_event)
    ]
    
    results = {}
    
    for check_name, check_func in checks:
        print(f"\n{'='*20} {check_name} {'='*20}")
        try:
            results[check_name] = check_func()
        except Exception as e:
            print(f"❌ {check_name} crashed: {e}")
            results[check_name] = False
    
    print(f"\n{'='*20} SUMMARY {'='*20}")
    
    all_passed = True
    for check_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {check_name}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print(f"\n🎉 All checks passed! SEO population should work.")
    else:
        print(f"\n⚠️ Some checks failed. Review the issues above.")
    
    return results

if __name__ == "__main__":
    main() 