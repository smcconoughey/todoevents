#!/usr/bin/env python3
"""
Fix image data for events where images were uploaded but database wasn't updated properly.
This script checks for uploaded image files and updates the database accordingly.
"""

import os
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
import glob
import re
from urllib.parse import urlparse

def get_database_connection():
    """Get database connection - PostgreSQL in production, SQLite in development"""
    database_url = os.getenv('DATABASE_URL')
    
    if database_url and database_url.startswith('postgresql'):
        # Production PostgreSQL
        print("Connecting to PostgreSQL database...")
        # Parse the DATABASE_URL
        if database_url.startswith('postgresql://'):
            database_url = database_url.replace('postgresql://', 'postgres://', 1)
        
        return psycopg2.connect(database_url, cursor_factory=RealDictCursor)
    else:
        # Development SQLite
        print("Connecting to SQLite database...")
        conn = sqlite3.connect('events_database.db')
        conn.row_factory = sqlite3.Row
        return conn

def find_uploaded_images():
    """Find all uploaded images and extract event IDs"""
    uploaded_images = {
        'banners': {},
        'logos': {}
    }
    
    # Check banner images
    banner_files = glob.glob('uploads/banners/banner_*.jpg')
    for file_path in banner_files:
        filename = os.path.basename(file_path)
        # Extract event ID from filename like "banner_1444_34c15187579547a9b828c89c9d543198.jpg"
        match = re.match(r'banner_(\d+)_', filename)
        if match:
            event_id = int(match.group(1))
            uploaded_images['banners'][event_id] = filename
    
    # Check logo images  
    logo_files = glob.glob('uploads/logos/logo_*.jpg')
    for file_path in logo_files:
        filename = os.path.basename(file_path)
        # Extract event ID from filename like "logo_1444_34c15187579547a9b828c89c9d543198.jpg"
        match = re.match(r'logo_(\d+)_', filename)
        if match:
            event_id = int(match.group(1))
            uploaded_images['logos'][event_id] = filename
    
    return uploaded_images

def get_events_missing_image_data(conn, uploaded_images):
    """Find events that have uploaded images but missing database records"""
    cursor = conn.cursor()
    missing_data = []
    
    # Check all events that should have banner images
    for event_id, banner_filename in uploaded_images['banners'].items():
        cursor.execute("SELECT id, banner_image FROM events WHERE id = %s", (event_id,))
        event = cursor.fetchone()
        
        if event and (not event['banner_image'] or event['banner_image'] != banner_filename):
            missing_data.append({
                'event_id': event_id,
                'type': 'banner',
                'filename': banner_filename,
                'current_value': event['banner_image']
            })
    
    # Check all events that should have logo images
    for event_id, logo_filename in uploaded_images['logos'].items():
        cursor.execute("SELECT id, logo_image FROM events WHERE id = %s", (event_id,))
        event = cursor.fetchone()
        
        if event and (not event['logo_image'] or event['logo_image'] != logo_filename):
            missing_data.append({
                'event_id': event_id,
                'type': 'logo', 
                'filename': logo_filename,
                'current_value': event['logo_image']
            })
    
    return missing_data

def fix_event_image_data(conn, event_id, image_type, filename):
    """Update database with correct image filename"""
    cursor = conn.cursor()
    
    if image_type == 'banner':
        cursor.execute(
            "UPDATE events SET banner_image = %s WHERE id = %s",
            (filename, event_id)
        )
    elif image_type == 'logo':
        cursor.execute(
            "UPDATE events SET logo_image = %s WHERE id = %s", 
            (filename, event_id)
        )
    
    if cursor.rowcount > 0:
        print(f"✅ Updated event {event_id} {image_type} to: {filename}")
        return True
    else:
        print(f"❌ Failed to update event {event_id} {image_type}")
        return False

def main():
    """Main function to fix image data"""
    print("🔍 Finding uploaded images...")
    uploaded_images = find_uploaded_images()
    
    print(f"Found {len(uploaded_images['banners'])} banner images")
    print(f"Found {len(uploaded_images['logos'])} logo images")
    
    if not uploaded_images['banners'] and not uploaded_images['logos']:
        print("No uploaded images found. Exiting.")
        return
    
    print("\n📊 Connecting to database...")
    try:
        with get_database_connection() as conn:
            print("🔎 Checking for missing image data...")
            missing_data = get_events_missing_image_data(conn, uploaded_images)
            
            if not missing_data:
                print("✅ All image data is correct!")
                return
            
            print(f"\n🔧 Found {len(missing_data)} records to fix:")
            for item in missing_data:
                print(f"  Event {item['event_id']} {item['type']}: {item['current_value']} -> {item['filename']}")
            
            confirm = input("\nProceed with fixes? (y/N): ")
            if confirm.lower() != 'y':
                print("Cancelled.")
                return
            
            print("\n🛠️  Applying fixes...")
            fixed_count = 0
            for item in missing_data:
                if fix_event_image_data(conn, item['event_id'], item['type'], item['filename']):
                    fixed_count += 1
            
            conn.commit()
            print(f"\n✅ Fixed {fixed_count}/{len(missing_data)} records!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 