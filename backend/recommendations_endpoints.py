import logging
from datetime import datetime, timedelta, timezone
from typing import Literal

from event_safety import canonical_event_url, distance_miles, overlaps_dates
from fastapi import HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class RecommendationsRequest(BaseModel):
    lat: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    lng: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    city: str | None = None
    max_distance: float = Field(default=100.0, gt=0, le=500, allow_inf_nan=False)
    limit: int = Field(default=20, ge=1, le=100)
    time_filter: Literal["this_weekend", "next_2_weeks", "upcoming"] = "upcoming"


def create_recommendations_endpoints(app, get_db, get_placeholder):
    @app.post("/api/recommendations")
    async def get_recommendations(request: RecommendationsRequest):
        """Recommend only published events inside the requested radius.

        No fallback city, widening, randomized results, or repeated-radius duplicates.
        Sparse results preserve the user's constraints and suggest an explicit retry.
        """
        if request.lat is None or request.lng is None:
            return {
                "events": [],
                "total_found": 0,
                "search_radius": request.max_distance,
                "message": "Choose a location to find nearby events.",
                "needs_location": True,
            }
        today = datetime.now(timezone.utc).date()
        if request.time_filter == "this_weekend":
            first = (
                today
                if today.weekday() >= 5
                else today + timedelta(days=5 - today.weekday())
            )
            last = first + timedelta(days=6 - first.weekday())
        else:
            first = today
            last = (
                today + timedelta(days=14)
                if request.time_filter == "next_2_weeks"
                else None
            )
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                placeholder = get_placeholder()
                conditions = [
                    "is_published = TRUE",
                    f"COALESCE(NULLIF(end_date, ''), date) >= {placeholder}",
                ]
                params = [(first - timedelta(days=1)).isoformat()]
                if last:
                    conditions.append(f"date <= {placeholder}")
                    params.append(last.isoformat())
                cursor.execute(
                    f"SELECT * FROM events WHERE {' AND '.join(conditions)} ORDER BY date, start_time, id",
                    params,
                )
                events, seen = [], set()
                while True:
                    rows = cursor.fetchmany(200)
                    if not rows:
                        break
                    for row in rows:
                        event = (
                            dict(row)
                            if hasattr(row, "keys")
                            else dict(zip([c[0] for c in cursor.description], row))
                        )
                        if event["id"] in seen or not overlaps_dates(
                            event, first, last
                        ):
                            continue
                        try:
                            distance = distance_miles(
                                request.lat, request.lng, event["lat"], event["lng"]
                            )
                        except (ValueError, TypeError, KeyError):
                            continue
                        if distance > request.max_distance:
                            continue
                        seen.add(event["id"])
                        event["distance"] = distance
                        event["url"] = canonical_event_url(event)
                        event["tags"] = ["Verified"] if event.get("verified") else []
                        event["time_note"] = (
                            "Local venue time; timezone not supplied by organizer"
                        )
                        events.append(event)
                    # Retain a bounded, deterministic set while streaming candidates.
                    events.sort(
                        key=lambda event: (
                            event["distance"],
                            str(event["date"]),
                            str(event["start_time"]),
                            event["id"],
                        )
                    )
                    events = events[: request.limit]
                response = {
                    "events": events,
                    "total_found": len(events),
                    "search_radius": request.max_distance,
                    "location": {
                        "lat": request.lat,
                        "lng": request.lng,
                        "city": request.city,
                    },
                    "time_filter": request.time_filter,
                    "message": f"Found {len(events)} published events matching your filters"
                    if events
                    else "No published events match these filters.",
                }
                if not events:
                    response["suggestions"] = [
                        "Choose different dates",
                        "Ask to increase the radius",
                        "Choose another location",
                    ]
                return response
        except Exception:
            logger.exception("Error in recommendations")
            raise HTTPException(
                status_code=503,
                detail="Event recommendations are temporarily unavailable",
            )

    @app.get("/api/recommendations/city/{city}")
    async def get_city_recommendations(
        city: str, time_filter: str = "upcoming", limit: int = 20
    ):
        """
        SEO-optimized endpoint for "things happening near [city]" pages.
        This creates cacheable content for search engines.
        """
        try:
            # Simple city-to-coordinates mapping (expand as needed)
            city_coords = {
                "daytona": {"lat": 29.2108, "lng": -81.0228, "name": "Daytona Beach"},
                "milwaukee": {"lat": 43.0389, "lng": -87.9065, "name": "Milwaukee"},
                "denver": {"lat": 39.7392, "lng": -104.9903, "name": "Denver"},
                "phoenix": {"lat": 33.4484, "lng": -112.0740, "name": "Phoenix"},
                "orlando": {"lat": 28.5383, "lng": -81.3792, "name": "Orlando"},
                "miami": {"lat": 25.7617, "lng": -80.1918, "name": "Miami"},
                "tampa": {"lat": 27.9506, "lng": -82.4572, "name": "Tampa"},
                "atlanta": {"lat": 33.7490, "lng": -84.3880, "name": "Atlanta"},
                "chicago": {"lat": 41.8781, "lng": -87.6298, "name": "Chicago"},
                "nyc": {"lat": 40.7128, "lng": -74.0060, "name": "New York City"},
                "los-angeles": {
                    "lat": 34.0522,
                    "lng": -118.2437,
                    "name": "Los Angeles",
                },
                "san-francisco": {
                    "lat": 37.7749,
                    "lng": -122.4194,
                    "name": "San Francisco",
                },
            }

            city_key = city.lower().replace("-", "").replace(" ", "")
            normalized_cities = {
                key.replace("-", ""): value for key, value in city_coords.items()
            }
            if city_key not in normalized_cities:
                return {
                    "events": [],
                    "total_found": 0,
                    "needs_location": True,
                    "message": "City not recognized. Provide coordinates or choose another location.",
                }
            location = normalized_cities[city_key]

            # Use the recommendations endpoint
            request = RecommendationsRequest(
                lat=location["lat"],
                lng=location["lng"],
                city=location["name"],
                max_distance=50.0,
                limit=limit,
                time_filter=time_filter,
            )

            result = await get_recommendations(request)

            # Add SEO metadata
            result["seo"] = {
                "title": f"Things Happening Near {location['name']} - TodoEvents",
                "description": f"Discover amazing events happening near {location['name']}. Find concerts, festivals, workshops, and more local activities.",
                "canonical_url": f"/api/recommendations/city/{city}",
                "city_name": location["name"],
                "last_updated": datetime.now(timezone.utc).isoformat(),
            }

            return result

        except Exception as e:
            logger.exception("Error in city recommendations")
            return {
                "events": [],
                "error": str(e),
                "seo": {
                    "title": f"Events Near {city} - TodoEvents",
                    "description": "Discover local events and activities.",
                    "city_name": city,
                },
            }

    @app.get("/api/recommendations/nearby-cities")
    async def get_nearby_cities_with_events(
        lat: float | None = None,
        lng: float | None = None,
        max_distance: float | None = 500.0,  # Default 500 mile radius
        limit: int | None = 10,
    ):
        """
        Get nearby cities that have upcoming events, sorted by distance.
        Used for "Explore other cities" functionality.
        """
        try:
            with get_db() as conn:
                c = conn.cursor()

                # If no location provided, use major US metros as fallback
                if lat is None or lng is None:
                    major_cities = [
                        {
                            "city": "New York",
                            "state": "NY",
                            "lat": 40.7128,
                            "lng": -74.0060,
                            "distance": 0,
                        },
                        {
                            "city": "Los Angeles",
                            "state": "CA",
                            "lat": 34.0522,
                            "lng": -118.2437,
                            "distance": 0,
                        },
                        {
                            "city": "Chicago",
                            "state": "IL",
                            "lat": 41.8781,
                            "lng": -87.6298,
                            "distance": 0,
                        },
                        {
                            "city": "Miami",
                            "state": "FL",
                            "lat": 25.7617,
                            "lng": -80.1918,
                            "distance": 0,
                        },
                        {
                            "city": "Phoenix",
                            "state": "AZ",
                            "lat": 33.4484,
                            "lng": -112.0740,
                            "distance": 0,
                        },
                        {
                            "city": "Orlando",
                            "state": "FL",
                            "lat": 28.5383,
                            "lng": -81.3792,
                            "distance": 0,
                        },
                        {
                            "city": "Denver",
                            "state": "CO",
                            "lat": 39.7392,
                            "lng": -104.9903,
                            "distance": 0,
                        },
                        {
                            "city": "Atlanta",
                            "state": "GA",
                            "lat": 33.7490,
                            "lng": -84.3880,
                            "distance": 0,
                        },
                        {
                            "city": "San Francisco",
                            "state": "CA",
                            "lat": 37.7749,
                            "lng": -122.4194,
                            "distance": 0,
                        },
                        {
                            "city": "Boston",
                            "state": "MA",
                            "lat": 42.3601,
                            "lng": -71.0589,
                            "distance": 0,
                        },
                    ]

                    # Add event counts to major cities
                    for city in major_cities:
                        # Quick count of upcoming events near this city - database agnostic
                        if get_placeholder() == "%s":  # PostgreSQL
                            date_filter = "date::date >= CURRENT_DATE"
                        else:  # SQLite
                            date_filter = "date >= date('now')"

                        c.execute(f"""
                            SELECT COUNT(*) as event_count
                            FROM events
                            WHERE is_published = TRUE AND {date_filter}
                            AND (6371 * acos(cos(radians({city["lat"]})) * cos(radians(lat)) *
                                 cos(radians(lng) - radians({city["lng"]})) + sin(radians({city["lat"]})) *
                                 sin(radians(lat)))) * 0.621371 <= 50
                        """)
                        result = c.fetchone()
                        city["event_count"] = (
                            (
                                dict(result)["event_count"]
                                if hasattr(result, "keys")
                                else result[0]
                            )
                            if result
                            else 0
                        )

                    # Filter cities with events and limit
                    cities_with_events = [
                        city for city in major_cities if city["event_count"] > 0
                    ]
                    return cities_with_events[:limit]

                # Find cities with events within distance, sorted by distance
                # Database-agnostic date filtering
                if get_placeholder() == "%s":  # PostgreSQL
                    date_filter = "date::date >= CURRENT_DATE"
                else:  # SQLite
                    date_filter = "date >= date('now')"

                query = f"""
                    SELECT
                        city,
                        state,
                        AVG(lat) as avg_lat,
                        AVG(lng) as avg_lng,
                        COUNT(*) as event_count,
                        (6371 * acos(cos(radians({lat})) * cos(radians(AVG(lat))) *
                         cos(radians(AVG(lng)) - radians({lng})) + sin(radians({lat})) *
                         sin(radians(AVG(lat))))) * 0.621371 as distance_miles
                    FROM events
                    WHERE is_published = TRUE AND {date_filter}
                    AND city IS NOT NULL
                    AND state IS NOT NULL
                    AND city != ''
                    AND state != ''
                    GROUP BY city, state
                    HAVING (6371 * acos(cos(radians({lat})) * cos(radians(AVG(lat))) *
                           cos(radians(AVG(lng)) - radians({lng})) + sin(radians({lat})) *
                           sin(radians(AVG(lat))))) * 0.621371 <= {max_distance}
                    AND COUNT(*) >= 2
                    ORDER BY distance_miles ASC
                    LIMIT {limit * 2}
                """

                c.execute(query)
                results = c.fetchall()

                cities = []
                for row in results:
                    if isinstance(row, dict):
                        city_data = dict(row)
                    else:
                        column_names = [
                            "city",
                            "state",
                            "avg_lat",
                            "avg_lng",
                            "event_count",
                            "distance_miles",
                        ]
                        city_data = dict(zip(column_names, row))

                    cities.append(
                        {
                            "city": city_data["city"],
                            "state": city_data["state"],
                            "lat": float(city_data["avg_lat"]),
                            "lng": float(city_data["avg_lng"]),
                            "event_count": int(city_data["event_count"]),
                            "distance": round(float(city_data["distance_miles"]), 1),
                        }
                    )

                return cities[:limit]

        except Exception:
            logger.exception("Error getting nearby cities")
            return []
