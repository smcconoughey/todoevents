#!/usr/bin/env python3

import sqlite3
import sys
from datetime import datetime

def dedupe_events(dry_run=True):
    """Remove duplicate events from the database"""
    try:
        conn = sqlite3.connect('events.db')
        cursor = conn.cursor()

        print("=" * 80)
        print("EVENT DEDUPLICATION SCRIPT")
        print("=" * 80)
        
        if dry_run:
            print("DRY RUN MODE - No changes will be made")
        else:
            print("LIVE MODE - Changes will be applied!")
        print()

        # Find duplicate events using the same logic as the API
        # Group by normalized title, date, start_time, rounded coordinates, and category
        query = '''
        SELECT 
            TRIM(LOWER(title)) as norm_title,
            date,
            start_time,
            ROUND(lat, 6) as rounded_lat,
            ROUND(lng, 6) as rounded_lng,
            category,
            COUNT(*) as count,
            GROUP_CONCAT(id) as ids,
            GROUP_CONCAT(title) as titles,
            GROUP_CONCAT(created_at) as created_ats
        FROM events 
        GROUP BY norm_title, date, start_time, rounded_lat, rounded_lng, category 
        HAVING COUNT(*) > 1
        ORDER BY count DESC, norm_title
        '''

        cursor.execute(query)
        duplicates = cursor.fetchall()

        if not duplicates:
            print("✅ No duplicate events found!")
            conn.close()
            return 0

        print(f"Found {len(duplicates)} groups of duplicate events:")
        print("-" * 80)
        
        total_to_remove = 0
        removal_plan = []
        
        for dup in duplicates:
            norm_title, date, start_time, lat, lng, category, count, ids_str, titles_str, created_ats_str = dup
            
            ids = [int(x) for x in ids_str.split(',')]
            titles = titles_str.split(',')
            created_ats = created_ats_str.split(',')
            
            print(f"Title: \"{titles[0]}\" (normalized: \"{norm_title}\")")
            print(f"Category: {category}")
            print(f"Date: {date} at {start_time}")
            print(f"Location: {lat}, {lng}")
            print(f"Duplicates: {count} copies")
            
            # Keep the first created event, remove the rest
            keep_id = ids[0]
            remove_ids = ids[1:]
            
            print(f"  → KEEP: ID {keep_id} (created: {created_ats[0]})")
            for i, remove_id in enumerate(remove_ids, 1):
                print(f"  → REMOVE: ID {remove_id} (created: {created_ats[i]})")
                removal_plan.append(remove_id)
            
            print("-" * 40)
            total_to_remove += len(remove_ids)

        # Show summary
        cursor.execute('SELECT COUNT(*) FROM events')
        total_events = cursor.fetchone()[0]
        
        print(f"\nSUMMARY:")
        print(f"Total events in database: {total_events}")
        print(f"Duplicate events to remove: {total_to_remove}")
        print(f"Events after deduplication: {total_events - total_to_remove}")
        print(f"Duplicate groups: {len(duplicates)}")

        if not dry_run and removal_plan:
            print(f"\n🔥 REMOVING {len(removal_plan)} DUPLICATE EVENTS...")
            
            # Remove duplicates
            for event_id in removal_plan:
                try:
                    # Start transaction
                    cursor.execute("BEGIN")
                    
                    # Remove from related tables first (to avoid foreign key issues)
                    cursor.execute("DELETE FROM event_interests WHERE event_id = ?", (event_id,))
                    cursor.execute("DELETE FROM event_views WHERE event_id = ?", (event_id,))
                    
                    # Remove the event
                    cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
                    
                    # Commit transaction
                    cursor.execute("COMMIT")
                    print(f"  ✅ Removed event ID {event_id}")
                    
                except Exception as e:
                    cursor.execute("ROLLBACK")
                    print(f"  ❌ Failed to remove event ID {event_id}: {e}")
            
            print(f"\n✅ Deduplication complete!")
            
            # Verify final count
            cursor.execute('SELECT COUNT(*) FROM events')
            final_count = cursor.fetchone()[0]
            print(f"Final event count: {final_count}")
            
        elif dry_run:
            print(f"\n📝 DRY RUN: Would remove {total_to_remove} duplicate events")
            print("Run with --live to actually remove duplicates")

        conn.close()
        return total_to_remove

    except Exception as e:
        print(f"❌ Error during deduplication: {e}")
        return -1

def main():
    """Main function with command line argument handling"""
    dry_run = True
    
    if len(sys.argv) > 1:
        if sys.argv[1] in ['--live', '--execute', '--real']:
            dry_run = False
        elif sys.argv[1] in ['--help', '-h']:
            print("Usage: python3 dedupe_events.py [--live|--dry-run]")
            print("  --live     : Actually remove duplicate events")
            print("  --dry-run  : Show what would be removed (default)")
            return
    
    if not dry_run:
        response = input("\n⚠️  WARNING: This will permanently delete duplicate events. Continue? (yes/NO): ")
        if response.lower() != 'yes':
            print("Aborted.")
            return
    
    removed = dedupe_events(dry_run=dry_run)
    
    if removed > 0 and dry_run:
        print(f"\nTo actually remove duplicates, run:")
        print(f"python3 dedupe_events.py --live")
    elif removed == 0:
        print(f"\n✅ Database is already clean!")

if __name__ == "__main__":
    main() 