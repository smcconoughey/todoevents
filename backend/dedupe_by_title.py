#!/usr/bin/env python3

import os
import sys
from datetime import datetime

def dedupe_by_title_only(dry_run=True):
    """Remove duplicate events based ONLY on title similarity"""
    try:
        # Check if we're in production (PostgreSQL) or local (SQLite)
        if 'DATABASE_URL' in os.environ:
            # Production PostgreSQL
            import psycopg2
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            placeholder = '%s'
        else:
            # Local SQLite
            import sqlite3
            conn = sqlite3.connect('events.db')
            placeholder = '?'
            
        cursor = conn.cursor()

        print("=" * 80)
        print("TITLE-ONLY EVENT DEDUPLICATION SCRIPT")
        print("=" * 80)
        
        if dry_run:
            print("🔍 DRY RUN MODE - No changes will be made")
        else:
            print("🔥 LIVE MODE - Changes will be applied!")
        print()

        # Find duplicate events based ONLY on normalized title
        if 'DATABASE_URL' in os.environ:
            # PostgreSQL syntax - order by created_at to keep oldest
            query = '''
            SELECT 
                TRIM(LOWER(title)) as norm_title,
                COUNT(*) as count,
                STRING_AGG(id::text, ',' ORDER BY created_at) as ids,
                STRING_AGG(title, '|||' ORDER BY created_at) as titles,
                STRING_AGG(date, ',' ORDER BY created_at) as dates,
                STRING_AGG(category, ',' ORDER BY created_at) as categories,
                STRING_AGG(created_at::text, ',' ORDER BY created_at) as created_ats
            FROM events 
            WHERE title IS NOT NULL AND TRIM(title) != ''
            GROUP BY TRIM(LOWER(title))
            HAVING COUNT(*) > 1
            ORDER BY count DESC, norm_title
            '''
        else:
            # SQLite syntax - order by created_at to keep oldest
            query = '''
            SELECT 
                TRIM(LOWER(title)) as norm_title,
                COUNT(*) as count,
                GROUP_CONCAT(id, ',') as ids,
                GROUP_CONCAT(title, ',') as titles,
                GROUP_CONCAT(date, ',') as dates,
                GROUP_CONCAT(category, ',') as categories,
                GROUP_CONCAT(created_at, ',') as created_ats
            FROM events 
            WHERE title IS NOT NULL AND TRIM(title) != ''
            GROUP BY norm_title 
            HAVING COUNT(*) > 1
            ORDER BY count DESC, norm_title
            '''

        cursor.execute(query)
        duplicates = cursor.fetchall()

        if not duplicates:
            print("✅ No duplicate titles found!")
            conn.close()
            return 0

        print(f"Found {len(duplicates)} groups of events with duplicate titles:")
        print("-" * 80)
        
        total_to_remove = 0
        removal_plan = []
        
        for dup in duplicates:
            norm_title, count, ids_str, titles_str, dates_str, categories_str, created_ats_str = dup
            
            try:
                ids = [int(x.strip()) for x in ids_str.split(',') if x.strip()]
                # Handle different separators for PostgreSQL vs SQLite
                if 'DATABASE_URL' in os.environ:
                    titles = [x.strip() for x in titles_str.split('|||') if x.strip()]
                else:
                    titles = [x.strip() for x in titles_str.split(',') if x.strip()]
                dates = [x.strip() for x in dates_str.split(',') if x.strip()]
                categories = [x.strip() for x in categories_str.split(',') if x.strip()]
                created_ats = [x.strip() for x in created_ats_str.split(',') if x.strip()]
                
                # Verify all lists have the same length
                min_length = min(len(ids), len(titles), len(dates), len(categories), len(created_ats))
                if min_length != len(ids):
                    print(f"⚠️  Warning: Data length mismatch for title '{norm_title}'. Skipping...")
                    continue
                
                # Truncate all lists to the minimum length to ensure consistency
                ids = ids[:min_length]
                titles = titles[:min_length]
                dates = dates[:min_length]
                categories = categories[:min_length]
                created_ats = created_ats[:min_length]
                
                print(f"📝 Normalized Title: \"{norm_title}\"")
                print(f"   Found {len(ids)} events with this title:")
                
                # Keep the first created event, remove the rest
                if len(ids) > 0:
                    keep_id = ids[0]
                    remove_ids = ids[1:]
                    
                    print(f"   → KEEP: ID {keep_id} - \"{titles[0]}\" ({dates[0]}, {categories[0]}) - created: {created_ats[0]}")
                    
                    for i, remove_id in enumerate(remove_ids):
                        idx = i + 1  # Index in the original arrays
                        if idx < len(titles):
                            print(f"   → REMOVE: ID {remove_id} - \"{titles[idx]}\" ({dates[idx]}, {categories[idx]}) - created: {created_ats[idx]}")
                            removal_plan.append(remove_id)
                    
                    print("-" * 40)
                    total_to_remove += len(remove_ids)
                    
            except Exception as e:
                print(f"⚠️  Error processing duplicate group for title '{norm_title}': {e}")
                print(f"   Skipping this group...")
                continue

        # Show summary
        cursor.execute('SELECT COUNT(*) FROM events')
        total_events = cursor.fetchone()[0]
        
        print(f"\n📊 SUMMARY:")
        print(f"   Total events in database: {total_events}")
        print(f"   Duplicate titles to remove: {total_to_remove}")
        print(f"   Events after deduplication: {total_events - total_to_remove}")
        print(f"   Unique title groups found: {len(duplicates)}")

        if not dry_run and removal_plan:
            print(f"\n🗑️ REMOVING {len(removal_plan)} EVENTS WITH DUPLICATE TITLES...")
            
            # Remove duplicates
            removed_count = 0
            for event_id in removal_plan:
                try:
                    # Start transaction (PostgreSQL uses different syntax)
                    if 'DATABASE_URL' in os.environ:
                        conn.autocommit = False
                    else:
                        cursor.execute("BEGIN")
                    
                    # Remove from related tables first (to avoid foreign key issues)
                    cursor.execute(f"DELETE FROM event_interests WHERE event_id = {placeholder}", (event_id,))
                    cursor.execute(f"DELETE FROM event_views WHERE event_id = {placeholder}", (event_id,))
                    
                    # Remove the event
                    cursor.execute(f"DELETE FROM events WHERE id = {placeholder}", (event_id,))
                    
                    # Commit transaction
                    if 'DATABASE_URL' in os.environ:
                        conn.commit()
                    else:
                        cursor.execute("COMMIT")
                    removed_count += 1
                    print(f"  ✅ Removed event ID {event_id}")
                    
                except Exception as e:
                    if 'DATABASE_URL' in os.environ:
                        conn.rollback()
                    else:
                        cursor.execute("ROLLBACK")
                    print(f"  ❌ Failed to remove event ID {event_id}: {e}")
            
            print(f"\n🎉 Title deduplication complete!")
            print(f"   Successfully removed: {removed_count} events")
            
            # Verify final count
            cursor.execute('SELECT COUNT(*) FROM events')
            final_count = cursor.fetchone()[0]
            print(f"   Final event count: {final_count}")
            
        elif dry_run:
            print(f"\n📝 DRY RUN COMPLETE")
            print(f"   Would remove {total_to_remove} events with duplicate titles")
            print(f"   To actually remove them, run: python3 dedupe_by_title.py --live")

        conn.close()
        return total_to_remove

    except Exception as e:
        print(f"❌ Error during title deduplication: {e}")
        return -1

