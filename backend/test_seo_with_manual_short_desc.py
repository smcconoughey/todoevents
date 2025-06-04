#!/usr/bin/env python3
"""
Test SEO auto-population with focus on short description generation
"""

import sqlite3
import random
import string
from contextlib import contextmanager

@contextmanager
def get_db():
    """Get database connection"""
    conn = sqlite3.connect('events.db')
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def make_short_description_local(description):
    """Generate short description from long description (max 160 chars)"""
    if not description:
        return ""
    
    # Clean the description
    clean_desc = description.strip()
    
    if len(clean_desc) <= 160:
        return clean_desc
    
    # Find the best truncation point (prefer sentence or word boundaries)
    max_length = 157  # Leave room for "..."
    
    # Try to find sentence boundary
    sentence_endings = ['. ', '! ', '? ']
    best_cut = 0
    
    for ending in sentence_endings:
        pos = clean_desc.rfind(ending, 0, max_length)
        if pos > best_cut:
            best_cut = pos + 1  # Include the punctuation
    
    # If no sentence boundary, try word boundary
    if best_cut == 0:
        pos = clean_desc.rfind(' ', 0, max_length)
        if pos > 0:
            best_cut = pos
        else:
            best_cut = max_length
    
    # Truncate and add ellipsis if needed
    result = clean_desc[:best_cut]
    if best_cut < len(clean_desc):
        result += "..."
    
    return result

def test_short_description_generation():
    """Test short description generation"""
    print("🧪 Testing short description generation...")
    
    test_cases = [
        "Short description that's under 160 characters.",
        "This is a longer description that should be truncated because it exceeds the 160 character limit for short descriptions. The function should find a good place to cut it off, preferably at a sentence boundary or word boundary.",
        "Very long description without proper punctuation that goes on and on and should be truncated at a word boundary since there are no sentence endings available in the first part of the text that fits within the character limit for short descriptions",
        "Short desc.",
        "Multiple sentences here. This is the second sentence. And this is the third sentence that should not appear in the short description because it would make it too long for SEO purposes.",
        ""
    ]
    
    for i, desc in enumerate(test_cases, 1):
        short_desc = make_short_description_local(desc)
        print(f"\nTest {i}:")
        print(f"  Original ({len(desc)} chars): {desc[:50]}{'...' if len(desc) > 50 else ''}")
        print(f"  Short ({len(short_desc)} chars): {short_desc}")
        assert len(short_desc) <= 160, f"Short description too long: {len(short_desc)} chars"

def test_full_seo_auto_population():
    """Test the full SEO auto-population workflow"""
    print("\n🔧 Testing full SEO auto-population...")
    
    # Sample event data similar to what frontend would send
    event_data = {
        'title': 'Community Garden Workshop',
        'description': 'Join us for an exciting community garden workshop where you will learn about organic gardening techniques, composting, and sustainable farming practices. This hands-on workshop is perfect for beginners and experienced gardeners alike. We will cover topics including soil preparation, plant selection, pest management, and harvest timing. Bring your gardening gloves and enthusiasm!',
        'date': '2025-06-20',
        'start_time': '09:00',
        'end_time': '15:00',
        'category': 'community',
        'address': '456 Garden Lane, Grand Rapids, MI, USA',
        'lat': 42.9634,
        'lng': -85.6681,
        'fee_required': '$25 includes lunch and materials',
        'event_url': 'https://gardencenter.com/workshop',
        'host_name': 'Green Thumb Community Center'
    }
    
    # Import the auto-population function from backend
    import sys
    sys.path.append('.')
    
    from backend import auto_populate_seo_fields
    
    populated_data = auto_populate_seo_fields(event_data.copy())
    
    print(f"Original description length: {len(event_data['description'])}")
    print(f"Generated short description: {populated_data.get('short_description', 'NOT GENERATED')}")
    print(f"Short description length: {len(populated_data.get('short_description', ''))}")
    print(f"Generated slug: {populated_data.get('slug', 'NOT GENERATED')}")
    print(f"Extracted city: {populated_data.get('city', 'NOT EXTRACTED')}")
    print(f"Extracted state: {populated_data.get('state', 'NOT EXTRACTED')}")
    print(f"Normalized price: {populated_data.get('price', 'NOT NORMALIZED')}")
    
    return populated_data

def test_event_creation_with_auto_seo():
    """Test creating an event through the database with auto-populated SEO"""
    print("\n📝 Testing event creation with auto SEO...")
    
    # Generate a unique title to avoid duplicates
    unique_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    
    event_data = {
        'title': f'Auto SEO Test Event {unique_id}',
        'description': 'This is a comprehensive test event description that should be long enough to trigger the automatic short description generation. The system should create a short description that is under 160 characters and ends at a word boundary or sentence boundary for optimal SEO performance.',
        'date': '2025-06-25',
        'start_time': '14:00',
        'end_time': '17:00',
        'category': 'community',
        'address': '789 Test Avenue, Ann Arbor, MI, USA',
        'lat': 42.2808,
        'lng': -83.7430,
        'fee_required': 'Free with suggested $10 donation',
        'host_name': 'Test Organization'
    }
    
    # Auto-populate SEO fields
    import sys
    sys.path.append('.')
    
    from backend import auto_populate_seo_fields
    
    populated_data = auto_populate_seo_fields(event_data.copy())
    
    # Test inserting into database
    with get_db() as conn:
        cursor = conn.cursor()
        
        try:
            insert_query = """
                INSERT INTO events (
                    title, description, short_description, date, start_time, end_time,
                    category, address, city, state, country, lat, lng, 
                    fee_required, price, currency, host_name, slug, created_by
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            """
            
            values = (
                populated_data['title'],
                populated_data['description'],
                populated_data.get('short_description', ''),
                populated_data['date'],
                populated_data['start_time'],
                populated_data.get('end_time'),
                populated_data['category'],
                populated_data['address'],
                populated_data.get('city'),
                populated_data.get('state'),
                populated_data.get('country', 'USA'),
                populated_data['lat'],
                populated_data['lng'],
                populated_data.get('fee_required'),
                populated_data.get('price', 0.0),
                populated_data.get('currency', 'USD'),
                populated_data.get('host_name'),
                populated_data.get('slug'),
                1  # created_by
            )
            
            cursor.execute(insert_query, values)
            event_id = cursor.lastrowid
            
            # Verify the event
            cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
            created_event = cursor.fetchone()
            
            if created_event:
                print(f"✅ Event created successfully with ID: {event_id}")
                print(f"   Title: {created_event['title']}")
                print(f"   Short Description: {created_event['short_description']}")
                print(f"   Slug: {created_event['slug']}")
                print(f"   City: {created_event['city']}")
                print(f"   State: {created_event['state']}")
                print(f"   Price: {created_event['price']}")
                
                # Cleanup
                cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
                conn.commit()
                print("🧹 Test event cleaned up")
                
                return True
            else:
                print("❌ Event not found after creation")
                return False
                
        except Exception as e:
            print(f"❌ Event creation failed: {e}")
            return False

def main():
    """Main function"""
    test_short_description_generation()
    test_full_seo_auto_population()
    test_event_creation_with_auto_seo()

if __name__ == "__main__":
    main() 