#!/bin/bash

# Print each command before executing
set -e
set -x

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm ci

# Install admin dependencies
echo "Installing admin dependencies..."
cd ../admin
npm ci

# Return to the root directory
cd ..

echo "All dependencies installed successfully!"
echo
echo "To run the frontend: cd frontend && npm run dev"
echo "To run the backend: cd backend && uvicorn backend:app --reload" 