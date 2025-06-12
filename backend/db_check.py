#!/usr/bin/env python3
"""Simple database connection check for deployment"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from backend import get_db
    print("✅ Database connection successful")
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM events")
        count = cursor.fetchone()[0]
        print(f"✅ Found {count} events in database")
        
    sys.exit(0)
except Exception as e:
    print(f"❌ Database connection failed: {e}")
    sys.exit(1) 