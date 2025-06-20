import math
import traceback
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

# Recommendations System Models
class RecommendationsRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: Optional[str] = None
    max_distance: Optional[float] = 100.0
    limit: Optional[int] = 20
    time_filter: Optional[str] = "upcoming"  # "this_weekend", "next_2_weeks", "upcoming"

def create_recommendations_endpoints(app, get_db, get_placeholder):
    """
    Create and register the recommendations endpoints with the FastAPI app
    """
    
    @app.post("/api/recommendations")
    async def get_recommendations(request: RecommendationsRequest):
        """
        Intelligent recommendations endpoint with fallback logic for sparse data regions.
        Prioritizes recency, relevance, and perceived activity, not actual popularity.
        """
        try:
            with get_db() as conn:
                c = conn.cursor()
                placeholder = get_placeholder()
                
                # If no location provided, use default active metro areas
                if not request.lat or not request.lng:
                    # Default to active metros if no location provided
                    default_locations = [
                        {"lat": 29.2108, "lng": -81.0228, "city": "Daytona Beach"},  # Daytona
                        {"lat": 43.0389, "lng": -87.9065, "city": "Milwaukee"},     # Milwaukee
                        {"lat": 39.7392, "lng": -104.9903, "city": "Denver"},       # Denver
                        {"lat": 33.4484, "lng": -112.0740, "city": "Phoenix"},      # Phoenix
                    ]
                    selected_location = default_locations[0]  # Start with Daytona
                    request.lat = selected_location["lat"]
                    request.lng = selected_location["lng"]
                    if not request.city:
                        request.city = selected_location["city"]
                
                # Ensure lat/lng are set after fallback
                if request.lat is None or request.lng is None:
                    return {
                        "events": [],
                        "error": "Location could not be determined",
                        "message": "Unable to determine location for recommendations."
                    }
                
                # Calculate current date for filtering
                current_date = datetime.now().date()
                current_datetime = datetime.now()
                
                # Define time range based on filter
                if request.time_filter == "this_weekend":
                    # Find next Saturday and Sunday
                    days_until_saturday = (5 - current_date.weekday()) % 7
                    if days_until_saturday == 0 and current_datetime.hour > 18:  # If it's Saturday evening, next weekend
                        days_until_saturday = 7
                    start_date = current_date + timedelta(days=days_until_saturday)
                    end_date = start_date + timedelta(days=1)  # Sunday
                elif request.time_filter == "next_2_weeks":
                    start_date = current_date
                    end_date = current_date + timedelta(days=14)
                else:  # "upcoming" - all future events
                    start_date = current_date
                    end_date = current_date + timedelta(days=365)  # 1 year out
                
                events = []
                radius_attempts = [10, 30, 50, 100, None]  # Expanding search radius
                
                for radius in radius_attempts:
                    where_conditions = []
                    params = []
                    
                    # Date filtering - prioritize events starting today or later
                    if get_placeholder() == "%s":  # PostgreSQL
                        where_conditions.append(f"date::date >= {placeholder}")
                    else:  # SQLite
                        where_conditions.append(f"date >= {placeholder}")
                    params.append(str(start_date))
                    
                    if request.time_filter != "upcoming":
                        if get_placeholder() == "%s":  # PostgreSQL
                            where_conditions.append(f"date::date <= {placeholder}")
                        else:  # SQLite
                            where_conditions.append(f"date <= {placeholder}")
                        params.append(str(end_date))
                    
                    # Location filtering with expanding radius
                    if radius is not None:
                        # Calculate bounding box for faster filtering
                        lat_delta = radius / 69.0  # Roughly 69 miles per degree latitude
                        lng_delta = radius / (69.0 * abs(math.cos(math.radians(request.lat))))
                        
                        min_lat = request.lat - lat_delta
                        max_lat = request.lat + lat_delta
                        min_lng = request.lng - lng_delta
                        max_lng = request.lng + lng_delta
                        
                        where_conditions.append(f"lat BETWEEN {placeholder} AND {placeholder}")
                        where_conditions.append(f"lng BETWEEN {placeholder} AND {placeholder}")
                        params.extend([min_lat, max_lat, min_lng, max_lng])
                    
                    # Build and execute query
                    where_clause = " AND ".join(where_conditions)
                    
                    # Database-agnostic query - avoid SQLite-specific functions
                    if get_placeholder() == "%s":  # PostgreSQL
                        query = f"""
                            SELECT *, 
                                   EXTRACT(days FROM (CURRENT_TIMESTAMP - created_at)) as days_since_created,
                                   CASE 
                                       WHEN verified = true THEN 10
                                       ELSE 0
                                   END as verification_bonus,
                                   CASE
                                       WHEN EXTRACT(days FROM (CURRENT_TIMESTAMP - created_at)) <= 7 THEN 5
                                       WHEN EXTRACT(days FROM (CURRENT_TIMESTAMP - created_at)) <= 30 THEN 2
                                       ELSE 0
                                   END as recency_bonus
                            FROM events 
                            WHERE {where_clause}
                            ORDER BY verification_bonus DESC, recency_bonus DESC, 
                                     date ASC, start_time ASC
                            LIMIT {request.limit * 2}
                        """
                    else:  # SQLite
                        query = f"""
                            SELECT *, 
                                   (julianday('now') - julianday(created_at)) as days_since_created,
                                   CASE 
                                       WHEN verified = 1 THEN 10
                                       ELSE 0
                                   END as verification_bonus,
                                   CASE
                                       WHEN (julianday('now') - julianday(created_at)) <= 7 THEN 5
                                       WHEN (julianday('now') - julianday(created_at)) <= 30 THEN 2
                                       ELSE 0
                                   END as recency_bonus
                            FROM events 
                            WHERE {where_clause}
                            ORDER BY verification_bonus DESC, recency_bonus DESC, 
                                     date ASC, start_time ASC
                            LIMIT {request.limit * 2}
                        """
                    
                    c.execute(query, params)
                    rows = c.fetchall()
                    
                    # Process results and calculate distances
                    for row in rows:
                        if isinstance(row, dict):
                            event_dict = dict(row)
                        else:
                            columns = [description[0] for description in c.description]
                            event_dict = dict(zip(columns, row))
                        
                        # Calculate exact distance using haversine formula
                        event_lat = event_dict.get('lat')
                        event_lng = event_dict.get('lng')
                        
                        if event_lat is not None and event_lng is not None:
                            # Use proper haversine formula for accurate distance calculation
                            def haversine_distance(lat1, lng1, lat2, lng2):
                                """Calculate accurate distance between two points using haversine formula"""
                                import math
                                
                                # Convert decimal degrees to radians
                                lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
                                
                                # Haversine formula
                                dlat = lat2 - lat1
                                dlng = lng2 - lng1
                                a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
                                c = 2 * math.asin(math.sqrt(a))
                                
                                # Radius of earth in miles
                                r = 3959
                                
                                return c * r
                            
                            distance = haversine_distance(request.lat, request.lng, event_lat, event_lng)
                        else:
                            distance = float('inf')  # Skip events without valid coordinates
                        
                        if radius is None or distance <= radius:
                            event_dict['distance'] = distance
                            
                            # Add dynamic tags for engagement
                            event_dict['tags'] = []
                            
                            if event_dict.get('days_since_created', 999) <= 7:
                                event_dict['tags'].append("Just listed")
                            
                            if event_dict.get('verified'):
                                event_dict['tags'].append("Verified")
                            
                            if distance > 50:
                                event_dict['tags'].append("Worth the trip")
                            elif distance > 20:
                                event_dict['tags'].append(f"Popular in {request.city or 'your area'}")
                            
                            if event_dict.get('fee_required') and ('free' in event_dict['fee_required'].lower() or '$0' in event_dict['fee_required']):
                                event_dict['tags'].append("Free Entry")
                            
                            # Check if event is within 48 hours
                            try:
                                event_date = datetime.strptime(event_dict['date'], '%Y-%m-%d').date()
                                days_until_event = (event_date - current_date).days
                                if days_until_event <= 2:
                                    event_dict['tags'].append("Coming soon")
                            except (ValueError, TypeError):
                                pass  # Skip invalid dates
                            
                            events.append(event_dict)
                    
                    # If we have enough events, break
                    if len(events) >= 5:
                        break
                
                # Sort events by priority score
                def calculate_priority_score(event):
                    score = 0
                    
                    # Distance penalty (closer is better)
                    distance = event.get('distance', 0)
                    score -= distance * 0.1
                    
                    # Verification bonus
                    if event.get('verified'):
                        score += 20
                    
                    # Recency bonus
                    days_since_created = event.get('days_since_created', 999)
                    if days_since_created <= 7:
                        score += 15
                    elif days_since_created <= 30:
                        score += 8
                    
                    # Date proximity bonus (sooner events get slight boost)
                    try:
                        event_date = datetime.strptime(event['date'], '%Y-%m-%d').date()
                        days_until_event = (event_date - current_date).days
                        if days_until_event <= 7:
                            score += 5
                        elif days_until_event <= 14:
                            score += 2
                    except (ValueError, TypeError):
                        pass  # Skip invalid dates
                    
                    return score
                
                # Sort by priority score and add some randomization for variety
                events.sort(key=calculate_priority_score, reverse=True)
                
                # Add randomization to lower-ranked events to prevent staleness
                if len(events) > 5:
                    top_events = events[:5]
                    remaining_events = events[5:]
                    import random
                    random.shuffle(remaining_events)
                    events = top_events + remaining_events
                
                # Limit to requested amount
                events = events[:request.limit]
                
                # If still no events, provide a graceful message
                if not events:
                    return {
                        "events": [],
                        "message": "Not much nearby right now. Check back soon for new events!",
                        "search_radius": radius_attempts[-2] if len(radius_attempts) > 1 else 100,
                        "location": {
                            "lat": request.lat,
                            "lng": request.lng,
                            "city": request.city
                        }
                    }
                
                return {
                    "events": events,
                    "total_found": len(events),
                    "search_radius": radius,
                    "location": {
                        "lat": request.lat,
                        "lng": request.lng,
                        "city": request.city
                    },
                    "time_filter": request.time_filter,
                    "message": f"Found {len(events)} amazing events happening near you"
                }
                
        except Exception as e:
            logger.error(f"Error in recommendations: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "events": [],
                "error": str(e),
                "message": "Sorry, we're having trouble loading recommendations right now."
            }

    @app.get("/api/recommendations/city/{city}")
    async def get_city_recommendations(
        city: str,
        time_filter: str = "upcoming",
        limit: int = 20
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
                "los-angeles": {"lat": 34.0522, "lng": -118.2437, "name": "Los Angeles"},
                "san-francisco": {"lat": 37.7749, "lng": -122.4194, "name": "San Francisco"},
            }
            
            city_key = city.lower().replace("-", "").replace(" ", "")
            
            if city_key not in city_coords:
                # Fallback to Daytona
                city_key = "daytona"
            
            location = city_coords[city_key]
            
            # Use the recommendations endpoint
            request = RecommendationsRequest(
                lat=location["lat"],
                lng=location["lng"],
                city=location["name"],
                max_distance=50.0,
                limit=limit,
                time_filter=time_filter
            )
            
            result = await get_recommendations(request)
            
            # Add SEO metadata
            result["seo"] = {
                "title": f"Things Happening Near {location['name']} - TodoEvents",
                "description": f"Discover amazing events happening near {location['name']}. Find concerts, festivals, workshops, and more local activities.",
                "canonical_url": f"/api/recommendations/city/{city}",
                "city_name": location["name"],
                "last_updated": datetime.now().isoformat()
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error in city recommendations: {str(e)}")
            return {
                "events": [],
                "error": str(e),
                "seo": {
                    "title": f"Events Near {city} - TodoEvents",
                    "description": "Discover local events and activities.",
                    "city_name": city
                }
            }

    @app.get("/api/recommendations/nearby-cities")
    async def get_nearby_cities_with_events(
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        max_distance: Optional[float] = 500.0,  # Default 500 mile radius
        limit: Optional[int] = 10
    ):
        """
        Get nearby cities that have upcoming events, sorted by distance.
        Used for "Explore other cities" functionality.
        """
        try:
            with get_db() as conn:
                c = conn.cursor()
                placeholder = get_placeholder()
                
                # If no location provided, use major US metros as fallback
                if not lat or not lng:
                    major_cities = [
                        {"city": "New York", "state": "NY", "lat": 40.7128, "lng": -74.0060, "distance": 0},
                        {"city": "Los Angeles", "state": "CA", "lat": 34.0522, "lng": -118.2437, "distance": 0},
                        {"city": "Chicago", "state": "IL", "lat": 41.8781, "lng": -87.6298, "distance": 0},
                        {"city": "Miami", "state": "FL", "lat": 25.7617, "lng": -80.1918, "distance": 0},
                        {"city": "Phoenix", "state": "AZ", "lat": 33.4484, "lng": -112.0740, "distance": 0},
                        {"city": "Orlando", "state": "FL", "lat": 28.5383, "lng": -81.3792, "distance": 0},
                        {"city": "Denver", "state": "CO", "lat": 39.7392, "lng": -104.9903, "distance": 0},
                        {"city": "Atlanta", "state": "GA", "lat": 33.7490, "lng": -84.3880, "distance": 0},
                        {"city": "San Francisco", "state": "CA", "lat": 37.7749, "lng": -122.4194, "distance": 0},
                        {"city": "Boston", "state": "MA", "lat": 42.3601, "lng": -71.0589, "distance": 0}
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
                            WHERE {date_filter}
                            AND (6371 * acos(cos(radians({city['lat']})) * cos(radians(lat)) * 
                                 cos(radians(lng) - radians({city['lng']})) + sin(radians({city['lat']})) * 
                                 sin(radians(lat)))) * 0.621371 <= 50
                        """)
                        result = c.fetchone()
                        city['event_count'] = result[0] if result else 0
                    
                    # Filter cities with events and limit
                    cities_with_events = [city for city in major_cities if city['event_count'] > 0]
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
                    WHERE {date_filter}
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
                        column_names = ['city', 'state', 'avg_lat', 'avg_lng', 'event_count', 'distance_miles']
                        city_data = dict(zip(column_names, row))
                    
                    cities.append({
                        'city': city_data['city'],
                        'state': city_data['state'],
                        'lat': float(city_data['avg_lat']),
                        'lng': float(city_data['avg_lng']),
                        'event_count': int(city_data['event_count']),
                        'distance': round(float(city_data['distance_miles']), 1)
                    })
                
                return cities[:limit]
                
        except Exception as e:
            logger.error(f"Error getting nearby cities: {str(e)}")
            return []