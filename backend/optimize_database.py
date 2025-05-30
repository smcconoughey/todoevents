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
            
            # Performance indexes based on query analysis
            indexes_to_create = [
                # Most critical indexes for frequent queries
                ("idx_events_date_starttime", "CREATE INDEX IF NOT EXISTS idx_events_date_starttime ON events(date, start_time)"),
                ("idx_events_category", "CREATE INDEX IF NOT EXISTS idx_events_category ON events(category)"),
                ("idx_events_date", "CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)"),
                ("idx_events_location", "CREATE INDEX IF NOT EXISTS idx_events_location ON events(lat, lng)"),
                
                # Indexes for tracking tables
                ("idx_event_interests_event_id", "CREATE INDEX IF NOT EXISTS idx_event_interests_event_id ON event_interests(event_id)"),
                ("idx_event_interests_user_fingerprint", "CREATE INDEX IF NOT EXISTS idx_event_interests_user_fingerprint ON event_interests(user_id, browser_fingerprint)"),
                ("idx_event_views_event_id", "CREATE INDEX IF NOT EXISTS idx_event_views_event_id ON event_views(event_id)"),
                ("idx_event_views_user_fingerprint", "CREATE INDEX IF NOT EXISTS idx_event_views_user_fingerprint ON event_views(user_id, browser_fingerprint)"),
                
                # Composite indexes for common filter combinations
                ("idx_events_category_date", "CREATE INDEX IF NOT EXISTS idx_events_category_date ON events(category, date, start_time)"),
                ("idx_events_created_by", "CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by)"),
            ]
            
            logger.info("📊 Creating performance indexes...")
            for index_name, sql in indexes_to_create:
                try:
                    logger.info(f"Creating index: {index_name}")
                    cursor.execute(sql)
                    logger.info(f"✅ Index {index_name} created successfully")
                except Exception as e:
                    error_msg = str(e)
                    if "already exists" in error_msg.lower():
                        logger.info(f"✓ Index {index_name} already exists")
                    else:
                        logger.warning(f"⚠️ Failed to create index {index_name}: {error_msg}")
            
            # Optimize database settings
            optimization_queries = []
            
            if IS_PRODUCTION and DB_URL:
                # PostgreSQL optimizations
                optimization_queries = [
                    "SET shared_preload_libraries = 'pg_stat_statements'",
                    "SET track_activity_query_size = 2048",
                    "SET log_statement_stats = off",
                    "SET track_counts = on",
                    "SET track_functions = all",
                ]
            else:
                # SQLite optimizations
                optimization_queries = [
                    "PRAGMA optimize",
                    "PRAGMA analysis_limit = 1000",
                    "PRAGMA mmap_size = 268435456",  # 256MB
                    "ANALYZE",  # Update table statistics
                ]
            
            logger.info("⚡ Applying database optimizations...")
            for query in optimization_queries:
                try:
                    cursor.execute(query)
                    logger.info(f"✅ Applied: {query}")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to apply {query}: {str(e)}")
            
            # Update table statistics for better query planning
            try:
                if IS_PRODUCTION and DB_URL:
                    cursor.execute("ANALYZE events")
                    cursor.execute("ANALYZE event_interests") 
                    cursor.execute("ANALYZE event_views")
                    cursor.execute("ANALYZE users")
                else:
                    cursor.execute("ANALYZE")
                logger.info("✅ Updated table statistics")
            except Exception as e:
                logger.warning(f"⚠️ Failed to update statistics: {str(e)}")
            
            conn.commit()
            logger.info("✅ Database optimization completed successfully!")
            
    except Exception as e:
        logger.error(f"❌ Database optimization failed: {str(e)}")
        raise

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