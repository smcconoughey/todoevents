# Enterprise Dashboard Deployment Guide

## Quick Deployment Steps

### 1. Database Schema Migration
```bash
# Add the client_name field to existing events table
curl -X POST "https://your-backend-url.com/enterprise/migrate-client-field" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 2. User Role Setup
Ensure enterprise users have the proper role:
```sql
-- Update user roles to 'enterprise' for enterprise customers
UPDATE users SET role = 'enterprise' WHERE email IN (
  'enterprise-user@company.com',
  'another-enterprise@company.com'
);
```

### 3. Access the Enterprise Dashboard
- Navigate to: `https://your-admin-dashboard-url.com`
- Login with enterprise credentials
- The system will automatically redirect to the enterprise dashboard for users with `enterprise` or `admin` roles

### 4. Test Core Functionality

#### Test Client Organization
1. Create events with `client_name` field populated
2. Verify client filtering works in the Events tab
3. Check client analytics appear in the Analytics tab

#### Test Bulk Operations
1. Go to Bulk Import tab
2. Use the enterprise template with `client_name` fields
3. Import a small batch of test events
4. Export events and verify CSV/JSON downloads work

#### Test Advanced Features
1. Sort events by different columns
2. Use persistent search and filter bar
3. Test event duplication and deletion
4. Verify pagination works with large datasets

## Environment Variables
No additional environment variables needed - the enterprise dashboard uses existing TodoEvents configuration.

## Troubleshooting

### Issue: "client_name field doesn't exist"
**Solution**: Run the migration endpoint:
```bash
curl -X POST "https://your-backend-url.com/enterprise/migrate-client-field" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Issue: "Not authorized" errors
**Solution**: Verify user role is set to 'enterprise' or 'admin':
```sql
SELECT email, role FROM users WHERE email = 'your-enterprise-user@email.com';
```

### Issue: Export downloads not working
**Solution**: Ensure proper CORS and file download headers are configured in your deployment environment.

## Production Considerations

### Performance
- The system is optimized for hundreds of events
- Pagination is set to 50 events per page for optimal performance
- Database queries use proper indexing

### Security
- All enterprise endpoints require authentication
- Users can only access their own events
- Role-based access control enforced

### Monitoring
- Monitor the new enterprise endpoints for performance
- Track client_name field usage for adoption metrics
- Set up alerts for bulk import operations

## Success Verification

✅ **Database Migration**: client_name field exists in events table  
✅ **Role Assignment**: Enterprise users have proper roles  
✅ **Dashboard Access**: Enterprise users can access the dashboard  
✅ **Client Organization**: Events can be organized by client  
✅ **Bulk Operations**: Import/export functionality works  
✅ **Analytics**: Client performance metrics display correctly  

The enterprise dashboard is now ready for production use!