#!/usr/bin/env python3
"""
Test script for automated sitemap generation and AI sync
"""
import os
import asyncio
import logging
from datetime import datetime

# Set environment variables to simulate production
os.environ['RENDER'] = 'true'
os.environ['IS_PRODUCTION'] = 'true'

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_full_automation():
    """Test all automation functions"""
    print("🚀 Starting Full Automation Test")
    print("=" * 50)
    
    # Import after setting environment variables
    from backend import task_manager
    
    print(f"📊 Environment: {'Production' if os.getenv('RENDER') else 'Development'}")
    print(f"🕒 Test Time: {datetime.utcnow().isoformat()}")
    print()
    
    # Test sitemap generation
    print("🗺️  Testing Sitemap Generation...")
    try:
        await task_manager.generate_sitemap_automatically()
        print("✅ Sitemap generation completed successfully")
    except Exception as e:
        print(f"❌ Sitemap generation failed: {str(e)}")
    print()
    
    # Test event data refresh
    print("📊 Testing Event Data Refresh...")
    try:
        await task_manager.refresh_event_data()
        print("✅ Event data refresh completed successfully")
    except Exception as e:
        print(f"❌ Event data refresh failed: {str(e)}")
    print()
    
    # Test AI sync
    print("🤖 Testing AI Tools Synchronization...")
    try:
        await task_manager.sync_with_ai_tools()
        print("✅ AI sync completed successfully")
    except Exception as e:
        print(f"❌ AI sync failed: {str(e)}")
    print()
    
    # Test scheduler (in production mode)
    print("⏰ Testing Scheduler...")
    try:
        if hasattr(task_manager, 'scheduler'):
            print(f"🔧 Scheduler exists: {task_manager.scheduler is not None}")
            print(f"🏃 Scheduler running: {task_manager.scheduler.running}")
            
            if not task_manager.scheduler.running:
                print("🚀 Starting scheduler...")
                task_manager.start_scheduler()
                print(f"✅ Scheduler started: {task_manager.scheduler.running}")
                
                # List scheduled jobs
                jobs = task_manager.scheduler.get_jobs()
                print(f"📋 Scheduled jobs: {len(jobs)}")
                for job in jobs:
                    print(f"   - {job.name}: Next run at {job.next_run_time}")
            else:
                print("✅ Scheduler already running")
        else:
            print("❌ Scheduler not available")
    except Exception as e:
        print(f"❌ Scheduler test failed: {str(e)}")
    print()
    
    # Check task status
    print("📈 Task Status Summary:")
    for task_name, status in task_manager.task_status.items():
        print(f"   {task_name}: {status['status']} (last run: {status['last_run']})")
    
    print()
    print("🎉 Automation test completed!")
    print("=" * 50)

def manual_trigger_test():
    """Test manual trigger functionality"""
    print("🔧 Manual Trigger Test")
    print("=" * 30)
    
    # This simulates what would happen when calling the API endpoint
    print("📞 You can manually trigger automation via API:")
    print("   POST /api/v1/automation/trigger/sitemap")
    print("   POST /api/v1/automation/trigger/events") 
    print("   POST /api/v1/automation/trigger/ai_sync")
    print()
    print("📊 Check status via:")
    print("   GET /api/v1/automation/status")
    print()

if __name__ == "__main__":
    # Run the automation test
    asyncio.run(test_full_automation())
    
    # Show manual trigger info
    manual_trigger_test() 