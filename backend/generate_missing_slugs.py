#!/usr/bin/env python3
"""Generate SEO-friendly slugs for events that are missing them.
Usage (from project root):
    python backend/generate_missing_slugs.py
This will update the `events` table in place and report how many rows were updated.
"""

import sys
from pathlib import Path
from typing import List, Tuple, Any

# Ensure backend package root is importable when executed via Render shell or locally
root = Path(__file__).resolve().parent
sys.path.append(str(root))

from shared_utils import get_db, get_placeholder, logger  # noqa: E402
from seo_utils import slugify  # noqa: E402


def fetch_rows(cursor) -> List[Any]:
    """Return rows as list of dicts regardless of DB adapter"""
    rows = cursor.fetchall()
    if not rows:
        return []
    # psycopg2 RealDictRow already acts like dict
    if isinstance(rows[0], dict):
        return rows  # type: ignore[arg-type]
    # sqlite3.Row supports dict(row)
    return [dict(row) for row in rows]


def generate_unique_slug(base: str, cursor, placeholder: str, event_id: int) -> str:
    """Ensure the slug is unique by appending numeric suffixes if necessary."""
    slug = base
    suffix = 1
    while True:
        cursor.execute(
            f"SELECT 1 FROM events WHERE slug = {placeholder} AND id <> {placeholder} LIMIT 1",
            (slug, event_id),
        )
        if not cursor.fetchone():
            return slug
        suffix += 1
        slug = f"{base}-{suffix}"


def main() -> None:
    placeholder = get_placeholder()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, title, city, state FROM events WHERE slug IS NULL OR slug = ''"
        )
        rows = fetch_rows(cursor)
        if not rows:
            logger.info("✅ No missing slugs found — all events already have slugs.")
            return

        updated = 0
        for row in rows:
            event_id = row["id"] if isinstance(row, dict) else row[0]
            title = row["title"] if isinstance(row, dict) else row[1]
            city = row.get("city") if isinstance(row, dict) else row[2]
            state = row.get("state") if isinstance(row, dict) else row[3]

            base_slug_components = [title]
            if city:
                base_slug_components.append(city)
            if state:
                base_slug_components.append(state)

            base_slug = slugify("-".join(base_slug_components))[:80].strip("-")
            if not base_slug:
                base_slug = f"event-{event_id}"

            unique_slug = generate_unique_slug(base_slug, cursor, placeholder, event_id)

            cursor.execute(
                f"UPDATE events SET slug = {placeholder} WHERE id = {placeholder}",
                (unique_slug, event_id),
            )
            updated += 1

        conn.commit()
        logger.info(f"✅ Added slugs to {updated} event(s).")


if __name__ == "__main__":
    main() 