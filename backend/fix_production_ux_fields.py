#!/usr/bin/env python3
"""
Production Database UX Fields Fix
Adds the missing UX enhancement fields to the production PostgreSQL database.

This fixes the "KeyError: 0" errors in bulk import by ensuring all expected fields exist.
"""

import os
import psycopg2
import sys
from contextlib import contextmanager

def get_production_connection():
    """Get PostgreSQL connection for production database"""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    return psycopg2.connect(db_url)

@contextmanager
def get_production_db():
    """Context manager for production database connection"""
    conn = None
    try:
        conn = get_production_connection()
        yield conn
    finally:
        if conn:
            conn.close()

def check_column_exists(cursor, table_name, column_name):
    """Check if a column exists in the table"""
    cursor.execute("""
        SELECT COUNT(*)
        FROM information_schema.columns 
        WHERE table_name = %s AND column_name = %s AND table_schema = 'public'
    """, (table_name, column_name))
    return cursor.fetchone()[0] > 0

def add_missing_ux_fields():
    """Add missing UX enhancement fields to production database"""
    print("🔧 Adding missing UX enhancement fields to production database...")
    
    # UX enhancement fields that need to be added
    ux_fields = [
        ('fee_required', 'TEXT'),      # Details about tickets/fees
        ('event_url', 'TEXT'),         # External event URL  
        ('host_name', 'TEXT'),         # Organization/host name
        ('organizer_url', 'TEXT'),     # Organizer website
        ('price', 'DECIMAL(10,2) DEFAULT 0.0'),  # Normalized price
        ('currency', 'VARCHAR(3) DEFAULT \'USD\''), # Currency code
        ('slug', 'TEXT'),              # URL-friendly slug
        ('is_published', 'BOOLEAN DEFAULT TRUE'), # Publication status
        ('start_datetime', 'TIMESTAMP'), # Enhanced datetime field
        ('end_datetime', 'TIMESTAMP'),   # Enhanced datetime field
        ('short_description', 'TEXT'),   # Short description for SEO
        ('city', 'VARCHAR(255)'),        # City extracted from address
        ('state', 'VARCHAR(2)'),         # State extracted from address
        ('country', 'VARCHAR(255) DEFAULT \'USA\''), # Country
        ('updated_at', 'TIMESTAMP'),     # Last update timestamp
        ('interest_count', 'INTEGER DEFAULT 0'), # Interest tracking
        ('view_count', 'INTEGER DEFAULT 0')      # View tracking
    ]
    
    added_fields = []
    existing_fields = []
    failed_fields = []
    
    with get_production_db() as conn:
        cursor = conn.cursor()
        
        # Check each field and add if missing
        for field_name, field_type in ux_fields:
            try:
                if check_column_exists(cursor, 'events', field_name):
                    existing_fields.append(field_name)
                    print(f"   ✅ Field '{field_name}' already exists")
                else:
                    # Add the missing field
                    alter_query = f"ALTER TABLE events ADD COLUMN {field_name} {field_type}"
                    cursor.execute(alter_query)
                    conn.commit()
                    added_fields.append(field_name)
                    print(f"   ➕ Added field '{field_name}' ({field_type})")
                    
            except Exception as e:
                failed_fields.append((field_name, str(e)))
                print(f"   ❌ Failed to add '{field_name}': {e}")
                conn.rollback()
    
    # Summary
    print(f"\n📊 **SUMMARY**")
    print(f"✅ Existing fields: {len(existing_fields)}")
    print(f"➕ Added fields: {len(added_fields)}")
    print(f"❌ Failed fields: {len(failed_fields)}")
    
    if added_fields:
        print(f"\n🎯 **NEWLY ADDED FIELDS:**")
        for field in added_fields:
            print(f"   - {field}")
    
    if failed_fields:
        print(f"\n⚠️  **FAILED FIELDS:**")
        for field, error in failed_fields:
            print(f"   - {field}: {error}")
    
    if len(added_fields) > 0:
        print(f"\n✨ **SUCCESS**: Added {len(added_fields)} missing UX fields to production database!")
        print("🚀 **NEXT STEPS:**")
        print("   1. Bulk import should now work without KeyError issues")
        print("   2. Test bulk import functionality")
        print("   3. Verify error messages are now detailed and helpful")
    else:
        print(f"\n🎯 **NO CHANGES NEEDED**: All UX fields already exist in production database")

def verify_ux_fields():
    """Verify all UX enhancement fields are present"""
    print("\n🔍 Verifying UX enhancement fields in production database...")
    
    expected_fields = [
        'fee_required', 'event_url', 'host_name', 'organizer_url',
        'price', 'currency', 'slug', 'is_published', 'start_datetime',
        'end_datetime', 'short_description', 'city', 'state', 'country',
        'updated_at', 'interest_count', 'view_count'
    ]
    
    with get_production_db() as conn:
        cursor = conn.cursor()
        
        # Get all columns in events table
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'events' AND table_schema = 'public'
            ORDER BY ordinal_position
        """)
        
        all_columns = cursor.fetchall()
        existing_column_names = [col[0] for col in all_columns]
        
        present_ux_fields = []
        missing_ux_fields = []
        
        for field in expected_fields:
            if field in existing_column_names:
                present_ux_fields.append(field)
            else:
                missing_ux_fields.append(field)
        
        print(f"\n📊 **VERIFICATION RESULTS**")
        print(f"Total columns in events table: {len(all_columns)}")
        print(f"Expected UX fields: {len(expected_fields)}")
        print(f"Present UX fields: {len(present_ux_fields)}")
        print(f"Missing UX fields: {len(missing_ux_fields)}")
        
        if missing_ux_fields:
            print(f"\n⚠️  **MISSING FIELDS:**")
            for field in missing_ux_fields:
                print(f"   - {field}")
        else:
            print(f"\n✅ **ALL UX FIELDS PRESENT** - Database schema is complete!")
        
        return len(missing_ux_fields) == 0

def main():
    """Main function to fix production UX fields"""
    print("🔧 **PRODUCTION DATABASE UX FIELDS FIX**")
    print("=" * 60)
    
    try:
        # Step 1: Verify current state
        is_complete = verify_ux_fields()
        
        if not is_complete:
            # Step 2: Add missing fields
            add_missing_ux_fields()
            
            # Step 3: Verify again
            print("\n" + "=" * 60)
            is_complete_after = verify_ux_fields()
            
            if is_complete_after:
                print(f"\n🎉 **MISSION ACCOMPLISHED!**")
                print("Production database now has all required UX enhancement fields.")
                print("Bulk import KeyError issues should be resolved.")
            else:
                print(f"\n⚠️  **PARTIAL SUCCESS** - Some fields may need manual attention")
        else:
            print(f"\n✨ **ALREADY COMPLETE** - No changes needed")
    
    except Exception as e:
        print(f"\n❌ **ERROR**: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 