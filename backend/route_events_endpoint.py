# Route Events Endpoint for batch event fetching along routes
# This can be integrated into backend.py

from fastapi import HTTPException
from typing import List, Dict, Any

@app.post("/route-events")
async def get_route_events(request: dict):
    """
    Retrieve events along a route by providing multiple coordinate points.
    Accepts: { "points": [{"lat": float, "lng": float}], "radius": float (optional, default 25) }
    Returns deduplicated events sorted by interest count.
    """
    try:
        points = request.get("points", [])
        radius = request.get("radius", 25.0)  # Default 25 miles
        
        if not points or len(points) == 0:
            raise HTTPException(status_code=400, detail="At least one coordinate point is required")
        
        # Validate points
        for i, point in enumerate(points):
            if not isinstance(point, dict) or "lat" not in point or "lng" not in point:
                raise HTTPException(status_code=400, detail=f"Invalid point format at index {i}")
            
            try:
                lat = float(point["lat"])
                lng = float(point["lng"])
                if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
                    raise ValueError("Invalid coordinates")
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail=f"Invalid coordinates at index {i}")
        
        all_events = []
        seen_event_ids = set()
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # For each point, find nearby events
            for point in points:
                lat = float(point["lat"])
                lng = float(point["lng"])
                
                # Build query with distance calculation
                location_select = f"""
                    , (6371 * acos(cos(radians({lat})) * cos(radians(lat)) * 
                      cos(radians(lng) - radians({lng})) + sin(radians({lat})) * 
                      sin(radians(lat)))) * 0.621371 as distance_miles
                """
                
                # Database-specific date comparison
                if IS_PRODUCTION and DB_URL:
                    date_comparison = "date::date >= CURRENT_DATE"
                else:
                    date_comparison = "date >= date('now')"
                
                query = f"""
                    SELECT id, title, description, short_description, date, start_time, end_time, end_date, 
                           category, address, city, state, country, lat, lng, recurring, frequency, created_by, created_at,
                           COALESCE(interest_count, 0) as interest_count,
                           COALESCE(view_count, 0) as view_count,
                           fee_required, price, currency, event_url, host_name, organizer_url, slug, is_published,
                           start_datetime, end_datetime, updated_at, verified
                           {location_select}
                    FROM events 
                    WHERE lat IS NOT NULL AND lng IS NOT NULL
                    ORDER BY 
                        CASE 
                            WHEN {date_comparison} THEN 0
                            ELSE 1
                        END,
                        interest_count DESC, date ASC
                    LIMIT 50
                """
                
                cursor.execute(query)
                events = cursor.fetchall()
                
                # Process events for this point
                for event in events:
                    try:
                        # Convert to dict
                        column_names = [
                            'id', 'title', 'description', 'short_description', 'date', 'start_time', 'end_time',
                            'end_date', 'category', 'address', 'city', 'state', 'country', 'lat', 'lng', 'recurring',
                            'frequency', 'created_by', 'created_at', 'interest_count', 'view_count',
                            'fee_required', 'price', 'currency', 'event_url', 'host_name', 'organizer_url', 'slug', 'is_published',
                            'start_datetime', 'end_datetime', 'updated_at', 'verified', 'distance_miles'
                        ]
                        
                        event_dict = dict(zip(column_names, event))
                        
                        # Filter by distance and deduplicate
                        if event_dict['distance_miles'] <= radius and event_dict['id'] not in seen_event_ids:
                            # Convert datetime fields
                            event_dict = convert_event_datetime_fields(event_dict)
                            
                            # Ensure proper types
                            event_dict['interest_count'] = int(event_dict.get('interest_count', 0) or 0)
                            event_dict['view_count'] = int(event_dict.get('view_count', 0) or 0)
                            
                            all_events.append(event_dict)
                            seen_event_ids.add(event_dict['id'])
                            
                    except Exception as event_error:
                        logger.warning(f"Error processing route event {event}: {event_error}")
                        continue
        
        # Sort by interest count and upcoming date preference
        all_events.sort(key=lambda x: (
            -(x.get('interest_count', 0) or 0),  # Higher interest first
            x.get('date', '9999-12-31')  # Earlier dates first
        ))
        
        logger.info(f"Route events query: {len(points)} points, {radius} mile radius, {len(all_events)} unique events found")
        return all_events
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving route events: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving route events") 