"""Shared, conservative handling of legacy public-event dates and locations.

Legacy events contain local wall times with no timezone. Never label these UTC,
invent an end time, or infer cancellation from event prose. Unpublishing is the
existing cancellation/removal mechanism; publication must be explicitly true.
"""

from datetime import date, datetime, timedelta
from math import asin, cos, isfinite, radians, sin, sqrt


def event_interval(event):
    """Return local naive start/end; overnight times roll into the following day."""
    start = datetime.fromisoformat(f"{str(event['date'])[:10]}T{event['start_time']}")
    end_date = event.get("end_date")
    end_time = event.get("end_time")
    if end_date and date.fromisoformat(str(end_date)[:10]) < start.date():
        raise ValueError("End date must not precede the event date")
    if not end_time:
        return start, None
    end = datetime.fromisoformat(f"{str(end_date or event['date'])[:10]}T{end_time}")
    if not end_date and end < start:
        end += timedelta(days=1)
    if end < start:
        raise ValueError("End date and time must not precede the start")
    return start, end


def overlaps_dates(event, first, last=None):
    """Filter legacy dates without pretending that their timezone is known."""
    try:
        start, end = event_interval(event)
        final_day = (
            end.date()
            if end
            else date.fromisoformat(str(event.get("end_date") or event["date"])[:10])
        )
        return final_day >= first and (last is None or start.date() <= last)
    except (ValueError, TypeError, KeyError):
        return False


def distance_miles(lat1, lng1, lat2, lng2):
    coordinates = tuple(float(value) for value in (lat1, lng1, lat2, lng2))
    if not all(isfinite(value) for value in coordinates):
        raise ValueError("Coordinates must be finite")
    if any(abs(coordinates[i]) > 90 for i in (0, 2)) or any(
        abs(coordinates[i]) > 180 for i in (1, 3)
    ):
        raise ValueError("Coordinates are out of range")
    a, b, c, d = map(radians, coordinates)
    hav = sin((c - a) / 2) ** 2 + cos(a) * cos(c) * sin((d - b) / 2) ** 2
    return 3959 * 2 * asin(sqrt(min(1, max(0, hav))))


def canonical_event_url(event):
    from urllib.parse import quote

    if event.get("slug"):
        return f"https://todo-events.com/e/{quote(str(event['slug']), safe='')}"
    return f"https://todo-events.com/?event={int(event['id'])}"
