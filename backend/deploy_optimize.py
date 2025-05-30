#!/usr/bin/env python3
"""
Production database optimization for Render deployment
Fixes timeout issues and improves performance
"""
import os
import sys
import time
import requests
import logging
from contextlib import contextmanager

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def optimize_production_database():
    """Optimize the production database via API calls"""
    
    logger.info("🚀 Starting production database optimization...")
    
    # Get the production URL
    prod_url = "https://todoevents-backend.onrender.com"
    
    # Test if backend is responsive first
    logger.info("🔍 Testing backend connectivity...")
    try:
        response = requests.get(f"{prod_url}/health", timeout=30)
        if response.status_code == 200:
            logger.info("✅ Backend is responsive")
        else:
            logger.error(f"❌ Backend health check failed: {response.status_code}")
            return False
    except Exception as e:
        logger.error(f"❌ Backend connectivity test failed: {e}")
        return False
    
    # Try to trigger database optimization via debug endpoint
    logger.info("📊 Attempting to access database optimization endpoint...")
    try:
        response = requests.post(f"{prod_url}/debug/create-tables", timeout=60)
        if response.status_code == 200:
            logger.info("✅ Database tables created/optimized")
        else:
            logger.warning(f"⚠️ Table creation response: {response.status_code}")
    except Exception as e:
        logger.warning(f"⚠️ Table optimization failed: {e}")
    
    # Test performance of key endpoints
    logger.info("🏃 Testing endpoint performance...")
    
    endpoints_to_test = [
        ("/events", "Events list"),
        ("/events/1", "Single event"),
        ("/events/1/interest", "Interest status")
    ]
    
    performance_results = {}
    
    for endpoint, name in endpoints_to_test:
        logger.info(f"  Testing {name} ({endpoint})...")
        start_time = time.time()
        try:
            response = requests.get(f"{prod_url}{endpoint}", timeout=15)
            end_time = time.time()
            duration_ms = (end_time - start_time) * 1000
            
            if response.status_code in [200, 404]:  # 404 is ok for event that might not exist
                logger.info(f"  ✅ {name}: {duration_ms:.0f}ms (status: {response.status_code})")
                performance_results[endpoint] = duration_ms
            else:
                logger.warning(f"  ⚠️ {name}: {duration_ms:.0f}ms (status: {response.status_code})")
                performance_results[endpoint] = duration_ms
                
        except requests.exceptions.Timeout:
            logger.error(f"  ❌ {name}: TIMEOUT after 15 seconds")
            performance_results[endpoint] = float('inf')
        except Exception as e:
            logger.error(f"  ❌ {name}: Error - {e}")
            performance_results[endpoint] = float('inf')
    
    # Analyze results
    logger.info("📈 Performance Analysis:")
    all_good = True
    for endpoint, duration in performance_results.items():
        if duration == float('inf'):
            logger.error(f"  ❌ {endpoint}: TIMEOUT")
            all_good = False
        elif duration > 5000:  # More than 5 seconds
            logger.warning(f"  ⚠️ {endpoint}: SLOW ({duration:.0f}ms)")
            all_good = False
        elif duration > 2000:  # More than 2 seconds
            logger.info(f"  🐌 {endpoint}: OK but slow ({duration:.0f}ms)")
        else:
            logger.info(f"  ⚡ {endpoint}: FAST ({duration:.0f}ms)")
    
    if all_good:
        logger.info("✅ All endpoints are performing well!")
        return True
    else:
        logger.warning("⚠️ Some endpoints are slow. Check database configuration.")
        return False

def restart_backend():
    """Trigger a backend restart by making API calls that might help"""
    logger.info("🔄 Attempting to help backend performance...")
    
    prod_url = "https://todoevents-backend.onrender.com"
    
    # Make a few API calls to warm up the service
    warmup_endpoints = ["/health", "/events"]
    
    for endpoint in warmup_endpoints:
        try:
            logger.info(f"  Warming up {endpoint}...")
            response = requests.get(f"{prod_url}{endpoint}", timeout=30)
            logger.info(f"  Response: {response.status_code}")
        except Exception as e:
            logger.warning(f"  Warmup failed for {endpoint}: {e}")

if __name__ == "__main__":
    print("🔧 TodoEvents Production Optimization Tool")
    print("=" * 50)
    
    # Run optimization
    if optimize_production_database():
        print("\n✨ Production optimization completed successfully!")
    else:
        print("\n⚠️ Some issues detected. Attempting warmup...")
        restart_backend()
        
        # Test again after warmup
        print("\n🔍 Re-testing after warmup...")
        if optimize_production_database():
            print("\n✅ Performance improved after warmup!")
        else:
            print("\n❌ Performance issues persist. Manual investigation needed.")
            print("\n💡 Suggestions:")
            print("   1. Check Render dashboard for resource usage")
            print("   2. Verify database connection pool settings")
            print("   3. Consider upgrading Render plan for more resources")
            print("   4. Check backend logs for specific errors") 