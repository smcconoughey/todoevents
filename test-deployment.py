#!/usr/bin/env python3
"""
Comprehensive deployment test script for todoevents application
Tests both frontend and backend connectivity and CORS
"""
import json
import time
import random
import string
import requests

# Configuration - Update these URLs if your deployment is different
FRONTEND_URL = "https://todoevents.onrender.com"
BACKEND_URL = "https://todoevents-backend.onrender.com"

def generate_random_email():
    """Generate a random email for testing"""
    random_str = ''.join(random.choice(string.ascii_lowercase) for _ in range(8))
    return f"test_{random_str}@example.com"

def test_frontend():
    """Test if frontend is responding"""
    print("\n==== Testing Frontend ====")
    try:
        response = requests.get(FRONTEND_URL, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Frontend is accessible")
            return True
        else:
            print("❌ Frontend returned unexpected status code")
            return False
    except Exception as e:
        print(f"❌ Frontend error: {str(e)}")
        return False

def test_backend_health():
    """Test if backend health endpoint is responding"""
    print("\n==== Testing Backend Health ====")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Backend health endpoint is accessible")
            print(f"Response: {response.text[:100]}...")
            return True
        else:
            print("❌ Backend health endpoint returned unexpected status code")
            return False
    except Exception as e:
        print(f"❌ Backend health error: {str(e)}")
        return False

def test_cors():
    """Test CORS configuration by simulating a preflight request"""
    print("\n==== Testing CORS Configuration ====")
    try:
        headers = {
            "Origin": FRONTEND_URL,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        }
        response = requests.options(f"{BACKEND_URL}/users", headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        
        cors_headers = {
            "Access-Control-Allow-Origin": response.headers.get("Access-Control-Allow-Origin"),
            "Access-Control-Allow-Methods": response.headers.get("Access-Control-Allow-Methods"),
            "Access-Control-Allow-Headers": response.headers.get("Access-Control-Allow-Headers"),
        }
        print(f"CORS Headers: {json.dumps(cors_headers, indent=2)}")
        
        if response.status_code in [200, 204] and cors_headers["Access-Control-Allow-Origin"] == FRONTEND_URL:
            print("✅ CORS is properly configured")
            return True
        else:
            print("❌ CORS is not properly configured")
            return False
    except Exception as e:
        print(f"❌ CORS test error: {str(e)}")
        return False

def test_registration():
    """Test user registration"""
    print("\n==== Testing User Registration ====")
    email = generate_random_email()
    password = "SecureTestPass123!"
    
    try:
        print(f"Registering user with email: {email}")
        data = {
            "email": email,
            "password": password,
            "role": "user"
        }
        response = requests.post(
            f"{BACKEND_URL}/users",
            json=data,
            timeout=30,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Registration successful")
            print(f"Response: {response.text[:100]}...")
            return True
        else:
            print(f"❌ Registration failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Registration error: {str(e)}")
        return False

def run_all_tests():
    """Run all deployment tests"""
    print(f"\n{'=' * 60}")
    print(f"TESTING TODOEVENTS DEPLOYMENT")
    print(f"Frontend: {FRONTEND_URL}")
    print(f"Backend: {BACKEND_URL}")
    print(f"{'=' * 60}")
    
    start_time = time.time()
    
    # Track test results
    results = {
        "frontend": test_frontend(),
        "backend_health": test_backend_health(),
        "cors": test_cors(),
        "registration": test_registration()
    }
    
    end_time = time.time()
    duration = end_time - start_time
    
    # Print summary
    print(f"\n{'=' * 60}")
    print("TEST SUMMARY")
    print(f"{'=' * 60}")
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.ljust(15)}: {status}")
    
    overall = all(results.values())
    print(f"\nOverall result: {'✅ PASS' if overall else '❌ FAIL'}")
    print(f"Total time: {duration:.2f} seconds")
    
    if not overall:
        print("\nRecommendations:")
        if not results["frontend"]:
            print("- Check if frontend service is deployed and running")
        if not results["backend_health"]:
            print("- Check if backend service is deployed and running")
            print("- Verify database connection")
        if not results["cors"]:
            print("- Update CORS settings in backend.py")
            print("- Ensure frontend URL is correctly added to allowed origins")
        if not results["registration"]:
            print("- Check database connection and schema initialization")
            print("- Review backend logs for specific errors")

if __name__ == "__main__":
    run_all_tests() 