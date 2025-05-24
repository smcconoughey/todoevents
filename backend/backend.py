import os
import re
import sqlite3
import logging
import time
from typing import Optional, List
from datetime import datetime, timedelta
from contextlib import contextmanager
from enum import Enum

import uvicorn
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response, JSONResponse

from pydantic import BaseModel, EmailStr, validator
from passlib.context import CryptContext
import jwt

# Load environment variables
load_dotenv()

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key-for-development-only")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# Environment configuration 
IS_PRODUCTION = os.getenv("RENDER", False) or os.getenv("RAILWAY_ENVIRONMENT", False)
DB_URL = os.getenv("DATABASE_URL", None)

# Password hashing setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="EventFinder API")

# Dynamic CORS origins based on environment
def get_cors_origins():
    base_origins = [
        "http://localhost:5173",  # Local Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:5174",  # Admin dashboard local
        "http://127.0.0.1:5174",
    ]
    
    if IS_PRODUCTION:
        # In production, add common Render.com patterns including the actual deployed URL
        production_origins = [
            "https://todoevents.onrender.com",  # Actual frontend URL
            "https://eventfinder-api.onrender.com",
            "https://eventfinder-web.onrender.com", 
            "https://eventfinder-admin.onrender.com",
            "https://todoevents-1.onrender.com",
            "https://todoevents-1-frontend.onrender.com", 
            "https://todoevents-1-web.onrender.com",
            "https://todoevents-api.onrender.com",
            "https://todoevents-frontend.onrender.com",
            "https://todoevents-web.onrender.com",
        ]
        return base_origins + production_origins
    else:
        return base_origins

# Custom CORS middleware for flexible Render.com handling
@app.middleware("http")
async def cors_handler(request, call_next):
    # Log the request for debugging
    origin = request.headers.get("origin")
    logger.info(f"Request: {request.method} {request.url} from origin: {origin}")
    
    # Handle preflight requests
    if request.method == "OPTIONS":
        logger.info(f"Handling preflight request from origin: {origin}")
        
        # For any origin, send proper preflight response
        allowed_origin = origin if origin else "*"
        
        if ("localhost" in origin or "127.0.0.1" in origin) or \
           (IS_PRODUCTION and ".onrender.com" in origin):
            logger.info(f"Allowing origin: {origin}")
        else:
            logger.warning(f"Unrecognized origin in preflight but allowing for debugging: {origin}")
            
        return Response(
            headers={
                "Access-Control-Allow-Origin": allowed_origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "86400",
            }
        )
    
    try:
        # Call the next middleware or endpoint handler
        response = await call_next(request)
        
        # Add CORS headers to successful responses
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            logger.info(f"Added CORS headers for successful response to origin: {origin}")
        
        return response
        
    except Exception as e:
        # Handle exceptions and ensure CORS headers are added to error responses
        logger.error(f"Error during request processing: {str(e)}")
        
        # Create response with error details
        status_code = 500
        if isinstance(e, HTTPException):
            status_code = e.status_code
            
        error_response = JSONResponse(
            status_code=status_code,
            content={"detail": str(e)},
        )
        
        # Add CORS headers to error response
        if origin:
            error_response.headers["Access-Control-Allow-Origin"] = origin
            error_response.headers["Access-Control-Allow-Credentials"] = "true"
            logger.info(f"Added CORS headers for error response to origin: {origin}")
            
        return error_response

# CORS middleware with dynamic origins (as fallback)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400,  # Cache preflight requests for 24 hours
)

# Database file for SQLite (development only)
DB_FILE = os.path.join(os.path.dirname(__file__), "events.db")

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"

