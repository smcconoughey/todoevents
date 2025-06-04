#!/usr/bin/env python3
"""
Schema Consistency Test
Validates that all centralized schema components are properly aligned
"""

import sys
import os

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_schema_consistency():
    """Test that schema definitions are consistent"""
    print("Testing Schema Consistency")
    print("=" * 50)
    
    try:
        from database_schema import (
            EVENT_FIELDS, INSERTABLE_EVENT_FIELDS, REQUIRED_INSERT_FIELDS,
            generate_insert_query, generate_update_query, get_placeholder
        )
        from event_data_builder import (
            build_event_values_for_insert, build_event_values_for_update,
            build_test_event_values, get_field_mapping_debug_info,
            validate_event_data_completeness
        )
        
        print("✅ All imports successful")
        
        # Test 1: Field count consistency
        total_fields = len(EVENT_FIELDS)
        insertable_fields = len(INSERTABLE_EVENT_FIELDS)
        required_fields = len(REQUIRED_INSERT_FIELDS)
        
        print(f"\n📊 Field Counts:")
        print(f"   Total fields: {total_fields}")
        print(f"   Insertable fields: {insertable_fields}")
        print(f"   Required fields: {required_fields}")
        
        # Test 2: Query generation
        insert_query = generate_insert_query()
        insert_query_with_return = generate_insert_query(returning_id=True)
        update_query = generate_update_query()
        
        print(f"\n🔧 Query Generation:")
        print("   INSERT query generated successfully")
        print("   INSERT with RETURNING generated successfully")
        print("   UPDATE query generated successfully")
        
        # Test 3: Placeholder consistency
        placeholder = get_placeholder()
        insert_placeholder_count = insert_query.count(placeholder)
        
        print(f"\n🎯 Placeholder Consistency:")
        print(f"   Placeholder symbol: {placeholder}")
        print(f"   Placeholders in INSERT: {insert_placeholder_count}")
        print(f"   Expected (insertable fields): {insertable_fields}")
        
        if insert_placeholder_count == insertable_fields:
            print("   ✅ INSERT placeholder count matches!")
        else:
            print("   ❌ INSERT placeholder count mismatch!")
            return False
        
        # Test 4: Test data building
        test_event_data = {
            'title': 'Test Event',
            'description': 'Test Description',
            'date': '2024-12-31',
            'start_time': '12:00',
            'category': 'community',
            'address': 'Test Address'
        }
        
        insert_values = build_event_values_for_insert(test_event_data, 1, 37.7749, -122.4194)
        test_values = build_test_event_values()
        
        print(f"\n🧪 Data Building:")
        print(f"   INSERT values length: {len(insert_values)}")
        print(f"   Test values length: {len(test_values)}")
        print(f"   Expected length: {insertable_fields}")
        
        if len(insert_values) == insertable_fields and len(test_values) == insertable_fields:
            print("   ✅ Values tuple lengths match!")
        else:
            print("   ❌ Values tuple length mismatch!")
            return False
        
        # Test 5: Data validation
        is_valid, missing = validate_event_data_completeness(test_event_data)
        print(f"\n✅ Data Validation:")
        print(f"   Test data valid: {is_valid}")
        if not is_valid:
            print(f"   Missing fields: {missing}")
        
        # Test 6: Debug info
        debug_info = get_field_mapping_debug_info()
        print(f"\n🔍 Debug Info Available:")
        for key in debug_info.keys():
            print(f"   - {key}")
        
        print(f"\n🎉 All consistency tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

def show_field_mappings():
    """Show detailed field mappings for debugging"""
    print("\nDetailed Field Mappings")
    print("=" * 50)
    
    try:
        from database_schema import EVENT_FIELDS, INSERTABLE_EVENT_FIELDS
        from event_data_builder import build_test_event_values
        
        print("All Event Fields:")
        for i, (field, field_type) in enumerate(EVENT_FIELDS):
            insertable = "✓" if field in INSERTABLE_EVENT_FIELDS else "✗"
            print(f"  {i+1:2d}. {field:20} ({field_type:15}) Insertable: {insertable}")
        
        print(f"\nInsertable Fields (in order):")
        for i, field in enumerate(INSERTABLE_EVENT_FIELDS):
            print(f"  {i+1:2d}. {field}")
        
        print(f"\nSample Values Mapping:")
        sample_values = build_test_event_values(title="Sample Event")
        for i, (field, value) in enumerate(zip(INSERTABLE_EVENT_FIELDS, sample_values)):
            print(f"  {i+1:2d}. {field:20} = {value}")
            
    except Exception as e:
        print(f"Error showing mappings: {e}")

def test_query_samples():
    """Show sample queries for validation"""
    print("\nSample Queries")
    print("=" * 50)
    
    try:
        from database_schema import generate_insert_query, generate_update_query
        
        print("INSERT Query:")
        print(generate_insert_query())
        
        print("\nINSERT Query with RETURNING:")
        print(generate_insert_query(returning_id=True))
        
        print("\nUPDATE Query:")
        print(generate_update_query())
        
    except Exception as e:
        print(f"Error generating queries: {e}")

if __name__ == "__main__":
    success = test_schema_consistency()
    
    if success:
        show_field_mappings()
        test_query_samples()
        print("\n" + "=" * 50)
        print("🎉 Schema consistency validation completed successfully!")
        print("All components are properly aligned.")
    else:
        print("\n" + "=" * 50)
        print("❌ Schema consistency validation failed!")
        print("Please review the errors above and fix the alignment issues.")
        sys.exit(1) 