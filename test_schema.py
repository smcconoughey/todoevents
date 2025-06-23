import sqlite3
import os

# Check if we're in production or local development
if os.environ.get('DATABASE_URL'):
    print("Production database detected, skipping local test")
    exit(0)

# Connect to local SQLite database
try:
    conn = sqlite3.connect('todo_events.db')
    cursor = conn.cursor()
    
    # Check if the is_premium_event column exists
    cursor.execute("PRAGMA table_info(events)")
    columns = cursor.fetchall()
    
    print("Events table columns:")
    column_names = [col[1] for col in columns]
    for col in columns:
        print(f"  {col[1]}: {col[2]}")
    
    # Check specifically for is_premium_event
    if 'is_premium_event' in column_names:
        print("\n✅ is_premium_event column found!")
        
        # Test inserting an event with is_premium_event
        cursor.execute("""
            INSERT INTO events (
                title, description, date, start_time, category, address, lat, lng, 
                created_by, is_premium_event
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "Test Premium Event", "Test description", "2024-12-25", "12:00",
            "community", "123 Test St", 40.7128, -74.0060, 1, True
        ))
        
        # Retrieve the event
        cursor.execute("SELECT title, is_premium_event FROM events WHERE title = ?", ("Test Premium Event",))
        result = cursor.fetchone()
        
        if result:
            print(f"✅ Successfully inserted and retrieved premium event: {result[0]}, is_premium_event: {result[1]}")
        else:
            print("❌ Failed to retrieve test event")
            
        # Clean up
        cursor.execute("DELETE FROM events WHERE title = ?", ("Test Premium Event",))
        conn.commit()
        
    else:
        print("❌ is_premium_event column NOT found!")
        print("Available columns:", column_names)
    
    conn.close()
    
except Exception as e:
    print(f"Error checking database schema: {e}") 