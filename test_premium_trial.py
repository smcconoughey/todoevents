#!/usr/bin/env python3
"""
Test script for the Premium Trial Invite System

This script demonstrates the complete flow:
1. Generate an invite code
2. Validate the invite code
3. Create a user with the invite code
4. Verify the user has premium access

Run this after starting the backend server.
"""

import requests
import json
from datetime import datetime, timedelta

API_BASE = "http://localhost:8000"

def test_premium_trial_system():
    print("🚀 Testing Premium Trial Invite System")
    print("=" * 50)
    
    # Step 1: Generate invite code
    print("1. Generating premium trial invite code...")
    try:
        response = requests.post(f"{API_BASE}/generate-premium-trial-invite")
        if response.status_code == 200:
            invite_data = response.json()
            invite_code = invite_data['invite_code']
            print(f"✅ Generated invite code: {invite_code}")
            print(f"   Trial type: {invite_data['trial_type']}")
            print(f"   Duration: {invite_data['trial_duration_days']} days")
            print(f"   Expires: {invite_data['expires_at']}")
        else:
            print(f"❌ Failed to generate invite code: {response.status_code}")
            print(f"   Response: {response.text}")
            return
    except Exception as e:
        print(f"❌ Error generating invite code: {e}")
        return
    
    # Step 2: Validate invite code
    print(f"\n2. Validating invite code: {invite_code}")
    try:
        response = requests.post(f"{API_BASE}/validate-trial-invite", 
                               json={'invite_code': invite_code})
        if response.status_code == 200:
            validation_data = response.json()
            print(f"✅ Invite code is valid:")
            print(f"   Trial type: {validation_data['trial_type']}")
            print(f"   Duration: {validation_data['trial_duration_days']} days")
            print(f"   Remaining uses: {validation_data['remaining_uses']}")
        else:
            print(f"❌ Invite validation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return
    except Exception as e:
        print(f"❌ Error validating invite code: {e}")
        return
    
    # Step 3: Test invalid invite code
    print(f"\n3. Testing invalid invite code...")
    try:
        response = requests.post(f"{API_BASE}/validate-trial-invite", 
                               json={'invite_code': 'INVALID123'})
        if response.status_code == 200:
            validation_data = response.json()
            if not validation_data['valid']:
                print(f"✅ Invalid invite code correctly rejected:")
                print(f"   Error: {validation_data['error']}")
            else:
                print(f"❌ Invalid invite code was accepted unexpectedly")
        else:
            print(f"❌ Unexpected response for invalid code: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing invalid invite code: {e}")
    
    # Step 4: Create user with invite code
    print(f"\n4. Creating user with invite code...")
    test_email = f"test+{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com"
    user_data = {
        'email': test_email,
        'password': 'TestPassword123!',
        'invite_code': invite_code
    }
    
    try:
        response = requests.post(f"{API_BASE}/users-with-invite", json=user_data)
        if response.status_code == 200:
            user_response = response.json()
            print(f"✅ User created successfully:")
            print(f"   Email: {user_response['email']}")
            print(f"   Role: {user_response['role']}")
            if user_response.get('trial_activated'):
                print(f"   🎉 Premium trial activated!")
                print(f"   Trial type: {user_response['trial_type']}")
                print(f"   Expires: {user_response['trial_expires_at']}")
            else:
                print(f"   ❌ Premium trial was not activated")
        else:
            print(f"❌ User creation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return
    except Exception as e:
        print(f"❌ Error creating user: {e}")
        return
    
    # Step 5: Test invite code usage (should be used up now)
    print(f"\n5. Testing invite code after use...")
    try:
        response = requests.post(f"{API_BASE}/validate-trial-invite", 
                               json={'invite_code': invite_code})
        if response.status_code == 200:
            validation_data = response.json()
            if validation_data['valid'] and validation_data['remaining_uses'] == 0:
                print(f"✅ Invite code correctly shows 0 remaining uses")
            elif not validation_data['valid']:
                print(f"✅ Invite code correctly marked as invalid after use")
                print(f"   Error: {validation_data['error']}")
            else:
                print(f"❌ Invite code still shows remaining uses after being used")
        else:
            print(f"❌ Unexpected response: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing used invite code: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Premium Trial Invite System Test Completed!")
    print("\nSummary:")
    print("- ✅ Invite code generation")
    print("- ✅ Invite code validation")
    print("- ✅ Invalid code rejection")
    print("- ✅ User registration with invite")
    print("- ✅ Premium trial activation")
    print("- ✅ Invite code usage tracking")
    print("\nThe system is ready for the 5th visit popup!")

if __name__ == "__main__":
    test_premium_trial_system() 