# TodoEvents Deployment Guide

## Overview
TodoEvents consists of three main components:
- **Backend API** - FastAPI application serving the REST API
- **Frontend** - React/Vite application for the main user interface  
- **Beta Glass UI** - React/Vite application with Apple's Glass UI design (served at `/beta`)

## Deployment Configuration

### Main Application
The main application is deployed on Render with the following services:

1. **Backend API** (`todoevents-backend`)
   - Python/FastAPI service
   - Connects to PostgreSQL database
   - Deployed at: `https://todoevents-backend.onrender.com`

2. **Frontend** (`todoevents`)
   - Node.js/React static site
   - Includes both main app and beta version
   - Main app deployed at: `https://todo-events.com`
   - Beta Glass UI accessible at: `https://todo-events.com/beta`

### Beta Glass UI Integration

The Beta Glass UI is automatically built and included as part of the main frontend deployment:

- **Build Process**: The frontend build script automatically builds the beta version and places it in `dist/beta/`
- **Base Path**: Beta is configured with `/beta/` as the base path via Vite configuration
- **Static Serving**: Render automatically serves the beta files at the `/beta` path

#### Build Scripts
```json
{
  "build": "npm run sync-sitemap && npm install tailwindcss-animate && vite build && npm run build:beta",
  "build:beta": "cd ../beta && npm ci && npm run build && mkdir -p ../frontend/dist/beta && cp -r dist/* ../frontend/dist/beta/"
}
```

### Environment Variables
Required environment variables for deployment:
- `VITE_API_URL`: Backend API URL
- `VITE_GOOGLE_MAPS_API_KEY`: Google Maps API key
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: Application secret key

### Database
- **Provider**: Render PostgreSQL
- **Plan**: Free tier
- **Connection**: Via `DATABASE_URL` environment variable

## Beta Glass UI Features

The beta version at `/beta` showcases:
- Apple's Glass UI design system
- Frosted glass panels with backdrop blur
- Apple-style animations and micro-interactions
- SF Pro Display typography
- Hardware-accelerated performance
- Mobile-optimized touch interactions

## Access URLs

- **Main App**: https://todo-events.com
- **Beta Glass UI**: https://todo-events.com/beta  
- **API**: https://todoevents-backend.onrender.com
- **Admin Dashboard**: https://todo-events.com/admin

## Local Development

### Main Frontend
```bash
cd frontend
npm install
npm run dev
```

### Beta Glass UI
```bash
cd beta  
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn backend:app --reload
```

## Deployment Process

1. **Automatic Deployment**: Push to main branch triggers automatic deployment
2. **Build Process**: 
   - Frontend builds main app
   - Automatically builds and integrates beta version
   - Static files served by Render's CDN
3. **Zero Downtime**: Beta updates don't affect main application

The beta Glass UI provides a preview of the future design direction while maintaining the stability of the main production application. 