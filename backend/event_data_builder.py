#!/usr/bin/env python3
"""
Event Data Builder Helper
Provides utility functions to build correctly ordered event data for database operations
"""

from typing import Dict, Any, Tuple, Optional
from database_schema import INSERTABLE_EVENT_FIELDS, generate_insert_query, generate_update_query, EVENT_FIELDS

def build_event_values_for_insert(event_data: Dict[str, Any], 
                                 current_user_id: int,
                                 lat: float = None, 
                                 lng: float = None) -> Tuple:
    """
    Build a values tuple for INSERT operations using the correct field order
    
    Args:
        event_data: Dictionary containing event data
        current_user_id: ID of the user creating the event
        lat: Optional latitude override
        lng: Optional longitude override
    
    Returns:
        Tuple of values in correct field order for INSERT
    """
    # Use provided lat/lng or get from event_data
    actual_lat = lat if lat is not None else event_data.get('lat')
    actual_lng = lng if lng is not None else event_data.get('lng')
    
    # Build the data mapping
    data_map = {
        'title': event_data.get('title', '').strip(),
        'description': event_data.get('description', '').strip(),
        'short_description': event_data.get('short_description', ''),
        'date': event_data.get('date'),
        'start_time': event_data.get('start_time'),
        'end_time': event_data.get('end_time'),
        'end_date': event_data.get('end_date'),
        'category': event_data.get('category'),
        'address': event_data.get('address', '').strip(),
        'city': event_data.get('city'),
        'state': event_data.get('state'),
        'country': event_data.get('country', 'USA'),
        'lat': actual_lat,
        'lng': actual_lng,
        'recurring': event_data.get('recurring', False),
        'frequency': event_data.get('frequency'),
        'fee_required': event_data.get('fee_required'),
        'price': event_data.get('price', 0.0),
        'currency': event_data.get('currency', 'USD'),
        'event_url': event_data.get('event_url'),
        'host_name': event_data.get('host_name'),
        'organizer_url': event_data.get('organizer_url'),
        'slug': event_data.get('slug'),
        'is_published': event_data.get('is_published', True),
        'start_datetime': event_data.get('start_datetime'),
        'end_datetime': event_data.get('end_datetime'),
        'created_by': current_user_id,
        'updated_at': event_data.get('updated_at'),
        'interest_count': event_data.get('interest_count', 0),
        'view_count': event_data.get('view_count', 0)
    }
    
    return tuple(data_map.get(field) for field in INSERTABLE_EVENT_FIELDS)

def build_event_values_for_update(event_data: Dict[str, Any], 
                                 event_id: int,
                                 exclude_fields: list = None) -> Tuple:
    """
    Build a values tuple for UPDATE operations using the correct field order
    
    Args:
        event_data: Dictionary containing event data
        event_id: ID of the event being updated
        exclude_fields: List of fields to exclude from update (beyond auto-excluded ones)
    
    Returns:
        Tuple of values in correct field order for UPDATE + event_id for WHERE clause
    """
    # Default excluded fields for UPDATE operations
    default_excluded = ['id', 'created_at', 'created_by']
    if exclude_fields:
        default_excluded.extend(exclude_fields)
    
    # Get update fields
    update_fields = [field[0] for field in EVENT_FIELDS 
                    if field[0] not in default_excluded]
    
    # Build the data mapping
    data_map = {
        'title': event_data.get('title', '').strip(),
        'description': event_data.get('description', '').strip(),
        'short_description': event_data.get('short_description', ''),
        'date': event_data.get('date'),
        'start_time': event_data.get('start_time'),
        'end_time': event_data.get('end_time'),
        'end_date': event_data.get('end_date'),
        'category': event_data.get('category'),
        'address': event_data.get('address', '').strip(),
        'city': event_data.get('city'),
        'state': event_data.get('state'),
        'country': event_data.get('country', 'USA'),
        'lat': event_data.get('lat'),
        'lng': event_data.get('lng'),
        'recurring': event_data.get('recurring', False),
        'frequency': event_data.get('frequency'),
        'fee_required': event_data.get('fee_required'),
        'price': event_data.get('price', 0.0),
        'currency': event_data.get('currency', 'USD'),
        'event_url': event_data.get('event_url'),
        'host_name': event_data.get('host_name'),
        'organizer_url': event_data.get('organizer_url'),
        'slug': event_data.get('slug'),
        'is_published': event_data.get('is_published', True),
        'start_datetime': event_data.get('start_datetime'),
        'end_datetime': event_data.get('end_datetime'),
        'updated_at': event_data.get('updated_at'),
        'interest_count': event_data.get('interest_count', 0),
        'view_count': event_data.get('view_count', 0)
    }
    
    # Build values tuple for update fields + event_id for WHERE clause
    return tuple(data_map.get(field) for field in update_fields) + (event_id,)

