#!/usr/bin/env python3
"""
Test Enhanced Migration Capabilities
Tests the auto-population functions with real address data examples
"""

import re
import unicodedata
from datetime import datetime

def slugify(title, city=""):
    """Enhanced slugify function using title and city"""
    if not title:
        return ""
    
    # Combine title and city for better uniqueness
    base = f"{title} {city}".lower() if city else title.lower()
    
    # Normalize Unicode characters
    base = unicodedata.normalize('NFKD', base)
    
    # Remove non-word characters (keep letters, numbers, spaces, hyphens)
    base = re.sub(r'[^\w\s-]', '', base)
    
    # Replace multiple spaces/underscores/hyphens with single hyphen
    base = re.sub(r'[\s_-]+', '-', base)
    
    # Remove leading/trailing hyphens
    return base.strip('-')

def extract_city_state_enhanced(address):
    """Enhanced city/state extraction using multiple regex strategies"""
    if not address:
        return {"city": None, "state": None, "country": "USA"}
    
    address = address.strip()
    print(f"🔍 Parsing: '{address}'")
    
    # Strategy A: Look for pattern ending with City, STATE, USA
    match = re.search(r",\s*([^,]+),\s*([A-Z]{2}),\s*USA", address)
    if match:
        city = match.group(1).strip()
        state = match.group(2).strip()
        result = {"city": city, "state": state, "country": "USA"}
        print(f"   ✅ Strategy A: {result}")
        return result
    
    # Strategy B: Look for pattern ending with City, STATE (without USA)
    match = re.search(r",\s*([^,]+),\s*([A-Z]{2})\s*$", address)
    if match:
        city = match.group(1).strip()
        state = match.group(2).strip()
        result = {"city": city, "state": state, "country": "USA"}
        print(f"   ✅ Strategy B: {result}")
        return result
    
    # Strategy C: Look for any 2-letter state code in the address
    state_match = re.search(r'\b([A-Z]{2})\b', address)
    if state_match:
        state = state_match.group(1)
        
        # Try to extract city before the state
        city_pattern = rf",\s*([^,]+)(?=.*\b{state}\b)"
        city_match = re.search(city_pattern, address)
        city = city_match.group(1).strip() if city_match else None
        
        result = {"city": city, "state": state, "country": "USA"}
        print(f"   ✅ Strategy C: {result}")
        return result
    
    # Strategy D: Fallback to parsing by comma separation
    parts = [part.strip() for part in address.split(',')]
    
    if len(parts) >= 3:
        city_part = parts[-2] if len(parts) >= 2 else None
        state_part = parts[-1] if len(parts) >= 1 else None
        
        # Check if state_part contains a 2-letter code
        if state_part:
            state_match = re.search(r'\b([A-Z]{2})\b', state_part)
            state = state_match.group(1) if state_match else None
        else:
            state = None
            
        result = {"city": city_part, "state": state, "country": "USA"}
        print(f"   ✅ Strategy D: {result}")
        return result
    
    result = {"city": None, "state": None, "country": "USA"}
    print(f"   ❌ No match: {result}")
    return result

