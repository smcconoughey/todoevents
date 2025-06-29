#!/usr/bin/env python3
"""
SEO Utilities for Todo Events
Handles JSON-LD generation, slugs, and structured data
"""

import re
import json
from datetime import datetime, timezone
from urllib.parse import quote
from typing import Dict, List, Optional, Any

def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    if not text:
        return ""
    
    # Convert to lowercase and replace spaces/special chars with hyphens
    slug = re.sub(r'[^\w\s-]', '', text.lower())
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug.strip('-')

def generate_event_slug(title: str, city: str = "") -> str:
    """Generate SEO-friendly slug for event"""
    base_slug = f"{title}-{city}" if city else title
    return slugify(base_slug)

def parse_address_components(address: str) -> Dict[str, str]:
    """Extract city, state, country from address string"""
    if not address:
        return {"city": "", "state": "", "country": "USA"}
    
    # Common patterns for US addresses
    parts = [part.strip() for part in address.split(',')]
    city = ""
    state = ""
    country = "USA"
    
    if len(parts) >= 2:
        # Last part often contains country
        if "USA" in parts[-1].upper() or "US" in parts[-1].upper():
            country = "USA"
            parts = parts[:-1]
        
        # Second to last often contains state
        if len(parts) >= 2:
            state_part = parts[-1].strip()
            # Look for state abbreviation (2 letters) or common state names
            state_match = re.search(r'\b([A-Z]{2})\b', state_part)
            if state_match:
                state = state_match.group(1)
            elif len(state_part) <= 20:  # Likely a state name
                state = state_part
        
        # City is usually the first or second part
        if len(parts) >= 1:
            city_candidate = parts[0].strip()
            # Remove common venue prefixes to get to the city
            city = re.sub(r'^[^,]*?,\s*', '', city_candidate).strip()
            if not city:  # If we stripped everything, use the original
                city = city_candidate
    
    return {"city": city, "state": state, "country": country}

def normalize_fee_to_price(fee_required: str) -> float:
    """Convert fee_required string to price float"""
    if not fee_required:
        return 0.0
    
    fee_str = str(fee_required).lower().strip()
    
    # Free events
    if fee_str in ['free', 'no', 'none', '0', '', 'n/a']:
        return 0.0
    
    # Extract numeric value
    price_match = re.search(r'[\d,]+\.?\d*', fee_str)
    if price_match:
        price_str = price_match.group().replace(',', '')
        try:
            return float(price_str)
        except ValueError:
            return 0.0
    
    return 0.0

def generate_short_description(description: str, max_length: int = 160) -> str:
    """Generate short description for meta tags"""
    if not description:
        return ""
    
    # Clean up description
    clean_desc = re.sub(r'\s+', ' ', description.strip())
    
    if len(clean_desc) <= max_length:
        return clean_desc
    
    # Truncate at word boundary
    truncated = clean_desc[:max_length]
    last_space = truncated.rfind(' ')
    if last_space > max_length * 0.8:  # Only truncate if we don't lose too much
        truncated = truncated[:last_space]
    
    return truncated.rstrip('.,!?;:') + '...'

def combine_datetime(date_str: str, time_str: str, timezone_offset: str = '-04:00') -> Optional[str]:
    """Combine date and time strings into ISO datetime"""
    try:
        if not date_str or not time_str:
            return None
        
        # Parse date and time
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        time_obj = datetime.strptime(time_str, '%H:%M').time()
        
        # Combine and format as ISO string
        dt = datetime.combine(date_obj, time_obj)
        return dt.strftime('%Y-%m-%dT%H:%M:%S') + timezone_offset
        
    except ValueError:
        return None

def generate_canonical_url(base_url: str, slug: str, city: str = "", state: str = "") -> str:
    """Generate canonical URL for event"""
    if city and state:
        # Format: /us/mi/midland/events/michigan-antique-festival-midland
        return f"{base_url}/us/{state.lower()}/{slugify(city)}/events/{slug}"
    elif city:
        # Format: /events/michigan-antique-festival-midland
        return f"{base_url}/events/{slug}"
    else:
        # Fallback
        return f"{base_url}/events/{slug}"

