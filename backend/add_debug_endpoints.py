#!/usr/bin/env python3
"""
Add debug endpoints for users schema and premium columns creation
"""

def add_debug_endpoints():
    # Read the file
    with open('backend.py', 'r') as f:
        content = f.read()

    # Debug endpoints to add
    debug_endpoints = '''
@app.get("/debug/users-schema")
async def debug_users_schema():
    """Debug endpoint to check users table schema"""
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            if IS_PRODUCTION and DB_URL:
                # PostgreSQL - get users table columns
                c.execute("""
                    SELECT column_name, data_type, is_nullable, column_default 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' 
                    ORDER BY ordinal_position
                """)
                users_columns = c.fetchall()
                
                # Check specifically for premium columns
                c.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' 
                    AND column_name IN ('premium_expires_at', 'premium_granted_by', 'premium_invited')
                """)
                premium_columns = [row[0] for row in c.fetchall()]
                
            else:
                # SQLite - get users table columns
                c.execute('PRAGMA table_info(users)')
                users_columns = c.fetchall()
                premium_columns = [col[1] for col in users_columns if col[1] in ['premium_expires_at', 'premium_granted_by', 'premium_invited']]
            
            return {
                "database_type": "postgresql" if IS_PRODUCTION and DB_URL else "sqlite",
                "users_table": {
                    "columns": users_columns,
                    "total_columns": len(users_columns)
                },
                "premium_columns": {
                    "found": premium_columns,
                    "missing": [col for col in ['premium_expires_at', 'premium_granted_by', 'premium_invited'] if col not in premium_columns],
                    "has_all_premium_columns": len(premium_columns) == 3
                }
            }
            
    except Exception as e:
        logger.error(f"Users schema debug error: {str(e)}")
        return {"error": str(e), "traceback": traceback.format_exc()}

@app.post("/debug/create-premium-columns")
async def create_premium_columns():
    """Debug endpoint to create premium columns in production"""
    try:
        logger.info("🚀 Starting premium columns creation...")
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Add premium columns to users table
            columns_to_add = [
                ("premium_expires_at", "TIMESTAMP"),
                ("premium_granted_by", "INTEGER"),
                ("premium_invited", "BOOLEAN DEFAULT FALSE")
            ]
            
            results = []
            for column_name, column_type in columns_to_add:
                try:
                    if IS_PRODUCTION and DB_URL:
                        # PostgreSQL
                        cursor.execute(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {column_name} {column_type}")
                    else:
                        # SQLite
                        cursor.execute(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}")
                    
                    results.append(f"✅ Added {column_name}")
                    logger.info(f"✅ Added column: {column_name}")
                    
                except Exception as e:
                    if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                        results.append(f"ℹ️ {column_name} already exists")
                        logger.info(f"ℹ️ Column {column_name} already exists")
                    else:
                        results.append(f"❌ Failed to add {column_name}: {str(e)}")
                        logger.error(f"❌ Failed to add {column_name}: {str(e)}")
            
            conn.commit()
            
            # Verify columns were created
            if IS_PRODUCTION and DB_URL:
                cursor.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'users' 
                    AND column_name IN ('premium_expires_at', 'premium_granted_by', 'premium_invited')
                """)
                created_columns = [row[0] for row in cursor.fetchall()]
            else:
                cursor.execute('PRAGMA table_info(users)')
                columns_info = cursor.fetchall()
                created_columns = [col[1] for col in columns_info if col[1] in ['premium_expires_at', 'premium_granted_by', 'premium_invited']]
            
            return {
                "success": True,
                "message": "Premium columns creation completed",
                "results": results,
                "created_columns": created_columns,
                "all_columns_present": len(created_columns) == 3
            }
            
    except Exception as e:
        logger.error(f"Error creating premium columns: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to create premium columns"
        }
'''

    # Find where to insert the debug endpoints (after existing debug endpoints)
    insert_point = '@app.get("/debug/privacy-requests-table")'
    if insert_point in content:
        content = content.replace(insert_point, debug_endpoints + '\n' + insert_point)
        print('✅ Added debug endpoints for users schema and premium columns')
    else:
        print('❌ Could not find insertion point for debug endpoints')
        return False

    # Write back
    with open('backend.py', 'w') as f:
        f.write(content)

    print('✅ Debug endpoints added successfully')
    return True

if __name__ == "__main__":
    add_debug_endpoints() 