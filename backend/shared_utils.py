#!/usr/bin/env python3
"""
Shared utilities module to avoid circular imports between backend.py and MissionOps modules.
Contains database connection helpers, authentication utilities, and other shared functions.
"""

import os
import sqlite3
import logging
import json
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from dotenv import load_dotenv

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
logger = logging.getLogger(__name__)

# Database file for SQLite (development only)
DB_FILE = os.path.join(os.path.dirname(__file__), "events.db")


@contextmanager
def get_db():
    """Database connection context manager"""
    if IS_PRODUCTION and DB_URL:
        # Production with PostgreSQL
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        try:
            conn = psycopg2.connect(
                DB_URL,
                cursor_factory=RealDictCursor,
                connect_timeout=8,
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=5,
                keepalives_count=3,
                application_name='todoevents'
            )
            yield conn
        finally:
            if conn:
                conn.close()
    else:
        # Local development with SQLite
        conn = sqlite3.connect(DB_FILE, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL')
        conn.execute('PRAGMA cache_size=10000')
        try:
            yield conn
        finally:
            conn.close()


def get_placeholder():
    """Get database placeholder character for queries"""
    return "%s" if IS_PRODUCTION and DB_URL else "?"


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")  # JWT contains email, not user_id
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    try:
        # Get user from database by email
        placeholder = get_placeholder()
        with get_db() as conn:
            c = conn.cursor()
            c.execute(f"SELECT id, email, role FROM users WHERE email = {placeholder}", (email,))
            user = c.fetchone()
            
            if not user:
                raise credentials_exception
                
            return {
                "id": user[0] if isinstance(user, (tuple, list)) else user["id"],
                "email": user[1] if isinstance(user, (tuple, list)) else user["email"],
                "role": user[2] if isinstance(user, (tuple, list)) else user["role"]
            }
            
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Database error during user lookup: {error_msg}")
        
        if "timeout" in error_msg.lower() or "deadlock" in error_msg.lower():
            raise HTTPException(
                status_code=408, 
                detail="Request timed out. Please try again."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Internal server error during authentication",
                headers={"WWW-Authenticate": "Bearer"},
            )


def format_cursor_row(row, column_names):
    """Format cursor row to dictionary"""
    if hasattr(row, '_asdict'):
        return row._asdict()
    elif hasattr(row, 'keys'):
        return dict(row)
    else:
        return dict(zip(column_names, row)) 