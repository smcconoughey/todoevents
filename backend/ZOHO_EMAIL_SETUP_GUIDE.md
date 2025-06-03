# 📧 Complete Zoho Mail Setup Guide for Todo Events

## Overview
Set up professional email (support@todo-events.com) using Zoho Mail's free plan with your Squarespace domain.

## 🎯 Step 1: Zoho Mail Account Setup

### 1.1 Sign Up for Zoho Mail
1. Go to: https://zoho.com/mail/zohomail-pricing.html
2. Click **"Get Started Free"**
3. **Create Account**:
   - Use your personal email for the Zoho account
   - Choose a strong password
   - Complete verification

### 1.2 Add Your Domain
1. **Add Domain**: Enter `todo-events.com`
2. **Select Plan**: Choose "Forever Free" (5GB, 5 users)
3. **Domain Verification**: Zoho will provide verification methods

## 🔧 Step 2: Squarespace DNS Configuration

### 2.1 Access Squarespace DNS Settings
1. Log into your Squarespace account
2. Go to **Settings** → **Domains**
3. Click on **todo-events.com**
4. Click **DNS Settings**

### 2.2 Add Required DNS Records

**You'll need to add these records (Zoho will provide exact values):**

#### MX Records (Email Routing)
```
Priority: 10
Host: @
Points to: mx.zoho.com

Priority: 20  
Host: @
Points to: mx2.zoho.com

Priority: 50
Host: @
Points to: mx3.zoho.com
```

#### TXT Record (Domain Verification)
```
Host: @
Value: zoho-verification=zb########## (Zoho provides this)
```

#### CNAME Records (Email Services)
```
Host: mail
Points to: business.zoho.com

Host: imap
Points to: business.zoho.com

Host: smtp
Points to: business.zoho.com

Host: pop
Points to: business.zoho.com
```

#### SPF Record (Email Authentication)
```
Host: @
Value: v=spf1 include:zoho.com ~all
```

### 2.3 Squarespace-Specific Instructions
1. In DNS Settings, click **"Add Record"**
2. For each record type:
   - **MX Record**: Select "MX" → Enter priority and mail server
   - **TXT Record**: Select "TXT" → Enter host and value
   - **CNAME Record**: Select "CNAME" → Enter host and target
3. **Save all changes**
4. **Wait 24-48 hours** for DNS propagation

## 📨 Step 3: Create Email Account

### 3.1 Create support@todo-events.com
1. In Zoho Mail dashboard
2. **Users** → **Add User**
3. **Email**: support@todo-events.com
4. **Password**: Create a strong password
5. **Save and Activate**

### 3.2 Access Your Email
- **Web Access**: https://mail.zoho.com
- **Mobile Apps**: Download Zoho Mail app
- **Desktop**: Configure with IMAP/SMTP settings

## ⚙️ Step 4: SMTP Configuration for Backend

### 4.1 Get SMTP Credentials
**Zoho SMTP Settings:**
- **Server**: smtp.zoho.com
- **Port**: 587 (TLS) or 465 (SSL)
- **Username**: support@todo-events.com
- **Password**: Your Zoho Mail password
- **Security**: TLS/STARTTLS

### 4.2 Create .env File
Create or update `backend/.env`:

```bash
# Zoho Mail Configuration
SMTP_SERVER=smtp.zoho.com
SMTP_PORT=587
SMTP_USERNAME=support@todo-events.com
SMTP_PASSWORD=your-zoho-password-here
FROM_EMAIL=support@todo-events.com
FROM_NAME=Todo Events Support

# Other settings
DATABASE_URL=sqlite:///./events.db
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-here
DEBUG=true
ENVIRONMENT=development
```

### 4.3 Enable App-Specific Password (if needed)
If you have 2FA enabled on Zoho:
1. **Zoho Account** → **Security** → **App Passwords**
2. **Generate** app-specific password for SMTP
3. **Use this password** in your .env file instead of main password

## 🧪 Step 5: Test Email Functionality

### 5.1 Test SMTP Connection
```bash
cd backend
python -c "
from email_config import email_service
result = email_service.send_password_reset_email('your-test-email@gmail.com', '123456', 'Test User')
print(f'Email sent: {result}')
"
```

### 5.2 Test Password Reset Flow
1. Go to your frontend
2. Click **"Forgot Password"**
3. Enter an email address
4. Check if reset email arrives

## 📋 DNS Records Verification

### Check if DNS is Working
Use these tools to verify:
- **MX Records**: `nslookup -type=mx todo-events.com`
- **TXT Records**: `nslookup -type=txt todo-events.com`
- **Online Tools**: mxtoolbox.com, whatsmydns.net

## 🔍 Troubleshooting

### Common Issues:
1. **DNS not propagated**: Wait 24-48 hours after adding records
2. **SMTP authentication failed**: Check username/password in .env
3. **Port blocked**: Try port 465 instead of 587
4. **Two-factor authentication**: Use app-specific password

### Support Contacts:
- **Zoho Support**: https://help.zoho.com/portal/en/community
- **Squarespace DNS Help**: Contact their support team

## ✅ Final Checklist

- [ ] Zoho Mail account created
- [ ] Domain todo-events.com added to Zoho
- [ ] DNS records added to Squarespace
- [ ] support@todo-events.com email account created
- [ ] SMTP credentials added to backend/.env
- [ ] Password reset emails tested and working
- [ ] Email delivery confirmed

---

**Estimated Setup Time**: 30 minutes + 24-48 hours for DNS propagation
**Monthly Cost**: FREE (up to 5GB storage)
**Features**: Professional email, mobile apps, SMTP for automation

## Next Steps After Setup

1. **Test all email functionality**
2. **Set up email forwarding rules** if needed
3. **Configure email signatures**
4. **Add additional users** if required (up to 5 free)
5. **Set up autoresponders** for support emails 