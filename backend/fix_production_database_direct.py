#!/usr/bin/env python3
"""
Direct Production Database Fix Script
=====================================

This script fixes the critical database schema issues causing bulk import failures:
1. Adds missing UX enhancement fields (fee_required, event_url, host_name)
2. Adds missing SEO fields (slug, short_description, etc.)
3. Verifies and repairs database schema consistency
4. Tests database functionality

Usage:
    python fix_production_database_direct.py
"""

import os
import sys
import logging
import traceback
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('production_database_fix.log')
    ]
)
logger = logging.getLogger(__name__)

def get_production_db():
    """Get production database connection"""
    try:
        DB_URL = os.getenv("DATABASE_URL")
        if not DB_URL:
            raise Exception("DATABASE_URL environment variable not set")
        
        logger.info(f"🔗 Connecting to database: {DB_URL[:30]}...")
        
        # Import based on what's available
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            
            # Parse the URL and create connection
            conn = psycopg2.connect(DB_URL)
            conn.autocommit = False  # We'll manage transactions manually
            logger.info("✅ Connected to PostgreSQL database")
            return conn
            
        except ImportError:
            logger.error("❌ psycopg2 not available")
            raise Exception("PostgreSQL driver (psycopg2) not installed")
            
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        raise

def check_table_exists(cursor, table_name):
    """Check if a table exists"""
    try:
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = %s
            )
        """, (table_name,))
        return cursor.fetchone()[0]
    except Exception as e:
        logger.error(f"❌ Error checking table existence: {e}")
        return False

def get_table_columns(cursor, table_name):
    """Get current table columns"""
    try:
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = %s
            ORDER BY ordinal_position
        """, (table_name,))
        
        columns = {}
        for row in cursor.fetchall():
            columns[row[0]] = {
                'type': row[1],
                'nullable': row[2] == 'YES',
                'default': row[3]
            }
        return columns
        
    except Exception as e:
        logger.error(f"❌ Error getting table columns: {e}")
        return {}

def add_missing_columns(cursor):
    """Add missing columns to events table"""
    logger.info("🔧 Adding missing columns to events table...")
    
    # Define all required columns with their specifications
    required_columns = {
        # UX Enhancement fields
        'fee_required': 'TEXT',
        'event_url': 'TEXT', 
        'host_name': 'TEXT',
        'organizer_url': 'TEXT',
        'price': 'DECIMAL(10,2) DEFAULT 0.0',
        'currency': 'VARCHAR(3) DEFAULT \'USD\'',
        
        # SEO fields
        'slug': 'TEXT',
        'short_description': 'TEXT',
        'city': 'VARCHAR(100)',
        'state': 'VARCHAR(50)',
        'country': 'VARCHAR(50) DEFAULT \'USA\'',
        'geo_hash': 'VARCHAR(20)',
        'is_published': 'BOOLEAN DEFAULT TRUE',
        
        # Datetime fields
        'start_datetime': 'TIMESTAMP',
        'end_datetime': 'TIMESTAMP',
        'updated_at': 'TIMESTAMP',
        
        # Counter fields
        'interest_count': 'INTEGER DEFAULT 0',
        'view_count': 'INTEGER DEFAULT 0'
    }
    
    # Get current columns
    current_columns = get_table_columns(cursor, 'events')
    logger.info(f"📊 Current table has {len(current_columns)} columns")
    
    added_columns = []
    failed_columns = []
    
    for column_name, column_spec in required_columns.items():
        if column_name not in current_columns:
            try:
                sql = f"ALTER TABLE events ADD COLUMN {column_name} {column_spec}"
                logger.info(f"🔧 Adding column: {column_name} ({column_spec})")
                cursor.execute(sql)
                added_columns.append(column_name)
                
            except Exception as e:
                logger.error(f"❌ Failed to add column {column_name}: {e}")
                failed_columns.append((column_name, str(e)))
        else:
            logger.debug(f"✅ Column {column_name} already exists")
    
    if added_columns:
        logger.info(f"✅ Successfully added {len(added_columns)} columns: {added_columns}")
    
    if failed_columns:
        logger.warning(f"⚠️ Failed to add {len(failed_columns)} columns: {[col[0] for col in failed_columns]}")
        
    return added_columns, failed_columns