def generate_event_json_ld(event: Dict[str, Any], base_url: str = "https://todo-events.com") -> Dict[str, Any]:
    """Generate JSON-LD structured data for event"""
    
    # Basic event structure
    json_ld = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": event.get('title', ''),
        "description": event.get('description', ''),
        "url": generate_canonical_url(
            base_url, 
            event.get('slug', ''), 
            event.get('city', ''), 
            event.get('state', '')
        ),
        "image": f"{base_url}/api/events/{event.get('id')}/share-card",  # Auto-generated share card
    }
    
    # Date and time
    start_datetime = event.get('start_datetime')
    end_datetime = event.get('end_datetime')
    
    if start_datetime:
        json_ld["startDate"] = start_datetime
    
    if end_datetime:
        json_ld["endDate"] = end_datetime
    
    # Location
    address = event.get('address', '')
    city = event.get('city', '')
    state = event.get('state', '')
    
    if address or city:
        json_ld["location"] = {
            "@type": "Place",
            "name": address.split(',')[0] if address else f"{city}, {state}",
            "address": {
                "@type": "PostalAddress",
                "streetAddress": address.split(',')[0] if ',' in address else address,
                "addressLocality": city,
                "addressRegion": state,
                "addressCountry": event.get('country', 'USA')
            }
        }
        
        # Add geo coordinates if available
        lat = event.get('lat')
        lng = event.get('lng')
        if lat and lng:
            json_ld["location"]["geo"] = {
                "@type": "GeoCoordinates",
                "latitude": lat,
                "longitude": lng
            }
    
    # Organizer
    host_name = event.get('host_name')
    organizer_url = event.get('organizer_url')
    
    if host_name:
        organizer = {
            "@type": "Organization",
            "name": host_name
        }
        if organizer_url:
            organizer["url"] = organizer_url
        else:
            # Add default URL to ensure organizer always has a URL
            organizer["url"] = f"{base_url}"
        
        json_ld["organizer"] = organizer
    else:
        # Always include organizer even if host_name is missing
        json_ld["organizer"] = {
            "@type": "Organization",
            "name": "TodoEvents",
            "url": base_url
        }
    
    # Performer - always include this field
    json_ld["performer"] = {
        "@type": "PerformingGroup",
        "name": host_name or event.get('title', '') or "Event Performers"
    }
    
    # Offers (pricing)
    price = event.get('price', 0.0)
    currency = event.get('currency', 'USD')
    
    if price == 0.0:
        json_ld["offers"] = {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": currency,
            "availability": "https://schema.org/InStock",
            "url": json_ld["url"]
        }
    else:
        json_ld["offers"] = {
            "@type": "Offer",
            "price": str(price),
            "priceCurrency": currency,
            "availability": "https://schema.org/InStock",
            "url": json_ld["url"]
        }
    
    # Additional metadata
    json_ld["eventStatus"] = "https://schema.org/EventScheduled"
    json_ld["eventAttendanceMode"] = "https://schema.org/OfflineEventAttendanceMode"
    
    # Category mapping
    category_mappings = {
        'music': 'MusicEvent',
        'arts': 'TheaterEvent',
        'sports': 'SportsEvent',
        'food': 'FoodEvent',
        'community': 'SocialEvent',
        'education': 'EducationEvent',
        'business': 'BusinessEvent'
    }
    
    category = event.get('category', '').lower()
    if category in category_mappings:
        json_ld["@type"] = category_mappings[category]
    
    return json_ld

def generate_webpage_json_ld(event: Dict[str, Any], base_url: str = "https://todo-events.com") -> Dict[str, Any]:
    """Generate WebPage JSON-LD for the event page"""
    canonical = generate_canonical_url(
        base_url,
        event.get('slug', ''),
        event.get('city', ''),
        event.get('state', '')
    )

    description = event.get('short_description') or generate_short_description(event.get('description', ''))

    return {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": event.get('title', ''),
        "url": canonical,
        "description": description,
    }

def generate_breadcrumb_json_ld(
    event: Dict[str, Any], 
    base_url: str = "https://todo-events.com"
) -> Dict[str, Any]:
    """Generate breadcrumb JSON-LD for event page"""
    
    city = event.get('city', '')
    state = event.get('state', '')
    title = event.get('title', '')
    
    breadcrumbs = [
        {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": base_url
        },
        {
            "@type": "ListItem",
            "position": 2,
            "name": "Events",
            "item": f"{base_url}/events"
        }
    ]
    
    position = 3
    
    if state:
        breadcrumbs.append({
            "@type": "ListItem",
            "position": position,
            "name": f"{state} Events",
            "item": f"{base_url}/us/{state.lower()}/events"
        })
        position += 1
    
    if city:
        breadcrumbs.append({
            "@type": "ListItem",
            "position": position,
            "name": f"{city} Events",
            "item": f"{base_url}/us/{state.lower()}/{slugify(city)}/events" if state else f"{base_url}/events?city={city}"
        })
        position += 1
    
    # Current event
    breadcrumbs.append({
        "@type": "ListItem",
        "position": position,
        "name": title,
        "item": generate_canonical_url(base_url, event.get('slug', ''), city, state)
    })
    
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbs
    }

