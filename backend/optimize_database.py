#!/usr/bin/env python3
"""
Database optimization script for todoevents backend
Fixes performance issues causing timeouts
"""
import os
import sys
import time
import logging
from contextlib import contextmanager

# Add current directory to path to import backend modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from backend import get_db, IS_PRODUCTION, DB_URL, get_placeholder
except ImportError as e:
    print(f"Error importing backend modules: {e}")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def optimize_database():
    """Add database indexes and optimize queries for better performance"""
    logger.info("🚀 Starting database optimization...")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            placeholder = get_placeholder()
            
            logger.info("📊 Checking current database schema...")
            
            # Check if we're in production (PostgreSQL) or development (SQLite)
            if IS_PRODUCTION and DB_URL:
                logger.info("🐘 Optimizing PostgreSQL production database")
                
                # Create indexes for better performance
                indexes_to_create = [
                    # Events table indexes
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_date ON events(date)",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_category ON events(category)",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_lat_lng ON events(lat, lng)",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_created_by ON events(created_by)",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_date_start_time ON events(date, start_time)",
                    
                    # Interest tracking indexes
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_interests_event_id ON event_interests(event_id)",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_interests_user_id ON event_interests(user_id)",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_interests_fingerprint ON event_interests(browser_fingerprint)",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_interests_unique ON event_interests(event_id, user_id, browser_fingerprint)",
                    
                    # View tracking indexes  
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_views_event_id ON event_views(event_id)",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_views_user_id ON event_views(user_id)",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_views_fingerprint ON event_views(browser_fingerprint)",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_views_timestamp ON event_views(viewed_at)",
                    
                    # Users table indexes
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email)",
                    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users(role)"
                ]
                
                # Analyze queries for better performance
                analyze_queries = [
                    "ANALYZE events",
                    "ANALYZE event_interests", 
                    "ANALYZE event_views",
                    "ANALYZE users"
                ]
                
            else:
                logger.info("🗃️ Optimizing SQLite development database")
                
                # SQLite indexes (without CONCURRENTLY)
                indexes_to_create = [
                    "CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)",
                    "CREATE INDEX IF NOT EXISTS idx_events_category ON events(category)",
                    "CREATE INDEX IF NOT EXISTS idx_events_lat_lng ON events(lat, lng)",
                    "CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by)",
                    "CREATE INDEX IF NOT EXISTS idx_events_date_start_time ON events(date, start_time)",
                    "CREATE INDEX IF NOT EXISTS idx_event_interests_event_id ON event_interests(event_id)",
                    "CREATE INDEX IF NOT EXISTS idx_event_interests_user_id ON event_interests(user_id)",
                    "CREATE INDEX IF NOT EXISTS idx_event_interests_fingerprint ON event_interests(browser_fingerprint)",
                    "CREATE INDEX IF NOT EXISTS idx_event_views_event_id ON event_views(event_id)",
                    "CREATE INDEX IF NOT EXISTS idx_event_views_user_id ON event_views(user_id)",
                    "CREATE INDEX IF NOT EXISTS idx_event_views_fingerprint ON event_views(browser_fingerprint)",
                    "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
                    "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)"
                ]
                
                analyze_queries = ["ANALYZE"]
            
            # Create indexes
            logger.info(f"📈 Creating {len(indexes_to_create)} performance indexes...")
            for i, index_sql in enumerate(indexes_to_create, 1):
                try:
                    logger.info(f"  [{i}/{len(indexes_to_create)}] {index_sql.split()[-3]} ON {index_sql.split()[-1]}")
                    cursor.execute(index_sql)
                    conn.commit()
                except Exception as e:
                    logger.warning(f"  ⚠️ Index creation failed (may already exist): {e}")
                    continue
            
            # Run analyze to update statistics
            logger.info("📊 Updating database statistics...")
            for analyze_sql in analyze_queries:
                try:
                    cursor.execute(analyze_sql)
                    conn.commit()
                except Exception as e:
                    logger.warning(f"  ⚠️ Analyze failed: {e}")
            
            # Check for NULL values that might slow queries
            logger.info("🔍 Checking for data integrity issues...")
            
            cursor.execute("SELECT COUNT(*) FROM events WHERE interest_count IS NULL")
            null_interests = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM events WHERE view_count IS NULL")
            null_views = cursor.fetchone()[0]
            
            if null_interests > 0:
                logger.info(f"🔧 Fixing {null_interests} NULL interest_count values...")
                cursor.execute("UPDATE events SET interest_count = 0 WHERE interest_count IS NULL")
                conn.commit()
            
            if null_views > 0:
                logger.info(f"🔧 Fixing {null_views} NULL view_count values...")
                cursor.execute("UPDATE events SET view_count = 0 WHERE view_count IS NULL")
                conn.commit()
            
            # Vacuum/optimize the database
            if not IS_PRODUCTION:
                logger.info("🧹 Optimizing SQLite database...")
                cursor.execute("VACUUM")
                conn.commit()
            else:
                logger.info("🧹 PostgreSQL optimization complete (VACUUM would be done by auto-vacuum)")
            
            logger.info("✅ Database optimization completed successfully!")
            return True
            
    except Exception as e:
        logger.error(f"❌ Database optimization failed: {e}")
        return False

def test_performance():
    """Test database query performance after optimization"""
    logger.info("🏃 Testing database performance...")
    
    queries_to_test = [
        ("List events", "SELECT COUNT(*) FROM events"),
        ("Events by category", "SELECT COUNT(*) FROM events WHERE category = 'music'"),
        ("Events by date", "SELECT COUNT(*) FROM events WHERE date >= '2024-01-01'"),
        ("Interest counts", "SELECT AVG(interest_count) FROM events"),
        ("View counts", "SELECT AVG(view_count) FROM events")
    ]
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            for name, query in queries_to_test:
                start_time = time.time()
                cursor.execute(query)
                result = cursor.fetchone()
                end_time = time.time()
                
                duration_ms = (end_time - start_time) * 1000
                logger.info(f"  ⚡ {name}: {duration_ms:.1f}ms (result: {result[0] if result else 'N/A'})")
        
        logger.info("✅ Performance testing completed!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Performance testing failed: {e}")
        return False

if __name__ == "__main__":
    print("🔧 TodoEvents Database Optimization Tool")
    print("=" * 50)
    
    # Run optimization
    if optimize_database():
        print("\n🎯 Testing performance...")
        test_performance()
        print("\n✨ Optimization complete! Backend should be faster now.")
    else:
        print("\n❌ Optimization failed. Check logs for details.")
        sys.exit(1) 