#!/usr/bin/env python3
"""
Test script to directly call the tracking functions and see what's happening
"""
import asyncio
import sys
import os

# Add the current directory to the path so we can import backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def test_tracking_functions():
    """Test the tracking functions directly"""
    from backend import track_event_view
    
    print("🧪 Testing tracking functions directly...")
    print("=" * 50)
    
    # Test 1: Track a view
    print("\n1. Testing track_event_view function...")
    try:
        result = await track_event_view(33, None, "test-fingerprint")
        print(f"✅ track_event_view result: {result}")
    except Exception as e:
        print(f"❌ track_event_view error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
    
    print("\n🏁 Direct function testing completed!")

if __name__ == "__main__":
    asyncio.run(test_tracking_functions()) 