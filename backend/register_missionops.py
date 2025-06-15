#!/usr/bin/env python3
"""
Script to register MissionOps router with the main FastAPI app.
This can be imported in backend.py or run as a standalone script.
"""

def register_missionops_router(app):
    """Register MissionOps router with the FastAPI app"""
    try:
        from missionops_endpoints import missionops_router
        app.include_router(missionops_router)
        print("✅ MissionOps endpoints registered successfully")
        return True
    except ImportError as e:
        print(f"⚠️ MissionOps endpoints not available: {e}")
        return False
    except Exception as e:
        print(f"❌ Error registering MissionOps endpoints: {e}")
        return False

if __name__ == "__main__":
    # If run as standalone script, patch the main backend.py file
    import os
    import sys
    
    backend_file = os.path.join(os.path.dirname(__file__), "backend.py")
    
    if not os.path.exists(backend_file):
        print("❌ backend.py not found")
        sys.exit(1)
    
    # Read the current backend.py
    with open(backend_file, 'r') as f:
        content = f.read()
    
    # Check if MissionOps is already registered
    if "missionops_router" in content:
        print("✅ MissionOps router already registered in backend.py")
        sys.exit(0)
    
    # Find the first FastAPI app creation and add the registration
    import_line = "from missionops_endpoints import missionops_router"
    register_line = "app.include_router(missionops_router)"
    
    # Add import after other imports
    if "from fastapi import" in content:
        content = content.replace(
            "from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks, Request, Header",
            "from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks, Request, Header\n\n# MissionOps import\ntry:\n    from missionops_endpoints import missionops_router\nexcept ImportError:\n    missionops_router = None"
        )
    
    # Add router registration after first app creation
    if "app = FastAPI(title=\"EventFinder API\")" in content:
        content = content.replace(
            "app = FastAPI(title=\"EventFinder API\")",
            "app = FastAPI(title=\"EventFinder API\")\n\n# Register MissionOps router\nif missionops_router:\n    app.include_router(missionops_router)\n    print(\"✅ MissionOps endpoints registered\")"
        )
    
    # Write the updated content
    with open(backend_file, 'w') as f:
        f.write(content)
    
    print("✅ MissionOps router registration added to backend.py") 