def generate_seo_metadata(event: Dict[str, Any], base_url: str = "https://todo-events.com") -> Dict[str, str]:
    """Generate complete SEO metadata for event"""
    
    title = event.get('title', '')
    short_description = event.get('short_description') or event.get('description', '')
    city = event.get('city', '')
    state = event.get('state', '')
    date = event.get('date', '')
    
    # Page title
    page_title = f"{title}"
    if city and state:
        page_title += f" - {city}, {state}"
    if date:
        try:
            date_obj = datetime.strptime(date, '%Y-%m-%d')
            formatted_date = date_obj.strftime('%B %d, %Y')
            page_title += f" | {formatted_date}"
        except ValueError:
            pass
    
    page_title += " | Todo Events"
    
    # Meta description
    meta_description = short_description or generate_short_description(event.get('description', ''))
    if not meta_description:
        meta_description = f"Join {title}"
        if city:
            meta_description += f" in {city}"
        if date:
            meta_description += f" on {formatted_date}"
        meta_description += ". Find local events on Todo Events."
    
    # Canonical URL
    canonical_url = generate_canonical_url(
        base_url, 
        event.get('slug', ''), 
        city, 
        state
    )
    
    # Open Graph image
    og_image = f"{base_url}/api/events/{event.get('id')}/share-card"
    
    return {
        "title": page_title,
        "description": meta_description,
        "canonical_url": canonical_url,
        "og_title": title,
        "og_description": meta_description,
        "og_image": og_image,
        "og_url": canonical_url,
        "twitter_card": "summary_large_image",
        "twitter_title": title,
        "twitter_description": meta_description,
        "twitter_image": og_image
    }

def validate_event_data(event: Dict[str, Any]) -> List[str]:
    """Validate event data for SEO completeness"""
    issues = []
    
    # Required fields
    required_fields = ['title', 'description', 'date', 'start_time', 'address']
    for field in required_fields:
        if not event.get(field):
            issues.append(f"Missing required field: {field}")
    
    # SEO fields
    if not event.get('slug'):
        issues.append("Missing SEO slug")
    
    if not event.get('short_description') and len(event.get('description', '')) > 160:
        issues.append("Long description without short_description for meta tags")
    
    # Geographic data
    if not event.get('city'):
        issues.append("Missing city for geographic SEO")
    
    if not event.get('state'):
        issues.append("Missing state for geographic SEO")
    
    # Structured data - Schema.org fields
    if not event.get('host_name'):
        issues.append("Missing host_name for JSON-LD organizer")
    
    if not event.get('lat') or not event.get('lng'):
        issues.append("Missing coordinates for location schema")
        
    if not event.get('organizer_url'):
        issues.append("Missing field 'url' in organizer")
        
    if not event.get('end_time') and not event.get('end_datetime'):
        issues.append("Missing field 'endDate'")
        
    if not event.get('price') and not event.get('fee_required'):
        issues.append("Missing price information for offers")
    
    return issues

class SEOEventProcessor:
    """Process events for SEO optimization"""
    
    def __init__(self, base_url: str = "https://todo-events.com"):
        self.base_url = base_url
    
    def process_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single event for SEO"""
        
        # Generate derived fields if missing
        if not event.get('slug'):
            event['slug'] = generate_event_slug(
                event.get('title', ''), 
                event.get('city', '')
            )
        
        if not event.get('short_description'):
            event['short_description'] = generate_short_description(
                event.get('description', '')
            )
        
        # Parse address if city/state missing
        if not event.get('city') or not event.get('state'):
            components = parse_address_components(event.get('address', ''))
            if not event.get('city'):
                event['city'] = components['city']
            if not event.get('state'):
                event['state'] = components['state']
            if not event.get('country'):
                event['country'] = components['country']
        
        # Normalize price
        if 'price' not in event and event.get('fee_required'):
            event['price'] = normalize_fee_to_price(event['fee_required'])
        
        # Generate datetime fields
        if not event.get('start_datetime') and event.get('date') and event.get('start_time'):
            event['start_datetime'] = combine_datetime(
                event['date'], 
                event['start_time']
            )
        
        if not event.get('end_datetime') and event.get('end_time'):
            end_date = event.get('end_date') or event.get('date')
            if end_date:
                event['end_datetime'] = combine_datetime(
                    end_date, 
                    event['end_time']
                )
        
        # Set updated timestamp
        if not event.get('updated_at'):
            event['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        return event
    
    def generate_full_seo_data(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Generate complete SEO data package for event"""
        
        processed_event = self.process_event(event)
        
        return {
            "event": processed_event,
            "metadata": generate_seo_metadata(processed_event, self.base_url),
            "json_ld": {
                "event": generate_event_json_ld(processed_event, self.base_url),
                "breadcrumb": generate_breadcrumb_json_ld(processed_event, self.base_url),
                "webpage": generate_webpage_json_ld(processed_event, self.base_url)
            },
            "validation_issues": validate_event_data(processed_event)
        }
