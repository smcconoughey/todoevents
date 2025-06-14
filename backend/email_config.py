import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

# Email configuration
EMAIL_CONFIG = {
    'smtp_server': os.getenv('SMTP_SERVER', 'smtp.zoho.com'),
    'smtp_port': int(os.getenv('SMTP_PORT', '587')),
    'smtp_username': os.getenv('SMTP_USERNAME', 'support@todo-events.com'),
    'smtp_password': os.getenv('SMTP_PASSWORD', ''),
    'from_email': os.getenv('FROM_EMAIL', 'support@todo-events.com'),
    'from_name': os.getenv('FROM_NAME', 'Todo Events Support')
}

class EmailService:
    def __init__(self):
        self.config = EMAIL_CONFIG
        self.logger = logging.getLogger(__name__)
        
        # Validate configuration on initialization
        self._validate_config()
    
    def _validate_config(self):
        """Validate email configuration and warn about missing credentials"""
        if not self.config['smtp_password']:
            self.logger.warning("⚠️ SMTP_PASSWORD not set - email sending will fail")
            self.logger.warning("📋 Set environment variables or create .env file for local development")
        
        if not os.getenv('SMTP_USERNAME'):
            self.logger.warning("⚠️ Using default SMTP_USERNAME - may not work without proper setup")
            
        self.logger.info(f"📧 Email service initialized with server: {self.config['smtp_server']}")
        self.logger.info(f"👤 Username: {self.config['smtp_username']}")
        self.logger.info(f"📨 From: {self.config['from_email']}")
    
    def send_email(self, to_email: str, subject: str, html_content: str, text_content: Optional[str] = None, cc_email: Optional[str] = None) -> bool:
        """Send an email using SMTP"""
        
        # Check if credentials are available
        if not self.config['smtp_password']:
            self.logger.error("❌ Cannot send email: SMTP_PASSWORD not configured")
            self.logger.error("📋 Set SMTP_PASSWORD environment variable or create .env file")
            return False
            
        try:
            self.logger.info(f"📤 Attempting to send email to {to_email}")
            self.logger.info(f"🔌 Connecting to {self.config['smtp_server']}:{self.config['smtp_port']}")
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.config['from_name']} <{self.config['from_email']}>"
            msg['To'] = to_email
            
            # Add CC if specified
            if cc_email:
                msg['Cc'] = cc_email
            
            # Add text version if provided
            if text_content:
                text_part = MIMEText(text_content, 'plain')
                msg.attach(text_part)
            
            # Add HTML version
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            # Handle different ports and encryption methods
            smtp_port = self.config['smtp_port']
            
            if smtp_port == 465:
                # Port 465 uses implicit SSL (SMTPS)
                self.logger.info("🔐 Using SSL connection (port 465)")
                with smtplib.SMTP_SSL(self.config['smtp_server'], smtp_port) as server:
                    self.logger.info(f"🔑 Authenticating with {self.config['smtp_username']}")
                    server.login(self.config['smtp_username'], self.config['smtp_password'])
                    
                    self.logger.info("📬 Sending message...")
                    # Prepare recipient list (to + cc)
                    recipients = [to_email]
                    if cc_email:
                        recipients.append(cc_email)
                        self.logger.info(f"📧 CC: {cc_email}")
                    server.send_message(msg, to_addrs=recipients)
            else:
                # Port 587 (and others) use explicit TLS (STARTTLS)
                self.logger.info("🔐 Using STARTTLS connection")
                with smtplib.SMTP(self.config['smtp_server'], smtp_port) as server:
                    self.logger.info("🔐 Starting TLS encryption...")
                    server.starttls()
                    
                    self.logger.info(f"🔑 Authenticating with {self.config['smtp_username']}")
                    server.login(self.config['smtp_username'], self.config['smtp_password'])
                    
                    self.logger.info("📬 Sending message...")
                    # Prepare recipient list (to + cc)
                    recipients = [to_email]
                    if cc_email:
                        recipients.append(cc_email)
                        self.logger.info(f"📧 CC: {cc_email}")
                    server.send_message(msg, to_addrs=recipients)
            
            self.logger.info(f"✅ Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Failed to send email to {to_email}: {str(e)}")
            
            # Provide helpful debugging information
            if "Name or service not known" in str(e):
                self.logger.error("🔍 DNS resolution failed for SMTP server")
                self.logger.error(f"   Server: {self.config['smtp_server']}")
                self.logger.error("   Check internet connection and DNS settings")
                self.logger.error("   💡 Try using 'smtp.zoho.com' instead of 'smtppro.zoho.com'")
            elif "Authentication failed" in str(e) or "Invalid credentials" in str(e):
                self.logger.error("🔑 SMTP authentication failed")
                self.logger.error("   Check SMTP_USERNAME and SMTP_PASSWORD")
                self.logger.error("   💡 Make sure you're using your Zoho Mail password or app-specific password")
            elif "Connection refused" in str(e):
                self.logger.error("🚫 Connection refused by SMTP server")
                self.logger.error(f"   Check SMTP_SERVER ({self.config['smtp_server']}) and SMTP_PORT ({self.config['smtp_port']})")
            elif "Connection unexpectedly closed" in str(e):
                self.logger.error("🔌 Connection unexpectedly closed")
                self.logger.error("   This often happens when using wrong encryption method for the port")
                self.logger.error("   💡 For port 465: Use SSL (implicit). For port 587: Use STARTTLS (explicit)")
                self.logger.error("   💡 Try using smtp.zoho.com with port 587 instead")
            elif "SSL" in str(e) or "TLS" in str(e):
                self.logger.error("🔐 SSL/TLS encryption issue")
                self.logger.error("   💡 Try switching between port 465 (SSL) and 587 (STARTTLS)")
            
            return False
    
    def send_password_reset_email(self, to_email: str, reset_code: str, user_name: Optional[str] = None) -> bool:
        """Send password reset email"""
        subject = "Reset Your Todo Events Password"
        
        # Create HTML content
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Password Reset - Todo Events</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #f4d03f, #3498db); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ background: white; padding: 30px; border: 1px solid #e0e0e0; }}
                .reset-code {{ background: #f8f9fa; border: 2px dashed #3498db; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }}
                .reset-code h2 {{ color: #3498db; margin: 0; font-size: 32px; letter-spacing: 3px; }}
                .button {{ background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #666; }}
                .warning {{ background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎯 Todo Events</h1>
                    <p style="color: white; margin: 10px 0 0 0;">Password Reset Request</p>
                </div>
                
                <div class="content">
                    <h2>Hello{f' {user_name}' if user_name else ''}!</h2>
                    
                    <p>We received a request to reset your password for your Todo Events account. Use the verification code below to reset your password:</p>
                    
                    <div class="reset-code">
                        <h2>{reset_code}</h2>
                        <p style="margin: 10px 0 0 0; color: #666;">Enter this code in the password reset form</p>
                    </div>
                    
                    <div class="warning">
                        <strong>⚠️ Security Notice:</strong>
                        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                            <li>This code will expire in 15 minutes</li>
                            <li>If you didn't request this reset, please ignore this email</li>
                            <li>Never share this code with anyone</li>
                        </ul>
                    </div>
                    
                    <p>If you have any questions or need help, please contact our support team at <a href="mailto:support@todo-events.com">support@todo-events.com</a>.</p>
                    
                    <p>Best regards,<br>The Todo Events Team</p>
                </div>
                
                <div class="footer">
                    <p>© 2024 Todo Events. Find local events wherever you are.</p>
                    <p>This email was sent to {to_email}. If you no longer wish to receive these emails, you can update your preferences in your account settings.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Create text version
        text_content = f"""
        Todo Events - Password Reset Request
        
        Hello{f' {user_name}' if user_name else ''}!
        
        We received a request to reset your password for your Todo Events account.
        
        Your verification code: {reset_code}
        
        Enter this code in the password reset form to reset your password.
        
        Security Notice:
        - This code will expire in 15 minutes
        - If you didn't request this reset, please ignore this email
        - Never share this code with anyone
        
        If you have any questions, contact us at support@todo-events.com
        
        Best regards,
        The Todo Events Team
        
        © 2024 Todo Events. Find local events wherever you are.
        """
        
        return self.send_email(to_email, subject, html_content, text_content)
    
    def send_privacy_request_email(self, to_email: str, request_type: str, request_id: int, user_details: dict = None) -> bool:
        """Send privacy request confirmation email"""
        subject = f"Privacy Request Confirmation - Todo Events (#{request_id})"
        
        request_type_display = {
            'access': 'Data Access Request',
            'delete': 'Data Deletion Request', 
            'opt_out': 'Opt-Out Request'
        }.get(request_type, 'Privacy Request')
        
        # Create HTML content with enhanced support team information
        support_section = ""
        if user_details:
            support_section = f"""
            <div class="info-box" style="background: #fff8dc; border-left: 4px solid #f59e0b;">
                <h3 style="margin-top: 0; color: #f59e0b;">📋 Support Team Information</h3>
                <p><strong>Request Details:</strong></p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                    <li><strong>Email:</strong> {to_email}</li>
                    <li><strong>Full Name:</strong> {user_details.get('full_name', 'Not provided')}</li>
                    <li><strong>Request Type:</strong> {request_type_display}</li>
                    <li><strong>Verification Info:</strong> {user_details.get('verification_info', 'Not provided')}</li>
                    <li><strong>Additional Details:</strong> {user_details.get('details', 'None provided')}</li>
                    <li><strong>Submitted:</strong> {user_details.get('created_at', 'Just now')}</li>
                </ul>
                <p style="margin-top: 15px; font-size: 14px; color: #666;">This information is provided for support team reference.</p>
            </div>
            """
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Privacy Request Confirmation - Todo Events</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #6366f1, #3b82f6); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ background: white; padding: 30px; border: 1px solid #e0e0e0; }}
                .request-id {{ background: #f0f9ff; border: 2px solid #3b82f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }}
                .request-id h2 {{ color: #1d4ed8; margin: 0; font-size: 24px; }}
                .info-box {{ background: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🛡️ Todo Events Privacy</h1>
                    <p style="color: white; margin: 10px 0 0 0;">Request Confirmation</p>
                </div>
                
                <div class="content">
                    <h2>Privacy Request Received</h2>
                    
                    <p>We have received your <strong>{request_type_display}</strong> for your Todo Events account.</p>
                    
                    <div class="request-id">
                        <h2>Request ID: #{request_id}</h2>
                        <p style="margin: 10px 0 0 0; color: #666;">Keep this ID for your records</p>
                    </div>
                    
                    {support_section}
                    
                    <div class="info-box">
                        <h3 style="margin-top: 0;">What happens next?</h3>
                        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                            <li><strong>Processing Time:</strong> We will respond within 45 days as required by law</li>
                            <li><strong>Verification:</strong> We may contact you to verify your identity</li>
                            <li><strong>Updates:</strong> You'll receive email updates on your request status</li>
                            <li><strong>Questions:</strong> Contact us at <a href="mailto:support@todo-events.com">support@todo-events.com</a></li>
                        </ul>
                    </div>
                    
                    {self._get_request_specific_info(request_type)}
                    
                    <p>If you have any questions about this request or our privacy practices, please don't hesitate to contact our privacy team at <a href="mailto:support@todo-events.com">support@todo-events.com</a>.</p>
                    
                    <p>Thank you,<br>The Todo Events Privacy Team</p>
                </div>
                
                <div class="footer">
                    <p>© 2025 Watchtower AB, Inc. Your privacy matters to us.</p>
                    <p>This email was sent to {to_email} regarding request #{request_id}.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Create text version with support team details
        support_text = ""
        if user_details:
            support_text = f"""
        
        === SUPPORT TEAM INFORMATION ===
        Email: {to_email}
        Full Name: {user_details.get('full_name', 'Not provided')}
        Request Type: {request_type_display}
        Verification Info: {user_details.get('verification_info', 'Not provided')}
        Additional Details: {user_details.get('details', 'None provided')}
        Submitted: {user_details.get('created_at', 'Just now')}
        ==============================
        """
        
        text_content = f"""
        Todo Events - Privacy Request Confirmation
        
        We have received your {request_type_display} for your Todo Events account.
        
        Request ID: #{request_id}
        Keep this ID for your records.
        {support_text}
        
        What happens next?
        - Processing Time: We will respond within 45 days as required by law
        - Verification: We may contact you to verify your identity  
        - Updates: You'll receive email updates on your request status
        - Questions: Contact us at support@todo-events.com
        
        {self._get_request_specific_text(request_type)}
        
        If you have any questions, please contact support@todo-events.com.
        
        Thank you,
        The Todo Events Privacy Team
        
        This email was sent to {to_email} regarding request #{request_id}.
        """
        
        # Send email with CC to support team
        return self.send_email(
            to_email=to_email, 
            subject=subject, 
            html_content=html_content, 
            text_content=text_content,
            cc_email="support@todo-events.com"
        )
    
    def _get_request_specific_info(self, request_type: str) -> str:
        """Get request-specific information for HTML emails"""
        if request_type == 'access':
            return '''
            <div class="info-box">
                <h3 style="margin-top: 0;">Data Access Request Details</h3>
                <p>We will provide you with a complete export of all personal data we have collected about you, including:</p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                    <li>Account information and preferences</li>
                    <li>Events you've created or shown interest in</li>
                    <li>Page visit history and usage analytics</li>
                    <li>Any reports or communications you've submitted</li>
                </ul>
            </div>
            '''
        elif request_type == 'delete':
            return '''
            <div class="info-box">
                <h3 style="margin-top: 0;">Data Deletion Request Details</h3>
                <p>We will permanently delete all personal data associated with your account, including:</p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                    <li>Your user account and login credentials</li>
                    <li>Events you've created (these will be removed from the platform)</li>
                    <li>Your interest history and page visit data</li>
                    <li>Any reports or feedback you've submitted</li>
                </ul>
                <p><strong>Note:</strong> This action cannot be undone. You will need to create a new account if you wish to use our services again.</p>
            </div>
            '''
        elif request_type == 'opt_out':
            return '''
            <div class="info-box">
                <h3 style="margin-top: 0;">Opt-Out Request Details</h3>
                <p>We will restrict the use of your personal data as follows:</p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                    <li>Stop processing your data for marketing purposes</li>
                    <li>Limit analytics and tracking to essential functions only</li>
                    <li>Prevent sharing of your data with third parties</li>
                    <li>Maintain minimal data necessary for service operation</li>
                </ul>
            </div>
            '''
        return ''
    
    def _get_request_specific_text(self, request_type: str) -> str:
        """Get request-specific information for text emails"""
        if request_type == 'access':
            return '''Data Access Request Details:
We will provide you with a complete export of all personal data we have collected about you, including account information, events, page visits, and communications.'''
        elif request_type == 'delete':
            return '''Data Deletion Request Details:
We will permanently delete all personal data associated with your account. This action cannot be undone.'''
        elif request_type == 'opt_out':
            return '''Opt-Out Request Details:
We will restrict the use of your personal data for marketing, analytics, and third-party sharing while maintaining minimal data for service operation.'''
        return ''
    
    def send_welcome_email(self, to_email: str, user_name: str) -> bool:
        """Send welcome email for new users"""
        subject = "Welcome to Todo Events!"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Welcome to Todo Events</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #f4d03f, #3498db); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ background: white; padding: 30px; border: 1px solid #e0e0e0; }}
                .button {{ background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #666; }}
                .tips {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎯 Welcome to Todo Events!</h1>
                </div>
                
                <div class="content">
                    <h2>Hello {user_name}!</h2>
                    
                    <p>Welcome to Todo Events! We're excited to have you join our community of event discoverers and hosts.</p>
                    
                    <div class="tips">
                        <h3>🚀 Get Started:</h3>
                        <ul>
                            <li><strong>Discover Events:</strong> Browse local events on our interactive map</li>
                            <li><strong>Host Your Own:</strong> Create and share your events with the community</li>
                            <li><strong>Stay Updated:</strong> Get notifications for events you're interested in</li>
                        </ul>
                    </div>
                    
                    <a href="https://todo-events.com/hosts" class="button">Learn About Hosting Events</a>
                    
                    <p>If you have any questions or need help getting started, don't hesitate to reach out to us at <a href="mailto:support@todo-events.com">support@todo-events.com</a>.</p>
                    
                    <p>Happy event discovering!<br>The Todo Events Team</p>
                </div>
                
                <div class="footer">
                    <p>© 2024 Todo Events. Find local events wherever you are.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(to_email, subject, html_content)

    def send_premium_invitation_email(self, to_email: str, months: int, message: Optional[str] = None, invited_by: Optional[str] = None) -> bool:
        """Send premium invitation email to new users"""
        subject = "You're Invited to Todo Events Premium!"
        
        # Create HTML content
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Premium Invitation - Todo Events</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #8e44ad, #3498db); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ background: white; padding: 30px; border: 1px solid #e0e0e0; }}
                .premium-badge {{ background: linear-gradient(135deg, #8e44ad, #9b59b6); color: white; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px; }}
                .premium-badge h2 {{ margin: 0; font-size: 20px; }}
                .features {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .button {{ background: #8e44ad; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #666; }}
                .custom-message {{ background: #e8f5e8; border-left: 4px solid #27ae60; padding: 15px; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎯 Todo Events Premium</h1>
                    <p style="color: white; margin: 10px 0 0 0;">You're Invited!</p>
                </div>
                
                <div class="content">
                    <h2>Congratulations!</h2>
                    
                    <p>You've been invited to join Todo Events Premium{f' by {invited_by}' if invited_by else ''}! We're excited to offer you exclusive access to our premium features.</p>
                    
                    <div class="premium-badge">
                        <h2>🌟 {months} Month{'s' if months != 1 else ''} Premium Access</h2>
                        <p style="margin: 5px 0 0 0;">Complimentary invitation</p>
                    </div>
                    
                    {f'<div class="custom-message"><strong>Personal Message:</strong><br>{message}</div>' if message else ''}
                    
                    <div class="features">
                        <h3>🚀 Premium Features Include:</h3>
                        <ul>
                            <li><strong>✅ Auto-Verified Events:</strong> Your events get instant verification badges</li>
                            <li><strong>📊 Advanced Analytics:</strong> Detailed insights into your event performance</li>
                            <li><strong>🔄 Recurring Events:</strong> Create series and repeating events easily</li>
                            <li><strong>🎯 Priority Support:</strong> Get help faster with premium support</li>
                            <li><strong>📈 Enhanced Visibility:</strong> Your events get better placement in search</li>
                            <li><strong>🎨 Custom Branding:</strong> Add your personal touch to events</li>
                        </ul>
                    </div>
                    
                    <a href="https://todo-events.com/register?premium_invite=true" class="button">Accept Invitation & Sign Up</a>
                    
                    <p><strong>How to get started:</strong></p>
                    <ol>
                        <li>Click the button above to create your account</li>
                        <li>Use this email address ({to_email}) when signing up</li>
                        <li>Your premium access will be automatically activated</li>
                        <li>Start creating amazing events with premium features!</li>
                    </ol>
                    
                    <p>This invitation is valid for 30 days. If you have any questions, please contact us at <a href="mailto:support@todo-events.com">support@todo-events.com</a>.</p>
                    
                    <p>Welcome to the premium experience!<br>The Todo Events Team</p>
                </div>
                
                <div class="footer">
                    <p>© 2024 Todo Events. Premium event hosting made simple.</p>
                    <p>This invitation was sent to {to_email}. If you didn't expect this email, you can safely ignore it.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Create text version
        text_content = f"""
        Todo Events Premium Invitation
        
        Congratulations! You've been invited to join Todo Events Premium{f' by {invited_by}' if invited_by else ''}!
        
        Premium Access: {months} month{'s' if months != 1 else ''} (complimentary)
        
        {f'Personal Message: {message}' if message else ''}
        
        Premium Features Include:
        - Auto-Verified Events: Your events get instant verification badges
        - Advanced Analytics: Detailed insights into your event performance  
        - Recurring Events: Create series and repeating events easily
        - Priority Support: Get help faster with premium support
        - Enhanced Visibility: Your events get better placement in search
        - Custom Branding: Add your personal touch to events
        
        How to get started:
        1. Visit: https://todo-events.com/register?premium_invite=true
        2. Use this email address ({to_email}) when signing up
        3. Your premium access will be automatically activated
        4. Start creating amazing events with premium features!
        
        This invitation is valid for 30 days.
        
        Questions? Contact us at support@todo-events.com
        
        Welcome to the premium experience!
        The Todo Events Team
        
        This invitation was sent to {to_email}.
        """
        
        return self.send_email(to_email, subject, html_content, text_content)
    
    def send_enterprise_invitation_email(self, to_email: str, months: int, message: Optional[str] = None, invited_by: Optional[str] = None) -> bool:
        """Send enterprise invitation email to new users"""
        subject = "You're Invited to Todo Events Enterprise!"
        
        # Create HTML content
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Enterprise Invitation - Todo Events</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ background: white; padding: 30px; border: 1px solid #e0e0e0; }}
                .enterprise-badge {{ background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px; }}
                .enterprise-badge h2 {{ margin: 0; font-size: 20px; }}
                .features {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .button {{ background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #666; }}
                .custom-message {{ background: #e8f5e8; border-left: 4px solid #27ae60; padding: 15px; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🏢 Todo Events Enterprise</h1>
                    <p style="color: white; margin: 10px 0 0 0;">You're Invited!</p>
                </div>
                
                <div class="content">
                    <h2>Congratulations!</h2>
                    
                    <p>You've been invited to join Todo Events Enterprise{f' by {invited_by}' if invited_by else ''}! We're excited to offer you exclusive access to our enterprise-grade event management platform.</p>
                    
                    <div class="enterprise-badge">
                        <h2>🌟 {months} Month{'s' if months != 1 else ''} Enterprise Access</h2>
                        <p style="margin: 5px 0 0 0;">Complimentary invitation</p>
                    </div>
                    
                    {f'<div class="custom-message"><strong>Personal Message:</strong><br>{message}</div>' if message else ''}
                    
                    <div class="features">
                        <h3>🚀 Enterprise Features Include:</h3>
                        <ul>
                            <li><strong>🏢 Enterprise Dashboard:</strong> Advanced client management and analytics</li>
                            <li><strong>📊 Client Organization:</strong> Organize events by client with dedicated analytics</li>
                            <li><strong>📤 Bulk Import/Export:</strong> Upload hundreds of events with CSV/JSON support</li>
                            <li><strong>�� Advanced Filtering:</strong> Powerful search and filtering for large datasets</li>
                            <li><strong>✅ Auto-Verified Events:</strong> All events get instant verification badges</li>
                            <li><strong>📈 Real-time Analytics:</strong> Performance insights and engagement metrics</li>
                            <li><strong>🎯 250 Events/Month:</strong> High-volume event management capacity</li>
                            <li><strong>⚡ Priority Support:</strong> Dedicated enterprise support channel</li>
                        </ul>
                    </div>
                    
                    <a href="https://todo-events.com/register?enterprise_invite=true" class="button">Accept Invitation & Sign Up</a>
                    
                    <p><strong>How to get started:</strong></p>
                    <ol>
                        <li>Click the button above to create your account</li>
                        <li>Use this email address ({to_email}) when signing up</li>
                        <li>Your enterprise access will be automatically activated</li>
                        <li>Access the Enterprise Dashboard for advanced features</li>
                    </ol>
                    
                    <p>This invitation is valid for 30 days. If you have any questions, please contact us at <a href="mailto:support@todo-events.com">support@todo-events.com</a>.</p>
                    
                    <p>Welcome to the enterprise experience!<br>The Todo Events Team</p>
                </div>
                
                <div class="footer">
                    <p>© 2024 Todo Events. Enterprise event management made simple.</p>
                    <p>This invitation was sent to {to_email}. If you didn't expect this email, you can safely ignore it.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Create text version
        text_content = f"""
        Todo Events Enterprise Invitation
        
        Congratulations! You've been invited to join Todo Events Enterprise{f' by {invited_by}' if invited_by else ''}!
        
        Enterprise Access: {months} month{'s' if months != 1 else ''} (complimentary)
        
        {f'Personal Message: {message}' if message else ''}
        
        Enterprise Features Include:
        - Enterprise Dashboard: Advanced client management and analytics
        - Client Organization: Organize events by client with dedicated analytics
        - Bulk Import/Export: Upload hundreds of events with CSV/JSON support
        - Advanced Filtering: Powerful search and filtering for large datasets
        - Auto-Verified Events: All events get instant verification badges
        - Real-time Analytics: Performance insights and engagement metrics
        - 250 Events/Month: High-volume event management capacity
        - Priority Support: Dedicated enterprise support channel
        
        How to get started:
        1. Visit: https://todo-events.com/register?enterprise_invite=true
        2. Use this email address ({to_email}) when signing up
        3. Your enterprise access will be automatically activated
        4. Access the Enterprise Dashboard for advanced features
        
        This invitation is valid for 30 days.
        
        Questions? Contact us at support@todo-events.com
        
        Welcome to the enterprise experience!
        The Todo Events Team
        
        This invitation was sent to {to_email}.
        """
        
        return self.send_email(to_email, subject, html_content, text_content)
    
    def send_premium_notification_email(self, to_email: str, user_name: Optional[str] = None, expires_at: Optional[str] = None, granted_by: Optional[str] = None) -> bool:
        """Send notification email when premium access is granted to existing user"""
        subject = "🌟 You've Been Upgraded to Premium!"
        
        # Format expiration date
        expiry_text = ""
        if expires_at:
            try:
                from datetime import datetime
                if isinstance(expires_at, str):
                    expiry_date = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                else:
                    expiry_date = expires_at
                expiry_text = f"Your premium access expires on {expiry_date.strftime('%B %d, %Y')}."
            except:
                expiry_text = "Check your account for premium expiration details."
        
        # Create HTML content
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Premium Access Granted - Todo Events</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #8e44ad, #3498db); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ background: white; padding: 30px; border: 1px solid #e0e0e0; }}
                .premium-badge {{ background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }}
                .premium-badge h2 {{ margin: 0; font-size: 24px; }}
                .features {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .button {{ background: #8e44ad; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #666; }}
                .expiry-info {{ background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎯 Todo Events Premium</h1>
                    <p style="color: white; margin: 10px 0 0 0;">Account Upgraded!</p>
                </div>
                
                <div class="content">
                    <h2>Great news{f', {user_name}' if user_name else ''}!</h2>
                    
                    <p>Your Todo Events account has been upgraded to Premium{f' by {granted_by}' if granted_by else ''}! You now have access to all our premium features.</p>
                    
                    <div class="premium-badge">
                        <h2>🌟 Premium Access Activated</h2>
                        <p style="margin: 5px 0 0 0;">All premium features are now available</p>
                    </div>
                    
                    {f'<div class="expiry-info"><strong>📅 Access Details:</strong><br>{expiry_text}</div>' if expiry_text else ''}
                    
                    <div class="features">
                        <h3>🚀 Your Premium Features:</h3>
                        <ul>
                            <li><strong>✅ Auto-Verified Events:</strong> Your events now get instant verification badges</li>
                            <li><strong>📊 Advanced Analytics:</strong> Access detailed insights into your event performance</li>
                            <li><strong>🔄 Recurring Events:</strong> Create series and repeating events with ease</li>
                            <li><strong>🎯 Priority Support:</strong> Get faster help with premium support</li>
                            <li><strong>📈 Enhanced Visibility:</strong> Your events get better placement in search results</li>
                            <li><strong>🎨 Custom Branding:</strong> Add your personal touch to events</li>
                        </ul>
                    </div>
                    
                    <a href="https://todo-events.com/dashboard" class="button">Explore Premium Features</a>
                    
                    <p><strong>What's next?</strong></p>
                    <ul>
                        <li>Log in to your account to see the new premium features</li>
                        <li>Create your first premium event with auto-verification</li>
                        <li>Check out the advanced analytics for your existing events</li>
                        <li>Explore recurring event options for regular gatherings</li>
                    </ul>
                    
                    <p>If you have any questions about your premium features, please contact us at <a href="mailto:support@todo-events.com">support@todo-events.com</a>.</p>
                    
                    <p>Enjoy your premium experience!<br>The Todo Events Team</p>
                </div>
                
                <div class="footer">
                    <p>© 2024 Todo Events. Premium event hosting made simple.</p>
                    <p>This notification was sent to {to_email}.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Create text version
        text_content = f"""
        Todo Events Premium - Account Upgraded!
        
        Great news{f', {user_name}' if user_name else ''}!
        
        Your Todo Events account has been upgraded to Premium{f' by {granted_by}' if granted_by else ''}!
        
        {expiry_text if expiry_text else ''}
        
        Your Premium Features:
        - Auto-Verified Events: Your events now get instant verification badges
        - Advanced Analytics: Access detailed insights into your event performance
        - Recurring Events: Create series and repeating events with ease
        - Priority Support: Get faster help with premium support
        - Enhanced Visibility: Your events get better placement in search results
        - Custom Branding: Add your personal touch to events
        
        What's next?
        - Log in to your account to see the new premium features
        - Create your first premium event with auto-verification
        - Check out the advanced analytics for your existing events
        - Explore recurring event options for regular gatherings
        
        Visit your dashboard: https://todo-events.com/dashboard
        
        Questions? Contact us at support@todo-events.com
        
        Enjoy your premium experience!
        The Todo Events Team
        
        This notification was sent to {to_email}.
        """
        
        return self.send_email(to_email, subject, html_content, text_content)
    
    def send_enterprise_notification_email(self, to_email: str, user_name: Optional[str] = None, expires_at: Optional[str] = None, granted_by: Optional[str] = None) -> bool:
        """Send notification email when enterprise access is granted to existing user"""
        subject = "🏢 Welcome to Todo Events Enterprise!"
        
        # Format expiration date
        expiry_text = ""
        if expires_at:
            try:
                from datetime import datetime
                if isinstance(expires_at, str):
                    expiry_date = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                else:
                    expiry_date = expires_at
                expiry_text = f"Your enterprise access expires on {expiry_date.strftime('%B %d, %Y')}."
            except:
                expiry_text = "Check your account for enterprise access details."
        
        # Create HTML content
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Enterprise Access Granted - Todo Events</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ background: white; padding: 30px; border: 1px solid #e0e0e0; }}
                .enterprise-badge {{ background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }}
                .enterprise-badge h2 {{ margin: 0; font-size: 24px; }}
                .features {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .button {{ background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #666; }}
                .expiry-info {{ background: #f3e8ff; border: 1px solid #c4b5fd; padding: 15px; border-radius: 6px; margin: 20px 0; }}
                .enterprise-highlight {{ background: linear-gradient(135deg, #f3e8ff, #e0e7ff); padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🏢 Todo Events Enterprise</h1>
                    <p style="color: white; margin: 10px 0 0 0;">Account Upgraded!</p>
                </div>
                
                <div class="content">
                    <h2>Welcome to Enterprise{f', {user_name}' if user_name else ''}!</h2>
                    
                    <p>Your Todo Events account has been upgraded to Enterprise{f' by {granted_by}' if granted_by else ''}! You now have access to our most powerful features designed for organizations and high-volume event creators.</p>
                    
                    <div class="enterprise-badge">
                        <h2>🏢 Enterprise Access Activated</h2>
                        <p style="margin: 5px 0 0 0;">All enterprise features are now available</p>
                    </div>
                    
                    {f'<div class="expiry-info"><strong>📅 Access Details:</strong><br>{expiry_text}</div>' if expiry_text else ''}
                    
                    <div class="enterprise-highlight">
                        <h3>🚀 Enterprise Event Capacity:</h3>
                        <p><strong>250 Events</strong> - Create up to 250 events with full enterprise features</p>
                    </div>
                    
                    <div class="features">
                        <h3>🏢 Your Enterprise Features:</h3>
                        <ul>
                            <li><strong>✅ Auto-Verified Events:</strong> Your events get instant verification badges</li>
                            <li><strong>📊 Advanced Analytics:</strong> Access detailed insights into your event performance</li>
                            <li><strong>🔄 Recurring Events:</strong> Create series and repeating events with ease</li>
                            <li><strong>🎯 Priority Support:</strong> Get faster help with premium support</li>
                            <li><strong>📈 Enhanced Visibility:</strong> Your events get better placement in search results</li>
                            <li><strong>🎨 Custom Branding:</strong> Add your personal touch to events</li>
                        </ul>
                        <p><strong>🚀 Coming Soon:</strong> Enterprise dashboard with advanced team management and reporting features</p>
                    </div>
                    
                    <a href="https://todo-events.com/dashboard" class="button">Explore Enterprise Features</a>
                    
                    <p><strong>What's next?</strong></p>
                    <ul>
                        <li>Log in to your account to see the new enterprise features</li>
                        <li>Create your first enterprise event with auto-verification</li>
                        <li>Check out the advanced analytics for your existing events</li>
                        <li>Explore recurring event options for regular gatherings</li>
                        <li>Contact our support team for onboarding assistance</li>
                    </ul>
                    
                    <p>If you have any questions about your enterprise features or need assistance with setup, please contact our support team at <a href="mailto:support@todo-events.com">support@todo-events.com</a>.</p>
                    
                    <p>Welcome to Todo Events Enterprise!<br>The Todo Events Team</p>
                </div>
                
                <div class="footer">
                    <p>© 2024 Todo Events. Enterprise event hosting made simple.</p>
                    <p>This notification was sent to {to_email}.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Create text version
        text_content = f"""
        Todo Events Enterprise - Account Upgraded!
        
        Welcome to Enterprise{f', {user_name}' if user_name else ''}!
        
        Your Todo Events account has been upgraded to Enterprise{f' by {granted_by}' if granted_by else ''}!
        
        {expiry_text if expiry_text else ''}
        
        Enterprise Event Capacity: 250 Events
        Create up to 250 events with full enterprise features
        
                 Your Enterprise Features:
         - Auto-Verified Events: Your events get instant verification badges
         - Advanced Analytics: Access detailed insights into your event performance
         - Recurring Events: Create series and repeating events with ease
         - Priority Support: Get faster help with premium support
         - Enhanced Visibility: Your events get better placement in search results
         - Custom Branding: Add your personal touch to events
         
         Coming Soon: Enterprise dashboard with advanced team management and reporting features
        
                 What's next?
         - Log in to your account to see the new enterprise features
         - Create your first enterprise event with auto-verification
         - Check out the advanced analytics for your existing events
         - Explore recurring event options for regular gatherings
         - Contact our support team for onboarding assistance
        
        Visit your dashboard: https://todo-events.com/dashboard
        
                 Questions? Contact our support team at support@todo-events.com
        
        Welcome to Todo Events Enterprise!
        The Todo Events Team
        
        This notification was sent to {to_email}.
        """
        
        return self.send_email(to_email, subject, html_content, text_content)
    
    def send_premium_expiration_reminder_email(self, to_email: str, user_name: Optional[str] = None, expires_at: Optional[str] = None, days_remaining: int = 7) -> bool:
        """Send reminder email when premium access is about to expire"""
        subject = f"⏰ Premium Access Expires in {days_remaining} Days"
        
        # Format expiration date
        expiry_text = "soon"
        if expires_at:
            try:
                from datetime import datetime
                if isinstance(expires_at, str):
                    expiry_date = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                else:
                    expiry_date = expires_at
                expiry_text = f"on {expiry_date.strftime('%B %d, %Y')}"
            except:
                expiry_text = "soon"
        
        # Create HTML content
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Premium Expiration Reminder - Todo Events</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #e67e22, #f39c12); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ background: white; padding: 30px; border: 1px solid #e0e0e0; }}
                .warning-badge {{ background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }}
                .warning-badge h2 {{ margin: 0; font-size: 20px; }}
                .features {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .button {{ background: #e67e22; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎯 Todo Events Premium</h1>
                    <p style="color: white; margin: 10px 0 0 0;">Expiration Reminder</p>
                </div>
                
                <div class="content">
                    <h2>Don't lose your premium features{f', {user_name}' if user_name else ''}!</h2>
                    
                    <p>Your Todo Events Premium access will expire {expiry_text}. We wanted to give you a heads up so you don't lose access to your premium features.</p>
                    
                    <div class="warning-badge">
                        <h2>⏰ {days_remaining} Days Remaining</h2>
                        <p style="margin: 5px 0 0 0;">Premium access expires {expiry_text}</p>
                    </div>
                    
                    <div class="features">
                        <h3>🌟 Features You'll Lose:</h3>
                        <ul>
                            <li><strong>✅ Auto-Verified Events:</strong> Events will need manual verification</li>
                            <li><strong>📊 Advanced Analytics:</strong> Limited to basic event stats</li>
                            <li><strong>🔄 Recurring Events:</strong> No more series or repeating events</li>
                            <li><strong>🎯 Priority Support:</strong> Standard support response times</li>
                            <li><strong>📈 Enhanced Visibility:</strong> Standard search placement</li>
                            <li><strong>🎨 Custom Branding:</strong> Basic event styling only</li>
                        </ul>
                    </div>
                    
                    <a href="https://todo-events.com/premium/renew" class="button">Renew Premium Access</a>
                    
                    <p><strong>Want to continue with premium?</strong> Contact our team at <a href="mailto:support@todo-events.com">support@todo-events.com</a> to discuss renewal options.</p>
                    
                    <p>Thank you for being a premium member!<br>The Todo Events Team</p>
                </div>
                
                <div class="footer">
                    <p>© 2024 Todo Events. Premium event hosting made simple.</p>
                    <p>This reminder was sent to {to_email}.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Create text version
        text_content = f"""
        Todo Events Premium - Expiration Reminder
        
        Don't lose your premium features{f', {user_name}' if user_name else ''}!
        
        Your Todo Events Premium access will expire {expiry_text}.
        
        Days Remaining: {days_remaining}
        
        Features You'll Lose:
        - Auto-Verified Events: Events will need manual verification
        - Advanced Analytics: Limited to basic event stats
        - Recurring Events: No more series or repeating events
        - Priority Support: Standard support response times
        - Enhanced Visibility: Standard search placement
        - Custom Branding: Basic event styling only
        
        Want to continue with premium? Contact our team at support@todo-events.com to discuss renewal options.
        
        Renew at: https://todo-events.com/premium/renew
        
        Thank you for being a premium member!
        The Todo Events Team
        
        This reminder was sent to {to_email}.
        """
        
        return self.send_email(to_email, subject, html_content, text_content)
    
    def send_subscription_cancellation_email(self, to_email: str, user_name: Optional[str] = None, 
                                           cancellation_type: str = "scheduled", 
                                           effective_date: Optional[str] = None) -> bool:
        """Send subscription cancellation confirmation email"""
        
        # Determine subject and content based on cancellation type
        if cancellation_type == "immediate":
            subject = "Subscription Cancelled - TodoEvents"
            action_text = "immediately cancelled"
            access_text = "Your premium access has ended immediately."
        else:
            subject = "Subscription Scheduled for Cancellation - TodoEvents" 
            action_text = "scheduled for cancellation"
            if effective_date:
                try:
                    from datetime import datetime
                    if isinstance(effective_date, str):
                        end_date = datetime.fromisoformat(effective_date.replace('Z', '+00:00'))
                    else:
                        end_date = effective_date
                    formatted_date = end_date.strftime('%B %d, %Y')
                    access_text = f"You'll keep access to all premium features until {formatted_date}."
                except:
                    access_text = "You'll keep access to all premium features until your current billing period ends."
            else:
                access_text = "You'll keep access to all premium features until your current billing period ends."
        
        # Create HTML content
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Subscription Cancellation - TodoEvents</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #6c757d, #495057); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ background: white; padding: 30px; border: 1px solid #e0e0e0; }}
                .cancellation-notice {{ background: {'#ffe6e6' if cancellation_type == 'immediate' else '#fff3cd'}; border: 1px solid {'#ffcccc' if cancellation_type == 'immediate' else '#ffeaa7'}; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .what-happens {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .button {{ background: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎯 TodoEvents</h1>
                    <p style="color: white; margin: 10px 0 0 0;">Subscription Cancellation</p>
                </div>
                
                <div class="content">
                    <h2>Subscription Cancellation Confirmed{f', {user_name}' if user_name else ''}</h2>
                    
                    <p>We've received and processed your cancellation request. Your TodoEvents Premium subscription has been {action_text}.</p>
                    
                    <div class="cancellation-notice">
                        <h3>📋 Cancellation Details</h3>
                        <p><strong>Status:</strong> {"Cancelled Immediately" if cancellation_type == "immediate" else "Scheduled for Cancellation"}</p>
                        <p><strong>Access:</strong> {access_text}</p>
                        {f'<p><strong>Effective Date:</strong> {formatted_date if effective_date else "End of current billing period"}</p>' if cancellation_type == "scheduled" else ''}
                    </div>
                    
                    <div class="what-happens">
                        <h3>What happens next?</h3>
                        <ul>
                            {"<li>Your premium access has ended immediately</li>" if cancellation_type == "immediate" else f"<li>You'll continue to have premium access until {formatted_date if effective_date else 'your billing period ends'}</li>"}
                            <li>No future charges will be made to your payment method</li>
                            <li>Your account will remain active with free features</li>
                            <li>All your events and data will be preserved</li>
                            {"<li>You can resubscribe anytime to regain premium features</li>" if cancellation_type == "immediate" else "<li>You can reactivate your subscription anytime before it ends</li>"}
                        </ul>
                    </div>
                    
                    {f'<a href="https://todo-events.com/subscription" class="button">{"Resubscribe to Premium" if cancellation_type == "immediate" else "Reactivate Subscription"}</a>' if cancellation_type != "scheduled" else ''}
                    
                    <p><strong>Need help or changed your mind?</strong> Our support team is here to help! Contact us at <a href="mailto:support@todo-events.com">support@todo-events.com</a> or visit your <a href="https://todo-events.com/subscription">subscription management page</a>.</p>
                    
                    <p>Thank you for being a TodoEvents Premium member. We're sorry to see you go, but you're always welcome back!</p>
                    
                    <p>Best regards,<br>The TodoEvents Team</p>
                </div>
                
                <div class="footer">
                    <p>© 2024 TodoEvents. Premium event hosting made simple.</p>
                    <p>This confirmation was sent to {to_email}.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Create text version
        text_content = f"""
        TodoEvents - Subscription Cancellation Confirmed
        
        Subscription Cancellation Confirmed{f', {user_name}' if user_name else ''}
        
        We've received and processed your cancellation request. Your TodoEvents Premium subscription has been {action_text}.
        
        Cancellation Details:
        - Status: {"Cancelled Immediately" if cancellation_type == "immediate" else "Scheduled for Cancellation"}
        - Access: {access_text}
        {f'- Effective Date: {formatted_date if effective_date else "End of current billing period"}' if cancellation_type == "scheduled" else ''}
        
        What happens next?
        {"- Your premium access has ended immediately" if cancellation_type == "immediate" else f"- You'll continue to have premium access until {formatted_date if effective_date else 'your billing period ends'}"}
        - No future charges will be made to your payment method
        - Your account will remain active with free features  
        - All your events and data will be preserved
        {"- You can resubscribe anytime to regain premium features" if cancellation_type == "immediate" else "- You can reactivate your subscription anytime before it ends"}
        
        Need help or changed your mind? Contact us at support@todo-events.com or visit:
        https://todo-events.com/subscription
        
        Thank you for being a TodoEvents Premium member. We're sorry to see you go, but you're always welcome back!
        
        Best regards,
        The TodoEvents Team
        
        This confirmation was sent to {to_email}.
        """
        
        return self.send_email(to_email, subject, html_content, text_content)

# Create global email service instance
email_service = EmailService() 