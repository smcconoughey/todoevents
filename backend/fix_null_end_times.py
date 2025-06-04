#!/usr/bin/env python3
"""
Fix NULL end_time values in production database
This script updates NULL end_time values to empty strings to prevent validation errors
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

def fix_null_end_times():
    """Fix NULL end_time values in the events table"""
    print("🔧 Fixing NULL end_time values in production database...")
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            # First, check how many events have NULL end_time
            cursor.execute("SELECT COUNT(*) FROM events WHERE end_time IS NULL")
            null_count = cursor.fetchone()[0]
            
            print(f"📊 Found {null_count} events with NULL end_time values")
            
            if null_count == 0:
                print("✅ No NULL end_time values found. Database is already clean!")
                return {"status": "success", "updated_count": 0}
            
            # Show some examples before fixing
            print("\n📋 Sample events with NULL end_time:")
            cursor.execute("""
                SELECT id, title, start_time, end_time 
                FROM events 
                WHERE end_time IS NULL 
                LIMIT 5
            """)
            
            samples = cursor.fetchall()
            for sample in samples:
                print(f"  ID {sample['id']}: '{sample['title']}' (start: {sample['start_time']}, end: {sample['end_time']})")
            
            # Update NULL end_time values to empty string
            print(f"\n🔄 Updating {null_count} NULL end_time values to empty strings...")
            
            cursor.execute("""
                UPDATE events 
                SET end_time = '' 
                WHERE end_time IS NULL
            """)
            
            updated_count = cursor.rowcount
            conn.commit()
            
            print(f"✅ Successfully updated {updated_count} events")
            
            # Verify the fix
            cursor.execute("SELECT COUNT(*) FROM events WHERE end_time IS NULL")
            remaining_nulls = cursor.fetchone()[0]
            
            if remaining_nulls == 0:
                print("🎉 All NULL end_time values have been fixed!")
            else:
                print(f"⚠️ Warning: {remaining_nulls} NULL end_time values still remain")
            
            return {
                "status": "success", 
                "updated_count": updated_count,
                "remaining_nulls": remaining_nulls
            }
            
    except Exception as e:
        print(f"❌ Error fixing NULL end_time values: {e}")
        return {"status": "error", "message": str(e)}

def validate_fix():
    """Validate that the fix worked correctly"""
    print("\n🔍 Validating the fix...")
    
    try:
        with get_production_db() as conn:
            cursor = conn.cursor()
            
            # Check for any remaining NULL values
            cursor.execute("SELECT COUNT(*) FROM events WHERE end_time IS NULL")
            null_count = cursor.fetchone()[0]
            
            # Check for empty string values (our fix)
            cursor.execute("SELECT COUNT(*) FROM events WHERE end_time = ''")
            empty_count = cursor.fetchone()[0]
            
            # Check for valid time values
            cursor.execute("SELECT COUNT(*) FROM events WHERE end_time IS NOT NULL AND end_time != ''")
            valid_count = cursor.fetchone()[0]
            
            print(f"📊 Validation Results:")
            print(f"  NULL end_time values: {null_count}")
            print(f"  Empty string end_time values: {empty_count}")
            print(f"  Valid end_time values: {valid_count}")
            
            if null_count == 0:
                print("✅ Validation passed: No NULL end_time values remain")
                return True
            else:
                print("❌ Validation failed: NULL values still exist")
                return False
                
    except Exception as e:
        print(f"❌ Validation error: {e}")
        return False

def main():
    """Main function to run the fix"""
    print("🚀 TodoEvents Production Database - Fix NULL end_time Values")
    print("=" * 60)
    
    # Fix the NULL values
    result = fix_null_end_times()
    
    if result["status"] != "success":
        print(f"❌ Fix failed: {result.get('message', 'Unknown error')}")
        return result
    
    # Validate the fix
    if validate_fix():
        print(f"\n🎉 SUCCESS: Fixed {result['updated_count']} NULL end_time values")
        print("📱 The frontend should now be able to load events without validation errors")
    else:
        print(f"\n⚠️ WARNING: Fix may not have completed successfully")
    
    return result

if __name__ == "__main__":
    result = main()
    print(f"\n📋 Final Result: {result}") 