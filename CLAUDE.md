# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (Main Application)
```bash
cd frontend
npm run dev          # Start development server (localhost:5173)
npm run build        # Build for production (includes beta build)
npm run lint         # Run ESLint
npm run sync-sitemap # Sync sitemap before build
npm run preview      # Preview production build
```

### Backend (Python FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend:app --reload  # Start development server (localhost:8000)
```

### Admin Dashboard
```bash
cd admin
npm run dev          # Start admin dashboard (localhost:5174)
npm run build        # Build admin dashboard
```

### Beta Environment
```bash
cd beta
npm run dev          # Start beta version
npm run build        # Build beta (automatically included in main build)
```

### Mobile Apps
- **Android**: `cd android-app && npm install && npm run android`
- **iOS**: Open Xcode project in `ios-app/TodoEventsApp`

## Architecture Overview

### Multi-Environment Structure
- **Frontend**: Main React application with Vite
- **Beta**: Separate beta version with shared components
- **Admin**: Standalone admin dashboard
- **Backend**: FastAPI Python server with SQLite/PostgreSQL
- **Mobile**: Expo (Android) and Swift (iOS) WebView wrappers

### Key Technologies
- **Frontend**: React 18, Vite, TailwindCSS, Radix UI, Google Maps API
- **Backend**: FastAPI, SQLite (dev), PostgreSQL (prod), JWT auth, Stripe
- **State Management**: React Context (Auth, Theme, MissionOps)
- **Deployment**: Render.com with automated builds

### Database Schema
- Centralized schema definitions in `backend/database_schema.py`
- SQLite for development, PostgreSQL for production
- Auto-migration scripts available in backend directory

### Authentication & Security
- JWT-based authentication with refresh tokens
- Password requirements: 8+ chars, uppercase, lowercase, number, special char
- Secure file uploads with image processing (PIL)
- CORS configured for cross-origin requests

### API Configuration
- Primary API: `https://todoevents-backend.onrender.com` (production)
- Fallback API: `http://localhost:8000` (development)
- Health check endpoint: `/health`
- API URL detection with automatic fallback in `frontend/src/config.js`

### Premium Features
- Stripe integration for subscription management
- Enterprise dashboard with analytics
- MissionOps AI-powered planning system
- Advanced event management with SEO optimization

### File Structure Patterns
- Components organized by feature (EventMap, MissionOps, etc.)
- Shared UI components in `components/ui/`
- Route-based page components
- Centralized configuration in `config.js`
- Custom hooks in `hooks/` directory

### Build Process
- Frontend build includes automatic beta build integration
- Sitemap generation and validation
- Image optimization and file uploads to `backend/uploads/`
- Production builds optimized for Render.com deployment

### Testing
- Backend tests: `python -m pytest` in backend directory
- Frontend: Uses ESLint for code quality
- Integration tests available for Stripe, premium features, and enterprise dashboard

### Environment Variables
- **Backend**: `DATABASE_URL`, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- **Frontend**: `VITE_API_URL`, `VITE_GOOGLE_MAPS_API_KEY`
- Templates provided in respective directories

### Mobile Integration
- WebView-based mobile apps redirect `/subscribe` to browser
- Pull-to-refresh and loading indicators implemented
- System theme adoption for native feel