# Todo Events Application

An event management application with enhanced user authentication, password reset functionality, and admin dashboard.

## Features

- **User Authentication**
  - Login with email and password
  - Registration with comprehensive password validation
  - Password reset flow with verification code
  - Clear error messaging and troubleshooting
  
- **Event Management**
  - Create, view, edit, and delete events
  - Browse events on a map interface
  - Filter events by category, date, and location
  
- **Admin Dashboard** 
  - User management (view, edit roles, delete)
  - Event moderation
  - Analytics and reporting
  - Access restricted to users with admin role

## Getting Started

### Prerequisites

- Node.js (18.x or later)
- Python (3.9 or later)
- PostgreSQL (for production) or SQLite (for development)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/todoevents.git
   cd todoevents
   ```

2. Install dependencies:
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
   
   This will install both frontend and admin dashboard dependencies.

3. Start the backend:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn backend:app --reload
   ```

4. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

5. Start the admin dashboard (optional):
   ```bash
   cd admin
   npm run dev
   ```

6. Access the application:
 - Main application: http://localhost:5173
  - Admin dashboard: http://localhost:5174 (if running separately)

### Android Wrapper

A minimal Android wrapper is provided in the `android-app` directory. The app
uses **Expo** with a `WebView` to load the web version of todo-events. When a
user navigates to the subscription flow (`/subscribe`), the link opens in the
device browser so payments are handled on the website. The wrapper adds pull-to-
refresh and a loading indicator for a smoother mobile experience. The wrapper
automatically follows the device's light or dark theme for a native feel.

#### Running Locally
```bash
cd android-app
npm install
npm run android
```

### iOS Wrapper

A minimal iOS wrapper is provided in the `ios-app` directory. It contains Swift
source files using a `WKWebView` to embed the website. When the user navigates
to `/subscribe`, the app opens Safari so payments occur on the web. The wrapper
adds pull-to-refresh and a loading spinner to make the mobile app more
responsive. It also adopts the system appearance so the colors match the user's
selected theme.

#### Running Locally
1. Open Xcode and create a new **App** project.
2. Replace the default Swift files with the ones from `ios-app/TodoEventsApp` and
   merge the provided `Info.plist` settings.
3. Build and run the project on a simulator or device running iOS 14 or later.
   

## Deployment

The application is configured for deployment on Render.com:

### Frontend and Backend
- Main application: See `render.yaml` for configuration details
- Backend API: Deployed separately at `https://todoevents-backend.onrender.com`

### Admin Dashboard (Standalone)
The admin dashboard can be deployed separately:
- See `admin/README.md` for detailed deployment instructions
- Supports Render.com, Vercel, and Netlify
- Configured to connect to the production backend automatically

## Password Requirements

Passwords must meet the following requirements:
- At least 8 characters long
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## Environment Variables

### Backend
- `DATABASE_URL`: PostgreSQL connection string (required for production)
- `SECRET_KEY`: JWT secret key
- `ACCESS_TOKEN_EXPIRE_MINUTES`: JWT token expiration time

### Frontend
- `VITE_API_URL`: Backend API URL
- `VITE_GOOGLE_MAPS_API_KEY`: Google Maps API key for map functionality

## Security Notes

- No API keys are hardcoded in the codebase; all are loaded from environment variables
- Default admin credentials are only created if no admin user exists in the database
- Passwords are securely hashed using bcrypt
- JWT tokens are used for authentication with proper expiration
- Password reset uses secure verification codes with expiration
- Environment variables examples are provided in `.env.example` files
- Helper scripts and troubleshooting tools have been removed from the codebase

## License

This project is licensed under the TODO-EVENTS COMMERCIAL LICENSE AGREEMENT.

**Copyright © 2025 Watchtower AB, Inc - All rights reserved.**

### Important License Terms

**STRICTLY PROHIBITED without written agreement:**
- Commercial, governmental, educational, or public-facing deployment
- Hosting or deploying private instances
- Forking, modifying, or creating derivative versions
- Bypassing licensing or access control mechanisms
- Using in competing platforms or services

### Premium Features
Access to premium features (vendor portals, analytics, SMS alerts, public maps) requires:
- Payment of applicable fees
- Execution of service contract
- Written authorization from Watchtower AB, Inc

### Contact for Licensing
**Watchtower AB, Inc**
- Email: support@todo-events.com  
- Website: todo-events.com

See the LICENSE file for complete terms and conditions. 