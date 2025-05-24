# Automatic Database Setup for TodoEvents

I've updated the deployment to automatically initialize the database when the backend service starts. This fix eliminates the need to access the shell in Render.

## Changes Made:

1. **Modified `render.yaml`**:
   ```yaml
   startCommand: python fix_database.py && uvicorn backend:app --host 0.0.0.0 --port $PORT --workers 1 --timeout-keep-alive 120
   ```
   Now the database setup script will run automatically before the API server starts.

2. **Enhanced `fix_database.py`**:
   - Added retry logic with exponential backoff
   - Switched to logging instead of print statements
   - Made the script non-blocking (won't crash the container if DB setup fails)
   - Added better error handling

## How to Deploy:

### Option 1: Redeploy with Git

1. Push these changes to your GitHub repository
2. Go to your `todoevents-backend` service in Render
3. Click "Manual Deploy" → "Clear build cache & deploy"

### Option 2: Update Environment and Restart

1. Go to your `todoevents-backend` service in Render
2. Update the `DATABASE_URL` environment variable to the correct value:
   ```
   postgresql://todoevents_user:9i7NARYK2tVZI6yXXV3gOw644m2SsjuE@dpg-d0od9fbe5dus73avgsk0-a.oregon-postgres.render.com/todoevents
   ```
3. Save the changes
4. Click "Manual Deploy" → "Clear build cache & deploy"

## After Deployment:

- Wait for the deployment to complete (might take a few minutes)
- The service logs will show the database setup progress
- Try registering on the frontend with a properly formatted password:
  ```
  Passw0rd!
  ```

## Admin Account:

An admin account will be automatically created:
- Email: `admin@todoevents.com`
- Password: `Admin123!`

## Troubleshooting:

If you still experience issues after deployment:

1. **Check Logs**: In the Render dashboard, view the logs for the backend service to see any database errors

2. **Validate Database URL**: Double-check that the database URL is correct and the database is running

3. **Manual Test**: If needed, replace the startup command temporarily with just:
   ```
   python fix_database.py
   ```
   This will run only the database setup and show detailed logs 