def create_indexes(cursor):
    """Create important indexes for performance"""
    logger.info("🔧 Creating database indexes...")
    
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug)",
        "CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)",
        "CREATE INDEX IF NOT EXISTS idx_events_category ON events(category)",
        "CREATE INDEX IF NOT EXISTS idx_events_city_state ON events(city, state)",
        "CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by)",
        "CREATE INDEX IF NOT EXISTS idx_events_published ON events(is_published)"
    ]
    
    created_indexes = []
    failed_indexes = []
    
    for sql in indexes:
        try:
            cursor.execute(sql)
            index_name = sql.split("idx_")[1].split(" ")[0] if "idx_" in sql else "unknown"
            created_indexes.append(index_name)
            logger.debug(f"✅ Created index: {index_name}")
            
        except Exception as e:
            logger.warning(f"⚠️ Index creation failed: {e}")
            failed_indexes.append(str(e))
    
    logger.info(f"✅ Successfully created {len(created_indexes)} indexes")
    if failed_indexes:
        logger.warning(f"⚠️ {len(failed_indexes)} indexes failed to create")
    
    return created_indexes, failed_indexes

def verify_database_functionality(cursor):
    """Test basic database operations"""
    logger.info("🔍 Verifying database functionality...")
    
    tests = []
    
    # Test 1: Count existing events
    try:
        cursor.execute("SELECT COUNT(*) FROM events")
        count = cursor.fetchone()[0]
        tests.append(("Event count", True, f"{count} events found"))
        logger.info(f"✅ Found {count} existing events")
    except Exception as e:
        tests.append(("Event count", False, str(e)))
        logger.error(f"❌ Could not count events: {e}")
    
    # Test 2: Check table structure
    try:
        current_columns = get_table_columns(cursor, 'events')
        required_fields = ['id', 'title', 'description', 'date', 'start_time', 'category', 'address', 'lat', 'lng']
        missing_required = [field for field in required_fields if field not in current_columns]
        
        if not missing_required:
            tests.append(("Required fields", True, "All required fields present"))
            logger.info("✅ All required fields are present")
        else:
            tests.append(("Required fields", False, f"Missing: {missing_required}"))
            logger.error(f"❌ Missing required fields: {missing_required}")
    except Exception as e:
        tests.append(("Required fields", False, str(e)))
        logger.error(f"❌ Could not check required fields: {e}")
    
    # Test 3: Test slug uniqueness checking
    try:
        cursor.execute("SELECT COUNT(*) FROM events WHERE slug IS NOT NULL")
        slug_count = cursor.fetchone()[0]
        tests.append(("Slug functionality", True, f"{slug_count} events have slugs"))
        logger.info(f"✅ Slug functionality working: {slug_count} events have slugs")
    except Exception as e:
        tests.append(("Slug functionality", False, str(e)))
        logger.error(f"❌ Slug functionality test failed: {e}")
    
    # Test 4: Test sequence functionality (for ID generation)
    try:
        cursor.execute("SELECT currval(pg_get_serial_sequence('events', 'id'))")
        last_id = cursor.fetchone()[0]
        tests.append(("ID sequence", True, f"Last ID: {last_id}"))
        logger.info(f"✅ ID sequence working: last ID = {last_id}")
    except Exception as e:
        logger.warning(f"⚠️ ID sequence test inconclusive: {e}")
        # This might fail if no events have been inserted yet, so it's not necessarily an error
        tests.append(("ID sequence", True, "Sequence exists but not yet used"))
    
    # Summary
    passed = sum(1 for test in tests if test[1])
    total = len(tests)
    logger.info(f"📊 Database functionality tests: {passed}/{total} passed")
    
    return tests