# Database context manager with retry logic
@contextmanager
def get_db():
    if IS_PRODUCTION and DB_URL:
        # In production with PostgreSQL
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        # Add retry logic for database connections
        retry_count = 10  # Increased from 5
        conn = None
        
        for attempt in range(retry_count):
            try:
                # Add connection pooling and extended timeout parameters
                logger.info(f"Connecting to PostgreSQL (attempt {attempt+1}/{retry_count})")
                conn = psycopg2.connect(
                    DB_URL,
                    cursor_factory=RealDictCursor,
                    connect_timeout=15,  # Reduced from 30 to 15 seconds for faster retries
                    keepalives=1,
                    keepalives_idle=30,
                    keepalives_interval=10,
                    keepalives_count=5
                )
                conn.autocommit = True
                logger.info("PostgreSQL connection successful")
                
                try:
                    cur = conn.cursor()
                    # Test the connection with a simple query with timeout
                    cur.execute("SELECT 1")
                    yield conn
                    break
                finally:
                    if conn:
                        conn.close()
                        logger.info("PostgreSQL connection closed")
            except Exception as e:
                if conn:
                    try:
                        conn.close()
                    except:
                        pass
                
                error_msg = str(e)
                logger.error(f"Database connection failed (attempt {attempt+1}/{retry_count}): {error_msg}")
                
                if attempt < retry_count - 1:
                    # Exponential backoff with shorter base wait time
                    wait_time = min(2 ** attempt, 8)  # Cap at 8 seconds
                    logger.info(f"Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                else:
                    logger.critical(f"Failed to connect to database after {retry_count} attempts: {error_msg}")
                    # Instead of falling back to SQLite, raise a proper HTTP exception
                    # This is better for debugging connection issues in production
                    raise HTTPException(
                        status_code=503,
                        detail="Database connection failed. Please try again later."
                    )
    else:
        # Local development with SQLite
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

# Helper function to get placeholder style based on environment
def get_placeholder():
    if IS_PRODUCTION and DB_URL:
        return "%s"  # PostgreSQL uses %s
    else:
        return "?"   # SQLite uses ?

# Database initialization
def init_db():
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            if IS_PRODUCTION and DB_URL:
                # PostgreSQL table creation
                
                # Create users table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        email TEXT UNIQUE NOT NULL,
                        hashed_password TEXT NOT NULL,
                        role TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create events table with user relationship
                c.execute('''
                    CREATE TABLE IF NOT EXISTS events (
                        id SERIAL PRIMARY KEY,
                        title TEXT NOT NULL,
                        description TEXT NOT NULL,
                        date TEXT NOT NULL,
                        time TEXT NOT NULL,
                        category TEXT NOT NULL,
                        address TEXT NOT NULL,
                        lat REAL NOT NULL,
                        lng REAL NOT NULL,
                        recurring BOOLEAN NOT NULL DEFAULT FALSE,
                        frequency TEXT,
                        end_date TEXT,
                        created_by INTEGER,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(created_by) REFERENCES users(id)
                    )
                ''')
                
                # Create activity_logs table
                c.execute('''
                    CREATE TABLE IF NOT EXISTS activity_logs (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER,
                        action TEXT NOT NULL,
                        details TEXT,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(user_id) REFERENCES users(id)
                    )
                ''')
            else:
                # SQLite table creation (existing code)
                c.execute('''CREATE TABLE IF NOT EXISTS users (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            email TEXT UNIQUE NOT NULL,
                            hashed_password TEXT NOT NULL,
                            role TEXT NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )''')
                
                c.execute('''CREATE TABLE IF NOT EXISTS events (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            title TEXT NOT NULL,
                            description TEXT NOT NULL,
                            date TEXT NOT NULL,
                            time TEXT NOT NULL,
                            category TEXT NOT NULL,
                            address TEXT NOT NULL,
                            lat REAL NOT NULL,
                            lng REAL NOT NULL,
                            recurring BOOLEAN NOT NULL DEFAULT 0,
                            frequency TEXT,
                            end_date TEXT,
                            created_by INTEGER,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY(created_by) REFERENCES users(id)
                        )''')
                
                c.execute('''CREATE TABLE IF NOT EXISTS activity_logs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER,
                            action TEXT NOT NULL,
                            details TEXT,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY(user_id) REFERENCES users(id)
                        )''')
                
            # Ensure password_resets table exists
            if IS_PRODUCTION and DB_URL:
                c.execute('''
                    CREATE TABLE IF NOT EXISTS password_resets (
                        id SERIAL PRIMARY KEY,
                        email TEXT NOT NULL,
                        reset_code TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL
                    )
                ''')
            else:
                c.execute('''
                    CREATE TABLE IF NOT EXISTS password_resets (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT NOT NULL,
                        reset_code TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL
                    )
                ''')
            
            # Check for default admin user and create if needed
            create_default_admin_user(conn)
            
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        # Don't raise the exception here - this allows the app to start even if DB init fails
        # We'll handle DB errors at the endpoint level

def create_default_admin_user(conn):
    """Create a default admin user if no admin users exist in the database"""
    try:
        placeholder = get_placeholder()
        c = conn.cursor()
        
        # Check if any admin users exist
        c.execute(f"SELECT COUNT(*) as admin_count FROM users WHERE role = {placeholder}", (UserRole.ADMIN,))
        admin_count = c.fetchone()
        
        # Convert to integer based on database type
        if IS_PRODUCTION and DB_URL:
            # PostgreSQL returns a dict
            admin_count = admin_count['admin_count']
        else:
            # SQLite returns a tuple
            admin_count = admin_count[0]
            
        if admin_count == 0:
            logger.info("No admin users found. Creating default admin user.")
            admin_email = "admin@todoevents.com"
            admin_password = "Admin123!"  # This should be changed after first login
            hashed_password = get_password_hash(admin_password)
            
            c.execute(
                f"INSERT INTO users (email, hashed_password, role) VALUES ({placeholder}, {placeholder}, {placeholder})",
                (admin_email, hashed_password, UserRole.ADMIN)
            )
            conn.commit()
            logger.info(f"Default admin user created: {admin_email}")
            logger.info("IMPORTANT: Remember to change the default admin password after first login")
        else:
            logger.info(f"Found {admin_count} existing admin users. Default admin creation skipped.")
            
    except Exception as e:
        logger.error(f"Error creating default admin user: {str(e)}")

# Initialize database
try:
    init_db()
except Exception as e:
    logger.error(f"Database initialization failed: {str(e)}")

# Password Validation System
class PasswordValidator:
    """
    Comprehensive password validation system with detailed feedback
    """
    @staticmethod
    def validate_password(password: str) -> dict:
        """
        Validate password and return detailed feedback
        
        Returns a dictionary with:
        - is_valid: Boolean indicating if password meets all criteria
        - feedback: List of specific validation messages
        - strength: Strength rating (weak/medium/strong)
        """
        # Initialize validation results
        validation_result = {
            "is_valid": True,
            "feedback": [],
            "strength": "weak"
        }
        
        # Check length
        if len(password) < 8:
            validation_result["is_valid"] = False
            validation_result["feedback"].append(
                "Password must be at least 8 characters long"
            )
        
        # Check for uppercase letters
        if not re.search(r'[A-Z]', password):
            validation_result["is_valid"] = False
            validation_result["feedback"].append(
                "Password must contain at least one uppercase letter"
            )
        
        # Check for lowercase letters
        if not re.search(r'[a-z]', password):
            validation_result["is_valid"] = False
            validation_result["feedback"].append(
                "Password must contain at least one lowercase letter"
            )
        
        # Check for numbers
        if not re.search(r'\d', password):
            validation_result["is_valid"] = False
            validation_result["feedback"].append(
                "Password must contain at least one number"
            )
        
        # Check for special characters
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            validation_result["is_valid"] = False
            validation_result["feedback"].append(
                "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)"
            )
        
        # Check for common weak passwords
        common_weak_passwords = [
            "password", "123456", "qwerty", "admin", 
            "letmein", "welcome", "monkey", "abc123"
        ]
        if password.lower() in common_weak_passwords:
            validation_result["is_valid"] = False
            validation_result["feedback"].append(
                "Password is too common and easily guessable"
            )
        
        # Determine strength
        strength_criteria = 0
        if len(password) >= 12:
            strength_criteria += 1
        if re.search(r'[A-Z]', password) and re.search(r'[a-z]', password):
            strength_criteria += 1
        if re.search(r'\d', password):
            strength_criteria += 1
        if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            strength_criteria += 1
        
        if strength_criteria <= 1:
            validation_result["strength"] = "weak"
        elif strength_criteria <= 3:
            validation_result["strength"] = "medium"
        else:
            validation_result["strength"] = "strong"
        
        return validation_result

# Pydantic Models
class EventBase(BaseModel):
    title: str
    description: str
    date: str
    time: str
    category: str
    address: str
    lat: float
    lng: float
    recurring: bool = False
    frequency: Optional[str] = None
    end_date: Optional[str] = None

    @validator('date')
    def validate_date(cls, v):
        try:
            # Try parsing the date to ensure it's in a valid format
            datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError('Date must be in YYYY-MM-DD format')

    @validator('time')
    def validate_time(cls, v):
        try:
            # Try parsing the time to ensure it's in a valid format
            datetime.strptime(v, '%H:%M')
            return v
        except ValueError:
            raise ValueError('Time must be in HH:MM 24-hour format')

class EventCreate(EventBase):
    pass

class EventResponse(EventBase):
    id: int
    created_by: int
    created_at: str

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.USER

    @validator('password')
    def validate_password(cls, v):
        # Use the PasswordValidator to get validation results
        validation = PasswordValidator.validate_password(v)
        
        # If not valid, raise a validation error with all feedback
        if not validation['is_valid']:
            raise ValueError('\n'.join(validation['feedback']))
        
        return v

class UserResponse(UserBase):
    id: int
    role: UserRole

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# Security Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.JWTError:
        raise credentials_exception

    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute(f"SELECT * FROM users WHERE email = {placeholder}", (email,))
            user = c.fetchone()
            if user is None:
                raise credentials_exception
            return dict(user)
    except Exception as e:
        logger.error(f"Error fetching user: {str(e)}")
        raise credentials_exception

# Authentication Endpoints
@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    placeholder = get_placeholder()
    logger.info(f"Login attempt for user: {form_data.username}")
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # First check connection health with a simple query
            try:
                c.execute("SELECT 1")
            except Exception as e:
                logger.error(f"Database health check failed during login: {str(e)}")
                raise HTTPException(
                    status_code=503, 
                    detail="Database connection issues. Please try again later."
                )
            
            # Find user by email - with timeout handling
            user = None
            try:
                c.execute(f"SELECT * FROM users WHERE email = {placeholder}", (form_data.username,))
                user = c.fetchone()
                
                if not user:
                    logger.warning(f"Login failed for user: {form_data.username} - User not found")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Incorrect email or password",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                
                if not verify_password(form_data.password, user["hashed_password"]):
                    logger.warning(f"Login failed for user: {form_data.username} - Invalid credentials")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Incorrect email or password",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            except HTTPException:
                raise
            except Exception as e:
                error_msg = str(e)
                logger.error(f"Database error during login user lookup: {error_msg}")
                
                if "timeout" in error_msg.lower() or "deadlock" in error_msg.lower():
                    raise HTTPException(
                        status_code=408, 
                        detail="Login request timed out. Please try again."
                    )
                else:
                    raise HTTPException(
                        status_code=500,
                        detail="Internal server error during login",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            
            # Generate access token
            if user:  # Extra safety check
                try:
                    logger.info(f"Generating access token for user: {form_data.username}")
                    access_token = create_access_token(data={"sub": user["email"]})
                    logger.info(f"Login successful for user: {form_data.username}")
                    return {"access_token": access_token, "token_type": "bearer"}
                except Exception as e:
                    logger.error(f"Error generating access token: {str(e)}")
                    raise HTTPException(
                        status_code=500,
                        detail="Error generating authentication token",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            else:
                # This should not happen due to the checks above, but as a fallback
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication failed",
                    headers={"WWW-Authenticate": "Bearer"},
                )
                
    except HTTPException as http_ex:
        # Pass through HTTP exceptions
        raise http_ex
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Unexpected error during login: {error_msg}")
        
        # Return more specific error messages
        if "timeout" in error_msg.lower():
            raise HTTPException(
                status_code=408, 
                detail="Login request timed out. Please try again later."
            )
        elif "connection" in error_msg.lower():
            raise HTTPException(
                status_code=503, 
                detail="Database connection issues. Please try again later."
            )
        else:
            # Catch all for any other unexpected errors
            raise HTTPException(
                status_code=500,
                detail="Internal server error during login",
                headers={"WWW-Authenticate": "Bearer"},
            )

@app.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate):
    # Validate password (this will raise an error if invalid)
    password_validation = PasswordValidator.validate_password(user.password)
    
    placeholder = get_placeholder()
    
    # Pre-hash password outside the database transaction to reduce transaction time
    hashed_password = get_password_hash(user.password)
    
    # Log the registration attempt
    logger.info(f"Registration attempt for email: {user.email}")
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # First check connection health with a simple query
            try:
                c.execute("SELECT 1")
            except Exception as e:
                logger.error(f"Database health check failed during registration: {str(e)}")
                raise HTTPException(
                    status_code=503, 
                    detail="Database connection issues. Please try again later."
                )
            
            # Check if email exists - with timeout handling
            try:
                c.execute(f"SELECT id FROM users WHERE email = {placeholder}", (user.email,))
                existing_user = c.fetchone()
                if existing_user:
                    logger.info(f"Registration failed: Email already exists - {user.email}")
                    raise HTTPException(status_code=400, detail="Email already registered")
            except Exception as e:
                if "timeout" in str(e).lower() or "deadlock" in str(e).lower():
                    logger.error(f"Timeout checking for existing email: {str(e)}")
                    raise HTTPException(
                        status_code=408, 
                        detail="Registration request timed out. Please try again."
                    )
                raise
            
            # Insert user with optimized query - with timeout handling
            try:
                logger.info(f"Inserting new user into database: {user.email}")
                c.execute(
                    f"INSERT INTO users (email, hashed_password, role) VALUES ({placeholder}, {placeholder}, {placeholder})",
                    (user.email, hashed_password, user.role)
                )
                conn.commit()
                logger.info(f"User inserted successfully: {user.email}")
            except Exception as e:
                conn.rollback()
                error_msg = str(e)
                logger.error(f"Error inserting user: {error_msg}")
                
                if "timeout" in error_msg.lower() or "deadlock" in error_msg.lower():
                    raise HTTPException(
                        status_code=408, 
                        detail="Registration request timed out. The server might be busy, please try again."
                    )
                elif "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
                    raise HTTPException(status_code=400, detail="Email already registered")
                else:
                    raise HTTPException(status_code=500, detail="Error creating user")
            
            # Get the created user ID
            try:
                # For PostgreSQL, we need to use a different method to get the last inserted ID
                if IS_PRODUCTION and DB_URL:
                    c.execute("SELECT lastval()")
                    last_id = c.fetchone()
                    if last_id is None:
                        raise ValueError("Failed to get last inserted ID")
                    last_id = last_id[0] if isinstance(last_id, (list, tuple, dict)) else last_id
                else:
                    last_id = c.lastrowid
                    
                logger.info(f"Fetching created user with ID {last_id}")
                c.execute(f"SELECT * FROM users WHERE id = {placeholder}", (last_id,))
                user_data = dict(c.fetchone())
                
                # Return user data along with password strength
                logger.info(f"User registration successful: {user.email}")
                return {
                    **user_data,
                    "password_strength": password_validation['strength']
                }
            except Exception as e:
                logger.error(f"Error retrieving created user: {str(e)}")
                # Even if we can't fetch the user, registration was successful
                return {
                    "id": last_id,
                    "email": user.email,
                    "role": user.role,
                    "password_strength": password_validation['strength']
                }
                
    except HTTPException as http_ex:
        # Pass through HTTP exceptions
        raise http_ex
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Unexpected error creating user: {error_msg}")
        
        # Return more specific error messages
        if "timeout" in error_msg.lower():
            raise HTTPException(
                status_code=408, 
                detail="Registration request timed out. Please try again later."
            )
        elif "connection" in error_msg.lower():
            raise HTTPException(
                status_code=503, 
                detail="Database connection issues. Please try again later."
            )
        else:
            raise HTTPException(status_code=500, detail="Error creating user")

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user

# Password Strength Check Endpoint
@app.post("/password-strength")
async def check_password_strength(password: str):
    """
    Endpoint to check password strength without creating a user
    Useful for real-time password feedback
    """
    return PasswordValidator.validate_password(password)

# Password Reset Models
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetVerify(BaseModel):
    email: EmailStr
    reset_code: str

class PasswordReset(BaseModel):
    email: EmailStr
    reset_code: str
    new_password: str
    
    @validator('new_password')
    def validate_password(cls, v):
        # Use the PasswordValidator to get validation results
        validation = PasswordValidator.validate_password(v)
        
        # If not valid, raise a validation error with all feedback
        if not validation['is_valid']:
            raise ValueError('\n'.join(validation['feedback']))
        
        return v

# Password Reset Endpoints
@app.post("/request-password-reset")
async def request_password_reset(request: PasswordResetRequest):
    """Request a password reset code"""
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user exists
            c.execute(f"SELECT * FROM users WHERE email = {placeholder}", (request.email,))
            user = c.fetchone()
            
            if not user:
                # Always return success for security reasons
                # This prevents email enumeration attacks
                return {"detail": "If your email is registered, you will receive a reset code"}
            
            # Generate a 6-digit reset code
            import random
            reset_code = ''.join(random.choices('0123456789', k=6))
            reset_expiry = datetime.utcnow() + timedelta(minutes=30)
            
            # Store the reset code in the database
            # First, create a password_resets table if it doesn't exist
            if IS_PRODUCTION and DB_URL:
                c.execute('''
                    CREATE TABLE IF NOT EXISTS password_resets (
                        id SERIAL PRIMARY KEY,
                        email TEXT NOT NULL,
                        reset_code TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL
                    )
                ''')
            else:
                c.execute('''
                    CREATE TABLE IF NOT EXISTS password_resets (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT NOT NULL,
                        reset_code TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL
                    )
                ''')
            
            # Delete any existing reset codes for this user
            c.execute(f"DELETE FROM password_resets WHERE email = {placeholder}", (request.email,))
            
            # Insert the new reset code
            c.execute(
                f"INSERT INTO password_resets (email, reset_code, expires_at) VALUES ({placeholder}, {placeholder}, {placeholder})",
                (request.email, reset_code, reset_expiry)
            )
            
            # In a real production system, you would send an email with the reset code
            # For demo purposes, we'll just log it
            logger.info(f"Password reset code for {request.email}: {reset_code}")
            
            # For development, return the reset code in the response
            # In production, remove this and use proper email delivery
            if not IS_PRODUCTION:
                return {
                    "detail": "Reset code generated",
                    "reset_code": reset_code
                }
            
            return {"detail": "If your email is registered, you will receive a reset code"}
            
    except Exception as e:
        logger.error(f"Error requesting password reset: {str(e)}")
        raise HTTPException(status_code=500, detail="Error requesting password reset")

@app.post("/verify-reset-code")
async def verify_reset_code(request: PasswordResetVerify):
    """Verify a password reset code"""
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if reset code exists and is valid
            c.execute(
                f"SELECT * FROM password_resets WHERE email = {placeholder} AND reset_code = {placeholder} AND expires_at > {placeholder}",
                (request.email, request.reset_code, datetime.utcnow())
            )
            reset = c.fetchone()
            
            if not reset:
                raise HTTPException(status_code=400, detail="Invalid or expired reset code")
            
            return {"detail": "Reset code verified"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying reset code: {str(e)}")
        raise HTTPException(status_code=500, detail="Error verifying reset code")

@app.post("/reset-password")
async def reset_password(request: PasswordReset):
    """Reset password with a valid reset code"""
    placeholder = get_placeholder()
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if reset code exists and is valid
            c.execute(
                f"SELECT * FROM password_resets WHERE email = {placeholder} AND reset_code = {placeholder} AND expires_at > {placeholder}",
                (request.email, request.reset_code, datetime.utcnow())
            )
            reset = c.fetchone()
            
            if not reset:
                raise HTTPException(status_code=400, detail="Invalid or expired reset code")
            
            # Update the user's password
            hashed_password = get_password_hash(request.new_password)
            c.execute(
                f"UPDATE users SET hashed_password = {placeholder} WHERE email = {placeholder}",
                (hashed_password, request.email)
            )
            
            # Delete all reset codes for this user
            c.execute(f"DELETE FROM password_resets WHERE email = {placeholder}", (request.email,))
            
            return {"detail": "Password has been reset successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {str(e)}")
        raise HTTPException(status_code=500, detail="Error resetting password")

# Event Endpoints
@app.get("/events", response_model=List[EventResponse])
async def list_events(
    category: Optional[str] = None,
    date: Optional[str] = None
):
    """
    Retrieve events with optional filtering by category and date.
    Open to all users, no authentication required.
    """
    placeholder = get_placeholder()
    
    try:
        # Use context manager properly
        with get_db() as conn:
            try:
                c = conn.cursor()
                
                # Base query to get all events
                query = "SELECT * FROM events WHERE 1=1"
                params = []
                
                # Add category filter if provided
                if category:
                    query += f" AND category = {placeholder}"
                    params.append(category)
                
                # Add date filter if provided
                if date:
                    query += f" AND date = {placeholder}"
                    params.append(date)
                
                # Order by date and time
                query += " ORDER BY date, time"
                
                # Execute query with timeout handling
                logger.info(f"Executing list_events query: {query} with params: {params}")
                
                # Execute the query
                c.execute(query, params)
                events = c.fetchall()
                logger.info(f"Successfully fetched {len(events) if events else 0} events")
                
                # Convert to list of dictionaries safely
                result = []
                for event in events:
                    try:
                        event_dict = dict(event)
                        
                        # Convert datetime objects to ISO format strings
                        if 'created_at' in event_dict and isinstance(event_dict['created_at'], datetime):
                            event_dict['created_at'] = event_dict['created_at'].isoformat()
                        
                        result.append(event_dict)
                    except Exception as e:
                        logger.error(f"Error converting event to dict: {str(e)}")
                        # Skip this event but continue with others
                        continue
                
                return result
            except Exception as query_error:
                logger.error(f"Database query error in list_events: {str(query_error)}")
                
                # Try to rollback if possible
                try:
                    conn.rollback()
                except Exception as rollback_error:
                    logger.error(f"Rollback failed: {str(rollback_error)}")
                    
                raise HTTPException(
                    status_code=500,
                    detail=f"Database error: {str(query_error)}"
                ) from None
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions
        raise http_ex
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error retrieving events: {error_msg}")
        
        if "timeout" in error_msg.lower():
            raise HTTPException(status_code=504, detail="Database query timed out")
        elif "connection" in error_msg.lower():
            raise HTTPException(status_code=503, detail="Database connection issues")
        else:
            raise HTTPException(status_code=500, detail="Error retrieving events")

@app.get("/events/{event_id}", response_model=EventResponse)
async def read_event(event_id: int):
    """
    Retrieve a specific event by its ID.
    Open to all users, no authentication required.
    """
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute(f"SELECT * FROM events WHERE id = {placeholder}", (event_id,))
            event = c.fetchone()
            
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Convert to dict and handle datetime fields
            event_dict = dict(event)
            
            # Convert datetime to string for serialization
            if 'created_at' in event_dict and isinstance(event_dict['created_at'], datetime):
                event_dict['created_at'] = event_dict['created_at'].isoformat()
            
            return event_dict
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving event")

@app.post("/events", response_model=EventResponse)
async def create_event(event: EventCreate, current_user: dict = Depends(get_current_user)):
    placeholder = get_placeholder()
    
    try:
        # Log the event data for debugging
        logger.info(f"Creating event: {event.dict()}")
        
        # Use context manager properly
        with get_db() as conn:
            try:
                c = conn.cursor()
                
                # Check for near-duplicate events to prevent accidental double submissions
                duplicate_check = f"""
                    SELECT id FROM events 
                    WHERE title = {placeholder} 
                    AND date = {placeholder} 
                    AND time = {placeholder} 
                    AND lat = {placeholder} 
                    AND lng = {placeholder} 
                    AND category = {placeholder}
                """
                c.execute(duplicate_check, (
                    event.title, 
                    event.date, 
                    event.time, 
                    event.lat, 
                    event.lng, 
                    event.category
                ))
                
                if c.fetchone():
                    raise HTTPException(
                        status_code=400, 
                        detail="An event with these exact details already exists"
                    )

                # Insert new event with user ID
                query = f"""
                    INSERT INTO events (
                        title, description, date, time, category,
                        address, lat, lng, recurring, frequency,
                        end_date, created_by
                    ) VALUES (
                        {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}
                    )
                """
                values = (
                    event.title, event.description, event.date,
                    event.time, event.category, event.address,
                    event.lat, event.lng, event.recurring,
                    event.frequency, event.end_date,
                    current_user["id"]
                )
                
                # Execute insert query
                c.execute(query, values)
                
                # For PostgreSQL, we need to use a different method to get the last inserted ID
                if IS_PRODUCTION and DB_URL:
                    c.execute("SELECT lastval()")
                    result = c.fetchone()
                    last_id = result[0] if result else None
                else:
                    last_id = c.lastrowid
                
                if not last_id:
                    conn.rollback()
                    raise ValueError("Failed to get ID of created event")
                    
                # Get the newly created event
                c.execute(f"SELECT * FROM events WHERE id = {placeholder}", (last_id,))
                event_data = c.fetchone()
                
                if not event_data:
                    conn.rollback()
                    raise ValueError("Created event not found")
                
                # Commit the transaction
                conn.commit()
                    
                # Convert to dict and handle datetime fields
                event_dict = dict(event_data)
                
                # Convert datetime to string for serialization
                if 'created_at' in event_dict and isinstance(event_dict['created_at'], datetime):
                    event_dict['created_at'] = event_dict['created_at'].isoformat()
                    
                # Return the event data
                return event_dict
            except Exception as db_error:
                # Log detailed database error
                error_msg = str(db_error)
                logger.error(f"Database error while executing event creation: {error_msg}")
                
                # Make sure to rollback if something went wrong
                try:
                    conn.rollback()
                except Exception as rollback_error:
                    logger.error(f"Rollback failed: {str(rollback_error)}")
                    
                # Re-raise as HTTP exception with detailed info
                raise HTTPException(
                    status_code=500,
                    detail=f"Database error: {error_msg}"
                ) from None  # Prevent chained exceptions
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions
        raise http_ex
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error creating event: {error_msg}")
        
        # Return a safer error without the generator error
        raise HTTPException(
            status_code=400, 
            detail=f"Could not create event: {error_msg}"
        ) from None  # Prevent chained exceptions

@app.get("/events/manage", response_model=List[EventResponse])
async def list_user_events(current_user: dict = Depends(get_current_user)):
    """
    Retrieve events created by the current user for management.
    Requires authentication.
    """
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Query events created by the current user
            query = f"SELECT * FROM events WHERE created_by = {placeholder} ORDER BY date, time"
            c.execute(query, (current_user["id"],))
            events = c.fetchall()
            
            # Convert to list of dictionaries
            return [dict(event) for event in events]
            
    except Exception as e:
        logger.error(f"Error retrieving user events: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving user events")

@app.put("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int, 
    event: EventCreate, 
    current_user: dict = Depends(get_current_user)
):
    """
    Update an existing event.
    Only the event creator or an admin can update the event.
    """
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # First, check if the event exists and who created it
            c.execute(f"SELECT * FROM events WHERE id = {placeholder}", (event_id,))
            existing_event = c.fetchone()
            
            if not existing_event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Check if current user is the creator or an admin
            if (current_user['id'] != existing_event['created_by'] and 
                current_user['role'] != UserRole.ADMIN):
                raise HTTPException(status_code=403, detail="Not authorized to update this event")
            
            # Prepare update query
            query = f"""
                UPDATE events 
                SET title={placeholder}, description={placeholder}, date={placeholder}, 
                    time={placeholder}, category={placeholder}, address={placeholder}, 
                    lat={placeholder}, lng={placeholder}, recurring={placeholder}, 
                    frequency={placeholder}, end_date={placeholder}
                WHERE id={placeholder}
            """
            values = (
                event.title, event.description, event.date, event.time, 
                event.category, event.address, event.lat, event.lng, 
                event.recurring, event.frequency, event.end_date, 
                event_id
            )
            
            c.execute(query, values)
            conn.commit()
            
            # Fetch and return the updated event
            c.execute(f"SELECT * FROM events WHERE id = {placeholder}", (event_id,))
            updated_event = c.fetchone()
            
            return dict(updated_event)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error updating event")

@app.delete("/events/{event_id}")
async def delete_event(
    event_id: int, 
    current_user: dict = Depends(get_current_user)
):
    """
    Delete an event.
    Only the event creator or an admin can delete the event.
    """
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # First, check if the event exists and who created it
            c.execute(f"SELECT * FROM events WHERE id = {placeholder}", (event_id,))
            existing_event = c.fetchone()
            
            if not existing_event:
                raise HTTPException(status_code=404, detail="Event not found")
            
            # Check if current user is the creator or an admin
            if (current_user['id'] != existing_event['created_by'] and 
                current_user['role'] != UserRole.ADMIN):
                raise HTTPException(status_code=403, detail="Not authorized to delete this event")
            
            # Delete the event
            c.execute(f"DELETE FROM events WHERE id = {placeholder}", (event_id,))
            conn.commit()
            
            return {"detail": "Event successfully deleted"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error deleting event")

# Optional: Admin endpoint to get all users (for admin dashboard)
@app.get("/admin/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(get_current_user)):
    """
    List all users (admin-only endpoint)
    """
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM users")
            users = c.fetchall()
            
            return [dict(user) for user in users]
    except Exception as e:
        logger.error(f"Error retrieving users: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving users")

# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Enhanced health check endpoint that tests database connectivity
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.2",
        "environment": "production" if IS_PRODUCTION else "development",
        "database": {
            "status": "unknown",
            "type": "postgresql" if IS_PRODUCTION and DB_URL else "sqlite",
            "connection_test": None
        }
    }
    
    # Test database connection with shorter timeout for health checks
    try:
        if IS_PRODUCTION and DB_URL:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            
            start_time = time.time()
            conn = psycopg2.connect(
                DB_URL,
                cursor_factory=RealDictCursor,
                connect_timeout=5  # Short timeout for health checks
            )
            
            try:
                c = conn.cursor()
                c.execute("SELECT 1")
                c.fetchone()
                end_time = time.time()
                
                response_time = round((end_time - start_time) * 1000)  # ms
                health_status["database"]["status"] = "connected"
                health_status["database"]["connection_test"] = {
                    "successful": True,
                    "response_time_ms": response_time
                }
            finally:
                conn.close()
        else:
            # SQLite health check
            start_time = time.time()
            conn = sqlite3.connect(DB_FILE)
            try:
                c = conn.cursor()
                c.execute("SELECT 1")
                c.fetchone()
                end_time = time.time()
                
                response_time = round((end_time - start_time) * 1000)  # ms
                health_status["database"]["status"] = "connected"
                health_status["database"]["connection_test"] = {
                    "successful": True,
                    "response_time_ms": response_time
                }
            finally:
                conn.close()
                
    except Exception as e:
        logger.error(f"Health check database test failed: {str(e)}")
        health_status["status"] = "degraded"
        health_status["database"]["status"] = "error"
        health_status["database"]["connection_test"] = {
            "successful": False,
            "error": str(e)[:200]  # Truncate long error messages
        }
    
    # Return appropriate HTTP status code based on health
    status_code = 200 if health_status["status"] == "healthy" else 503
    
    return health_status

# Root endpoint
@app.get("/")
async def root():
    """
    Root endpoint for API
    """
    return {
        "message": "EventFinder API is running",
        "docs": "/docs",
        "health": "/health"
    }

# New Admin Endpoints
@app.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: int, 
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a user (admin-only)
    """
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user exists
            c.execute(f"SELECT * FROM users WHERE id = {placeholder}", (user_id,))
            user = c.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Prevent deleting the last admin
            c.execute(f"SELECT COUNT(*) as admin_count FROM users WHERE role = {placeholder}", (UserRole.ADMIN,))
            admin_count = c.fetchone()['admin_count']
            
            if admin_count <= 1 and user['role'] == UserRole.ADMIN:
                raise HTTPException(status_code=400, detail="Cannot delete the last admin")
            
            # Delete user
            c.execute(f"DELETE FROM users WHERE id = {placeholder}", (user_id,))
            
            # Optionally, delete user's events
            c.execute(f"DELETE FROM events WHERE created_by = {placeholder}", (user_id,))
            
            conn.commit()
            
            return {"detail": "User successfully deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error deleting user")

@app.put("/admin/users/{user_id}/role")
async def update_user_role(
    user_id: int, 
    role: UserRole,
    current_user: dict = Depends(get_current_user)
):
    """
    Update user role (admin-only)
    """
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if user exists
            c.execute(f"SELECT * FROM users WHERE id = {placeholder}", (user_id,))
            user = c.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Prevent removing last admin
            if user['role'] == UserRole.ADMIN:
                c.execute(f"SELECT COUNT(*) as admin_count FROM users WHERE role = {placeholder}", (UserRole.ADMIN,))
                admin_count = c.fetchone()['admin_count']
                
                if admin_count <= 1:
                    raise HTTPException(status_code=400, detail="Cannot remove the last admin")
            
            # Update role
            c.execute(f"UPDATE users SET role = {placeholder} WHERE id = {placeholder}", (role, user_id))
            conn.commit()
            
            return {"detail": "User role updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user role {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error updating user role")

@app.get("/admin/activity-logs")
async def get_activity_logs(
    current_user: dict = Depends(get_current_user),
    limit: int = 100,
    offset: int = 0
):
    """
    Retrieve activity logs (admin-only)
    """
    if current_user['role'] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Create an activity logs table if it doesn't exist
            if IS_PRODUCTION and DB_URL:
                c.execute('''CREATE TABLE IF NOT EXISTS activity_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
            else:
                c.execute('''CREATE TABLE IF NOT EXISTS activity_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
            
            # Fetch logs with optional pagination
            c.execute(f"""
                SELECT al.*, u.email 
                FROM activity_logs al
                LEFT JOIN users u ON al.user_id = u.id
                ORDER BY al.timestamp DESC
                LIMIT {placeholder} OFFSET {placeholder}
            """, (limit, offset))
            
            logs = [dict(log) for log in c.fetchall()]
            
            return logs
    except Exception as e:
        logger.error(f"Error retrieving activity logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving activity logs")

# Utility function to log activities
def log_activity(user_id: int, action: str, details: str = None):
    """
    Log user activities
    """
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Ensure activity_logs table exists
            if IS_PRODUCTION and DB_URL:
                c.execute('''CREATE TABLE IF NOT EXISTS activity_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
            else:
                c.execute('''CREATE TABLE IF NOT EXISTS activity_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
            
            # Insert log entry
            c.execute(
                f"INSERT INTO activity_logs (user_id, action, details) VALUES ({placeholder}, {placeholder}, {placeholder})",
                (user_id, action, details)
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Error logging activity: {str(e)}")

# Main execution block
if __name__ == "__main__":
    # Ensure environment variables are loaded
    load_dotenv()
    
    # Get port from environment variable for Render.com
    port = int(os.getenv("PORT", 8000))
    
    # Run the server
    uvicorn.run(
        "backend:app", 
        host="0.0.0.0", 
        port=port, 
        reload=not IS_PRODUCTION  # Only use reload in development
    )