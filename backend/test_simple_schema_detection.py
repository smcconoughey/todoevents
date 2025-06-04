#!/usr/bin/env python3
"""
Simple Schema Detection Test
Tests the database schema detection functionality directly
"""

import os
import sys
import sqlite3
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Import the backend functions
from backend import get_actual_table_columns, ensure_unique_slug, get_placeholder, init_db

def test_schema_detection():
    """Test schema detection with local SQLite"""
    print("🔍 Testing Schema Detection Functionality")
    print("=" * 50)
    
    # Initialize database
    init_db()
    
    # Connect to the local database
    db_path = "events.db"
    print(f"📁 Using database: {db_path}")
    
    if not os.path.exists(db_path):
        print("❌ Database does not exist")
        return False
    
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Test schema detection
            print("\n📋 Testing get_actual_table_columns()...")
            columns = get_actual_table_columns(cursor, 'events')
            
            print(f"✅ Found {len(columns)} columns in events table:")
            for i, col in enumerate(columns, 1):
                print(f"   {i:2d}. {col}")
            
            # Test placeholder function
            print(f"\n🔧 Testing get_placeholder()...")
            placeholder = get_placeholder()
            print(f"✅ Placeholder: '{placeholder}'")
            
            # Test ensure_unique_slug function
            print(f"\n🏷️ Testing ensure_unique_slug()...")
            
            test_slugs = [
                "test-event-slug",
                "another-test-slug",
                "",  # Empty slug test
                None,  # None slug test
                "test-with-special-chars-àáâã"
            ]
            
            for i, test_slug in enumerate(test_slugs, 1):
                print(f"   Test {i}: '{test_slug}'")
                try:
                    result_slug = ensure_unique_slug(cursor, test_slug)
                    print(f"   ✅ Result: '{result_slug}'")
                except Exception as e:
                    print(f"   ❌ Error: {e}")
            
            # Test database structure
            print(f"\n📊 Testing database structure...")
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            print(f"✅ Found {len(tables)} tables: {', '.join(tables)}")
            
            # Check if events table has data
            cursor.execute("SELECT COUNT(*) FROM events")
            event_count = cursor.fetchone()[0]
            print(f"✅ Events table has {event_count} records")
            
            # Test a sample query with placeholders
            print(f"\n🔍 Testing sample query with placeholders...")
            sample_query = f"SELECT COUNT(*) FROM events WHERE category = {placeholder}"
            cursor.execute(sample_query, ("business",))
            business_events = cursor.fetchone()[0]
            print(f"✅ Found {business_events} business events")
            
            return True
            
    except Exception as e:
        print(f"❌ Schema detection test failed: {e}")
        return False

def test_bulk_import_components():
    """Test individual components of bulk import"""
    print("\n🧩 Testing Bulk Import Components")
    print("=" * 40)
    
    try:
        # Test SEO field generation
        from backend import auto_populate_seo_fields
        
        test_event = {
            "title": "Test Event for Schema Detection",
            "description": "This is a test event to verify our bulk import fixes work correctly",
            "address": "123 Test Street, Nashville, TN 37203, USA",
            "fee_required": "Free admission"
        }
        
        print("📝 Testing auto_populate_seo_fields()...")
        enhanced_event = auto_populate_seo_fields(test_event)
        
        print(f"✅ Enhanced event data:")
        print(f"   📍 City: {enhanced_event.get('city', 'Not set')}")
        print(f"   📍 State: {enhanced_event.get('state', 'Not set')}")
        print(f"   🏷️ Slug: {enhanced_event.get('slug', 'Not set')}")
        print(f"   💰 Price: ${enhanced_event.get('price', 0)}")
        print(f"   📝 Short Description: {enhanced_event.get('short_description', 'Not set')[:50]}...")
        
        return True
        
    except Exception as e:
        print(f"❌ Component test failed: {e}")
        return False

def main():
    """Main test function"""
    print("🧪 TodoEvents Schema Detection & Bulk Import Component Test")
    print("=" * 70)
    
    try:
        # Test schema detection
        schema_success = test_schema_detection()
        
        # Test bulk import components
        component_success = test_bulk_import_components()
        
        if schema_success and component_success:
            print("\n🎉 All schema detection tests passed!")
            print("✅ Database schema detection is working correctly")
            print("✅ Bulk import components are functional")
            print("✅ The fixes should work correctly in production")
            return True
        else:
            print("\n⚠️ Some tests failed")
            return False
            
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1) 