import React, { useContext, useEffect, useState } from "react";
import { ThemeContext } from "../ThemeContext";
import { getCategory } from "./categoryConfig";
import { CategoryIcon } from "./CategoryIcons";
import { PaidIcon, FreeIcon, HostIcon } from "./WebIcons";

// Custom logo component - Replace with your actual logo
const TodoEventsLogo = ({ theme, className = "" }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg width="48" height="48" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#4F9BED", stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: "#3B82F6", stopOpacity: 1 }} />
          </linearGradient>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.25)" />
          </filter>
        </defs>
        {/* Main pin shape */}
        <path 
          d="M100 20C75 20 55 40 55 65C55 90 100 180 100 180C100 180 145 90 145 65C145 40 125 20 100 20Z" 
          fill="url(#logoGradient)" 
          filter="url(#shadow)"
        />
        {/* Inner circle for checkmark */}
        <circle 
          cx="100" 
          cy="65" 
          r="25" 
          fill="rgba(255,255,255,0.95)"
        />
        {/* Checkmark */}
        <path 
          d="M88 65L96 73L112 57" 
          stroke="#3B82F6" 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          fill="none"
        />
      </svg>
    </div>
  );
};

// Fallback map component when Google Maps isn't available
const FallbackMap = ({ event, category, theme }) => (
  <div 
    className="w-full h-full flex items-center justify-center relative"
    style={{ 
      backgroundColor: theme === "dark" ? "#1a1a1a" : "#f8f9fa",
      backgroundImage: `radial-gradient(circle at 50% 50%, ${category.color || "#F5C842"}20 0%, transparent 50%)`
    }}
  >
    <div className="text-center">
      <div className="flex items-center justify-center mb-2">
        <div 
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg"
          style={{ backgroundColor: category.color || "#F5C842" }}
        >
          <CategoryIcon 
            category={event.category} 
            className="w-5 h-5 sm:w-6 sm:h-6" 
            style={{ color: "#1F2937" }}
          />
        </div>
      </div>
      <p className="text-sm sm:text-base font-semibold mb-1" style={{ color: theme === "dark" ? "#ffffff" : "#1F2937" }}>
        {event.title}
      </p>
      <p className="text-xs leading-tight px-2" style={{ color: theme === "dark" ? "#a3a3a3" : "#525252" }}>
        {event.address}
      </p>
      <div className="mt-2 flex items-center justify-center gap-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke={category.color || "#F5C842"} strokeWidth="2" />
          <circle cx="12" cy="12" r="8" stroke={category.color || "#F5C842"} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
        </svg>
        <span className="text-xs" style={{ color: theme === "dark" ? "#a3a3a3" : "#525252" }}>
          5-mile radius area
        </span>
      </div>
    </div>
  </div>
);

