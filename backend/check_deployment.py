#!/usr/bin/env python3
"""
Script to check various possible backend deployment URLs
"""
import requests
import time

def test_url(url):
    """Test if a URL is responding"""
    try:
        response = requests.get(url, timeout=10)
        return response.status_code, response.text[:200]
    except requests.exceptions.RequestException as e:
        return None, str(e)

# List of possible backend URLs to test
possible_urls = [
    "https://todoevents-backend.onrender.com",
    "https://eventfinder-api.onrender.com", 
    "https://todoevents-1.onrender.com",
    "https://todoevents-api.onrender.com",
    "https://todoevents.onrender.com/api",  # Maybe backend is on same domain
    "https://todoevents-1-backend.onrender.com",
]

print("Testing possible backend URLs...")
print("=" * 50)

for url in possible_urls:
    print(f"\nTesting: {url}")
    
    # Test health endpoint
    health_url = f"{url}/health"
    status, content = test_url(health_url)
    
    if status:
        print(f"  Health: {status} - {content}")
        if status == 200:
            print(f"  ✅ FOUND WORKING BACKEND: {url}")
            break
    else:
        print(f"  Health: ERROR - {content}")
    
    # Test root endpoint
    root_status, root_content = test_url(url)
    if root_status:
        print(f"  Root: {root_status} - {root_content}")
    else:
        print(f"  Root: ERROR - {root_content}")

print("\n" + "=" * 50)
print("Check your Render dashboard to see actual service names and URLs.") 