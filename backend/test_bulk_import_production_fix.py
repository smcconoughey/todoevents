#!/usr/bin/env python3
"""
Test script for the production bulk import fix
==============================================

This script tests the new bulk import functionality to ensure it works
with the PostgreSQL RETURNING clause fix.
"""

import requests
import json
import os
import logging
from datetime import datetime, timedelta

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
BASE_URL = os.getenv('API_BASE_URL', 'https://todoevents-backend.onrender.com')
TEST_ADMIN_EMAIL = os.getenv('TEST_ADMIN_EMAIL', 'admin@todoevents.com')
TEST_ADMIN_PASSWORD = os.getenv('TEST_ADMIN_PASSWORD', 'admin123!@#')

def get_auth_token():
    """Get authentication token for admin user"""
    logger.info(f"🔐 Authenticating as {TEST_ADMIN_EMAIL}")
    
    login_data = {
        'username': TEST_ADMIN_EMAIL,
        'password': TEST_ADMIN_PASSWORD
    }
    
    response = requests.post(
        f"{BASE_URL}/token", 
        data=login_data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    
    if response.status_code == 200:
        token = response.json()['access_token']
        logger.info("✅ Authentication successful")
        return token
    else:
        logger.error(f"❌ Authentication failed: {response.status_code} - {response.text}")
        return None

def test_simple_bulk_import(token):
    """Test the simplified bulk import endpoint"""
    logger.info("🧪 Testing simplified bulk import endpoint")
    
    # Create test events
    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    
    test_events = [
        {
            "title": "Test Event 1 - Bulk Import Fix",
            "description": "Testing the new bulk import with RETURNING clause",
            "date": tomorrow,
            "start_time": "14:00",
            "end_time": "16:00",
            "category": "conference",
            "address": "123 Test St, Test City, FL 32801",
            "lat": 28.5383,
            "lng": -81.3792,
            "fee_required": "Free",
            "host_name": "Test Organization",
            "event_url": "https://test.example.com"
        },
        {
            "title": "Test Event 2 - Database Fix",
            "description": "Second test event for PostgreSQL bulk import",
            "date": tomorrow,
            "start_time": "18:00",
            "end_time": "20:00",
            "category": "music",
            "address": "456 Music Ave, Concert City, CA 90210",
            "lat": 34.0522,
            "lng": -118.2437,
            "fee_required": "$25",
            "host_name": "Music Venue",
            "event_url": "https://music.example.com"
        }
    ]
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "events": test_events
    }
    
    # Test the simplified bulk import
    logger.info("🚀 Sending bulk import request (simple method)")
    response = requests.post(
        f"{BASE_URL}/admin/events/bulk-simple",
        headers=headers,
        json=payload
    )
    
    logger.info(f"📊 Response status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        logger.info(f"✅ Simple bulk import successful!")
        logger.info(f"   Success count: {result['success_count']}")
        logger.info(f"   Error count: {result['error_count']}")
        
        if result['errors']:
            logger.warning("⚠️ Some errors occurred:")
            for error in result['errors']:
                logger.warning(f"   - {error}")
        
        # Return created event IDs for cleanup
        return [event['id'] for event in result['created_events']]
    else:
        logger.error(f"❌ Simple bulk import failed: {response.text}")
        return []

def test_standard_bulk_import(token):
    """Test the standard bulk import endpoint with RETURNING fix"""
    logger.info("🧪 Testing standard bulk import endpoint (with RETURNING fix)")
    
    # Create test events
    tomorrow = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')
    
    test_events = [
        {
            "title": "Standard Bulk Test 1",
            "description": "Testing the fixed standard bulk import",
            "date": tomorrow,
            "start_time": "10:00",
            "end_time": "12:00",
            "category": "sports",
            "address": "789 Sports Complex, Athletic City, TX 75001",
            "lat": 32.7767,
            "lng": -96.7970,
            "fee_required": "$15",
            "host_name": "Sports Center"
        },
        {
            "title": "Standard Bulk Test 2",
            "description": "Second test for PostgreSQL RETURNING clause",
            "date": tomorrow,
            "start_time": "15:00",
            "end_time": "17:00",
            "category": "arts",
            "address": "321 Art Gallery, Creative City, NY 10001",
            "lat": 40.7128,
            "lng": -74.0060,
            "fee_required": "Free",
            "host_name": "Art Gallery"
        }
    ]
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "events": test_events
    }
    
    # Test the standard bulk import
    logger.info("🚀 Sending bulk import request (standard method with RETURNING fix)")
    response = requests.post(
        f"{BASE_URL}/admin/events/bulk",
        headers=headers,
        json=payload
    )
    
    logger.info(f"📊 Response status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        logger.info(f"✅ Standard bulk import successful!")
        logger.info(f"   Success count: {result['success_count']}")
        logger.info(f"   Error count: {result['error_count']}")
        
        if result['errors']:
            logger.warning("⚠️ Some errors occurred:")
            for error in result['errors']:
                logger.warning(f"   - {error}")
        
        # Return created event IDs for cleanup
        return [event['id'] for event in result['created_events']]
    else:
        logger.error(f"❌ Standard bulk import failed: {response.text}")
        return []

def cleanup_test_events(token, event_ids):
    """Clean up test events"""
    if not event_ids:
        return
    
    logger.info(f"🧹 Cleaning up {len(event_ids)} test events")
    
    headers = {
        'Authorization': f'Bearer {token}'
    }
    
    for event_id in event_ids:
        try:
            response = requests.delete(
                f"{BASE_URL}/events/{event_id}",
                headers=headers
            )
            if response.status_code == 200:
                logger.info(f"   ✅ Deleted event {event_id}")
            else:
                logger.warning(f"   ⚠️ Failed to delete event {event_id}: {response.status_code}")
        except Exception as e:
            logger.error(f"   ❌ Error deleting event {event_id}: {e}")

def test_database_info(token):
    """Test the database info endpoint"""
    logger.info("🧪 Testing database info endpoint")
    
    headers = {
        'Authorization': f'Bearer {token}'
    }
    
    response = requests.get(
        f"{BASE_URL}/debug/database-info",
        headers=headers
    )
    
    if response.status_code == 200:
        info = response.json()
        logger.info("✅ Database info retrieved:")
        logger.info(f"   Database type: {info.get('database_type')}")
        logger.info(f"   Is production: {info.get('is_production')}")
        logger.info(f"   Event count: {info.get('event_count')}")
        logger.info(f"   UX fields present: {info.get('ux_fields_present')}")
        logger.info(f"   Table count: {len(info.get('tables', []))}")
        return info
    else:
        logger.error(f"❌ Failed to get database info: {response.status_code} - {response.text}")
        return None

def main():
    """Main test function"""
    logger.info("🚀 Starting bulk import production fix test")
    logger.info(f"   Target URL: {BASE_URL}")
    
    # Authenticate
    token = get_auth_token()
    if not token:
        logger.error("❌ Cannot proceed without authentication")
        return
    
    all_created_ids = []
    
    try:
        # Test database info
        db_info = test_database_info(token)
        
        # Test simple bulk import
        simple_ids = test_simple_bulk_import(token)
        all_created_ids.extend(simple_ids)
        
        # Test standard bulk import 
        standard_ids = test_standard_bulk_import(token)
        all_created_ids.extend(standard_ids)
        
        # Report results
        logger.info("📊 Test Results Summary:")
        logger.info(f"   Total events created: {len(all_created_ids)}")
        
        if len(all_created_ids) >= 4:
            logger.info("🎉 All bulk import tests PASSED!")
        elif len(all_created_ids) >= 2:
            logger.warning("⚠️ Partial success - some bulk import methods working")
        else:
            logger.error("❌ Bulk import tests FAILED - no events created")
        
    finally:
        # Clean up test events
        if all_created_ids:
            cleanup_test_events(token, all_created_ids)
    
    logger.info("✅ Test completed")

if __name__ == "__main__":
    main() 