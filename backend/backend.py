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
from fastapi.responses import FileResponse

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

# CORS middleware with correct Render.com domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Local Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:5174",  # Admin dashboard local
        "http://127.0.0.1:5174",
        "https://eventfinder-api.onrender.com",  # Main API
        "https://eventfinder-web.onrender.com",  # Main frontend
        "https://eventfinder-admin.onrender.com",  # Admin frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
        retry_count = 5
        for attempt in range(retry_count):
            try:
                conn = psycopg2.connect(DB_URL)
                conn.autocommit = True
                try:
                    cur = conn.cursor(cursor_factory=RealDictCursor)
                    yield conn
                finally:
                    conn.close()
                break
            except Exception as e:
                if attempt < retry_count - 1:
                    logger.error(f"Database connection failed (attempt {attempt+1}/{retry_count}): {str(e)}")
                    time.sleep(2)  # Wait before retrying
                else:
                    logger.error(f"Failed to connect to database after {retry_count} attempts: {str(e)}")
                    raise
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
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        # Don't raise the exception here - this allows the app to start even if DB init fails
        # We'll handle DB errors at the endpoint level

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
    try:
        with get_db() as conn:
            c = conn.cursor()
            c.execute(f"SELECT * FROM users WHERE email = {placeholder}", (form_data.username,))
            user = c.fetchone()
            
            if not user or not verify_password(form_data.password, user["hashed_password"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect email or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            access_token = create_access_token(data={"sub": user["email"]})
            return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during login",
            headers={"WWW-Authenticate": "Bearer"},
        )

@app.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate):
    # Validate password (this will raise an error if invalid)
    password_validation = PasswordValidator.validate_password(user.password)
    
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
            c = conn.cursor()
            
            # Check if email exists
            c.execute(f"SELECT id FROM users WHERE email = {placeholder}", (user.email,))
            if c.fetchone():
                raise HTTPException(status_code=400, detail="Email already registered")
            
            hashed_password = get_password_hash(user.password)
            c.execute(
                f"INSERT INTO users (email, hashed_password, role) VALUES ({placeholder}, {placeholder}, {placeholder})",
                (user.email, hashed_password, user.role)
            )
            conn.commit()
            
            # For PostgreSQL, we need to use a different method to get the last inserted ID
            if IS_PRODUCTION and DB_URL:
                c.execute("SELECT lastval()")
                last_id = c.fetchone()[0]
            else:
                last_id = c.lastrowid
                
            c.execute(f"SELECT * FROM users WHERE id = {placeholder}", (last_id,))
            user_data = dict(c.fetchone())
            
            # Return user data along with password strength (front-end can use this)
            return {
                **user_data,
                "password_strength": password_validation['strength']
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user: {str(e)}")
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
        with get_db() as conn:
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
            
            # Execute query
            c.execute(query, params)
            events = c.fetchall()
            
            # Convert to list of dictionaries
            return [dict(event) for event in events]
            
    except Exception as e:
        logger.error(f"Error retrieving events: {str(e)}")
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
            
            return dict(event)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving event")

@app.post("/events", response_model=EventResponse)
async def create_event(event: EventCreate, current_user: dict = Depends(get_current_user)):
    placeholder = get_placeholder()
    try:
        with get_db() as conn:
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
            
            c.execute(query, values)
            conn.commit()
            
            # For PostgreSQL, we need to use a different method to get the last inserted ID
            if IS_PRODUCTION and DB_URL:
                c.execute("SELECT lastval()")
                last_id = c.fetchone()[0]
            else:
                last_id = c.lastrowid
                
            c.execute(f"SELECT * FROM events WHERE id = {placeholder}", (last_id,))
            return dict(c.fetchone())
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating event: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

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
    Simple health check endpoint that doesn't depend on database
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }

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