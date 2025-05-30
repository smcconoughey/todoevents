#!/usr/bin/env python3
"""
Quick performance test for TodoEvents backend
"""
import requests
import time
import json

def test_endpoint(url, name, timeout=10):
    """Test a single endpoint and return response time"""
    try:
        start_time = time.time()
        response = requests.get(url, timeout=timeout)
        end_time = time.time()
        
        response_time = (end_time - start_time) * 1000  # Convert to milliseconds
        
        print(f"✅ {name}: {response_time:.0f}ms (HTTP {response.status_code})")
        return response_time, response.status_code
        
    except requests.exceptions.Timeout:
        print(f"❌ {name}: TIMEOUT (>{timeout}s)")
        return None, 'TIMEOUT'
    except requests.exceptions.RequestException as e:
        print(f"❌ {name}: ERROR - {str(e)}")
        return None, 'ERROR'

def main():
    """Run performance tests"""
    print("🚀 TodoEvents Backend Performance Test")
    print("=" * 50)
    
    base_url = "https://todoevents-backend.onrender.com"
    
    # Test endpoints in order of importance
    endpoints = [
        ("/health", "Health Check"),
        ("/events", "List Events"),
        ("/events/1", "Single Event"),
        ("/events/1/interest", "Interest Status"),
    ]
    
    total_time = 0
    successful_tests = 0
    
    for endpoint, name in endpoints:
        url = f"{base_url}{endpoint}"
        response_time, status = test_endpoint(url, name, timeout=15)
        
        if response_time is not None:
            total_time += response_time
            successful_tests += 1
        
        # Small delay between requests
        time.sleep(0.5)
    
    print("=" * 50)
    if successful_tests > 0:
        avg_time = total_time / successful_tests
        print(f"📊 Average Response Time: {avg_time:.0f}ms")
        
        if avg_time < 1000:
            print("🟢 Performance: GOOD")
        elif avg_time < 3000:
            print("🟡 Performance: MODERATE")
        else:
            print("🔴 Performance: POOR")
    else:
        print("🔴 All tests failed!")

if __name__ == "__main__":
    main() 