# Premium Trial Invite System

## Overview

A complete system that shows a premium trial popup on a user's 5th visit, generates unique invite codes, and automatically grants 7-day premium trials when users sign up through the popup.

## Features

### 1. 5th Visit Popup Detection
- Tracks page visits in localStorage
- Shows popup automatically on the 5th visit
- Only shows once per user (tracked in localStorage)
- Beautiful, mobile-responsive popup design

### 2. Invite Code Generation
- Generates unique 8-character codes (format: `TRIAL7D` + random characters)
- Codes expire after 30 days
- Single-use codes (max_uses = 1)
- Fallback generation if database fails

### 3. User Registration with Invite Codes
- New registration endpoint: `/users-with-invite`
- Validates invite codes during registration
- Automatically grants premium role and sets expiration
- Tracks usage and marks codes as used

### 4. Premium Trial Management
- 7-day premium access from registration date
- Tracks trial source (invite code used)
- Compatible with existing premium system
- Works with both SQLite (dev) and PostgreSQL (prod)

## Implementation Details

### Backend Endpoints

#### `POST /generate-premium-trial-invite`
```json
Response: {
  "invite_code": "TRIAL7DXY12AB34",
  "trial_type": "premium7d",
  "trial_duration_days": 7,
  "expires_at": "2024-02-15T10:30:00Z",
  "max_uses": 1
}
```

#### `POST /validate-trial-invite`
```json
Request: {
  "invite_code": "TRIAL7DXY12AB34"
}

Response: {
  "valid": true,
  "trial_type": "premium7d",
  "trial_duration_days": 7,
  "remaining_uses": 1
}
```

#### `POST /users-with-invite`
```json
Request: {
  "email": "user@example.com",
  "password": "SecurePass123!",
  "invite_code": "TRIAL7DXY12AB34"
}

Response: {
  "id": 123,
  "email": "user@example.com",
  "role": "premium",
  "trial_activated": true,
  "trial_type": "premium7d",
  "trial_expires_at": "2024-02-15T10:30:00Z",
  "password_strength": "strong"
}
```

### Database Schema

#### `trial_invite_codes` Table
```sql
CREATE TABLE trial_invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    trial_type TEXT NOT NULL DEFAULT 'premium7d',
    trial_duration_days INTEGER NOT NULL DEFAULT 7,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
```

### Frontend Components

#### `PremiumTrialPopup.jsx`
- Tracks visit count in localStorage
- Generates invite codes when popup opens
- Beautiful gradient design with premium branding
- Promotes community event hosting benefits
- Redirects to registration page with pre-populated invite code

#### `RegistrationPage.jsx`
- Standalone registration page at `/register` and `/signup`
- Accepts invite codes via URL parameters
- Real-time invite code validation
- Enhanced UI for premium trial signups
- Auto-login after successful registration

## User Flow

1. **Visit Tracking**: User visits are tracked in localStorage
2. **5th Visit Popup**: On the 5th visit, the premium trial popup appears
3. **Invite Generation**: When popup opens, a unique invite code is generated
4. **User Interest**: User clicks "Sign Up for 7-Day Free Trial"
5. **Registration**: User is taken to registration page with invite code pre-filled
6. **Account Creation**: User creates account with invite code
7. **Premium Activation**: User automatically gets 7-day premium access
8. **Trial Experience**: User can create unlimited events and access premium features

## Benefits for Community Promotion

The popup specifically targets community event organizers with messaging about:
- Promoting local business events
- Church and community organization events  
- Building local community engagement
- Professional event management tools

## Testing

Use the included `test_premium_trial.py` script to test the complete system:

```bash
cd backend
python test_premium_trial.py
```

The script tests:
- Invite code generation
- Code validation (valid and invalid)
- User registration with invite codes
- Premium trial activation
- Usage tracking

## Security Features

- Invite codes have expiration dates
- Single-use codes prevent abuse
- Code validation prevents invalid registrations
- Fallback code generation for system reliability
- Database compatibility for dev/prod environments

## Mobile-Optimized

- Responsive popup design
- Touch-friendly interface
- Smooth animations and transitions
- Works seamlessly on all device sizes

## Integration

The system integrates seamlessly with:
- Existing user authentication
- Current premium subscription system
- Database migration system
- Both frontend and beta versions

## Future Enhancements

Potential future improvements:
- Multi-use invite codes for referral programs
- Different trial durations for different promotions
- Analytics dashboard for invite code usage
- Email invitations with embedded codes
- Social sharing of invite codes 