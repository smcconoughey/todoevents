#!/usr/bin/env python3

from backend import get_db

def fix_interest_table():
    print("🔧 Fixing event_interests table...")
    
    with get_db() as conn:
        c = conn.cursor()
        
        # Drop the existing table
        c.execute('DROP TABLE IF EXISTS event_interests')
        print("🗑️ Dropped existing event_interests table")
        
        # Recreate with correct schema
        c.execute('''CREATE TABLE event_interests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            user_id INTEGER,
            browser_fingerprint TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(event_id, user_id, browser_fingerprint),
            FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        )''')
        
        conn.commit()
        print("✅ Recreated event_interests table with correct schema")
        
        # Verify the table structure
        c.execute('PRAGMA table_info(event_interests)')
        columns = [row[1] for row in c.fetchall()]
        print(f"📋 Columns: {columns}")

if __name__ == "__main__":
    fix_interest_table() 