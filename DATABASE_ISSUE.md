# Database Connection Issue

## The Issue

We're encountering database connectivity errors when trying to create users. The 500 Internal Server Error with "Error creating user" message indicates that:

1. Your application is correctly connecting to the backend service
2. Password validation is passing successfully
3. **But**: the database connection is failing

Based on our tests:
- The old database connection (`eventfinder` database) is no longer accessible
- The new database defined in `render.yaml` (`todoevents-db`) needs to be created

## Solution Steps

### Step 1: Create the Database on Render

1. Go to the Render Dashboard: https://dashboard.render.com
2. Click "New" → "PostgreSQL"
3. Fill in the database details:
   - **Name**: `todoevents-db`
   - **Database**: `todoevents`
   - **User**: `todoevents_user`
   - **Region**: Oregon (US West)
   - **Plan**: Free

4. Click "Create Database"
5. Wait for the database to be provisioned (this may take a few minutes)
6. Once created, note the "Internal Database URL" or "External Database URL"

### Step 2: Update the Backend Environment

1. Go to your `todoevents-backend` service in the Render Dashboard
2. Click "Environment" in the left sidebar
3. Find the `DATABASE_URL` environment variable
4. Update its value to match the new database URL from Step 1
5. Click "Save Changes"

### Step 3: Redeploy the Backend

1. Click "Manual Deploy" → "Clear build cache & deploy"
2. Wait for the deployment to complete

### Step 4: Run the Database Setup Script

After deployment is successful:

1. Click "Shell" in the left sidebar
2. Run the database setup script:
   ```
   python fix_database.py
   ```
3. This will create the necessary tables and an admin user

### Step 5: Try Registration Again

Try registering with the proper password format:
- At least 8 characters long
- Contains uppercase letters (A-Z)
- Contains lowercase letters (a-z)
- Contains numbers (0-9)
- Contains special characters (!@#$%^&*(),.?":{}|<>)

Example: `Passw0rd!`

## Local Testing (Optional)

If you want to test locally before deploying to Render, you need to:

1. Install PostgreSQL locally
2. Create a local database
3. Set environment variables:
   ```
   export DATABASE_URL="postgresql://localhost/todoevents" 
   export RENDER="true"
   ```
4. Run the application:
   ```
   uvicorn backend:app --reload
   ``` 