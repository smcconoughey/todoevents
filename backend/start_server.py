import uvicorn
import os
from backend import app, init_db, create_default_admin_user, get_db, AutomatedTaskManager, IS_PRODUCTION, logger

if __name__ == "__main__":
    # Initialize database on startup
    init_db()
    
    # Create default admin user
    try:
        with get_db() as conn:
            create_default_admin_user(conn)
    except Exception as e:
        logger.error(f"Error creating default admin user: {e}")
    
    # Start automated task manager
    try:
        task_manager = AutomatedTaskManager()
        task_manager.start_scheduler()
        logger.info("✅ Automated task manager started successfully")
    except Exception as e:
        logger.error(f"❌ Failed to start automated task manager: {e}")
    
    # Determine host and port
    host = "0.0.0.0" if IS_PRODUCTION else "127.0.0.1"
    port = int(os.getenv("PORT", 8000))
    
    logger.info(f"🚀 Starting TodoEvents API server on {host}:{port}")
    logger.info(f"Environment: {'Production' if IS_PRODUCTION else 'Development'}")
    
    # Start the server
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
        access_log=True
    ) 