#!/bin/bash
# Deployment and database check script for EventFinder

echo "EventFinder Deployment Helper"
echo "============================"
echo

# Check if render CLI is installed
if ! command -v render &> /dev/null; then
    echo "Render CLI is not installed. Installing it now..."
    curl -s https://render.com/install-cli.sh | bash
    if [ $? -ne 0 ]; then
        echo "Failed to install Render CLI. Please install it manually from: https://render.com/docs/cli"
        exit 1
    fi
fi

echo "Building frontend..."
cd frontend
npm run build
if [ $? -ne 0 ]; then
    echo "Frontend build failed."
    exit 1
fi
echo "Frontend build successful."

echo
echo "BACKEND DATABASE CONNECTION TEST"
echo "==============================="

# Run the database connectivity test
cd ../backend
python db_check.py
if [ $? -ne 0 ]; then
    echo
    echo "Database connection check failed."
    echo "Your registration system may experience issues."
    echo
    echo "Free tier PostgreSQL on Render has connection limitations."
    echo "Consider upgrading to a Starter or higher plan."
    echo
    
    read -p "Continue with deployment anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
fi

echo
echo "Deploying to Render..."

# Using render.yaml to deploy
cd ..
render deploy --yaml render.yaml

echo
echo "Deployment process initiated."
echo "Monitor the deployment status in your Render dashboard."
echo "Once deployed, verify the registration functionality."
echo
echo "Access your health check endpoint at: https://your-api.onrender.com/health"
echo "This will show the real-time database connection status." 