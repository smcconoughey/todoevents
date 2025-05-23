# Deployment Guide for Render.com

## Overview
This project consists of two separate services that need to be deployed independently:
1. Backend API (FastAPI/Python)
2. Frontend Web App (Vite/React)

## Prerequisites
- GitHub repository with your code
- Render.com account
- PostgreSQL database (already created: `eventfinder-db`)

## Step 1: Deploy Backend API

1. **Create a new Web Service on Render:**
   - Go to Render Dashboard → New → Web Service
   - Connect your GitHub repository
   - **Important:** Set the root directory to `backend`

2. **Configure the Backend Service:**
   - **Name:** `todoevents-backend`
   - **Environment:** Python 3
   - **Region:** Oregon (US West) - Same as your database
   - **Branch:** main (or your default branch)
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn backend:app --host 0.0.0.0 --port $PORT --workers 1 --timeout-keep-alive 120`

3. **Environment Variables for Backend:**
   ```
   RENDER=true
   SECRET_KEY=3a4f89cc0b7db4bf2a97e6fe9f9a8e29fcb43d8f5d67c8a3
   DATABASE_URL=postgresql://eventfinder_user:J6euBSG7jS6U0aPZxMjy5CfuUnOAhjj8@dpg-d0bs2huuk2gs7383mnu0-a.oregon-postgres.render.com/eventfinder
   ```

## Step 2: Deploy Frontend

1. **Create another Web Service on Render:**
   - Go to Render Dashboard → New → Static Site
   - Connect the same GitHub repository
   - **Important:** Set the root directory to `frontend`

2. **Configure the Frontend Service:**
   - **Name:** `todoevents-frontend`
   - **Environment:** Static Site
   - **Root Directory:** `frontend`
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`

3. **Environment Variables for Frontend:**
   ```
   VITE_API_URL=https://todoevents-backend.onrender.com
   NODE_ENV=production
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```

## Step 3: Verify Deployment

1. **Check Backend:**
   - Visit: `https://todoevents-backend.onrender.com/health`
   - Should return JSON with health status

2. **Check Frontend:**
   - Visit: `https://todoevents-frontend.onrender.com`
   - Should load your React app

3. **Test API Communication:**
   - On frontend, try creating an account or viewing events
   - Check browser Network tab for API calls

## Step 4: Update CORS (if needed)

If you get CORS errors, the backend automatically allows any `*.onrender.com` subdomain, but you may need to add your specific URLs to the CORS configuration in `backend/backend.py`.

## Troubleshooting

### Backend Issues:
- **500 errors:** Check database connection
- **Timeout on startup:** Database connection might be slow
- **Module not found:** Check requirements.txt and build logs

### Frontend Issues:
- **API calls failing:** Verify VITE_API_URL environment variable
- **Build fails:** Check package.json and Node.js version
- **Routes not working:** Ensure rewrite rules are set up

### Database Issues:
- **Connection timeout:** Database might be sleeping (free tier)
- **Permission denied:** Check database credentials and IP allowlist

## Manual Testing Commands

You can test the backend locally:
```bash
cd backend
python test_api.py https://todoevents-backend.onrender.com
```

## Important Notes

1. **Free Tier Limitations:**
   - Services sleep after 15 minutes of inactivity
   - First request after sleep may be slow (30+ seconds)
   - Database connections are limited

2. **Service Names:**
   - Backend: `todoevents-backend`
   - Frontend: `todoevents-frontend` 
   - Database: `eventfinder-db`

3. **URLs:**
   - Backend API: `https://todoevents-backend.onrender.com`
   - Frontend: `https://todoevents-frontend.onrender.com`

## Alternative: Deploy from Root Directory

If you prefer to deploy both services from the root directory, you can use the main `render.yaml` file, but you'll need to adjust the build commands to include the directory navigation. 