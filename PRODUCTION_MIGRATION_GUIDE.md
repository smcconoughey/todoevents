# Production Database Migration Guide

## 🚨 **Issue**
The production database on Render.com needs to be migrated to support the new start/end time fields. Currently getting errors:
```
Database error: column "start_time" does not exist
```

## 🔧 **Solution Options**

### **Option 1: Automatic Migration via Backend Restart (Recommended)**

The backend now includes improved migration logic. Simply restart your Render.com backend service:

1. **Go to Render Dashboard**: https://render.com
2. **Find your backend service**: `todoevents-backend` (or similar)
3. **Click "Manual Deploy"** or **"Restart Service"**
4. **Monitor the logs** for migration messages like:
   ```
   ✅ Migrated 'time' column to 'start_time'
   ✅ Added 'end_time' column
   ✅ Added 'end_date' column
   ```

### **Option 2: Manual Migration Script**

If the automatic migration doesn't work, run the manual migration script:

1. **Set your DATABASE_URL** (get this from Render dashboard):
   ```bash
   export DATABASE_URL="your_postgres_url_here"
   ```

2. **Run the migration script**:
   ```bash
   python migrate_production_db.py
   ```

3. **Restart your backend service** on Render.com

### **Option 3: Database Console (Advanced)**

If you have access to the PostgreSQL console on Render:

```sql
-- Check current schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events';

-- Migrate time to start_time (if needed)
ALTER TABLE events RENAME COLUMN time TO start_time;

-- Add new columns
ALTER TABLE events ADD COLUMN end_time TEXT;
ALTER TABLE events ADD COLUMN end_date TEXT;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events';
```

## 📋 **Expected Schema After Migration**

The events table should have these columns:
- `id` (SERIAL PRIMARY KEY)
- `title` (TEXT NOT NULL)
- `description` (TEXT NOT NULL)
- `date` (TEXT NOT NULL) - Start date
- `start_time` (TEXT NOT NULL) - Start time (renamed from `time`)
- `end_time` (TEXT) - Optional end time
- `end_date` (TEXT) - Optional end date for multi-day events
- `category` (TEXT NOT NULL)
- `address` (TEXT NOT NULL)
- `lat` (REAL NOT NULL)
- `lng` (REAL NOT NULL)
- `recurring` (BOOLEAN NOT NULL DEFAULT FALSE)
- `frequency` (TEXT)
- `created_by` (INTEGER)
- `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

## 🧪 **Testing After Migration**

1. **Check the backend logs** for successful migration messages
2. **Try creating a new event** on the frontend
3. **Verify existing events still display correctly**
4. **Test the AI API endpoint**: `/api/v1/local-events`

## 🚨 **Troubleshooting**

### **If migration fails:**
1. Check Render logs for specific error messages
2. Ensure the DATABASE_URL is correct
3. Verify database permissions allow ALTER TABLE operations
4. Contact Render support if database access issues persist

### **If events display incorrectly after migration:**
- Old events will have `start_time` but no `end_time` or `end_date`
- This is expected and the frontend handles it gracefully
- New events will have all the new fields

### **If you see "duplicate column" errors:**
- This means the migration already partially ran
- The migration script is designed to be idempotent (safe to run multiple times)
- Just restart the backend service

## ✅ **Success Indicators**

You'll know the migration worked when:
- ✅ No more "column does not exist" errors
- ✅ Can create new events with start/end times
- ✅ Existing events still display correctly
- ✅ AI API returns events with proper time formatting

## 📞 **Need Help?**

If you're still having issues:
1. Check the Render service logs for specific error messages
2. Try the manual migration script with verbose logging
3. Verify your DATABASE_URL environment variable is correct
4. Consider temporarily enabling database logging to see exact SQL queries 