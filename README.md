# EventFinder Application

EventFinder is a full-stack application for creating and managing events with location-based features.

## Components

- **Backend**: FastAPI application with PostgreSQL database (or SQLite for local development)
- **Frontend**: React + Vite application with Tailwind CSS
- **Admin**: Admin dashboard interface

## Deployment to Render.com

This application is configured for deployment on Render.com using a PostgreSQL database.

### Database Setup on Render

1. Create a PostgreSQL database on Render
   - Go to the Render Dashboard → New → PostgreSQL
   - Fill in the required fields
   - Use at least the "Starter" plan for production use (Free tier has severe limitations that can cause timeouts)
   - Note the "Internal Database URL" as you'll need it later

2. Database Connection Optimization
   - The backend is configured with connection pooling and retry logic to handle connection issues
   - You may adjust pool size parameters in the `render.yaml` file based on your plan limits

### Backend Deployment

1. Deploy the backend API to Render
   - Go to the Render Dashboard → New → Web Service
   - Connect your repository
   - Set the build command: `pip install -r requirements.txt`
   - Set the start command: `uvicorn backend:app --host 0.0.0.0 --port $PORT --workers 2 --timeout-keep-alive 75`
   - Add the environment variables:
     - `DATABASE_URL`: Use the Internal Database URL from your PostgreSQL instance
     - `SECRET_KEY`: A secure random string for JWT token encryption
     - `PORT`: 8000
     - `RENDER`: true
     - `DATABASE_POOL_SIZE`: 5 (adjust based on your database plan)
     - `DATABASE_MAX_OVERFLOW`: 10 (adjust based on your database plan)

2. Testing Backend Connectivity
   - After deployment, test your connection by running: `python db_check.py`
   - This script will test PostgreSQL connectivity and basic database operations
   - If you encounter issues, check the logs on Render dashboard

### Frontend Deployment

1. Deploy the frontend to Render
   - Go to the Render Dashboard → New → Static Site
   - Connect your repository and select the `frontend` directory
   - Set the build command: `npm install && npm run build`
   - Set the publish directory: `dist`
   - Add the environment variables:
     - `VITE_API_URL`: The URL of your backend API (e.g., https://your-api.onrender.com)
     - `VITE_GOOGLE_MAPS_API_KEY`: Your Google Maps API key

## Troubleshooting Registration and DB Connection Issues

If you encounter timeouts or database connection issues during registration:

1. **Database Connection Issues**
   - Check the "Health" endpoint of your backend: `https://your-api.onrender.com/health`
   - This will report on the database connection status and response time
   - If the database status shows "error", your database connection may be down

2. **Registration Timeouts**
   - The backend is configured with enhanced timeout and retry logic
   - Check the Render logs for specific error messages
   - If you see errors about "pool exhaustion", consider increasing your database plan or adjusting connection parameters

3. **Database Free Tier Limitations**
   - The free PostgreSQL tier on Render has severe limitations that can cause timeouts
   - Limited to 1 connection at a time, which can cause connection pooling to fail
   - Slow response times, particularly when the database hasn't been used recently
   - Consider upgrading to at least the "Starter" plan for production use

4. **Fixing Issues**
   - If your database has too many connections, restart your web service on Render
   - Ensure your database has adequate resources for your user load
   - Check for slow queries that might be causing timeouts
   - Consider implementing a queue system for registration if you have high traffic

## Local Development

1. **Backend**
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn backend:app --reload
   ```

2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Admin**
   ```bash
   cd admin
   npm install
   npm run dev
   ```

## Environment Variables

Create a `.env` file in the backend directory with:

```
DATABASE_URL=postgresql://username:password@host:port/database
SECRET_KEY=your-secret-key
```

For local development, you can omit the DATABASE_URL to use SQLite instead.

## Testing Database Connectivity

Run the database connectivity test script to verify your database setup:

```bash
cd backend
python db_check.py
```

This will test connection to your PostgreSQL database and verify basic operations. 