#!/usr/bin/env python3
"""
Quick fix for event 1444 image data
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

def fix_event_1444():
    """Fix event 1444 image data directly"""
    
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ DATABASE_URL environment variable not set")
        print("This script is designed to run on production")
        return
    
    # Known image filenames from the upload logs
    banner_filename = "banner_1444_34c15187579547a9b828c89c9d543198.jpg"
    
    print("🔧 Fixing event 1444 image data...")
    print(f"Banner filename: {banner_filename}")
    
    try:
        # Connect to database
        if database_url.startswith('postgresql://'):
            database_url = database_url.replace('postgresql://', 'postgres://', 1)
        
        with psycopg2.connect(database_url, cursor_factory=RealDictCursor) as conn:
            cursor = conn.cursor()
            
            # First, check current state
            cursor.execute("SELECT id, title, banner_image, logo_image FROM events WHERE id = %s", (1444,))
            event = cursor.fetchone()
            
            if not event:
                print("❌ Event 1444 not found")
                return
            
            print(f"📊 Current event data:")
            print(f"  Title: {event['title']}")
            print(f"  Banner: {event['banner_image']}")
            print(f"  Logo: {event['logo_image']}")
            
            # Update the banner image
            cursor.execute(
                "UPDATE events SET banner_image = %s WHERE id = %s",
                (banner_filename, 1444)
            )
            
            print(f"✅ Updated {cursor.rowcount} record(s)")
            
            # Verify the update
            cursor.execute("SELECT banner_image, logo_image FROM events WHERE id = %s", (1444,))
            updated_event = cursor.fetchone()
            
            print(f"📊 Updated event data:")
            print(f"  Banner: {updated_event['banner_image']}")
            print(f"  Logo: {updated_event['logo_image']}")
            
            conn.commit()
            print("✅ Changes committed to database")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    fix_event_1444() 