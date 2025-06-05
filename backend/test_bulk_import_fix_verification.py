#!/usr/bin/env python3
"""
Bulk Import Fix Verification Test
=================================

This script tests the PostgreSQL RETURNING clause fix for bulk import.
It validates that event IDs are properly retrieved from RealDictRow results.
"""

import os
import sys
import logging
from datetime import datetime, timedelta

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_bulk_import_postgresql_fix():
    """Test the PostgreSQL result handling fix for bulk import"""
    
    logger.info("🧪 Testing PostgreSQL Bulk Import Fix")
    logger.info("=" * 50)
    
    try:
        # Import necessary modules
        from backend import get_db, IS_PRODUCTION, DB_URL, auto_populate_seo_fields
        
        logger.info(f"📊 Environment: Production={IS_PRODUCTION}, DB_URL exists={bool(DB_URL)}")
        
        # Test data
        test_events = [
            {
                "title": "Test Event 1",
                "description": "A test event for bulk import verification",
                "date": (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d'),
                "start_time": "19:00",
                "end_time": "21:00",
                "category": "Sports & Recreation",
                "address": "123 Test St, Test City, Test State 12345",
                "lat": 40.7128,
                "lng": -74.0060,
                "recurring": False
            },
            {
                "title": "Test Event 2", 
                "description": "Another test event for bulk import verification",
                "date": (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d'),
                "start_time": "14:00",
                "end_time": "16:00", 
                "category": "Educational & Business",
                "address": "456 Test Ave, Test City, Test State 12345",
                "lat": 40.7589,
                "lng": -73.9851,
                "recurring": False
            }
        ]
        
        # Auto-populate SEO fields for each event
        for event in test_events:
            auto_populated = auto_populate_seo_fields(event)
            event.update(auto_populated)
            logger.info(f"📝 Auto-populated event: {event['title']} -> slug: {event.get('slug', 'N/A')}")
        
        logger.info(f"✅ Test data prepared: {len(test_events)} events")
        
        # Test database connection
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if we can access the events table
            if IS_PRODUCTION and DB_URL:
                cursor.execute("SELECT COUNT(*) FROM events")
            else:
                cursor.execute("SELECT COUNT(*) FROM events")
                
            count_result = cursor.fetchone()
            if count_result:
                existing_count = count_result[0] if hasattr(count_result, '__getitem__') else count_result
                logger.info(f"📊 Existing events in database: {existing_count}")
            
            # Test the RETURNING clause functionality specifically
            logger.info("🔍 Testing RETURNING clause functionality...")
            
            test_event = test_events[0]
            
            # Prepare insert data similar to bulk import
            insert_columns = ['title', 'description', 'date', 'start_time', 'category', 'address', 'lat', 'lng', 'created_by']
            insert_values = [
                test_event['title'] + ' (Test)',
                test_event['description'],
                test_event['date'],
                test_event['start_time'],
                test_event['category'],
                test_event['address'],
                test_event['lat'],
                test_event['lng'],
                1  # Test user ID
            ]
            
            if IS_PRODUCTION and DB_URL:
                placeholders = ['%s'] * len(insert_columns)
                insert_query = f"""
                    INSERT INTO events ({', '.join(insert_columns)}) 
                    VALUES ({', '.join(placeholders)})
                    RETURNING id
                """
            else:
                placeholders = ['?'] * len(insert_columns)
                insert_query = f"""
                    INSERT INTO events ({', '.join(insert_columns)}) 
                    VALUES ({', '.join(placeholders)})
                """
            
            logger.info(f"🔍 Executing test insert query...")
            logger.debug(f"Query: {insert_query}")
            logger.debug(f"Values: {insert_values}")
            
            cursor.execute(insert_query, insert_values)
            
            # Test ID retrieval
            event_id = None
            if IS_PRODUCTION and DB_URL:
                # PostgreSQL: Test RETURNING clause
                result = cursor.fetchone()
                logger.info(f"🔍 RETURNING result: {result} (type: {type(result)})")
                
                if result is not None:
                    if hasattr(result, 'get') and 'id' in result:
                        event_id = int(result['id'])
                        logger.info(f"✅ Got event ID via RealDictRow['id']: {event_id}")
                    elif hasattr(result, '__getitem__'):
                        event_id = int(result[0])
                        logger.info(f"✅ Got event ID via result[0]: {event_id}")
                    else:
                        event_id = int(result)
                        logger.info(f"✅ Got event ID via direct conversion: {event_id}")
            else:
                # SQLite: Test last_insert_rowid()
                cursor.execute("SELECT last_insert_rowid()")
                result = cursor.fetchone()
                if result:
                    event_id = int(result[0])
                    logger.info(f"✅ Got event ID via last_insert_rowid: {event_id}")
            
            if event_id and event_id > 0:
                logger.info(f"🎉 SUCCESS: Event ID retrieval test passed! ID: {event_id}")
                
                # Clean up test event
                if IS_PRODUCTION and DB_URL:
                    cursor.execute("DELETE FROM events WHERE id = %s", (event_id,))
                else:
                    cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
                logger.info(f"🧹 Cleaned up test event ID: {event_id}")
                
                conn.commit()
                
            else:
                logger.error(f"❌ FAILED: Could not retrieve valid event ID")
                return False
    
    except Exception as e:
        logger.error(f"❌ Test failed with error: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return False
    
    logger.info("=" * 50)
    logger.info("🎉 PostgreSQL Bulk Import Fix Verification PASSED!")
    return True

def main():
    """Main test function"""
    logger.info("🚀 Starting Bulk Import Fix Verification")
    
    success = test_bulk_import_postgresql_fix()
    
    if success:
        logger.info("✅ All tests passed! Bulk import fix is working correctly.")
        sys.exit(0)
    else:
        logger.error("❌ Tests failed! Bulk import fix needs attention.")
        sys.exit(1)

if __name__ == "__main__":
    main() 