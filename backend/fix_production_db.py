#!/usr/bin/env python3
"""
Script to add missing premium columns to production database
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_production_database():
    # Get database URL from environment
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        logger.error("DATABASE_URL environment variable not found")
        return False
    
    try:
        # Connect to production database
        logger.info("🔗 Connecting to production database...")
        conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
        cursor = conn.cursor()
        
        # Check current users table schema
        logger.info("🔍 Checking current users table schema...")
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            ORDER BY ordinal_position
        """)
        users_columns = cursor.fetchall()
        logger.info(f"Found {len(users_columns)} columns in users table")
        
        # Check for premium columns
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name IN ('premium_expires_at', 'premium_granted_by', 'premium_invited')
        """)
        existing_premium_columns = [row['column_name'] for row in cursor.fetchall()]
        logger.info(f"Found existing premium columns: {existing_premium_columns}")
        
        # Add missing premium columns
        columns_to_add = [
            ("premium_expires_at", "TIMESTAMP"),
            ("premium_granted_by", "INTEGER"),
            ("premium_invited", "BOOLEAN DEFAULT FALSE")
        ]
        
        results = []
        for column_name, column_type in columns_to_add:
            if column_name not in existing_premium_columns:
                try:
                    logger.info(f"➕ Adding column: {column_name}")
                    cursor.execute(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}")
                    results.append(f"✅ Added {column_name}")
                    logger.info(f"✅ Successfully added {column_name}")
                except Exception as e:
                    results.append(f"❌ Failed to add {column_name}: {str(e)}")
                    logger.error(f"❌ Failed to add {column_name}: {str(e)}")
            else:
                results.append(f"ℹ️ {column_name} already exists")
                logger.info(f"ℹ️ Column {column_name} already exists")
        
        # Commit changes
        conn.commit()
        logger.info("💾 Changes committed")
        
        # Verify all columns now exist
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name IN ('premium_expires_at', 'premium_granted_by', 'premium_invited')
        """)
        final_premium_columns = [row['column_name'] for row in cursor.fetchall()]
        
        # Also check if privacy_requests table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'privacy_requests'
            )
        """)
        privacy_table_exists = cursor.fetchone()[0]
        
        # If privacy_requests table doesn't exist, create it
        if not privacy_table_exists:
            logger.info("➕ Creating privacy_requests table...")
            cursor.execute("""
                CREATE TABLE privacy_requests (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) NOT NULL,
                    request_type VARCHAR(50) NOT NULL,
                    message TEXT,
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processed_at TIMESTAMP NULL,
                    processed_by INTEGER NULL
                )
            """)
            conn.commit()
            logger.info("✅ Privacy requests table created")
            results.append("✅ Created privacy_requests table")
        else:
            logger.info("ℹ️ Privacy requests table already exists")
            results.append("ℹ️ Privacy requests table already exists")
        
        conn.close()
        
        logger.info("🎉 Database fix completed successfully!")
        logger.info(f"Premium columns now present: {final_premium_columns}")
        logger.info("Results:")
        for result in results:
            logger.info(f"  {result}")
        
        return {
            "success": True,
            "premium_columns_added": len(final_premium_columns) == 3,
            "final_premium_columns": final_premium_columns,
            "results": results,
            "privacy_table_exists": privacy_table_exists or "created"
        }
        
    except Exception as e:
        logger.error(f"❌ Error fixing production database: {str(e)}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    result = fix_production_database()
    print(f"Final result: {result}") 