def normalize_price_enhanced(fee_required):
    """Enhanced price normalization from fee_required field"""
    if not fee_required:
        return 0.0
    
    fee_str = str(fee_required).lower().strip()
    print(f"💰 Normalizing: '{fee_required}' -> '{fee_str}'")
    
    # Handle explicit free indicators
    if fee_str in ['free', 'no charge', 'no fee', 'none', '0', '', 'n/a', 'na']:
        print(f"   ✅ Free event: 0.0")
        return 0.0
    
    # Remove currency symbols and common text
    fee_str = re.sub(r'[\$£€¥₹]', '', fee_str)
    fee_str = re.sub(r'\b(usd|dollars?|cents?)\b', '', fee_str)
    
    # Extract numeric value (handle decimals and commas)
    price_match = re.search(r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', fee_str)
    if price_match:
        price_str = price_match.group(1).replace(',', '')
        try:
            price = float(price_str)
            print(f"   ✅ Extracted price: {price}")
            return price
        except ValueError:
            pass
    
    # Try to extract any number
    number_match = re.search(r'(\d+(?:\.\d{2})?)', fee_str)
    if number_match:
        try:
            price = float(number_match.group(1))
            print(f"   ✅ Fallback price: {price}")
            return price
        except ValueError:
            pass
    
    print(f"   ❌ Could not extract price: 0.0")
    return 0.0

def build_datetimes_enhanced(date_str, start_time_str, end_time_str, end_date_str=None):
    """Enhanced datetime building with better error handling"""
    print(f"📅 Building datetime: date={date_str}, start={start_time_str}, end={end_time_str}, end_date={end_date_str}")
    
    try:
        if not date_str or not start_time_str:
            print(f"   ❌ Missing required fields")
            return None, None
        
        # Parse start datetime
        start_dt = datetime.strptime(f"{date_str} {start_time_str}", "%Y-%m-%d %H:%M")
        start_iso = start_dt.isoformat() + '-04:00'
        
        # Parse end datetime
        if end_date_str and end_time_str:
            # Multi-day event
            end_dt = datetime.strptime(f"{end_date_str} {end_time_str}", "%Y-%m-%d %H:%M")
            print(f"   ✅ Multi-day event")
        elif end_time_str:
            # Same day event
            end_dt = datetime.strptime(f"{date_str} {end_time_str}", "%Y-%m-%d %H:%M")
            print(f"   ✅ Same-day event")
        else:
            # Default to 1 hour duration if no end time
            end_dt = start_dt.replace(hour=start_dt.hour + 1)
            print(f"   ⚠️ No end time, defaulting to +1 hour")
        
        end_iso = end_dt.isoformat() + '-04:00'
        
        print(f"   ✅ Start: {start_iso}")
        print(f"   ✅ End: {end_iso}")
        return start_iso, end_iso
        
    except ValueError as e:
        print(f"   ❌ DateTime parsing error: {e}")
        return None, None

def make_short_description_enhanced(description):
    """Enhanced short description generation with better truncation"""
    if not description:
        print(f"📝 Making short description from: None")
        print(f"   ❌ No description provided")
        return ""
    
    print(f"📝 Making short description from: '{description[:100]}{'...' if len(description) > 100 else ''}'")
    
    if not description:
        print(f"   ❌ No description provided")
        return ""
    
    # Clean up the description
    clean_desc = re.sub(r'\s+', ' ', description.strip())
    
    # If already short enough, return as-is
    if len(clean_desc) <= 160:
        print(f"   ✅ Already short enough: '{clean_desc}'")
        return clean_desc
    
    # Truncate at sentence boundary if possible
    sentences = re.split(r'[.!?]+', clean_desc)
    if sentences and len(sentences[0]) <= 140:
        result = sentences[0].strip() + '.'
        print(f"   ✅ Sentence boundary: '{result}'")
        return result
    
    # Truncate at word boundary
    truncated = clean_desc[:157]
    last_space = truncated.rfind(' ')
    if last_space > 120:  # Don't lose too much content
        truncated = truncated[:last_space]
    
    result = truncated.rstrip('.,!?;:') + '...'
    print(f"   ✅ Word boundary: '{result}'")
    return result

def test_address_parsing():
    """Test address parsing with various formats"""
    print("🏠 Testing Address Parsing")
    print("=" * 50)
    
    test_addresses = [
        "Midland County Fairgrounds, 6905 Eastman Ave, Midland, MI, USA",
        "123 Main Street, Detroit, MI",
        "Central Park, New York, NY, USA",
        "Golden Gate Park, San Francisco, CA",
        "Downtown Convention Center, 456 Business Ave, Austin, TX",
        "Community Center, 789 Local St, Phoenix, AZ, USA",
        "University Campus, 321 College Way, Madison, WI",
        "City Hall, 555 Government Blvd, Tampa, FL, USA",
    ]
    
    for address in test_addresses:
        extract_city_state_enhanced(address)
        print()

def test_price_normalization():
    """Test price normalization with various fee formats"""
    print("💰 Testing Price Normalization")
    print("=" * 50)
    
    test_fees = [
        "Free",
        "$25",
        "$25.00",
        "25 dollars",
        "$1,500",
        "$1,234.56",
        "No charge",
        "€50",
        "£30.00",
        "20",
        "Free admission",
        "N/A",
        "",
        None,
        "15.99",
        "$5-$10 sliding scale",
    ]
    
    for fee in test_fees:
        normalize_price_enhanced(fee)
        print()

def test_datetime_building():
    """Test datetime building with various scenarios"""
    print("📅 Testing DateTime Building")
    print("=" * 50)
    
    test_scenarios = [
        ("2025-05-31", "08:00", "18:00", None),  # Same day event
        ("2025-06-01", "09:00", "17:00", "2025-06-03"),  # Multi-day event
        ("2025-07-15", "19:30", None, None),  # Event with start time only
        ("2025-08-20", "14:00", "16:30", None),  # Afternoon event
    ]
    
    for date_str, start_time, end_time, end_date in test_scenarios:
        build_datetimes_enhanced(date_str, start_time, end_time, end_date)
        print()

def test_slug_generation():
    """Test slug generation with various title/city combinations"""
    print("🔗 Testing Slug Generation")
    print("=" * 50)
    
    test_cases = [
        ("Michigan Antique Festival", "Midland"),
        ("Summer Music Concert", "Detroit"),
        ("Art & Wine Festival", "San Francisco"),
        ("Tech Conference 2025", "Austin"),
        ("Community Farmer's Market", "Madison"),
        ("Holiday Light Display", ""),
        ("Café & Coffee Tasting", "Portland"),
        ("5K Fun Run/Walk", "Phoenix"),
    ]
    
    for title, city in test_cases:
        slug = slugify(title, city)
        print(f"📝 '{title}' + '{city}' -> '{slug}'")

def test_short_description():
    """Test short description generation"""
    print("📝 Testing Short Description Generation")
    print("=" * 50)
    
    test_descriptions = [
        "Short description that's already fine.",
        "This is a longer description that needs to be truncated because it exceeds the 160 character limit for meta descriptions and SEO purposes. It contains multiple sentences with detailed information about the event.",
        "Features Mid-Michigan's largest classic car show with over 500 expected vehicles, alongside thousands of antiques, vintage items, and live acoustic music. Perfect for families and collectors!",
        "Join us for an amazing evening of entertainment. This event will feature local artists, food vendors, and activities for all ages. Don't miss this incredible opportunity to connect with your community.",
        "",
        None,
    ]
    
    for desc in test_descriptions:
        make_short_description_enhanced(desc)
        print()

def main():
    """Run all tests"""
    print("🧪 Enhanced Migration Capabilities Test Suite")
    print("=" * 70)
    print()
    
    test_address_parsing()
    print()
    test_price_normalization()
    print()
    test_datetime_building()
    print()
    test_slug_generation()
    print()
    test_short_description()
    
    print("\n🎉 All tests completed!")
    print("💡 These functions demonstrate how the enhanced migration")
    print("   auto-populates missing fields from existing data.")

if __name__ == "__main__":
    main() 