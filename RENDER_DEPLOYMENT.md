# Render Deployment Guide

## Issue Summary
- Frontend deployed at: `https://todoevents.onrender.com`
- Backend deployment is missing/failing
- Database connection is failing - old database may be suspended or deleted
- CORS issues between frontend and backend

## Deployment Instructions

### Step 1: Create a New PostgreSQL Database

1. Go to the Render Dashboard (https://dashboard.render.com)
2. Click "New" -> "PostgreSQL"
3. Configure as follows:
   - **Name**: `todoevents-db`
   - **Database**: `todoevents`
   - **User**: `todoevents_user`
   - **Region**: Oregon (US West)
   - **PostgreSQL Version**: 15 (or latest)
   - **Plan**: Free tier

4. Click "Create Database"
5. Once created, copy the "External Database URL" from the dashboard

### Step 2: Create the Backend Service

1. Go to the Render Dashboard (https://dashboard.render.com)
2. Click "New" -> "Web Service"
3. Connect to your GitHub repository
4. Configure as follows:
   - **Name**: `todoevents-backend`
   - **Environment**: Python 3
   - **Region**: Oregon (US West) (important: same as your DB)
   - **Root Directory**: `backend` (CRITICAL: set this correctly!)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend:app --host 0.0.0.0 --port $PORT --workers 1 --timeout-keep-alive 120`

5. Add Environment Variables:
   ```
   RENDER=true
   SECRET_KEY=3a4f89cc0b7db4bf2a97e6fe9f9a8e29fcb43d8f5d67c8a3
   DATABASE_URL=<paste the External Database URL from Step 1>
   ```

6. Click "Create Web Service"

### Step 3: Update the Frontend Service

Your frontend is already deployed, but let's ensure it's pointing to the correct backend:

1. Go to your `todoevents` service in the Render Dashboard
2. Click "Environment" in the left menu
3. Check that you have an environment variable:
   ```
   VITE_API_URL=https://todoevents-backend.onrender.com
   ```
4. If this isn't set correctly, add or modify it
5. After changing, go to "Manual Deploy" -> "Clear build cache & deploy"

### Step 4: Verify Deployment

1. Wait for both deployments to complete (check "Events" tab)
2. Test backend health at: `https://todoevents-backend.onrender.com/health`
3. Test frontend at: `https://todoevents.onrender.com`
4. Try to register/login, which should now work

## Troubleshooting

If you still have CORS issues after both deployments:

1. Database Issues:
   - The original database may have been deleted or suspended
   - Make sure to create a new database and update the DATABASE_URL

2. Restart the backend:
   - Go to the `todoevents-backend` service in Render Dashboard
   - Click "Manual Deploy" -> "Deploy latest commit"
   - The CORS handler in backend.py has been improved to handle all *.onrender.com origins

3. Check Logs:
   - Select your service
   - Click "Logs" in the left menu
   - Look for any errors

## Render.yaml (Alternative)

Instead of the manual steps above, you can also deploy using render.yaml:

1. Make sure the `render.yaml` file is at the repository root
2. Update the DATABASE_URL in render.yaml with your new database URL
3. Go to Dashboard -> "New" -> "Blueprint"
4. Connect to your GitHub repository 
5. Render will identify the render.yaml and deploy all services

## Ongoing Maintenance

- Free tier has limitations (services sleep when inactive)
- First request after sleep period will be slow (up to 30 seconds)
- Free tier databases may be deleted after 90 days of inactivity 