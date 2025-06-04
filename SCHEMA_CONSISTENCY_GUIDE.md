# Database Schema Consistency Guide

## Overview

This guide documents the centralized database schema management system implemented to prevent recurring issues with misaligned field counts and placeholders when database schema changes are made.

## Problem Statement

Previously, whenever database fields were added or modified, hardcoded elements throughout the codebase would become misaligned:

- **Hardcoded placeholder counts** (e.g., `?, ?, ?, ...`) in INSERT/UPDATE statements
- **Field order mismatches** between SQL statements and values tuples
- **Count discrepancies** between schema changes and application code
- **Manual maintenance** required across multiple files for each schema change

## Solution: Centralized Schema Management

### Core Files

#### 1. `backend/database_schema.py`
- **Single source of truth** for all database schema definitions
- **EVENT_FIELDS**: Complete ordered list of all event table fields with types
- **INSERTABLE_EVENT_FIELDS**: Fields used in INSERT operations (excludes auto-generated)
- **REQUIRED_INSERT_FIELDS**: Fields that must be provided for valid inserts
- **Dynamic SQL generation**: Functions that build queries based on field definitions

#### 2. `backend/event_data_builder.py`
- **Helper functions** for building correctly ordered data tuples
- **Validation functions** for ensuring data completeness
- **Test utilities** for creating test data with proper field order

### Key Functions

#### Database Schema (`database_schema.py`)
```python
# Generate INSERT queries dynamically
generate_insert_query(returning_id=False)

# Generate UPDATE queries dynamically  
generate_update_query(fields=None)

# Get database-specific placeholders
get_db_placeholder()
```

#### Event Data Builder (`event_data_builder.py`)
```python
# Build INSERT values tuple in correct order
build_event_values_for_insert(event_data, current_user_id, lat=None, lng=None)

# Build UPDATE values tuple in correct order
build_event_values_for_update(event_data, event_id, exclude_fields=None)

# Build test event values with defaults
build_test_event_values(title="Test Event", description="Test Description", ...)

# Validate data completeness
validate_event_data_completeness(event_data)
```

## How to Add New Database Fields

### Step 1: Update Central Schema
1. **Edit `backend/database_schema.py`**
2. **Add new field** to `EVENT_FIELDS` list in correct position
3. **Update field type** definition as needed
4. **Add to `REQUIRED_INSERT_FIELDS`** if field is required

Example:
```python
EVENT_FIELDS = [
    # ... existing fields ...
    ('new_field_name', 'TEXT'),  # Add new field here
    # ... rest of fields ...
]

# If required for inserts:
REQUIRED_INSERT_FIELDS = [
    # ... existing required fields ...
    'new_field_name',
]
```

### Step 2: Update Data Builder Logic
1. **Edit `event_data_builder.py`**
2. **Add field mapping** in all data mapping dictionaries
3. **Set appropriate defaults** for the new field

Example:
```python
# In build_event_values_for_insert():
data_map = {
    # ... existing mappings ...
    'new_field_name': event_data.get('new_field_name', 'default_value'),
}

# In build_test_event_values():
defaults = {
    # ... existing defaults ...
    'new_field_name': 'test_default_value',
}
```

### Step 3: Update Database Migration
1. **Create migration script** to add column to actual database
2. **Test with both SQLite and PostgreSQL** if applicable
3. **Backfill existing data** if needed

### Step 4: Update API/Frontend (if needed)
1. **Add field to API request/response models** if client-facing
2. **Update frontend forms** if user-editable
3. **Update validation rules** as appropriate

## Code Patterns to Follow

### ✅ CORRECT: Use Centralized Helpers
```python
# INSERT operations
from database_schema import generate_insert_query
from event_data_builder import build_event_values_for_insert

insert_query = generate_insert_query(returning_id=True)
values = build_event_values_for_insert(event_data, user_id, lat, lng)
cursor.execute(insert_query, values)
```

```python
# UPDATE operations  
from database_schema import generate_update_query
from event_data_builder import build_event_values_for_update

query = generate_update_query()
values = build_event_values_for_update(event_data, event_id)
cursor.execute(query, values)
```

### ❌ INCORRECT: Hardcoded SQL and Values
```python
# DON'T DO THIS - hardcoded field lists and placeholders
insert_query = """
    INSERT INTO events (title, description, date, start_time, ...)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""
values = (title, description, date, start_time, ...)  # Manual field order
```

## Testing Your Changes

### 1. Schema Consistency Test
```bash
cd backend
python database_schema.py
```
This will show current field mappings and validate consistency.

### 2. Data Builder Test
```bash
cd backend  
python event_data_builder.py
```
This will show sample data tuples and field ordering.

### 3. Full Integration Test
```bash
cd backend
python test_ux_fields_simple.py
```
This tests the complete INSERT flow with the centralized system.

## Debugging Field Misalignment

### Check Field Count
```python
from database_schema import INSERTABLE_EVENT_FIELDS
from event_data_builder import get_field_mapping_debug_info

print(f"Expected field count: {len(INSERTABLE_EVENT_FIELDS)}")
debug_info = get_field_mapping_debug_info()
print(debug_info)
```

### Validate Data Tuple
```python
from event_data_builder import build_event_values_for_insert, validate_event_data_completeness

# Check if your event data is complete
is_valid, missing = validate_event_data_completeness(your_event_data)
if not is_valid:
    print(f"Missing required fields: {missing}")
```

### Compare Expected vs Actual
```python
from database_schema import INSERTABLE_EVENT_FIELDS

values = build_event_values_for_insert(event_data, user_id)
print(f"Field count: expected={len(INSERTABLE_EVENT_FIELDS)}, actual={len(values)}")

# Show field-to-value mapping
for field, value in zip(INSERTABLE_EVENT_FIELDS, values):
    print(f"{field}: {value}")
```

## Benefits of This System

1. **Single Source of Truth**: All schema information defined in one place
2. **Automatic Consistency**: SQL queries and values tuples always match
3. **Easy Maintenance**: Adding fields requires changes in only 1-2 files
4. **Error Prevention**: Type checking and validation built-in
5. **Better Testing**: Standardized test data creation
6. **Documentation**: Self-documenting field order and requirements

## Migration Checklist

When making schema changes, ensure you:

- [ ] Update `EVENT_FIELDS` in `database_schema.py`
- [ ] Update data mappings in `event_data_builder.py`  
- [ ] Add required field validation if applicable
- [ ] Test with `python database_schema.py`
- [ ] Test with `python event_data_builder.py`
- [ ] Run integration tests
- [ ] Update database migration scripts
- [ ] Update API documentation if needed

## Future Enhancements

- **Automated validation**: CI/CD checks for schema consistency
- **Type safety**: Add runtime type checking for field values
- **Migration generation**: Auto-generate migration scripts from schema changes
- **Documentation generation**: Auto-generate API docs from schema definitions 