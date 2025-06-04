# TodoEvents Bulk Import Guide

## Overview
The Admin Bulk Import feature allows administrators to efficiently import multiple events at once using JSON format. This feature is designed for large-scale event uploads while maintaining data integrity and providing detailed feedback.

## Accessing Bulk Import

1. Log in to the Admin Dashboard
2. Navigate to the "Bulk Operations" tab
3. Use the Bulk Event Import section

## Features

### ✅ Enhanced Template System
- Pre-built JSON template with 12 diverse event examples
- All categories represented (food-drink, music, arts, sports, automotive, airshows, vehicle-sports, community, religious, education, veteran, cookout, graduation, networking)
- UX enhancement fields included (fee_required, event_url, host_name)
- One-click template copying

### ✅ Smart Validation
- Client-side JSON structure validation
- Required field verification before submission
- Batch size limit (100 events max per import)
- Real-time character count
- Duplicate detection (server-side)

### ✅ Robust Error Handling
- Detailed error messages with field-specific feedback
- Validation errors shown before API submission
- Per-event error tracking with index numbers
- Graceful handling of partial failures

### ✅ Progress Tracking
- Loading states with spinner animation
- Success/error counts displayed prominently
- Detailed results breakdown
- Only clears input on complete success

## JSON Structure

### Required Format
```json
{
  "events": [
    {
      "title": "Event Name",
      "description": "Event description...",
      "date": "2024-07-15",
      "start_time": "14:00",
      "category": "music",
      "address": "123 Main St, City, State, Country",
      "lat": 40.7829,
      "lng": -73.9654
    }
  ]
}
```

### Required Fields
- `title` - Event title (string)
- `description` - Event description (string) 
- `date` - Event date in YYYY-MM-DD format
- `start_time` - Start time in HH:MM (24-hour format)
- `category` - Valid category ID (see categories below)
- `address` - Full address string
- `lat` - Latitude (float, 6 decimal places recommended)
- `lng` - Longitude (float, 6 decimal places recommended)

### Optional Fields
- `end_time` - End time in HH:MM format
- `end_date` - End date (for multi-day events)
- `recurring` - Boolean (true/false)
- `frequency` - "weekly" or "monthly" (if recurring is true)

### UX Enhancement Fields
- `fee_required` - Pricing/fee information (e.g., "Free admission", "$25 general admission")
- `event_url` - External website URL for registration or details
- `host_name` - Organization or host name

### Auto-Generated Fields
The system automatically generates these SEO and organizational fields:
- `slug` - URL-friendly slug based on title and city (e.g., "coffee-competition-orlando")
- `short_description` - Truncated description for previews (160 characters max)
- `city`, `state` - Extracted from address using smart parsing
- `price` - Normalized from fee_required (converts "$25 admission" to 25.0)
- `start_datetime`, `end_datetime` - Combined date/time fields with timezone info

**Note**: These fields are generated using the same logic as frontend event creation, ensuring consistency across all event creation methods.

## Valid Categories

- `food-drink` - Food & Drink events
- `music` - Music events and concerts
- `arts` - Arts and cultural events
- `sports` - Sports and fitness events
- `automotive` - Car shows and automotive events
- `airshows` - Aviation events and airshows
- `vehicle-sports` - Racing and vehicle sports
- `community` - Community gatherings
- `religious` - Religious events
- `education` - Educational workshops and tech events
- `veteran` - Veteran-related events
- `cookout` - BBQs and cookout events
- `graduation` - Graduation celebrations
- `networking` - Professional networking events

## Backend Processing

### Database Integration
- Uses centralized database schema helpers
- Supports both SQLite (development) and PostgreSQL (production)
- Automatic coordinate rounding for consistency
- Transaction-based processing for data integrity

### Duplicate Prevention
Duplicates are detected using:
- Exact title match (case-insensitive, trimmed)
- Same date and start time
- Same coordinates (within 0.000001 degrees)
- Same category

