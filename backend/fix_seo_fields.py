#!/usr/bin/env python3
"""
Script to fix missing SEO fields in the events database
Addresses the following SEO issues:
- Missing field "url" (in "organizer")
- Missing field "offers"
- Missing field "image"
- Missing field "eventStatus"
- Missing field "performer"
- Missing field "endDate"
"""

import sqlite3
import os
import sys
import argparse
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

# Add the current directory to the path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import utility functions
from seo_utils import SEOEventProcessor, generate_event_json_ld, validate_event_data

def get_db_connection(db_path: str = "events.db"):
    """Get a connection to the SQLite database"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def get_all_events(conn) -> List[Dict[str, Any]]:
    """Get all events from the database"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            id, title, slug, description, short_description,
            date, start_time, end_time, end_date,
            start_datetime, end_datetime,
            category, address, city, state, country,
            lat, lng, price, currency, fee_required,
            event_url, host_name, organizer_url,
            created_by, created_at, updated_at,
            interest_count, view_count, is_published,
            verified
        FROM events 
        WHERE is_published = 1
    """)
    
    events = []
    for row in cursor.fetchall():
        events.append(dict(row))
    
    return events

def update_event_seo_fields(conn, event: Dict[str, Any]) -> Dict[str, Any]:
    """Update an event with missing SEO fields"""
    
    # Create SEO processor
    processor = SEOEventProcessor(base_url="https://todo-events.com")
    
    # Process the event to fill in missing fields
    processed_event = processor.process_event(event)
    
    # Additional fixes for specific SEO issues
    
    # 1. Fix missing organizer URL
    if not processed_event.get('organizer_url'):
        processed_event['organizer_url'] = "https://todo-events.com"
    
    # 2. Fix missing end date/time
    if not processed_event.get('end_time') and not processed_event.get('end_datetime'):
        # Default to 2 hours after start time
        if processed_event.get('start_time'):
            start_parts = processed_event['start_time'].split(':')
            if len(start_parts) >= 2:
                start_hour = int(start_parts[0])
                start_minute = int(start_parts[1])
                
                end_hour = (start_hour + 2) % 24
                end_minute = start_minute
                
                processed_event['end_time'] = f"{end_hour:02d}:{end_minute:02d}"
                
                # If event crosses midnight, set end_date to next day
                if end_hour < start_hour:
                    if processed_event.get('date'):
                        try:
                            start_date = datetime.strptime(processed_event['date'], '%Y-%m-%d')
                            end_date = start_date + timedelta(days=1)
                            processed_event['end_date'] = end_date.strftime('%Y-%m-%d')
                        except ValueError:
                            pass
    
    # Update the database
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE events
        SET 
            short_description = ?,
            organizer_url = ?,
            end_time = ?,
            end_date = ?,
            updated_at = ?
        WHERE id = ?
    """, (
        processed_event.get('short_description', ''),
        processed_event.get('organizer_url', ''),
        processed_event.get('end_time', ''),
        processed_event.get('end_date', ''),
        datetime.now().isoformat(),
        processed_event['id']
    ))
    
    return processed_event

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Fix missing SEO fields in the events database')
    parser.add_argument('--db', type=str, default='events.db', help='Path to the SQLite database')
    parser.add_argument('--dry-run', action='store_true', help='Do not make changes, just report issues')
    args = parser.parse_args()
    
    conn = get_db_connection(args.db)
    
    try:
        # Get all events
        events = get_all_events(conn)
        print(f"Found {len(events)} published events")
        
        # Track statistics
        total_issues = 0
        fixed_events = 0
        issue_types = {
            "Missing field 'url' (in 'organizer')": 0,
            "Missing field 'offers'": 0,
            "Missing field 'image'": 0,
            "Missing field 'eventStatus'": 0,
            "Missing field 'performer'": 0,
            "Missing field 'endDate'": 0
        }
        
        # Process each event
        for event in events:
            # Validate the event
            issues = validate_event_data(event)
            
            if issues:
                total_issues += len(issues)
                
                # Count issue types
                for issue in issues:
                    for issue_type in issue_types:
                        if issue_type.lower() in issue.lower():
                            issue_types[issue_type] += 1
                
                print(f"\nEvent ID {event['id']}: {event['title']}")
                print(f"Issues: {', '.join(issues)}")
                
                if not args.dry_run:
                    # Update the event
                    updated_event = update_event_seo_fields(conn, event)
                    
                    # Check if issues were fixed
                    remaining_issues = validate_event_data(updated_event)
                    fixed = len(remaining_issues) < len(issues)
                    
                    if fixed:
                        fixed_events += 1
                        print(f"✅ Fixed issues for event ID {event['id']}")
                        if remaining_issues:
                            print(f"Remaining issues: {', '.join(remaining_issues)}")
                    else:
                        print(f"❌ Could not fix all issues for event ID {event['id']}")
        
        # Commit changes if not dry run
        if not args.dry_run:
            conn.commit()
            print(f"\nCommitted changes to database")
        
        # Print summary
        print("\n=== Summary ===")
        print(f"Total events: {len(events)}")
        print(f"Events with issues: {total_issues}")
        if not args.dry_run:
            print(f"Fixed events: {fixed_events}")
        
        print("\nIssue types:")
        for issue_type, count in issue_types.items():
            print(f"- {issue_type}: {count}")
        
    finally:
        conn.close()

if __name__ == "__main__":
    main() 