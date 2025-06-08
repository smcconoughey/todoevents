# Analytics Dashboard - Grafana-Style Features

## Overview
The TodoEvents Admin Dashboard now includes comprehensive Grafana-style analytics with dynamic filtering, real-time charting, and advanced metrics tracking.

## Key Features

### 📊 Metrics Dashboard
- **Total Events**: Filtered event count
- **Total Users**: Current user count  
- **Active Hosts**: Users with events in last 30 days
- **Host Rate**: Percentage of active event creators

### 📈 Interactive Charts
- **Line Charts**: Time series for events, users, active hosts
- **Bar Charts**: Geographic distribution by state
- **Pie Charts**: Category and role distributions
- **Real-time Updates**: Auto-refresh every minute

### 🎯 Advanced Filtering
- **Time Frames**: 7d, 30d, 90d, this week/month
- **Custom Dates**: Start/end date pickers
- **Category Filter**: Filter by event category
- **User Exclusion**: Exclude specific user IDs
- **Chart Periods**: Daily, weekly, monthly aggregation

### 🌍 Geographic Analytics
- **State Distribution**: Events by US state
- **Top Cities**: Most active cities ranked
- **Visual Charts**: Bar graphs and lists

### 🏆 Top Hosts Leaderboard
- **Event Creators**: Ranked by event count
- **Performance Stats**: First/latest event dates
- **Interactive Table**: Sortable columns

## Technical Implementation

### Backend Endpoints
- `/admin/analytics/metrics` - Core metrics with filtering
- `/admin/analytics/time-series` - Time series data
- `/admin/analytics/top-hosts` - Top event creators
- `/admin/analytics/geographic` - Geographic distribution

### Frontend Stack
- **Chart.js + React-Chartjs-2**: Interactive charts
- **Date-fns**: Date manipulation
- **Tailwind CSS**: Responsive styling
- **Lucide React**: Icons

## Usage

1. **Access**: Admin Dashboard → Analytics tab
2. **Filter**: Select time frame, category, exclude users
3. **Interact**: Hover charts, toggle metrics, auto-refresh
4. **Export**: View top hosts table, geographic data

## Performance Features
- Server-side aggregation
- Query result caching  
- Responsive design
- Debounced filter updates
- Lazy chart loading

## Filtering Capabilities

### Time Frame Filters
- **Presets**: Last 7/30/90 days, this week, this month
- **Custom Range**: Start and end date pickers
- **Real-time**: Instant chart updates

### Advanced Filters
- **Category Filter**: Focus on specific event categories
- **User Exclusion**: Exclude specific user IDs from analytics
- **Metric Selection**: Choose which metrics to display in charts

### Chart Controls
- **Period Selection**: Daily, weekly, monthly aggregation
- **Metric Selection**: Toggle different metrics on/off
- **Auto-refresh**: Automatic data updates every minute

## Customization Options

### Chart Themes
```javascript
const chartTheme = {
  colors: {
    primary: '#3B82F6',    // Blue
    secondary: '#10B981',  // Green  
    accent: '#F59E0B',     // Yellow
    danger: '#EF4444',     // Red
    purple: '#8B5CF6',     // Purple
    pink: '#EC4899',       // Pink
    teal: '#14B8A6',       // Teal
    orange: '#F97316'      // Orange
  }
};
```

### Filter Presets
```javascript
const timeFramePresets = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days', 
  '90d': 'Last 90 days',
  'thisWeek': 'This week',
  'thisMonth': 'This month'
};
```

## Troubleshooting

### Common Issues

1. **Charts not loading**
   - Check API endpoint availability
   - Verify authentication token
   - Check browser console for errors

2. **Data appears outdated**
   - Click refresh button
   - Enable auto-refresh
   - Check date range filters

3. **Performance issues**
   - Reduce date range
   - Limit metrics selection
   - Use weekly/monthly aggregation

### API Errors
- **403 Forbidden**: Admin role required
- **500 Server Error**: Check backend logs
- **Network Error**: Verify API URL configuration

## Future Enhancements

### Planned Features
- **Export Functionality**: CSV/PDF exports
- **Dashboard Sharing**: Shareable dashboard links
- **Alert System**: Metric threshold alerts
- **Custom Metrics**: User-defined calculations
- **Real-time Updates**: WebSocket integration

### Advanced Analytics
- **Cohort Analysis**: User retention tracking
- **Funnel Analysis**: Event creation workflow
- **Predictive Models**: ML-based forecasting
- **A/B Testing**: Feature comparison analytics

## API Reference

### Authentication
All analytics endpoints require admin authentication:
```
Authorization: Bearer <admin_token>
```

### Query Parameters

#### Common Filters
- `start_date`: ISO date string (YYYY-MM-DD)
- `end_date`: ISO date string (YYYY-MM-DD)
- `exclude_users`: Comma-separated user IDs
- `category`: Event category filter

#### Time Series Specific
- `metric`: events, users, active_hosts
- `period`: daily, weekly, monthly

#### Top Hosts Specific
- `limit`: Number of hosts to return (default: 10)

### Response Formats

#### Metrics Response
```json
{
  "total_events": 150,
  "total_users": 75,
  "active_hosts": 25,
  "events_by_category": {
    "music": 45,
    "food": 35,
    "sports": 25
  },
  "user_roles": {
    "user": 70,
    "admin": 5
  },
  "events_trend": {
    "2024-01-01": 5,
    "2024-01-02": 8
  },
  "filters_applied": {
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "excluded_users": [1, 2],
    "category": "music"
  }
}
```

#### Time Series Response
```json
{
  "metric": "events",
  "period": "daily",
  "date_label": "Date",
  "data": [
    {"period": "2024-01-01", "count": 5},
    {"period": "2024-01-02", "count": 8}
  ],
  "filters_applied": {}
}
```

## Development Setup

### Prerequisites
- Node.js 18+
- Admin authentication
- Backend API running

### Installation
```bash
cd admin
npm install
npm run dev
```

### Environment Variables
```bash
VITE_API_URL=https://todoevents.onrender.com
```

## Contributing

When adding new analytics features:

1. **Backend**: Add endpoint to `backend.py`
2. **Frontend**: Update `AdminDashboard.jsx`
3. **Documentation**: Update this README
4. **Testing**: Test with various filter combinations

### Code Style
- Follow existing Chart.js patterns
- Use Tailwind CSS classes
- Implement proper error handling
- Add loading states for async operations 