### SEO Auto-Population
Each imported event automatically gets:
- **URL-friendly slug generation** - Creates SEO-friendly URLs like `/e/coffee-competition-orlando`
- **Unique slug enforcement** - Handles duplicates with ID suffixes like `/e/coffee-competition-orlando-175`
- **Database compatibility** - Works correctly with both PostgreSQL (production) and SQLite (local)
- **City/state extraction** - Automatically parses address to extract location data
- **Price normalization** - Converts fee descriptions to structured pricing data
- **Short description generation** - Creates 160-character previews for search engines
- **Same processing as frontend** - Uses identical logic to individual event creation

## Performance & Limits

- **Batch Size**: Maximum 100 events per import
- **Processing**: Each event processed in individual transactions
- **Validation**: Client-side validation before API submission
- **Cache**: Event cache automatically cleared after successful imports
- **Logging**: Comprehensive server-side logging for debugging

## Error Handling

### Client-Side Validation
- JSON syntax validation
- Required field presence check
- Structure validation (events array presence)
- Batch size enforcement

### Server-Side Processing
- Individual event transaction handling
- Duplicate detection and prevention
- Field validation with detailed error messages
- Graceful rollback on individual event failures

### Error Response Format
```json
{
  "success_count": 5,
  "error_count": 2,
  "errors": [
    {
      "index": 2,
      "event_title": "Event Name",
      "error": "Duplicate event - event with these exact details already exists"
    }
  ],
  "created_events": [...]
}
```

## Best Practices

### Data Preparation
1. **Coordinates**: Use precise lat/lng coordinates (6 decimal places)
2. **Addresses**: Use complete addresses including city, state, country
3. **Times**: Use 24-hour format (14:30 not 2:30 PM)
4. **Dates**: Use YYYY-MM-DD format consistently
5. **Categories**: Double-check category names against valid list

### Import Strategy
1. **Small Batches**: Start with 10-20 events for testing
2. **Review Template**: Use provided template as reference
3. **Validate First**: Check JSON syntax before importing
4. **Monitor Results**: Review success/error counts after each import
5. **Gradual Scale**: Increase batch size after successful smaller imports

### Error Resolution
1. **Fix Errors**: Address validation errors before retrying
2. **Partial Success**: Remove successful events from JSON before retrying failures
3. **Duplicate Handling**: Check for existing events if getting duplicate errors
4. **Format Issues**: Verify JSON syntax and structure

## Production Considerations

### Database Schema
- Production uses PostgreSQL with full schema support
- All UX enhancement fields are properly configured
- SEO fields are auto-populated and indexed
- Interest and view tracking tables are initialized

### Performance Monitoring
- Server logs track import performance
- Individual event processing times monitored
- Database transaction efficiency measured
- Cache invalidation timing optimized

### Security
- Admin-only endpoint with role verification
- Token-based authentication required
- Input sanitization and validation
- SQL injection prevention through parameterized queries

## Troubleshooting

### Common Issues

**"JSON must contain an events array"**
- Ensure your JSON has the correct structure with an "events" key containing an array

**"Missing required fields"**
- Verify all required fields are present and not empty
- Check field names match exactly (case-sensitive)

**"Duplicate event detected"**
- Check if event already exists with same details
- Modify title, date, time, or location slightly if needed

**"Invalid category"**
- Use only valid category IDs from the supported list
- Check spelling and case-sensitivity

**"Invalid coordinates"**
- Ensure lat/lng are valid numbers within reasonable ranges
- Lat: -90 to 90, Lng: -180 to 180

### Support
For technical issues or questions:
1. Check server logs for detailed error information
2. Verify API connectivity and authentication
3. Test with smaller batch sizes
4. Contact system administrator with specific error messages

## Version History

**v2.0** (Current)
- Enhanced validation with client-side checks
- Improved error messaging and formatting
- Updated template with all categories
- Added UX enhancement fields support
- Better progress tracking and user feedback
- Batch size optimization and limits

**v1.0** (Previous)
- Basic bulk import functionality
- Simple JSON template
- Limited error handling
- Basic duplicate detection 