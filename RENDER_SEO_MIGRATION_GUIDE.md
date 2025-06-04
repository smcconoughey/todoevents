# Render Production SEO Migration Guide

This guide explains how to migrate all existing events in the production database to populate missing SEO fields, especially slugs.

## Overview

The production database on Render may have events that are missing key SEO fields:
- `slug` - URL-friendly identifier
- `city` / `state` - Geographic information
- `price` - Normalized pricing
- `start_datetime` / `end_datetime` - ISO formatted timestamps  
- `short_description` - SEO-optimized descriptions

## Migration Options

### Option 1: API Endpoint (Recommended)

Use the REST API endpoints to trigger the migration:

#### Background Migration (Non-blocking)
```bash
curl -X POST https://your-render-app.onrender.com/api/seo/migrate-events \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "message": "Production SEO migration started in background",
  "status": "processing",
  "info": "Processing all existing events to populate missing SEO fields including slugs"
}
```

#### Synchronous Migration (With Results)
```bash
curl -X POST https://your-render-app.onrender.com/api/seo/migrate-events-sync \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "success": true,
  "message": "Production SEO migration completed successfully",
  "result": {
    "success": true,
    "updated_count": 150,
    "total_processed": 150,
    "total_in_database": 500,
    "errors": [],
    "final_stats": {
      "total": 500,
      "with_slug": 500,
      "with_city": 450,
      "with_state": 450,
      "with_price": 500,
      "with_start_datetime": 500,
      "with_short_description": 500
    }
  }
}
```

### Option 2: Render Shell Access

If you have shell access to your Render deployment:

```bash
# Navigate to backend directory
cd /opt/render/project/src/backend

# Run the migration script directly
python production_seo_migration.py
```

### Option 3: Deployment Script

Add the migration to your deployment process by adding this to your `render.yaml` or startup script:

```yaml
services:
  - type: web
    name: todoevents-backend
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: |
      python production_seo_migration.py &&
      python backend.py
```

## What the Migration Does

### 1. Database Connection
- Automatically detects PostgreSQL (production) vs SQLite (local)
- Uses `DATABASE_URL` environment variable on Render
- Handles both `postgres://` and `postgresql://` URL schemes

### 2. SEO Field Population

For each event missing SEO fields:

#### Slug Generation
```python
# Example: "Community Garden Workshop" + "Ann Arbor" 
# Becomes: "community-garden-workshop-ann-arbor"
```

#### Geographic Extraction
```python
# From: "123 Main St, Ann Arbor, MI, USA"
# Extracts: city="Ann Arbor", state="MI"
```

#### Price Normalization
```python
# From: "$15 suggested donation"
# Extracts: price=15.0
# From: "Free event"
# Extracts: price=0.0
```

#### DateTime Generation
```python
# From: date="2025-06-15", start_time="14:30"
# Creates: start_datetime="2025-06-15T14:30:00-04:00"
```

#### Short Description
```python
# From: "This is a very long description..."
# Creates: "This is a very long description that gets truncated..."
# (Max 160 characters, word boundary)
```

### 3. Unique Slug Handling
- Ensures all slugs are unique
- Appends numbers if duplicates exist
- Example: `event-title`, `event-title-2`, `event-title-3`

## Migration Safety

### Idempotent Operation
- Can be run multiple times safely
- Only updates events missing fields
- Preserves existing data

### Error Handling
- Continues processing if individual events fail
- Logs all errors for review
- Commits successful updates even if some fail

### Performance
- Processes events in batches
- Shows progress every 10 events
- Optimized for large datasets

## Monitoring the Migration

### Check Migration Status
```bash
curl https://your-render-app.onrender.com/api/seo/validate/EVENT_ID
```

### View Final Statistics
The migration provides comprehensive statistics:
- Total events processed
- Success/failure counts
- Completion percentages for each field
- Detailed error reporting

## Post-Migration Verification

### 1. Check Event URLs
New events will have SEO-friendly URLs:
```
https://todo-events.com/us/mi/ann-arbor/events/community-garden-workshop
```

### 2. Verify SEO Fields
```bash
curl https://your-render-app.onrender.com/api/seo/events/EVENT_ID
```

### 3. Test Sitemap
```bash
curl https://your-render-app.onrender.com/api/seo/sitemap/events
```

## Troubleshooting

### Common Issues

#### 1. PostgreSQL Connection Error
```
psycopg2.OperationalError: connection to server failed
```
**Solution**: Verify `DATABASE_URL` environment variable is set correctly in Render.

#### 2. Column Not Found Error
```
column "short_description" does not exist
```
**Solution**: Run the schema migration first:
```bash
curl -X POST https://your-render-app.onrender.com/admin/migrate-database
```

#### 3. Timeout on Large Datasets
For databases with 1000+ events, use the background migration option.

### Performance Optimization

For very large datasets:
1. Use background migration (`/api/seo/migrate-events`)
2. Monitor Render logs for progress
3. Consider running during low-traffic periods

## Environment Variables

Ensure these are set in Render:

```env
DATABASE_URL=postgresql://user:pass@host:port/dbname
POSTGRES_DB=your_db_name
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
```

## Expected Results

After successful migration:
- ✅ All events have unique slugs
- ✅ Geographic data extracted from addresses
- ✅ Prices normalized from fee text
- ✅ ISO datetime fields generated
- ✅ SEO-optimized descriptions created
- ✅ Events accessible via SEO-friendly URLs

## Rollback Plan

If issues occur:
1. The migration only adds/updates fields, never deletes
2. Original data in `title`, `description`, `address` remains unchanged
3. Can manually reset problematic fields via SQL if needed

## Contact

If you encounter issues:
1. Check Render logs for detailed error messages
2. Use the synchronous endpoint for immediate feedback
3. Review the migration statistics for completion status

---

**Note**: This migration is specifically designed for Render's PostgreSQL environment but also works locally for testing. 