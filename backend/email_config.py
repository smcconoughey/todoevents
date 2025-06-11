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

# Create global email service instance
email_service = EmailService() 