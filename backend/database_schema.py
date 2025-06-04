#!/usr/bin/env python3
"""
Database Schema Configuration
Centralized definition of all table schemas to prevent misalignment issues
"""

from typing import List, Dict, Tuple, Any
import os

# Event table field definitions with their order and types
EVENT_FIELDS = [
    # Core event fields
    ('id', 'INTEGER PRIMARY KEY' if not os.getenv('DATABASE_URL') else 'SERIAL PRIMARY KEY'),
    ('title', 'TEXT NOT NULL'),
    ('description', 'TEXT NOT NULL'),
    ('short_description', 'TEXT'),
    ('date', 'TEXT NOT NULL'),
    ('start_time', 'TEXT NOT NULL'),
    ('end_time', 'TEXT'),
    ('end_date', 'TEXT'),
    ('category', 'TEXT NOT NULL'),
    ('address', 'TEXT NOT NULL'),
    ('city', 'TEXT'),
    ('state', 'TEXT'),
    ('country', 'TEXT DEFAULT "USA"'),
    ('lat', 'REAL NOT NULL'),
    ('lng', 'REAL NOT NULL'),
    ('recurring', 'BOOLEAN DEFAULT FALSE'),
    ('frequency', 'TEXT'),
    
    # Pricing/UX fields
    ('fee_required', 'TEXT'),
    ('price', 'REAL DEFAULT 0.0'),
    ('currency', 'TEXT DEFAULT "USD"'),
    ('event_url', 'TEXT'),
    ('host_name', 'TEXT'),
    ('organizer_url', 'TEXT'),
    
    # SEO fields
    ('slug', 'TEXT'),
    ('is_published', 'BOOLEAN DEFAULT TRUE'),
    ('start_datetime', 'TEXT'),
    ('end_datetime', 'TEXT'),
    
    # Metadata fields
    ('created_by', 'INTEGER NOT NULL'),
    ('created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
    ('updated_at', 'TIMESTAMP'),
    ('interest_count', 'INTEGER DEFAULT 0'),
    ('view_count', 'INTEGER DEFAULT 0'),
]

# Get field names only (excluding id)
INSERTABLE_EVENT_FIELDS = [field[0] for field in EVENT_FIELDS if field[0] != 'id']

# Get field names for all fields including id
ALL_EVENT_FIELDS = [field[0] for field in EVENT_FIELDS]

# Fields that auto-populate (don't need to be provided in INSERT)
AUTO_FIELDS = ['id', 'created_at']

# Fields required for INSERT operations
REQUIRED_INSERT_FIELDS = [field[0] for field in EVENT_FIELDS 
                         if field[0] not in AUTO_FIELDS and 'DEFAULT' not in field[1]]

def get_placeholder():
    """Get appropriate SQL placeholder for the database type"""
    # Use same logic as backend.py
    IS_PRODUCTION = os.getenv('IS_PRODUCTION', 'False').lower() == 'true'
    DB_URL = os.getenv('DATABASE_URL')
    
    if IS_PRODUCTION and DB_URL:
        return "%s"  # PostgreSQL uses %s
    else:
        return "?"   # SQLite uses ?

def generate_insert_query(table_name: str = 'events', 
                         fields: List[str] = None,
                         returning_id: bool = True) -> str:
    """
    Generate a properly formatted INSERT query with correct field order and placeholder count
    
    Args:
        table_name: Name of the table (default: 'events')
        fields: List of field names to insert (default: all insertable fields)
        returning_id: Whether to include RETURNING id clause for PostgreSQL
    
    Returns:
        Formatted INSERT SQL query
    """
    if fields is None:
        fields = INSERTABLE_EVENT_FIELDS
    
    placeholder = get_placeholder()
    if placeholder == "?":
        # SQLite: use ? for all placeholders
        placeholders = ', '.join(['?'] * len(fields))
    else:
        # PostgreSQL: use %s for all placeholders (psycopg2 style)
        placeholders = ', '.join(['%s'] * len(fields))
    field_list = ', '.join(fields)
    
    query = f"""
        INSERT INTO {table_name} (
            {field_list}
        ) VALUES (
            {placeholders}
        )"""
    
    # Add RETURNING clause for PostgreSQL
    if returning_id and os.getenv('DATABASE_URL'):
        query += " RETURNING id"
    
    return query

def generate_update_query(table_name: str = 'events',
                         fields: List[str] = None,
                         where_field: str = 'id') -> str:
    """
    Generate a properly formatted UPDATE query with correct field order
    
    Args:
        table_name: Name of the table (default: 'events') 
        fields: List of field names to update (default: all updatable fields)
        where_field: Field to use in WHERE clause (default: 'id')
    
    Returns:
        Formatted UPDATE SQL query
    """
    if fields is None:
        # Exclude auto-generated fields from updates
        fields = [field[0] for field in EVENT_FIELDS 
                 if field[0] not in ['id', 'created_at', 'created_by']]
    
    placeholder = get_placeholder()
    if placeholder == "?":
        # SQLite: use ? for all placeholders
        set_clauses = ', '.join([f"{field}=?" for field in fields])
        where_placeholder = "?"
    else:
        # PostgreSQL: use %s for all placeholders (psycopg2 style)
        set_clauses = ', '.join([f"{field}=%s" for field in fields])
        where_placeholder = "%s"
    
    query = f"""
        UPDATE {table_name} 
        SET {set_clauses}
        WHERE {where_field}={where_placeholder}
    """
    
    return query

def generate_select_query(table_name: str = 'events',
                         fields: List[str] = None,
                         where_clause: str = None) -> str:
    """
    Generate a properly formatted SELECT query
    
    Args:
        table_name: Name of the table (default: 'events')
        fields: List of field names to select (default: all fields)
        where_clause: Optional WHERE clause
    
    Returns:
        Formatted SELECT SQL query
    """
    if fields is None:
        fields = ALL_EVENT_FIELDS
    
    field_list = ', '.join(fields)
    query = f"SELECT {field_list} FROM {table_name}"
    
    if where_clause:
        query += f" WHERE {where_clause}"
    
    return query

def validate_field_order(provided_fields: List[str]) -> bool:
    """
    Validate that provided fields are in the correct database order
    
    Args:
        provided_fields: List of field names in the order they will be used
    
    Returns:
        True if order is correct, False otherwise
    """
    # Get the expected order for the provided fields
    expected_order = [field for field in ALL_EVENT_FIELDS if field in provided_fields]
    return provided_fields == expected_order

def get_field_count(exclude_auto: bool = True) -> int:
    """
    Get the total number of fields for placeholder validation
    
    Args:
        exclude_auto: Whether to exclude auto-generated fields (default: True)
    
    Returns:
        Number of fields
    """
    if exclude_auto:
        return len(INSERTABLE_EVENT_FIELDS)
    return len(ALL_EVENT_FIELDS)

def get_event_schema_info() -> Dict[str, Any]:
    """
    Get comprehensive schema information for debugging
    
    Returns:
        Dictionary with schema information
    """
    return {
        'total_fields': len(ALL_EVENT_FIELDS),
        'insertable_fields': len(INSERTABLE_EVENT_FIELDS),
        'required_fields': len(REQUIRED_INSERT_FIELDS),
        'auto_fields': len(AUTO_FIELDS),
        'field_order': ALL_EVENT_FIELDS,
        'insertable_field_order': INSERTABLE_EVENT_FIELDS,
        'required_field_order': REQUIRED_INSERT_FIELDS,
        'database_type': 'postgresql' if os.getenv('DATABASE_URL') else 'sqlite'
    }

# Pre-generated queries for common operations
STANDARD_INSERT_QUERY = generate_insert_query()
STANDARD_UPDATE_QUERY = generate_update_query()
STANDARD_SELECT_QUERY = generate_select_query()

# Debugging function
def print_schema_info():
    """Print schema information for debugging"""
    info = get_event_schema_info()
    print("Database Schema Information:")
    print("=" * 40)
    for key, value in info.items():
        if isinstance(value, list):
            print(f"{key}: {len(value)} items")
            for i, item in enumerate(value):
                print(f"  {i+1:2d}. {item}")
        else:
            print(f"{key}: {value}")

if __name__ == "__main__":
    print_schema_info() 