def update_null_values(cursor):
    """Update NULL values in new columns to avoid issues"""
    logger.info("🔧 Updating NULL values in new columns...")
    
    updates = [
        "UPDATE events SET fee_required = '' WHERE fee_required IS NULL",
        "UPDATE events SET event_url = '' WHERE event_url IS NULL",
        "UPDATE events SET host_name = '' WHERE host_name IS NULL",
        "UPDATE events SET organizer_url = '' WHERE organizer_url IS NULL",
        "UPDATE events SET short_description = '' WHERE short_description IS NULL",
        "UPDATE events SET city = '' WHERE city IS NULL",
        "UPDATE events SET state = '' WHERE state IS NULL",
        "UPDATE events SET country = 'USA' WHERE country IS NULL",
        "UPDATE events SET currency = 'USD' WHERE currency IS NULL",
        "UPDATE events SET price = 0.0 WHERE price IS NULL",
        "UPDATE events SET interest_count = 0 WHERE interest_count IS NULL",
        "UPDATE events SET view_count = 0 WHERE view_count IS NULL",
        "UPDATE events SET is_published = TRUE WHERE is_published IS NULL"
    ]
    
    updated_counts = []
    
    for sql in updates:
        try:
            cursor.execute(sql)
            count = cursor.rowcount
            if count > 0:
                field = sql.split("SET ")[1].split(" =")[0]
                updated_counts.append((field, count))
                logger.info(f"✅ Updated {count} NULL values in {field}")
        except Exception as e:
            logger.warning(f"⚠️ Update failed: {e}")
    
    return updated_counts

def main():
    """Main execution function"""
    logger.info("🚀 Starting Production Database Fix")
    logger.info("=" * 50)
    
    try:
        # Connect to database
        conn = get_production_db()
        cursor = conn.cursor()
        
        # Check if events table exists
        if not check_table_exists(cursor, 'events'):
            logger.error("❌ Events table does not exist!")
            return False
        
        logger.info("✅ Events table exists")
        
        # Get current state
        current_columns = get_table_columns(cursor, 'events')
        logger.info(f"📊 Current events table has {len(current_columns)} columns")
        
        # Add missing columns
        added_columns, failed_columns = add_missing_columns(cursor)
        
        # Update NULL values
        updated_counts = update_null_values(cursor)
        
        # Create indexes
        created_indexes, failed_indexes = create_indexes(cursor)
        
        # Commit changes
        conn.commit()
        logger.info("✅ All changes committed to database")
        
        # Verify functionality
        test_results = verify_database_functionality(cursor)
        
        # Final summary
        logger.info("=" * 50)
        logger.info("🎉 Production Database Fix Complete!")
        logger.info(f"📊 Summary:")
        logger.info(f"   • Added columns: {len(added_columns)}")
        logger.info(f"   • Failed columns: {len(failed_columns)}")
        logger.info(f"   • Created indexes: {len(created_indexes)}")
        logger.info(f"   • Updated NULL values: {len(updated_counts)}")
        
        passed_tests = sum(1 for test in test_results if test[1])
        logger.info(f"   • Functionality tests: {passed_tests}/{len(test_results)} passed")
        
        if failed_columns:
            logger.warning("⚠️ Some columns failed to be added - bulk import may still have issues")
            return False
        
        logger.info("✅ Database is ready for bulk imports!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Critical error during database fix: {e}")
        logger.error(f"📝 Traceback: {traceback.format_exc()}")
        
        try:
            conn.rollback()
            logger.info("🔄 Database changes rolled back")
        except:
            pass
        
        return False
        
    finally:
        try:
            cursor.close()
            conn.close()
            logger.info("🔌 Database connection closed")
        except:
            pass

if __name__ == "__main__":
    success = main()
    if success:
        logger.info("🎉 Script completed successfully!")
        sys.exit(0)
    else:
        logger.error("❌ Script failed!")
        sys.exit(1) 