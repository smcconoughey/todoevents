#!/usr/bin/env python3
"""
Fix endpoints for privacy requests alias and premium invitation for existing users
"""

def fix_endpoints():
    # Read the file
    with open('backend.py', 'r') as f:
        content = f.read()

    # 1. Add alias for privacy requests endpoint
    privacy_alias = '''# Add alias for privacy requests endpoint (frontend expects /admin/privacy-requests)
@app.get("/admin/privacy-requests")
async def list_privacy_requests_alias(current_user: dict = Depends(get_current_user)):
    """
    Alias for privacy requests endpoint (frontend compatibility)
    """
    return await list_privacy_requests(current_user)

'''

    # Insert the alias before the existing endpoint
    existing_endpoint = '@app.get("/admin/privacy/requests")'
    if existing_endpoint in content:
        content = content.replace(existing_endpoint, privacy_alias + existing_endpoint)
        print('✅ Added privacy requests alias endpoint')
    else:
        print('❌ Could not find privacy requests endpoint')

    # 2. Fix premium invitation logic for existing users
    old_logic = '''            if existing_user:
                return {
                    "detail": "User already exists",
                    "user_exists": True,
                    "user_id": existing_user['id'],
                    "current_role": existing_user['role']
                }'''

    new_logic = '''            if existing_user:
                # For existing users, upgrade them to premium instead of returning error
                from datetime import datetime, timedelta
                expires_at = datetime.now() + timedelta(days=30 * request.months)
                
                # Update user to premium
                c.execute(f"""
                    UPDATE users 
                    SET role = 'premium', 
                        premium_expires_at = {placeholder},
                        premium_granted_by = {placeholder}
                    WHERE id = {placeholder}
                """, (expires_at, current_user['id'], existing_user['id']))
                
                conn.commit()
                
                # Log the activity
                log_activity(current_user['id'], "premium_invite_existing", f"Upgraded existing user {request.email} to {request.months} months premium")
                
                # Send premium notification email
                try:
                    from email_config import email_service
                    email_sent = email_service.send_premium_notification_email(
                        to_email=request.email,
                        user_name=existing_user.get('full_name'),
                        expires_at=expires_at.isoformat(),
                        granted_by=current_user.get('email', 'Admin')
                    )
                    
                    if email_sent:
                        logger.info(f"✅ Premium upgrade notification email sent to {request.email}")
                    else:
                        logger.error(f"❌ Failed to send premium upgrade notification email to {request.email}")
                except Exception as e:
                    logger.error(f"❌ Error sending premium upgrade notification email: {str(e)}")
                
                return {
                    "detail": f"Existing user upgraded to premium for {request.months} months",
                    "user_exists": True,
                    "user_id": existing_user['id'],
                    "previous_role": existing_user['role'],
                    "new_role": "premium",
                    "expires_at": expires_at.isoformat(),
                    "email": request.email,
                    "months": request.months
                }'''

    if old_logic in content:
        content = content.replace(old_logic, new_logic)
        print('✅ Updated premium invitation logic for existing users')
    else:
        print('❌ Could not find premium invitation logic')

    # Write back
    with open('backend.py', 'w') as f:
        f.write(content)

    print('✅ All fixes applied successfully')
    return True

if __name__ == "__main__":
    fix_endpoints() 