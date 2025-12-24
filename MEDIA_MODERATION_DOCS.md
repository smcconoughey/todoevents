# Media Moderation & Law Enforcement Portal

## Overview

A comprehensive admin portal for media moderation and law enforcement compliance has been implemented in the TodoEvents application. This system provides complete oversight of uploaded media content and maintains detailed forensic data trails for law enforcement investigations.

## Features

### 1. Media Moderation Dashboard

**Location**: Admin Portal → Media Tab

The media moderation portal provides four main sections:

#### Overview Tab
- **Total Media Files**: Count of all uploaded images (banners + logos)
- **Banner Images**: Count of event banner images
- **Logo Images**: Count of event logo images
- **Flagged Content**: Count of content flagged for review

#### Media Files Tab
- **Comprehensive File Listing**: All uploaded media with full context
- **User Information**: Email, role, account creation date
- **Event Context**: Event title, category, and date
- **Moderation Actions**: Flag, Remove, or Approve content
- **Search & Filter**: By media type (banner/logo) and text search

#### User Forensics Tab
- **Complete User Profiles**: All user account data
- **Activity Metrics**: Events created, media uploaded, login history
- **Account Timeline**: Registration date, last activity
- **Search Functionality**: Find users by email or ID

#### Audit Trail Tab
- **Comprehensive Logging**: All user activities and system events
- **Forensic Data**: User actions, timestamps, IP addresses (when available)
- **Law Enforcement Ready**: Complete audit trail for investigations

### 2. Enhanced Data Retention

#### Database Schema Extensions

**New Tables**:
- `media_forensic_data`: Comprehensive media file tracking
- `user_forensic_data`: Enhanced user activity profiles
- `login_attempts`: Complete login history
- `media_audit_logs`: Media-specific activity logs

**Key Data Points Retained**:
- Upload timestamps and file metadata
- User IP addresses and user agents (when available)
- File sizes, hashes, and content types
- Moderation status and admin actions
- Complete user activity timelines
- Failed login attempts and security events

#### Legal Compliance Features

- **Data Retention**: All activities are logged permanently
- **Law Enforcement Ready**: Comprehensive forensic data trails
- **User Context**: Complete user profiles with all permitted data
- **Activity Tracking**: Every action is logged with timestamps
- **Content Moderation**: Admin tools for content review and removal

### 3. API Endpoints

#### Admin Media Endpoints
- `GET /admin/media/overview` - Media statistics and overview
- `GET /admin/media/files` - Paginated media file listing with user context
- `PUT /admin/media/flag/{event_id}` - Flag, remove, or approve media content

#### Forensic Data Endpoints
- `GET /admin/forensics/users` - User forensic data for law enforcement
- `GET /admin/audit/comprehensive` - Complete audit trail

#### Enhanced Logging Functions
- `log_media_activity()` - Enhanced media upload logging
- `create_forensic_tables()` - Automatic forensic table creation
- `log_activity()` - Enhanced with login/registration tracking

### 4. Security & Privacy

#### Data Protection
- Admin-only access (role-based authentication)
- Secure data handling for sensitive information
- Complete audit trails for all admin actions

#### Legal Compliance
- Retains all data permitted by legal policy
- Provides comprehensive context for law enforcement investigations
- Maintains user activity timelines and content history
- Tracks all media uploads with full metadata

### 5. Usage Instructions

#### For Administrators

1. **Access the Portal**:
   - Log in to the Admin Dashboard
   - Navigate to the "Media" tab

2. **Review Media Content**:
   - Use the "Media Files" tab to see all uploaded content
   - Search by filename, user email, or event title
   - Filter by media type (banner/logo)

3. **Moderate Content**:
   - Click flag icon to mark content for review
   - Click trash icon to remove inappropriate content
   - Click check icon to approve content

4. **Access User Data**:
   - Use "User Forensics" tab for complete user profiles
   - Search for specific users by email or ID
   - View activity counts and timestamps

5. **Review Audit Logs**:
   - Use "Audit Trail" tab for comprehensive activity logs
   - Filter by user, date range, or activity type
   - Export data for law enforcement requests

#### For Law Enforcement

The system provides comprehensive forensic data including:
- Complete user registration and activity history
- All media uploads with full metadata and timestamps
- Login attempts (successful and failed)
- User IP addresses and browser information (when available)
- Complete audit trail of all user actions
- Content moderation history and admin actions

**Legal Contact**: support@todo-events.com

### 6. Technical Implementation

#### Backend Components
- **Enhanced Activity Logging**: All user actions are logged
- **Forensic Data Tables**: Dedicated tables for law enforcement data
- **Database Compatibility**: Works with both PostgreSQL and SQLite
- **Auto-Migration**: Forensic tables are created automatically

#### Frontend Components
- **Media Moderation Interface**: Complete admin portal
- **Real-time Search**: Instant filtering and search
- **Responsive Design**: Works on all device sizes
- **Intuitive Actions**: One-click moderation tools

#### Database Schema
```sql
-- Media forensic data
CREATE TABLE media_forensic_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    event_id INTEGER,
    filename TEXT NOT NULL,
    file_size BIGINT,
    file_hash TEXT,
    upload_timestamp TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    action TEXT NOT NULL,
    moderation_status TEXT DEFAULT 'active',
    flagged_content BOOLEAN DEFAULT FALSE,
    moderation_notes TEXT,
    law_enforcement_hold BOOLEAN DEFAULT FALSE,
    -- Additional forensic fields...
);

-- User forensic profiles
CREATE TABLE user_forensic_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE,
    registration_ip TEXT,
    registration_timestamp TIMESTAMP,
    last_login_timestamp TIMESTAMP,
    login_count INTEGER DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    -- Additional tracking fields...
);
```

### 7. Future Enhancements

Potential improvements for enhanced law enforcement support:
- Real-time IP geolocation tracking
- Enhanced browser fingerprinting
- Automated content analysis and flagging
- Integration with external law enforcement systems
- Enhanced reporting and export capabilities

---

**Note**: This system is designed to comply with legal data retention requirements and provide comprehensive support for law enforcement investigations while maintaining user privacy protections where legally required. 