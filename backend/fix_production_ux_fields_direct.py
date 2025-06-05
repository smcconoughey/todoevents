#!/usr/bin/env python3
"""
Direct Production UX Fields Fix
Adds missing UX fields to production database that are causing bulk import issues
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

def get_production_db():
    """Get production database connection"""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise Exception("DATABASE_URL environment variable not found")
    
    conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
    return conn

def check_existing_columns():
    """Check which UX columns already exist"""
    print("🔍 Checking existing database columns...")
    
    with get_production_db() as conn:
        cursor = conn.cursor()
        
        # Get all columns for events table
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'events'
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        print(f"   Found {len(columns)} total columns in events table")
        
        # Check for UX fields specifically
        ux_fields = ['fee_required', 'event_url', 'host_name']
        existing_ux = []
        missing_ux = []
        
        column_names = [col['column_name'] for col in columns]
        
        for field in ux_fields:
            if field in column_names:
                existing_ux.append(field)
                print(f"   ✅ {field} exists")
            else:
                missing_ux.append(field)
                print(f"   ❌ {field} missing")
        
        return existing_ux, missing_ux, columns

def add_missing_ux_fields(missing_fields):
    """Add missing UX fields to the database"""
    if not missing_fields:
        print("✅ All UX fields already exist!")
        return True
    
    print(f"🔧 Adding {len(missing_fields)} missing UX fields...")
    
    # Define the SQL for each field
    field_definitions = {
        'fee_required': 'TEXT',  # Details about tickets/fees
        'event_url': 'TEXT',     # External event URL
        'host_name': 'TEXT'      # Organization/host name
    }
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            for field in missing_fields:
                if field in field_definitions:
                    sql = f"ALTER TABLE events ADD COLUMN {field} {field_definitions[field]}"
                    print(f"   Adding {field}...")
                    cursor.execute(sql)
                    print(f"   ✅ {field} added successfully")
                else:
                    print(f"   ⚠️ Unknown field: {field}")
            
            # Commit the changes
            conn.commit()
            print("✅ All missing UX fields added successfully!")
            return True
            
    except Exception as e:
        print(f"❌ Error adding UX fields: {e}")
        return False

def verify_fields_added():
    """Verify that all UX fields now exist"""
    print("\n🔍 Verifying UX fields were added...")
    
    existing_ux, missing_ux, _ = check_existing_columns()
    
    if not missing_ux:
        print("✅ All UX fields now exist!")
        return True
    else:
        print(f"❌ Still missing: {missing_ux}")
        return False

def test_field_insertion():
    """Test inserting data into the new fields"""
    print("\n🧪 Testing field insertion...")
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            # Find a recent event to update
            cursor.execute("""
                SELECT id, title 
                FROM events 
                WHERE fee_required IS NULL 
                LIMIT 1
            """)
            
            event = cursor.fetchone()
            if event:
                event_id = event['id']
                title = event['title']
                
                # Test updating the UX fields
                cursor.execute("""
                    UPDATE events 
                    SET fee_required = %s, event_url = %s, host_name = %s
                    WHERE id = %s
                """, (
                    "Test fee info",
                    "https://example.com/test",
                    "Test Host",
                    event_id
                ))
                
                conn.commit()
                print(f"   ✅ Successfully updated event '{title}' (ID: {event_id}) with test UX data")
                
                # Verify the update
                cursor.execute("""
                    SELECT fee_required, event_url, host_name
                    FROM events 
                    WHERE id = %s
                """, (event_id,))
                
                result = cursor.fetchone()
                if result and result['fee_required']:
                    print("   ✅ UX field update verified!")
                    return True
                else:
                    print("   ❌ UX field update verification failed")
                    return False
            else:
                print("   ⚠️ No events found to test with")
                return True
                
    except Exception as e:
        print(f"   ❌ Field insertion test failed: {e}")
        return False

def main():
    """Add missing UX fields to production database"""
    print("🚀 Production UX Fields Fix")
    print("=" * 40)
    
    try:
        # 1. Check existing columns
        existing_ux, missing_ux, all_columns = check_existing_columns()
        
        # 2. Add missing fields
        if missing_ux:
            success = add_missing_ux_fields(missing_ux)
            if not success:
                print("❌ Failed to add UX fields")
                return
        
        # 3. Verify fields were added
        verify_success = verify_fields_added()
        if not verify_success:
            print("❌ Verification failed")
            return
        
        # 4. Test field insertion
        test_success = test_field_insertion()
        if not test_success:
            print("⚠️ Field insertion test had issues")
        
        print("\n🎉 Production UX fields fix completed!")
        print("\n📋 Next Steps:")
        print("1. Test bulk import functionality")
        print("2. Run: python test_bulk_import_consistency.py")
        print("3. Monitor bulk import logs for errors")
        
    except Exception as e:
        print(f"❌ Script failed: {e}")

if __name__ == "__main__":
    main() 