def build_test_event_values(title: str = "Test Event",
                           description: str = "Test Description",
                           created_by: int = 1,
                           **overrides) -> Tuple:
    """
    Build test event values with sensible defaults
    
    Args:
        title: Event title
        description: Event description  
        created_by: User ID creating the event
        **overrides: Any field overrides
    
    Returns:
        Tuple of values in correct field order for INSERT
    """
    defaults = {
        'title': title,
        'description': description,
        'short_description': '',
        'date': '2024-12-31',
        'start_time': '12:00',
        'end_time': None,
        'end_date': None,
        'category': 'community',
        'address': 'Test Address',
        'city': None,
        'state': None,
        'country': 'USA',
        'lat': 37.7749,
        'lng': -122.4194,
        'recurring': False,
        'frequency': None,
        'fee_required': None,
        'price': 0.0,
        'currency': 'USD',
        'event_url': None,
        'host_name': None,
        'organizer_url': None,
        'slug': None,
        'is_published': True,
        'start_datetime': None,
        'end_datetime': None,
        'created_by': created_by,
        'updated_at': None,
        'interest_count': 0,
        'view_count': 0
    }
    
    # Apply any overrides
    defaults.update(overrides)
    
    return tuple(defaults.get(field) for field in INSERTABLE_EVENT_FIELDS)

def validate_event_data_completeness(event_data: Dict[str, Any]) -> Tuple[bool, list]:
    """
    Validate that all required fields are present in event data
    
    Args:
        event_data: Dictionary containing event data
    
    Returns:
        Tuple of (is_valid, list_of_missing_required_fields)
    """
    from database_schema import REQUIRED_INSERT_FIELDS
    
    missing_fields = []
    for field in REQUIRED_INSERT_FIELDS:
        if field == 'created_by':  # This is added separately in functions
            continue
        if field not in event_data or event_data[field] is None:
            missing_fields.append(field)
    
    return len(missing_fields) == 0, missing_fields

def get_field_mapping_debug_info() -> Dict[str, Any]:
    """
    Get debugging information about field mappings
    
    Returns:
        Dictionary with field mapping information
    """
    return {
        'insertable_fields': INSERTABLE_EVENT_FIELDS,
        'total_insertable_fields': len(INSERTABLE_EVENT_FIELDS),
        'sample_insert_query': generate_insert_query(),
        'sample_update_query': generate_update_query(),
        'field_order': {i: field for i, field in enumerate(INSERTABLE_EVENT_FIELDS)}
    }

# Example usage for debugging
if __name__ == "__main__":
    print("Event Data Builder - Field Mapping Info")
    print("=" * 50)
    
    debug_info = get_field_mapping_debug_info()
    for key, value in debug_info.items():
        print(f"\n{key}:")
        if isinstance(value, list):
            for i, item in enumerate(value):
                print(f"  {i+1:2d}. {item}")
        elif isinstance(value, dict):
            for k, v in value.items():
                print(f"  {k}: {v}")
        else:
            print(f"  {value}")
    
    print("\n" + "=" * 50)
    print("Sample test event values:")
    test_values = build_test_event_values(title="Debug Test", description="Sample event")
    for i, (field, value) in enumerate(zip(INSERTABLE_EVENT_FIELDS, test_values)):
        print(f"  {i+1:2d}. {field}: {value}") 