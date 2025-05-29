#!/usr/bin/env python3
"""
Test script to verify backend functionality
"""
import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_backend_import():
    """Test that the backend can be imported without errors"""
    try:
        print("🔄 Testing backend import...")
        
        # Try importing just the security functions first
        from backend import verify_password, get_password_hash, get_db, create_default_admin_user
        print("✅ Security functions imported successfully")
        
        # Test password hashing
        test_password = "TestPassword123!"
        hashed = get_password_hash(test_password)
        verified = verify_password(test_password, hashed)
        
        if verified:
            print("✅ Password hashing/verification working correctly")
        else:
            print("❌ Password verification failed")
            return False
            
        # Test admin user creation
        try:
            with get_db() as conn:
                create_default_admin_user(conn)
            print("✅ Default admin user creation working")
        except Exception as e:
            print(f"❌ Admin user creation failed: {str(e)}")
            return False
            
        # Try importing the full backend
        import backend
        print("✅ Full backend imported successfully")
        
        # Check scheduler
        if hasattr(backend, 'task_manager'):
            scheduler_status = hasattr(backend.task_manager, 'scheduler')
            print(f"✅ Task manager available: {scheduler_status}")
        
        return True
        
    except Exception as e:
        print(f"❌ Backend import failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_backend_import()
    if success:
        print("\n🎉 All backend tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Backend tests failed!")
        sys.exit(1) 