# Bulk Event Import Guide

## Overview

The todo-events admin dashboard now includes a powerful bulk event import feature that allows administrators to create multiple events at once using JSON data. This feature is designed to streamline the process of adding large numbers of events to the system.

## Access Requirements

- **Admin Access Only**: Only users with admin role can access the bulk import functionality
- **Authentication**: Must be logged in to the admin dashboard with valid admin credentials

## How to Access

1. Log in to the admin dashboard at `/admin`
2. Navigate to the **"Bulk Import"** tab in the sidebar
3. The bulk import interface will be displayed

## JSON Format Requirements

### Basic Structure
```json
{
  "events": [
    {
      "title": "Event Title",
      "description": "Event description",
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "category": "category_name",
      "address": "Full address",
      "lat": 40.7829,
      "lng": -73.9654
    }
  ]
}
```

### Required Fields
- `title` (string): Event title
- `description` (string): Event description  
- `date` (string): Event date in YYYY-MM-DD format
- `start_time` (string): Start time in 24-hour HH:MM format
- `category` (string): Event category (see valid categories below)
- `address` (string): Full event address
- `lat` (number): Latitude coordinate
- `lng` (number): Longitude coordinate

### Optional Fields
- `end_time` (string): End time in 24-hour HH:MM format
- `end_date` (string): End date in YYYY-MM-DD format (for multi-day events)
- `recurring` (boolean): Whether the event is recurring (default: false)
- `frequency` (string): Recurrence frequency (if recurring is true)

### Valid Categories
- `food-drink`: Food and beverage events
- `music`: Concerts and musical performances
- `arts`: Art shows and cultural events
- `sports`: Sports events and recreational activities
- `community`: Community gatherings and social events

## Example JSON

```json
{
  "events": [
    {
      "title": "Summer Music Festival",
      "description": "Join us for an amazing outdoor music festival featuring local and international artists.",
      "date": "2024-07-15",
      "start_time": "18:00",
      "end_time": "23:30",
      "end_date": "2024-07-15",
      "category": "music",
      "address": "Central Park, New York, NY 10024, USA",
      "lat": 40.7829,
      "lng": -73.9654,
      "recurring": false,
      "frequency": null
    },
    {
      "title": "Food Truck Rally",
      "description": "Delicious food from various food trucks gathered in one location.",
      "date": "2024-07-20",
      "start_time": "11:00",
      "end_time": "20:00",
      "category": "food-drink",
      "address": "Brooklyn Bridge Park, Brooklyn, NY 11201, USA",
      "lat": 40.7010,
      "lng": -73.9969,
      "recurring": false,
      "frequency": null
    },
    {
      "title": "Weekly Art Class",
      "description": "Learn painting techniques in this weekly recurring class.",
      "date": "2024-07-10",
      "start_time": "14:00",
      "end_time": "16:00",
      "category": "arts",
      "address": "Community Art Center, 123 Main St, Anytown, USA",
      "lat": 40.7580,
      "lng": -73.9855,
      "recurring": true,
      "frequency": "weekly"
    }
  ]
}
```

## How to Use

### Step 1: Prepare Your Data
1. Gather all event information you want to import
2. Format the data according to the JSON structure above
3. Validate that all required fields are included
4. Ensure coordinates are accurate (you can use Google Maps to get lat/lng)

### Step 2: Import Process
1. Navigate to the **Bulk Import** tab in the admin dashboard
2. Paste your JSON data into the text area
3. Optionally, click **"Show Example"** to see the correct format
4. Click **"Import Events"** to start the process
5. Wait for the import to complete

### Step 3: Review Results
The system will display:
- **Success Count**: Number of events successfully created
- **Error Count**: Number of events that failed to import
- **Error Details**: Specific error messages for failed imports
- **Created Events**: List of successfully imported events with their IDs

## Common Errors and Solutions

### 1. Invalid JSON Format
**Error**: `Invalid JSON format`
**Solution**: Validate your JSON using an online JSON validator

### 2. Missing Required Fields
**Error**: `Field required`
**Solution**: Ensure all required fields are present for each event

### 3. Invalid Date Format
**Error**: `Invalid date format`
**Solution**: Use YYYY-MM-DD format (e.g., 2024-07-15)

### 4. Invalid Time Format
**Error**: `Invalid time format`
**Solution**: Use 24-hour HH:MM format (e.g., 18:00 for 6:00 PM)

### 5. Invalid Category
**Error**: `Invalid category`
**Solution**: Use one of the valid categories: food-drink, music, arts, sports, community

### 6. Duplicate Events
**Error**: `Duplicate event - event with these exact details already exists`
**Solution**: This is expected behavior - events with identical title, date, time, and location will be skipped

### 7. Invalid Coordinates
**Error**: `Invalid coordinates`
**Solution**: Ensure lat/lng values are valid decimal numbers within proper ranges

## Best Practices

### Data Preparation
1. **Verify Addresses**: Ensure all addresses are complete and accurate
2. **Check Coordinates**: Use a tool like Google Maps to get precise lat/lng values
3. **Validate Categories**: Double-check that all categories match the allowed values
4. **Date Consistency**: Ensure all dates are in the future and properly formatted
5. **Time Validation**: Verify start times are before end times

### Import Strategy
1. **Test Small Batches**: Start with a few events to test your JSON format
2. **Backup Data**: Keep a backup copy of your JSON data
3. **Monitor Results**: Carefully review the import results for any errors
4. **Handle Errors**: Address any errors and re-import failed events if needed

### Performance Considerations
1. **Batch Size**: For large imports (100+ events), consider breaking into smaller batches
2. **Server Load**: Avoid importing during peak usage times
3. **Validation**: Pre-validate your data to minimize errors during import

## API Endpoint Details

The bulk import feature uses the following API endpoint:

**Endpoint**: `POST /admin/events/bulk`
**Authentication**: Bearer token (admin role required)
**Content-Type**: `application/json`

**Request Body**:
```json
{
  "events": [
    // Array of event objects
  ]
}
```

**Response**:
```json
{
  "success_count": 2,
  "error_count": 0,
  "errors": [],
  "created_events": [
    // Array of created event objects with IDs
  ]
}
```

## Security Features

1. **Admin-Only Access**: Only administrators can use the bulk import feature
2. **Duplicate Prevention**: System automatically prevents duplicate events
3. **Data Validation**: All event data is validated before insertion
4. **Transaction Safety**: Each event is processed in its own transaction
5. **Error Isolation**: Errors in one event don't affect others

## Troubleshooting

### If Import Fails Completely
1. Check your admin authentication status
2. Verify the JSON format is valid
3. Ensure the "events" array exists and is not empty
4. Check browser console for detailed error messages

### If Some Events Fail
1. Review the error details in the results section
2. Fix the problematic events in your JSON
3. Re-import only the failed events

### If Import is Slow
1. Reduce batch size
2. Check server performance
3. Ensure database connectivity is stable

## Support

If you encounter issues with the bulk import feature:

1. Check this guide for common solutions
2. Verify your JSON format matches the examples
3. Review error messages carefully
4. Test with a smaller batch to isolate issues
5. Contact technical support if problems persist

## Version History

- **v1.0**: Initial implementation with basic bulk import functionality
- Added comprehensive error handling and validation
- Included duplicate detection and prevention
- Integrated with existing admin dashboard 