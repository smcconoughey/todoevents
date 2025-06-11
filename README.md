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
   
### Default Admin Account

When the application first starts, it creates a default admin user:
- **Email**: admin@todoevents.com
- **Password**: Admin123!

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