// Helper to format date/time in a more social-friendly way
function formatDate(event) {
  try {
    if (!event?.date || !event?.start_time) {
      return 'Date and time not specified';
    }

    const startDate = new Date(event.date);
    const formattedDate = startDate.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });

    // Format time range
    let timeStr = event.start_time;
    if (event.end_time) {
      timeStr += ` - ${event.end_time}`;
    }

    // Handle multi-day events
    if (event.end_date && event.end_date !== event.date) {
      const endDate = new Date(event.end_date);
      const formattedEndDate = endDate.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      });
      return `${formattedDate} - ${formattedEndDate} at ${timeStr}`;
    }

    return `${formattedDate} at ${timeStr}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    // Fallback formatting
    let fallback = event.date || 'Date not specified';
    if (event.start_time) {
      fallback += ` at ${event.start_time}`;
      if (event.end_time) {
        fallback += ` - ${event.end_time}`;
      }
    }
    return fallback;
  }
}

const ShareCard = ({ event }) => {
  const { theme } = useContext(ThemeContext);
  const category = getCategory(event.category);
  const [mapUrl, setMapUrl] = useState("");
  
  const bgColor = theme === "glass" ? "#E1F5FE" : (theme === "dark" ? "#0f0f0f" : "#ffffff");
  const textColor = theme === "glass" ? "#1e4064" : (theme === "dark" ? "#ffffff" : "#0f0f0f");
  const secondaryTextColor = theme === "glass" ? "#1e4064CC" : (theme === "dark" ? "#a3a3a3" : "#525252");
  const borderColor = theme === "glass" ? "#FFFFFF66" : (theme === "dark" ? "#262626" : "#e5e5e5");
  const cardBg = theme === "glass" ? "rgba(255, 255, 255, 0.2)" : (theme === "dark" ? "#171717" : "#fafafa");

  // Generate simplified Google Maps Static API URL
  useEffect(() => {
    if (event?.lat && event?.lng) {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        console.warn("Google Maps API key not found - using fallback map");
        return;
      }
      
      const center = `${event.lat},${event.lng}`;
      const zoom = 15; // Increased zoom for better detail
      const size = "800x400"; // Higher resolution for better quality when scaled
      const scale = 2;
      
      // Enhanced marker styling
      const markerColor = category.color?.replace('#', '') || "red";
      const marker = `markers=color:${markerColor}%7Csize:large%7C${center}`;
      
      // Enhanced map styles for better readability
      const baseStyles = [
        "feature:poi.business|visibility:off", // Hide business POIs for cleaner look
        "feature:poi.medical|visibility:off",
        "feature:poi.school|visibility:off", 
        "feature:transit|visibility:simplified",
        "feature:road.arterial|element:labels|visibility:on",
        "feature:road.highway|element:labels|visibility:on",
        "feature:administrative.locality|element:labels|visibility:on",
        "feature:administrative.neighborhood|element:labels|visibility:simplified"
      ];
      
      const lightStyles = theme === "light" ? [
        "element:geometry|color:0xf5f5f5",
        "element:labels.text.fill|color:0x2c2c2c",
        "element:labels.text.stroke|color:0xffffff|weight:3",
        "feature:road|element:geometry|color:0xe8e8e8",
        "feature:road.highway|element:geometry|color:0xd4d4d4",
        "feature:road.arterial|element:geometry|color:0xe0e0e0",
        "feature:water|element:geometry|color:0x93c5fd",
        "feature:park|element:geometry|color:0xd1fae5",
        "feature:landscape.natural|element:geometry|color:0xf0fdf4",
        "feature:administrative|element:geometry.stroke|color:0xc0c0c0|weight:1"
      ] : [];
      
      const darkStyles = theme === "dark" ? [
        "element:geometry|color:0x242424",
        "element:labels.text.fill|color:0xe5e5e5",
        "element:labels.text.stroke|color:0x1a1a1a|weight:3",
        "feature:road|element:geometry|color:0x3a3a3a",
        "feature:road.highway|element:geometry|color:0x4a4a4a",
        "feature:road.arterial|element:geometry|color:0x404040",
        "feature:water|element:geometry|color:0x1e3a8a",
        "feature:park|element:geometry|color:0x1f2937",
        "feature:landscape.natural|element:geometry|color:0x1f2937",
        "feature:administrative|element:geometry.stroke|color:0x404040|weight:1"
      ] : [];
      
      const allStyles = [...baseStyles, ...(theme === "dark" ? darkStyles : lightStyles)];
      const styleParam = allStyles.map(style => `&style=${encodeURIComponent(style)}`).join('');
      
      const url = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${size}&scale=${scale}&maptype=roadmap&${marker}${styleParam}&key=${apiKey}`;
      
      setMapUrl(url);
    }
  }, [event?.lat, event?.lng, theme, category]);

  // Simplified inline styles for better image generation compatibility
  const containerStyle = {
    backgroundColor: bgColor,
    color: textColor,
    border: `1px solid ${borderColor}`,
    fontFamily: 'Arial, sans-serif', // Use more basic font
    width: '320px',  // Fixed width for 2:3 ratio
    height: '480px', // Fixed height for 2:3 ratio
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column'
  };

  const headerStyle = {
    backgroundColor: cardBg,
    borderBottom: `1px solid ${borderColor}`,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0
  };

  const titleStyle = {
    fontSize: '16px',  // Slightly smaller for better fit
    fontWeight: 'bold',
    lineHeight: '1.2',
    color: textColor,
    margin: '0',
    marginRight: '12px'
  };

  const categoryStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '4px'
  };

  const categoryTextStyle = {
    fontSize: '11px',  // Smaller category text
    fontWeight: '500',
    color: category.color || "#F5C842"
  };

  const mapContainerStyle = {
    position: 'relative',
    minHeight: '80px',   // Minimum height to ensure map is visible
    maxHeight: '180px',  // Maximum height to prevent it from being too large
    flex: '1 1 auto',    // Allow it to grow and shrink based on available space
    flexShrink: 1        // Allow shrinking when content needs space
  };

  const mapImageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    backgroundColor: theme === "dark" ? "#262626" : "#f5f5f5"
  };

  const mainContentStyle = {
    backgroundColor: cardBg,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: '1 1 auto',    // Allow this section to grow/shrink
    minHeight: '120px',  // Minimum height to ensure content fits
    overflow: 'hidden'   // Prevent content overflow
  };

  const descriptionStyle = {
    fontSize: '13px',
    lineHeight: '1.4',
    color: textColor,
    margin: '0 0 12px 0',
    fontWeight: '400',
    flex: '0 0 auto',    // Don't shrink description
    maxHeight: '80px',   // Limit description height
    overflow: 'hidden'   // Hide overflow text
  };

  const detailsContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: '1 1 auto',    // Allow details to use remaining space
    minHeight: '0'       // Allow shrinking
  };

  const detailRowStyle = {
    display: 'flex',
    alignItems: 'center',  // Changed from flex-start to center for better alignment
    gap: '8px'
  };

  const iconContainerStyle = {
    width: '20px',  // Fixed width for consistent alignment
    height: '20px', // Fixed height
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0  // Prevent shrinking
  };

  const detailTextStyle = {
    fontSize: '11px',  // Smaller details text
    lineHeight: '1.3',
    color: secondaryTextColor,  // Use secondary color for less emphasis
    margin: '0',
    flex: 1
  };

  const footerStyle = {
    padding: '8px 16px',  // Reduced padding
    textAlign: 'center',
    borderTop: `1px solid ${borderColor}`,
    backgroundColor: bgColor,
    flexShrink: 0
  };

  const footerTextStyle = {
    fontSize: '8px',  // Smaller footer text
    color: secondaryTextColor,
    margin: '0 0 2px 0'
  };

  const brandingStyle = {
    fontSize: '12px',  // Smaller branding
    fontWeight: 'bold',
    color: "#F5C842",
    margin: '0'
  };

  const eventIdStyle = {
    fontSize: '8px',  // Smaller event ID
    color: secondaryTextColor,
    margin: '4px 0 0 0'
  };

  // Helper function to determine if event is paid
  const isPaidEvent = (event) => {
    // Check explicit price field
    if (event.price && parseFloat(event.price) > 0) return true;
    
    // Check fee_required field with more comprehensive logic
    if (event.fee_required) {
      const feeText = event.fee_required.toLowerCase().trim();
      
      // Explicitly free indicators
      if (feeText === 'free' || 
          feeText === 'no' || 
          feeText === 'none' || 
          feeText === '$0' ||
          feeText === '0' ||
          feeText.includes('free admission') ||
          feeText.includes('no cost') ||
          feeText.includes('no charge')) {
        return false;
      }
      
      // If it contains dollar signs, price numbers, or payment terms, it's likely paid
      if (feeText.includes('$') && !feeText.includes('$0') ||
          /\$[1-9]/.test(feeText) ||
          feeText.includes('fee') ||
          feeText.includes('cost') ||
          feeText.includes('charge') ||
          feeText.includes('ticket') ||
          feeText.includes('admission') ||
          feeText.includes('entry') ||
          /\d+/.test(feeText)) {
        return true;
      }
    }
    
    // Check if title or description mentions payment
    const titleText = (event.title || '').toLowerCase();
    const descText = (event.description || '').toLowerCase();
    
    if (titleText.includes('$') || descText.includes('admission fee') || 
        descText.includes('entry fee') || descText.includes('ticket required')) {
      return true;
    }
    
    // Default to free if no clear payment indicators
    return false;
  };

  return (
    <div style={containerStyle} id="share-card-root">
      {/* Header with title and logo */}
      <div style={headerStyle}>
        <div style={{ flex: 1 }}>
          <h1 style={titleStyle}>
            {event.title}
          </h1>
          <div style={categoryStyle}>
            <CategoryIcon 
              category={event.category} 
              style={{ width: '14px', height: '14px', color: category.color || "#F5C842" }}
            />
            <span style={categoryTextStyle}>
              {category.label || event.category}
            </span>
          </div>
        </div>
        <TodoEventsLogo theme={theme} className="w-10 h-10" />
      </div>
      
      {/* Map section */}
      <div style={mapContainerStyle}>
        {mapUrl ? (
          <img 
            src={mapUrl} 
            alt="Event location map"
            style={mapImageStyle}
            onError={() => setMapUrl("")}
            loading="eager"
            crossOrigin="anonymous"
          />
        ) : (
          <FallbackMap event={event} category={category} theme={theme} />
        )}
      </div>
      
      {/* Main content with description first */}
      <div style={mainContentStyle}>
        {/* Description - Prioritized */}
        {event.description && (
          <div>
            <p style={descriptionStyle}>
              {event.description.length > 120 ? event.description.substring(0, 120) + "..." : event.description}
            </p>
          </div>
        )}
        
        {/* Event details - smaller at bottom */}
        <div style={detailsContainerStyle}>
          {/* Date and time */}
          <div style={detailRowStyle}>
            <div style={{
              ...iconContainerStyle,
              backgroundColor: theme === "dark" ? "rgba(30, 64, 175, 0.2)" : "#dbeafe"
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" 
                  stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={detailTextStyle}>
              {formatDate(event)}
            </p>
          </div>
          
          {/* Location */}
          <div style={detailRowStyle}>
            <div style={{
              ...iconContainerStyle,
              backgroundColor: theme === "dark" ? "rgba(220, 38, 38, 0.2)" : "#fee2e2"
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" 
                  stroke="#dc2626" strokeWidth="2"/>
                <path d="M12 22C12 22 20 18 20 10.5C20 6.36 16.42 3 12 3C7.58 3 4 6.36 4 10.5C4 18 12 22 12 22Z" 
                  stroke="#dc2626" strokeWidth="2"/>
              </svg>
            </div>
            <p style={detailTextStyle}>
              {event.address}
            </p>
          </div>
          
          {/* Host Name */}
          {event.host_name && (
            <div style={detailRowStyle}>
              <div style={{
                ...iconContainerStyle,
                backgroundColor: theme === "dark" ? "rgba(34, 197, 94, 0.2)" : "#dcfce7"
              }}>
                <HostIcon 
                  style={{ width: '12px', height: '12px', color: '#16a34a' }}
                />
              </div>
              <p style={detailTextStyle}>
                Hosted by {event.host_name}
              </p>
            </div>
          )}
          
          {/* Payment Status */}
          <div style={detailRowStyle}>
            <div style={{
              ...iconContainerStyle,
              backgroundColor: isPaidEvent(event) 
                ? (theme === "dark" ? "rgba(234, 179, 8, 0.2)" : "#fef3c7")
                : (theme === "dark" ? "rgba(34, 197, 94, 0.2)" : "#dcfce7")
            }}>
              {isPaidEvent(event) ? (
                <PaidIcon 
                  style={{ width: '12px', height: '12px', color: '#eab308' }}
                />
              ) : (
                <FreeIcon 
                  style={{ width: '12px', height: '12px', color: '#16a34a' }}
                />
              )}
            </div>
            <p style={detailTextStyle}>
              {isPaidEvent(event) ? 'Paid Event' : 'Free Event'}
            </p>
          </div>
          
          {/* Secondary Category */}
          {event.secondary_category && (
            <div style={detailRowStyle}>
              <div style={{
                ...iconContainerStyle,
                backgroundColor: theme === "dark" ? "rgba(139, 92, 246, 0.2)" : "#ede9fe"
              }}>
                <CategoryIcon 
                  category={event.secondary_category} 
                  style={{ width: '12px', height: '12px', color: '#8b5cf6' }}
                />
              </div>
              <p style={detailTextStyle}>
                Also: {getCategory(event.secondary_category)?.label || event.secondary_category}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer with branding */}
      <div style={footerStyle}>
        <p style={footerTextStyle}>
          Discover more local events at
        </p>
        <p style={brandingStyle}>
          todo-events.com
        </p>
        <p style={eventIdStyle}>
          Event ID: {event.id} • 5-mile radius highlighted
        </p>
      </div>
    </div>
  );
};

export default ShareCard; 