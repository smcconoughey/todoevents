#!/usr/bin/env python3
"""
Simple API test script to verify backend connectivity
"""

import requests
import json
import sys
import time
from urllib.parse import urljoin

def test_api_endpoint(base_url, timeout=10):
    """Test basic API endpoints"""
    print(f"Testing API at: {base_url}")
    
    # Test health endpoint
    try:
        print("1. Testing health endpoint...")
        response = requests.get(
            urljoin(base_url, "/health"), 
            timeout=timeout
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            health_data = response.json()
            print(f"   Database: {health_data.get('database', {}).get('status', 'unknown')}")
            print(f"   Environment: {health_data.get('environment', 'unknown')}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Failed: {str(e)}")
        return False
    
    # Test root endpoint
    try:
        print("2. Testing root endpoint...")
        response = requests.get(
            urljoin(base_url, "/"), 
            timeout=timeout
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Failed: {str(e)}")
    
    # Test events endpoint
    try:
        print("3. Testing events endpoint...")
        response = requests.get(
            urljoin(base_url, "/events"), 
            timeout=timeout
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            events = response.json()
            print(f"   Found {len(events)} events")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Failed: {str(e)}")
    
    # Test CORS preflight
    try:
        print("4. Testing CORS preflight...")
        response = requests.options(
            urljoin(base_url, "/events"),
            headers={
                'Origin': 'https://todoevents-1.onrender.com',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type,Authorization'
            },
            timeout=timeout
        )
        print(f"   Status: {response.status_code}")
        cors_headers = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
        }
        print(f"   CORS Headers: {cors_headers}")
    except Exception as e:
        print(f"   Failed: {str(e)}")
    
    return True

if __name__ == "__main__":
    # Test URLs
    urls_to_test = [
        "http://localhost:8000",  # Local development
        "https://eventfinder-api.onrender.com",  # Production
    ]
    
    # Allow custom URL from command line
    if len(sys.argv) > 1:
        urls_to_test = [sys.argv[1]]
    
    for url in urls_to_test:
        print(f"\n{'='*50}")
        print(f"Testing: {url}")
        print('='*50)
        
        success = test_api_endpoint(url)
        
        if not success:
            print(f"❌ Failed to connect to {url}")
        else:
            print(f"✅ Successfully tested {url}")
        
        time.sleep(1)  # Brief pause between tests 