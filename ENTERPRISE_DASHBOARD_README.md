# Enterprise Dashboard for TodoEvents

A comprehensive client management and event organization dashboard designed for enterprise customers who manage hundreds of events for multiple clients and brands.

## 🚀 Features

### Client-Oriented Organization
- **Client Sidebar**: Lists all clients with active event counts for quick navigation
- **Client Filtering**: Filter events by specific client/brand across all views
- **Client Analytics**: Dedicated analytics and metrics broken down by client
- **Client Performance Tracking**: Monitor engagement rates and metrics per client

### Bulk Event Management
- **Enhanced Bulk Import**: Upload CSV/JSON files with client-specific event data
- **Event Export**: Download events in CSV or JSON format for offline editing
- **Template System**: Pre-built templates with client_name field for enterprise use
- **Batch Processing**: Handle up to 100 events per import for optimal performance

### Advanced Event Table
- **Sortable Columns**: Sort by date, client, status, views, and engagement
- **Quick Actions**: Edit, duplicate, and cancel events directly from the table
- **Bulk Selection**: Select multiple events for batch operations
- **Advanced Filtering**: Search across title, description, and location
- **Status Indicators**: Visual indicators for active vs. past events

### Client Analytics Overview
- **Performance Metrics**: Total views, engagement rates by client
- **Trend Analysis**: Charts showing event creation and engagement trends
- **Comparative Analytics**: Compare performance across different clients
- **Export Capabilities**: Download analytics as CSV or JSON

### Navigation & Layout
- **Persistent Sidebar**: Quick access to Overview, Clients, Events, Bulk Import, and Analytics
- **Search & Filter Bar**: Global search and filtering across large datasets
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## 📋 Database Schema Updates

The enterprise dashboard adds a new `client_name` field to the events table:

```sql
-- New field added to events table
ALTER TABLE events ADD COLUMN client_name TEXT;
```

This field is:
- Optional for regular users
- Available for enterprise and admin users
- Used for client-based organization and analytics
- Included in bulk import/export operations

## 🛠 API Endpoints

### Enterprise Authentication
All enterprise endpoints require enterprise or admin role:

```javascript
// Enterprise user authentication
GET /users/me
// Must return role: "enterprise" or "admin"
```

### Core Enterprise Endpoints

#### Overview Dashboard
```javascript
GET /enterprise/overview
// Returns: total events, clients, views, recent events
```

#### Client Management
```javascript
GET /enterprise/clients
// Returns: list of clients with event counts and metrics
```

#### Events Management
```javascript
GET /enterprise/events?client_filter=ClientName&status_filter=active&search=keyword&page=1&limit=50
// Returns: paginated events with filtering support

PUT /enterprise/events/{event_id}/duplicate
// Duplicates an event with "(Copy)" suffix

DELETE /enterprise/events/{event_id}
// Deletes an event (ownership verified)
```

#### Bulk Operations
```javascript
POST /enterprise/events/bulk-import
// Body: { "events": [event_objects_with_client_name] }
// Returns: success/error counts and details

GET /enterprise/events/export?format=csv&client_filter=ClientName
// Returns: CSV or JSON download of events
```

#### Analytics
```javascript
GET /enterprise/analytics/clients?start_date=2024-01-01&end_date=2024-12-31
// Returns: client performance metrics and trends data
```

## 📊 Event Schema for Enterprise

Enterprise events include all standard fields plus client organization:

```json
{
  "title": "Brand Marketing Event",
  "description": "Marketing showcase for our client",
  "date": "2024-07-15",
  "start_time": "14:00",
  "end_time": "22:00",
  "category": "marketing",
  "address": "Convention Center, New York, NY",
  "lat": 40.7829,
  "lng": -73.9654,
  "client_name": "Acme Corporation",
  "fee_required": "Free for invited guests",
  "event_url": "https://www.acmecorp.com/events",
  "host_name": "Acme Marketing Team",
  "recurring": false
}
```

### Required Fields
- `title`, `description`, `date`, `start_time`
- `category`, `address`, `lat`, `lng`

### Enterprise-Specific Fields
- `client_name`: Client/brand name for organization (optional)
- `host_name`: Organization hosting the event
- `event_url`: Event registration/details URL

## 🎯 Usage Guide

