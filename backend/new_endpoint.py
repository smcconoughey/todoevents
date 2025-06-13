@app.post("/debug/create-missing-tables")
async def create_missing_tables():
    """Create missing tables and columns in production"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            results = []
            
            # Check if privacy_requests table exists
            if IS_PRODUCTION and DB_URL:
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'privacy_requests'
                    )
                """)
                privacy_table_exists = cursor.fetchone()[0]
            else:
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='privacy_requests'")
                privacy_table_exists = cursor.fetchone() is not None
            
            # Create privacy_requests table if it doesn't exist
            if not privacy_table_exists:
                if IS_PRODUCTION and DB_URL:
                    cursor.execute("""
                        CREATE TABLE privacy_requests (
                            id SERIAL PRIMARY KEY,
                            request_type VARCHAR(50) NOT NULL,
                            email VARCHAR(255) NOT NULL,
                            full_name VARCHAR(255),
                            details TEXT,
                            status VARCHAR(20) DEFAULT 'pending',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            completed_at TIMESTAMP NULL,
                            admin_notes TEXT
                        )
                    """)
                results.append("✅ Created privacy_requests table")
            else:
                results.append("ℹ️ privacy_requests table already exists")
            
            # Add premium columns to users table
            premium_columns = [
                ("premium_expires_at", "TIMESTAMP"),
                ("premium_granted_by", "INTEGER"),
                ("premium_invited", "BOOLEAN DEFAULT FALSE")
            ]
            
            for column_name, column_type in premium_columns:
                try:
                    if IS_PRODUCTION and DB_URL:
                        cursor.execute(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {column_name} {column_type}")
                    else:
                        cursor.execute(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}")
                    results.append(f"✅ Added {column_name} to users table")
                except Exception as e:
                    if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                        results.append(f"ℹ️ {column_name} already exists in users table")
                    else:
                        results.append(f"❌ Failed to add {column_name}: {str(e)}")
            
            conn.commit()
            
            return {
                "success": True,
                "message": "Database creation completed",
                "results": results,
                "privacy_table_created": not privacy_table_exists
            }
            
    except Exception as e:
        logger.error(f"Error creating missing tables: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to create missing tables"
        } 