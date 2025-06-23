#!/usr/bin/env python3
"""
Complete sitemap regeneration script for TodoEvents
Clears existing sitemap and rebuilds with ALL future events only.

Usage (from project root):
    python backend/regenerate_sitemap.py

This script will:
1. Connect to the database
2. Fetch ALL future events (date >= today)
3. Generate slugs for events missing them
4. Build a complete new sitemap with multiple URL formats
5. Replace the existing sitemap entirely
"""

import sys
import asyncio
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

# Ensure backend package root is importable
root = Path(__file__).resolve().parent
sys.path.append(str(root))

from shared_utils import get_db, IS_PRODUCTION, DB_URL, logger  # noqa: E402
from seo_utils import slugify  # noqa: E402

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')

class SitemapRegeneration:
    def __init__(self):
        self.domain = "https://todo-events.com"
        self.event_count = 0
        self.url_count = 0

    def fetch_all_future_events(self):
        try:
            with get_db() as conn:
                c = conn.cursor()
                
                if IS_PRODUCTION and DB_URL:
                    c.execute("""
                        SELECT id, title, date, slug, city, state, created_at, updated_at, is_published
                        FROM events 
                        WHERE CAST(date AS DATE) >= CURRENT_DATE 
                        ORDER BY CAST(date AS DATE)
                    """)
                else:
                    c.execute("""
                        SELECT id, title, date, slug, city, state, created_at, updated_at, is_published
                        FROM events 
                        WHERE date >= date('now') 
                        ORDER BY date
                    """)
                
                rows = c.fetchall()
                
                if hasattr(rows[0], 'keys') if rows else False:
                    events = [dict(row) for row in rows]
                else:
                    columns = [desc[0] for desc in c.description]
                    events = [dict(zip(columns, row)) for row in rows]
                
                logger.info(f"Found {len(events)} future events")
                return events
                
        except Exception as e:
            logger.error(f"Error fetching events: {e}")
            return []

    def ensure_slugs(self, events):
        needs_update = []
        
        for event in events:
            if not event.get('slug'):
                title_part = slugify(event.get('title', 'event'))
                event['slug'] = f"{title_part}-{event.get('id', '')}"
                needs_update.append(event)
        
        if needs_update:
            try:
                with get_db() as conn:
                    c = conn.cursor()
                    for event in needs_update:
                        c.execute("UPDATE events SET slug = ? WHERE id = ?", 
                                (event['slug'], event['id']))
                    conn.commit()
                    logger.info(f"Updated {len(needs_update)} slugs")
            except Exception as e:
                logger.error(f"Error updating slugs: {e}")
        
        return events

    def build_sitemap(self, events):
        current_date = datetime.utcnow().strftime('%Y-%m-%d')
        self.event_count = len(events)
        
        sitemap = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{self.domain}/</loc>
    <lastmod>{current_date}</lastmod>
    <priority>1.0</priority>
  </url>'''
        
        for event in events:
            if not event.get('slug'):
                continue
                
            slug = event['slug']
            
            # Short URL
            sitemap += f'''
  <url>
    <loc>{self.domain}/e/{slug}</loc>
    <lastmod>{current_date}</lastmod>
    <priority>0.8</priority>
  </url>'''
            self.url_count += 1
            
            # Geographic URL if available
            if event.get('city') and event.get('state'):
                state_slug = slugify(event['state'].lower())
                city_slug = slugify(event['city'])
                sitemap += f'''
  <url>
    <loc>{self.domain}/us/{state_slug}/{city_slug}/events/{slug}</loc>
    <lastmod>{current_date}</lastmod>
    <priority>0.9</priority>
  </url>'''
                self.url_count += 1

        sitemap += '\n</urlset>'
        return sitemap

    async def regenerate(self):
        logger.info("Starting sitemap regeneration...")
        
        events = self.fetch_all_future_events()
        if not events:
            return False
        
        events = self.ensure_slugs(events)
        sitemap_content = self.build_sitemap(events)
        
        # Save to file
        with open(root / "new_sitemap.xml", 'w') as f:
            f.write(sitemap_content)
        
        logger.info(f"Generated {self.url_count} URLs from {self.event_count} events")
        return True

async def main():
    regen = SitemapRegeneration()
    await regen.regenerate()

if __name__ == '__main__':
    asyncio.run(main()) 