### Accessing the Enterprise Dashboard

1. **Login**: Use enterprise credentials at `/enterprise` or `/enterprise-dashboard`
2. **Role Verification**: System verifies enterprise or admin role
3. **Dashboard Access**: Redirected to enterprise dashboard interface

### Creating Events with Client Organization

1. **Standard Event Creation**: Use existing event creation flow
2. **Add Client Information**: Include `client_name` field in event data
3. **Automatic Organization**: Events automatically categorized by client

### Bulk Import Process

1. **Access Bulk Import**: Navigate to "Bulk Import" tab
2. **Use Template**: Copy the enterprise JSON template
3. **Add Client Data**: Include `client_name` for each event
4. **Validate & Import**: System validates and imports up to 100 events
5. **Review Results**: Check success/error counts and details

### Client Analytics

1. **View Clients**: Navigate to "Clients" tab for overview
2. **Performance Metrics**: Check engagement rates and event counts
3. **Detailed Analytics**: Use "Analytics" tab for comprehensive charts
4. **Export Data**: Download analytics as CSV or JSON for reporting

### Event Management

1. **Filter Events**: Use client, status, and search filters
2. **Sort Results**: Click column headers to sort by different criteria
3. **Bulk Actions**: Select multiple events for duplicate/delete operations
4. **Quick Actions**: Use inline buttons for individual event actions

## 🔧 Installation & Setup

### Backend Setup

1. **Database Migration**: The client_name field is automatically added during backend startup
2. **API Endpoints**: Enterprise endpoints are included in the main backend.py
3. **Authentication**: Uses existing JWT token system with role verification

### Frontend Setup

1. **Admin Dashboard**: Enterprise dashboard is included in the admin dashboard codebase
2. **Route Access**: Access via `/enterprise` or `/enterprise-dashboard` paths
3. **Component Loading**: Main.jsx automatically loads EnterpriseDashboard based on URL path

### Deployment

1. **Same Infrastructure**: Uses existing deployment infrastructure
2. **Role-Based Access**: Enterprise users automatically get access to enterprise features
3. **Backward Compatibility**: Regular users continue using standard interface

## 📈 Performance Considerations

### Database Optimization
- Indexed `client_name` field for fast filtering
- Optimized queries for large datasets
- Pagination for event listings (50 events per page)

### Frontend Performance
- Lazy loading for analytics charts
- Debounced search and filtering
- Efficient state management for large event lists

### API Efficiency
- Batch operations for bulk actions
- Compressed JSON responses
- Caching for frequently accessed data

## 🔐 Security Features

### Access Control
- Role-based authentication (enterprise/admin only)
- User ownership verification for event operations
- Secure token-based authentication

### Data Protection
- Input validation for all bulk operations
- SQL injection prevention
- XSS protection in frontend components

## 🎨 UI/UX Features

### Responsive Design
- Mobile-optimized layouts
- Touch-friendly controls
- Flexible grid systems

### User Experience
- Loading states for all operations
- Clear error messages and validation
- Consistent design patterns with admin dashboard

### Accessibility
- Keyboard navigation support
- Screen reader compatible
- High contrast mode support

## 🔮 Future Enhancements

### Planned Features
- **Team Collaboration**: Multi-user access for enterprise accounts
- **Advanced Reporting**: Scheduled analytics reports
- **API Integration**: Webhook support for external systems
- **White-Label Options**: Customizable branding for enterprise clients

### Scalability Improvements
- **Database Sharding**: Support for larger datasets
- **Caching Layer**: Redis integration for improved performance
- **CDN Integration**: Faster asset delivery
- **Background Processing**: Queue system for bulk operations

## 📞 Support

For enterprise dashboard support:
- Email: support@todo-events.com
- Documentation: This README and inline help
- Training: Available upon request for enterprise customers

## 🏗 Architecture

### Technology Stack
- **Backend**: Python FastAPI with PostgreSQL
- **Frontend**: React with Chart.js for visualizations
- **Authentication**: JWT tokens with role-based access
- **Deployment**: Render.com with environment-based configuration

### Design Patterns
- **Component-Based Architecture**: Reusable React components
- **RESTful API Design**: Consistent endpoint patterns
- **Responsive Layout**: Mobile-first design approach
- **Modular Structure**: Separate components for each feature area