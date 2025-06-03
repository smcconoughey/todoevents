# 📧 Email Setup Guide for Todo Events

## Overview
This guide shows you how to set up professional email (support@todo-events.com) and automated emails for password resets using free and paid options.

## 🆓 FREE Option (Recommended to Start)

### Step 1: Set up Email Forwarding in Squarespace
1. **Squarespace Admin** → Settings → Domains
2. **todo-events.com** → Advanced Settings
3. **Email Forwarding** → Add forwarding rule:
   - **From**: support@todo-events.com
   - **To**: your-personal-email@gmail.com

### Step 2: Gmail App Password (for SMTP)
1. **Gmail Account** → Manage your Google Account
2. **Security** → 2-Step Verification (enable if not already)
3. **App passwords** → Generate password for "Mail"
4. **Copy the 16-character password** (you'll need this)

### Step 3: Environment Variables
Create a `.env` file in the `backend` folder:

```bash
# Email Configuration (FREE Gmail SMTP)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-gmail@gmail.com
SMTP_PASSWORD=your-16-char-app-password
FROM_EMAIL=support@todo-events.com
FROM_NAME=Todo Events Support

# Other settings
DATABASE_URL=sqlite:///./events.db
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-here
DEBUG=true
ENVIRONMENT=development
```

## 💰 PAID Options (When Ready to Upgrade)

### Option A: Google Workspace ($6/month)
**Best for**: Professional appearance, reliability
```bash
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=support@todo-events.com
SMTP_PASSWORD=your-workspace-password
FROM_EMAIL=support@todo-events.com
FROM_NAME=Todo Events Support
```

### Option B: Zoho Mail (FREE tier available)
**Best for**: Free custom domain email
```bash
SMTP_SERVER=smtp.zoho.com
SMTP_PORT=587
SMTP_USERNAME=support@todo-events.com
SMTP_PASSWORD=your-zoho-password
FROM_EMAIL=support@todo-events.com
FROM_NAME=Todo Events Support
```

### Option C: SendGrid (100 emails/day free)
**Best for**: High-volume automated emails
```bash
SMTP_SERVER=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your-sendgrid-api-key
FROM_EMAIL=support@todo-events.com
FROM_NAME=Todo Events Support
```

## 🔧 Setup Instructions

### 1. Create .env file
```bash
cd backend
touch .env
# Copy the appropriate configuration above into .env
```

### 2. Install Python email dependencies (already included)
The required packages are already in your backend:
- `smtplib` (built-in)
- `email.mime` (built-in)

### 3. Test email functionality
```bash
cd backend
python -c "from email_config import email_service; print('Email service loaded successfully')"
```

### 4. Test sending an email (optional)
```python
# In Python console
from email_config import email_service
result = email_service.send_password_reset_email('test@example.com', '123456', 'Test User')
print(f"Email sent: {result}")
```

## 📝 How It Works

### Incoming Emails (Support)
1. User sends email to support@todo-events.com
2. Squarespace forwards to your personal email
3. You reply from your personal email (users see the reply)

### Outgoing Emails (Automated)
1. Password reset requested
2. Backend generates reset code
3. Email service sends professional email from "Todo Events Support"
4. User receives email from support@todo-events.com

## 🔄 Migration Path

**Start Free** → **Upgrade Later**
1. **Month 1-3**: Use email forwarding + Gmail SMTP (FREE)
2. **When revenue grows**: Upgrade to Google Workspace ($6/month)
3. **High volume**: Add SendGrid for automated emails

## 🛠️ Troubleshooting

### Gmail SMTP Issues
- **Enable 2-factor authentication** in Gmail
- **Use App Password**, not your regular password
- **Check "Less secure app access"** (if using old Gmail)

### Email Not Sending
- **Check .env file** is in backend folder
- **Verify SMTP credentials** in Gmail
- **Check backend logs** for error messages

### Email Goes to Spam
- **Use consistent FROM email** (support@todo-events.com)
- **Add SPF record** in Squarespace DNS
- **Consider Google Workspace** for better deliverability

## 📞 Support
If you need help with setup:
1. Check the backend logs for error messages
2. Verify your .env file configuration
3. Test SMTP credentials manually
4. Contact me for assistance

---

**Next Steps**: Set up email forwarding in Squarespace, then create your .env file with Gmail SMTP settings. 