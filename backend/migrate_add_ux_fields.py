#!/usr/bin/env python3
"""
Migration script to add new UX enhancement fields to existing events table.
This script adds: fee_required, event_url, and host_name columns.
"""
import sqlite3
import os
import sys
from contextlib import contextmanager

# Database connection helper
@contextmanager
def get_db():
    """Database connection helper"""
    db_path = 'events.db'
    if not os.path.exists(db_path):
        print(f"Database file not found: {db_path}")
        sys.exit(1)
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def check_column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [column[1] for column in cursor.fetchall()]
    return column_name in columns

def migrate_database():
    """Add new UX enhancement columns to events table"""
    print("🔄 Starting database migration for UX enhancement fields...")
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Check if events table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='events'")
            if not cursor.fetchone():
                print("❌ Events table not found!")
                return False
            
            migrations_applied = 0
            
            # Add fee_required column if it doesn't exist
            if not check_column_exists(cursor, 'events', 'fee_required'):
                print("📝 Adding fee_required column...")
                cursor.execute('ALTER TABLE events ADD COLUMN fee_required TEXT')
                migrations_applied += 1
                print("✅ Added fee_required column")
            else:
                print("✓ fee_required column already exists")
            
            # Add event_url column if it doesn't exist
            if not check_column_exists(cursor, 'events', 'event_url'):
                print("📝 Adding event_url column...")
                cursor.execute('ALTER TABLE events ADD COLUMN event_url TEXT')
                migrations_applied += 1
                print("✅ Added event_url column")
            else:
                print("✓ event_url column already exists")
            
            # Add host_name column if it doesn't exist
            if not check_column_exists(cursor, 'events', 'host_name'):
                print("📝 Adding host_name column...")
                cursor.execute('ALTER TABLE events ADD COLUMN host_name TEXT')
                migrations_applied += 1
                print("✅ Added host_name column")
            else:
                print("✓ host_name column already exists")
            
            # Commit changes
            conn.commit()
            
            if migrations_applied > 0:
                print(f"🎉 Migration completed! Applied {migrations_applied} changes.")
            else:
                print("✓ No migration needed - all columns already exist")
            
            # Verify the new schema
            print("\n📋 Current events table schema:")
            cursor.execute("PRAGMA table_info(events)")
            columns = cursor.fetchall()
            for column in columns:
                print(f"  - {column[1]} ({column[2]})")
            
            return True
            
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        return False

def rollback_migration():
    """Rollback migration (SQLite doesn't support DROP COLUMN easily)"""
    print("⚠️  Rollback not implemented for SQLite")
    print("⚠️  SQLite doesn't support DROP COLUMN directly")
    print("⚠️  If you need to rollback, restore from backup")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        rollback_migration()
    else:
        migrate_database() 