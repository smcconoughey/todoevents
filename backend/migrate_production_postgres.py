#!/usr/bin/env python3

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_production_db():
    """Get production PostgreSQL connection"""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise Exception("DATABASE_URL environment variable not set")
    
    conn = psycopg2.connect(
        db_url,
        cursor_factory=RealDictCursor,
        connect_timeout=10
    )
    return conn

def init_production_database():
    """Initialize all tables in production PostgreSQL database"""
    print("🚀 Initializing Production PostgreSQL Database...")
    
    with get_production_db() as conn:
        cursor = conn.cursor()
        
        # Create users table
        print("📋 Creating users table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                hashed_password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create events table with all fields including UX enhancements
        print("📋 Creating events table with UX enhancement fields...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                date VARCHAR(10) NOT NULL,
                start_time VARCHAR(8),
                end_time VARCHAR(8),
                end_date VARCHAR(10),
                category VARCHAR(100),
                address TEXT,
                lat REAL,
                lng REAL,
                recurring BOOLEAN DEFAULT FALSE,
                frequency VARCHAR(50),
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                interest_count INTEGER DEFAULT 0,
                view_count INTEGER DEFAULT 0,
                fee_required TEXT,
                event_url TEXT,
                host_name TEXT
            )
        """)
        
        # Create event_interest table
        print("📋 Creating event_interest table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS event_interest (
                id SERIAL PRIMARY KEY,
                event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(event_id, user_id)
            )
        """)
        
        # Create event_views table
        print("📋 Creating event_views table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS event_views (
                id SERIAL PRIMARY KEY,
                event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                browser_fingerprint VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address INET
            )
        """)
        
        # Create password_reset_codes table
        print("📋 Creating password_reset_codes table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_codes (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                reset_code VARCHAR(6) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE
            )
        """)
        
        # Create activity_logs table
        print("📋 Creating activity_logs table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(255) NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create indexes for performance
        print("🔍 Creating indexes...")
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)",
            "CREATE INDEX IF NOT EXISTS idx_events_category ON events(category)",
            "CREATE INDEX IF NOT EXISTS idx_events_location ON events(lat, lng)",
            "CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by)",
            "CREATE INDEX IF NOT EXISTS idx_event_interest_event_id ON event_interest(event_id)",
            "CREATE INDEX IF NOT EXISTS idx_event_interest_user_id ON event_interest(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_event_views_event_id ON event_views(event_id)",
            "CREATE INDEX IF NOT EXISTS idx_event_views_user_id ON event_views(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_password_reset_email ON password_reset_codes(email)",
            "CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)"
        ]
        
        for index_sql in indexes:
            cursor.execute(index_sql)
        
        conn.commit()
        print("✅ Production database initialized successfully!")

def create_default_admin():
    """Create default admin user in production"""
    print("👤 Creating default admin user...")
    
    with get_production_db() as conn:
        cursor = conn.cursor()
        
        # Check if admin exists
        cursor.execute("SELECT id FROM users WHERE email = %s", ("admin@todoevents.com",))
        if cursor.fetchone():
            print("ℹ️  Admin user already exists")
            return
        
        # Create admin user
        from backend import get_password_hash
        hashed_password = get_password_hash("admin123!")
        
        cursor.execute("""
            INSERT INTO users (email, hashed_password, role) 
            VALUES (%s, %s, %s)
        """, ("admin@todoevents.com", hashed_password, "admin"))
        
        conn.commit()
        print("✅ Default admin user created: admin@todoevents.com / admin123!")

def migrate_ux_fields():
    """Ensure UX enhancement fields exist"""
    print("🔧 Checking UX enhancement fields...")
    
    with get_production_db() as conn:
        cursor = conn.cursor()
        
        # Check if UX fields exist
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'events' 
            AND column_name IN ('fee_required', 'event_url', 'host_name')
        """)
        
        existing_fields = [row['column_name'] for row in cursor.fetchall()]
        required_fields = ['fee_required', 'event_url', 'host_name']
        
        for field in required_fields:
            if field not in existing_fields:
                print(f"➕ Adding {field} column...")
                cursor.execute(f"ALTER TABLE events ADD COLUMN {field} TEXT")
            else:
                print(f"✓ {field} column already exists")
        
        conn.commit()
        print("✅ UX enhancement fields verified!")

def verify_database():
    """Verify the database setup"""
    print("🔍 Verifying database setup...")
    
    with get_production_db() as conn:
        cursor = conn.cursor()
        
        # Check tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        tables = [row['table_name'] for row in cursor.fetchall()]
        
        expected_tables = ['users', 'events', 'event_interest', 'event_views', 'password_reset_codes', 'activity_logs']
        
        print("📊 Tables found:")
        for table in tables:
            print(f"  ✓ {table}")
        
        missing_tables = [t for t in expected_tables if t not in tables]
        if missing_tables:
            print(f"❌ Missing tables: {missing_tables}")
        else:
            print("✅ All required tables exist!")
        
        # Check events table structure
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'events'
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        print("\n📋 Events table structure:")
        for col in columns:
            print(f"  - {col['column_name']} ({col['data_type']})")
        
        # Check if UX fields exist
        ux_fields = ['fee_required', 'event_url', 'host_name']
        existing_ux_fields = [col['column_name'] for col in columns if col['column_name'] in ux_fields]
        
        print(f"\n🎨 UX Enhancement fields: {existing_ux_fields}")
        
        if len(existing_ux_fields) == len(ux_fields):
            print("✅ All UX enhancement fields are present!")
        else:
            missing_ux = [f for f in ux_fields if f not in existing_ux_fields]
            print(f"❌ Missing UX fields: {missing_ux}")

def main():
    print("🚀 Production PostgreSQL Migration Script")
    print("=" * 50)
    
    try:
        # Initialize database
        init_production_database()
        
        # Migrate UX fields
        migrate_ux_fields()
        
        # Create admin user
        create_default_admin()
        
        # Verify setup
        verify_database()
        
        print("\n🎉 Production database migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise

if __name__ == "__main__":
    main() 