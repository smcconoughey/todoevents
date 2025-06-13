#!/usr/bin/env python3
"""
Fix the premium users endpoint to handle missing columns gracefully
"""

def fix_premium_endpoint():
    # Read the backend file
    with open('backend.py', 'r') as f:
        content = f.read()

    # Find and replace the problematic query
    old_query = '''            # Get all users with premium role or premium expiration
            c.execute(f"""
                SELECT u.id, u.email, u.role, u.created_at,
                       u.premium_expires_at, u.premium_granted_by, u.premium_invited,
                       admin.email as granted_by_email
                FROM users u
                LEFT JOIN users admin ON u.premium_granted_by = admin.id
                WHERE u.role = 'premium' OR u.premium_expires_at IS NOT NULL
                ORDER BY u.premium_expires_at DESC NULLS LAST, u.created_at DESC
            """)'''

    new_query = '''            # Check if premium columns exist first
            try:
                if IS_PRODUCTION and DB_URL:
                    c.execute("""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name = 'users' 
                        AND column_name IN ('premium_expires_at', 'premium_granted_by', 'premium_invited')
                    """)
                    existing_columns = [row[0] for row in c.fetchall()]
                else:
                    c.execute('PRAGMA table_info(users)')
                    columns_info = c.fetchall()
                    existing_columns = [col[1] for col in columns_info if col[1] in ['premium_expires_at', 'premium_granted_by', 'premium_invited']]
                
                has_premium_columns = len(existing_columns) >= 1
            except Exception as e:
                logger.warning(f"Could not check premium columns: {e}")
                has_premium_columns = False
            
            # Use appropriate query based on available columns
            if has_premium_columns:
                try:
                    c.execute(f"""
                        SELECT u.id, u.email, u.role, u.created_at,
                               u.premium_expires_at, u.premium_granted_by, u.premium_invited,
                               admin.email as granted_by_email
                        FROM users u
                        LEFT JOIN users admin ON u.premium_granted_by = admin.id
                        WHERE u.role = 'premium' OR u.premium_expires_at IS NOT NULL
                        ORDER BY u.premium_expires_at DESC NULLS LAST, u.created_at DESC
                    """)
                except Exception as e:
                    logger.warning(f"Full query failed, falling back to simple query: {e}")
                    has_premium_columns = False
            
            if not has_premium_columns:
                # Fallback to simple query
                c.execute(f"""
                    SELECT u.id, u.email, u.role, u.created_at
                    FROM users u
                    WHERE u.role = 'premium'
                    ORDER BY u.created_at DESC
                """)'''

    # Replace the query
    if old_query in content:
        content = content.replace(old_query, new_query)
        print('✅ Updated premium users query')
    else:
        print('❌ Could not find exact match for premium users query')
        return False

    # Also update the response processing
    old_processing = '''            users = []
            for row in c.fetchall():
                user_dict = dict(row)
                # Check if premium is expired
                if user_dict['premium_expires_at']:
                    from datetime import datetime
                    expires_at = datetime.fromisoformat(user_dict['premium_expires_at'].replace('Z', '+00:00')) if isinstance(user_dict['premium_expires_at'], str) else user_dict['premium_expires_at']
                    user_dict['is_expired'] = expires_at < datetime.now()
                else:
                    user_dict['is_expired'] = False
                users.append(user_dict)
            
            return {"users": users}'''

    new_processing = '''            users = []
            for row in c.fetchall():
                user_dict = dict(row)
                
                # Add default values for missing columns
                if 'premium_expires_at' not in user_dict:
                    user_dict['premium_expires_at'] = None
                if 'premium_granted_by' not in user_dict:
                    user_dict['premium_granted_by'] = None
                if 'premium_invited' not in user_dict:
                    user_dict['premium_invited'] = False
                if 'granted_by_email' not in user_dict:
                    user_dict['granted_by_email'] = None
                
                # Check if premium is expired
                if user_dict['premium_expires_at']:
                    try:
                        from datetime import datetime
                        expires_at = datetime.fromisoformat(user_dict['premium_expires_at'].replace('Z', '+00:00')) if isinstance(user_dict['premium_expires_at'], str) else user_dict['premium_expires_at']
                        user_dict['is_expired'] = expires_at < datetime.now()
                    except:
                        user_dict['is_expired'] = False
                else:
                    user_dict['is_expired'] = False
                
                users.append(user_dict)
            
            return {
                "users": users,
                "has_premium_columns": has_premium_columns,
                "note": "Some premium features may be limited until database migration is complete" if not has_premium_columns else None
            }'''

    if old_processing in content:
        content = content.replace(old_processing, new_processing)
        print('✅ Updated response processing')
    else:
        print('❌ Could not find exact match for response processing')

    # Write the updated content back
    with open('backend.py', 'w') as f:
        f.write(content)

    print('✅ Backend file updated successfully')
    return True

if __name__ == "__main__":
    fix_premium_endpoint() 