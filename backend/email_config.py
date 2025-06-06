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
    
    def send_email(self, to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> bool:
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
                    server.send_message(msg)
            else:
                # Port 587 (and others) use explicit TLS (STARTTLS)
                self.logger.info("🔐 Using STARTTLS connection")
                with smtplib.SMTP(self.config['smtp_server'], smtp_port) as server:
                    self.logger.info("🔐 Starting TLS encryption...")
                    server.starttls()
                    
                    self.logger.info(f"🔑 Authenticating with {self.config['smtp_username']}")
                    server.login(self.config['smtp_username'], self.config['smtp_password'])
                    
                    self.logger.info("📬 Sending message...")
                    server.send_message(msg)
            
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