# Render PostgreSQL Setup & Migration Guide

## The Issue
Your app is creating events in a local SQLite database but Render is configured to use PostgreSQL. This causes a mismatch where:
- ✅ Events get created successfully (in SQLite)  
- ❌ Events don't appear on the map (because queries hit PostgreSQL)

## Solution: Initialize PostgreSQL Database

### Step 1: Connect to Your Render Backend
1. Go to your Render dashboard
2. Find your backend service
3. Click on "Shell" or use the Web Service URL

### Step 2: Run the Migration Script
In your Render backend shell, run:

```bash
# Set the DATABASE_URL (it should already be set)
export DATABASE_URL="postgresql://eventfinder_user:J6euBSG7jS6U0aPZxMjy5CfuUnOAhjj8@dpg-d0bs2huuk2gs7383mnu0-a.oregon-postgres.render.com/eventfinder"

# Run the production migration
python migrate_production_postgres.py
```

This will:
- ✅ Create all required tables in PostgreSQL
- ✅ Add the UX enhancement fields (`fee_required`, `event_url`, `host_name`)
- ✅ Create a default admin user
- ✅ Set up proper indexes for performance

### Step 3: Verify the Setup
After running the migration, test your API:

```bash
# Check health
curl https://your-backend-url.onrender.com/health

# Check events (should return empty array initially)
curl https://your-backend-url.onrender.com/events

# Test creating an event via your frontend
```

### Step 4: Update Frontend API URL
Make sure your frontend is pointing to your Render backend URL, not localhost.

## Expected Results

After this migration:
- ✅ **Events will persist** between deployments
- ✅ **UX enhancement fields will work** (fee_required, event_url, host_name)
- ✅ **Event details panel will show** UX enhancement information
- ✅ **Multiple backend instances** will share the same database
- ✅ **Database will survive** container restarts

## Manual Alternative

If you can't access the shell, you can also:

1. **Trigger the migration from code** by adding this to your backend startup:
   ```python
   # Add this to backend.py startup
   if IS_PRODUCTION and DB_URL:
       try:
           from migrate_production_postgres import main as migrate_db
           migrate_db()
       except Exception as e:
           logger.error(f"Migration failed: {e}")
   ```

2. **Or run via endpoint**: Create a temporary endpoint to trigger migration:
   ```python
   @app.post("/admin/migrate-db")
   async def migrate_database():
       from migrate_production_postgres import main as migrate_db
       try:
           migrate_db()
           return {"status": "success", "message": "Database migrated"}
       except Exception as e:
           return {"status": "error", "message": str(e)}
   ```

## Troubleshooting

### If you get connection errors:
- Verify your `DATABASE_URL` in Render environment variables
- Check that your PostgreSQL service is running
- Ensure the connection string format is correct

### If tables already exist:
- The script uses `CREATE TABLE IF NOT EXISTS` - it's safe to run multiple times
- It will only add missing UX enhancement fields

### If you need to start fresh:
You can drop and recreate tables in PostgreSQL admin panel or via:
```sql
DROP TABLE IF EXISTS activity_logs, password_reset_codes, event_views, event_interest, events, users CASCADE;
```

## Default Admin Credentials
After migration, you can log in with:
- **Email**: `admin@todoevents.com`
- **Password**: `admin123!`

**Important**: Change these credentials immediately after first login! 