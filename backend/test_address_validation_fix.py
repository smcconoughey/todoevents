#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend import EventResponse, EventBase
from pydantic import ValidationError

def test_address_validation_fix():
    """Test that address validation no longer rejects city-only addresses"""
    
    # Test data that should now be valid (was previously rejected)
    test_addresses = [
        "Omaha, NE, USA",
        "San Francisco, CA",
        "New York, NY",
        "Austin, Texas, USA",
        "Miami, FL, United States"
    ]
    
    # Test data that should still be valid
    valid_addresses = [
        "123 Main Street, San Francisco, CA",
        "456 Oak Avenue, Austin, TX",
        "789 Broadway, New York, NY"
    ]
    
    print("🔍 Testing address validation fix...")
    print("=" * 50)
    
    # Test that previously problematic addresses now work
    print("\n✅ Testing previously problematic addresses (should now work):")
    for address in test_addresses:
        try:
            # Test with minimal event data
            event_data = {
                "title": "Test Event",
                "description": "Test description",
                "date": "2025-06-10",
                "start_time": "19:00",
                "category": "community",
                "address": address,
                "lat": 40.7128,
                "lng": -74.0060
            }
            
            # Try to create an EventBase instance (this will trigger validation)
            event = EventBase(**event_data)
            print(f"  ✅ PASS: '{address}' - validation successful")
            
        except ValidationError as e:
            print(f"  ❌ FAIL: '{address}' - validation failed: {e}")
            return False
        except Exception as e:
            print(f"  ❌ ERROR: '{address}' - unexpected error: {e}")
            return False
    
    # Test that good addresses still work
    print("\n✅ Testing valid street addresses (should continue to work):")
    for address in valid_addresses:
        try:
            event_data = {
                "title": "Test Event",
                "description": "Test description", 
                "date": "2025-06-10",
                "start_time": "19:00",
                "category": "community",
                "address": address,
                "lat": 40.7128,
                "lng": -74.0060
            }
            
            event = EventBase(**event_data)
            print(f"  ✅ PASS: '{address}' - validation successful")
            
        except ValidationError as e:
            print(f"  ❌ FAIL: '{address}' - validation failed: {e}")
            return False
        except Exception as e:
            print(f"  ❌ ERROR: '{address}' - unexpected error: {e}")
            return False
    
    # Test empty address still fails (basic validation should remain)
    print("\n🚫 Testing empty address (should still fail):")
    try:
        event_data = {
            "title": "Test Event",
            "description": "Test description",
            "date": "2025-06-10", 
            "start_time": "19:00",
            "category": "community",
            "address": "",  # Empty address
            "lat": 40.7128,
            "lng": -74.0060
        }
        
        event = EventBase(**event_data)
        print(f"  ❌ FAIL: Empty address was accepted (should be rejected)")
        return False
        
    except ValidationError as e:
        print(f"  ✅ PASS: Empty address correctly rejected: {str(e)[:100]}...")
    
    print("\n" + "=" * 50)
    print("🎉 ALL TESTS PASSED - Address validation fix is working!")
    print("\n✅ Summary:")
    print("  - City-only addresses now work (existing events saved)")
    print("  - Street addresses continue to work")
    print("  - Empty addresses still properly rejected")
    print("  - No breaking changes for existing functionality")
    
    return True

if __name__ == "__main__":
    success = test_address_validation_fix()
    sys.exit(0 if success else 1) 