def main():
    """Main function with command line argument handling"""
    dry_run = True
    
    if len(sys.argv) > 1:
        if sys.argv[1] in ['--live', '--execute', '--real']:
            dry_run = False
        elif sys.argv[1] in ['--help', '-h']:
            print("Title-Only Event Deduplication Script")
            print("=====================================")
            print("This script removes events with duplicate titles (normalized).")
            print("It keeps the oldest event and removes newer ones with the same title.")
            print()
            print("Usage: python3 dedupe_by_title.py [OPTIONS]")
            print()
            print("Options:")
            print("  --live     : Actually remove duplicate events")
            print("  --dry-run  : Show what would be removed (default)")
            print("  --help, -h : Show this help message")
            print()
            print("Examples:")
            print("  python3 dedupe_by_title.py           # Dry run")
            print("  python3 dedupe_by_title.py --live    # Actually remove duplicates")
            return
    
    if not dry_run:
        print("⚠️  WARNING: This will permanently delete events with duplicate titles!")
        print("   This operation cannot be undone.")
        print("   Only the oldest event for each title will be kept.")
        response = input("\nContinue? Type 'yes' to proceed: ")
        if response.lower() != 'yes':
            print("❌ Aborted.")
            return
    
    removed = dedupe_by_title_only(dry_run=dry_run)
    
    if removed > 0 and dry_run:
        print(f"\n💡 To actually remove {removed} duplicate events, run:")
        print(f"   python3 dedupe_by_title.py --live")
    elif removed == 0:
        print(f"\n✅ No duplicate titles found - database is clean!")

if __name__ == "__main__":
    main() 