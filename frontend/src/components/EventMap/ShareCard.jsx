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
  if (!event?.date) return 'Date TBD';
  
  try {
    const startDate = new Date(event.date);
    let dateStr = startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    if (event.end_date && event.end_date !== event.date) {
      const endDate = new Date(event.end_date);
      // If same year, don't repeat it
      const endDateStr = endDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: startDate.getFullYear() !== endDate.getFullYear() ? 'numeric' : undefined
      });
      dateStr += ` - ${endDateStr}`;
    }
    
    return dateStr;
  } catch (error) {
    console.error('Error formatting date:', error);
    return event.date || 'Date TBD';
  }
}

function formatTime(event) {
  if (!event?.start_time) return 'Time TBD';
  
  try {
    const convertTo12Hour = (time24) => {
      if (!time24) return time24;
      const [hours, minutes] = time24.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return time24;
      
      const period = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const minutesStr = minutes.toString().padStart(2, '0');
      
      return `${hours12}:${minutesStr} ${period}`;
    };
    
    const startTime = convertTo12Hour(event.start_time);
    const endTime = event.end_time ? convertTo12Hour(event.end_time) : null;
    
    if (endTime) {
      return `${startTime} - ${endTime}`;
    }
    return startTime;
  } catch (error) {
    console.error('Error formatting time:', error);
    return event.start_time || 'Time TBD';
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
    width: '340px',  // Slightly wider for two-column layout
    height: '480px', // Keep same height for 2:3 ratio
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column'
  };

  const headerStyle = {
    backgroundColor: cardBg,
    borderBottom: `1px solid ${borderColor}`,
    padding: '10px 14px',  // Increased from 8px 12px
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0
  };

  const titleStyle = {
    fontSize: '15px',  // Increased from 14px
    fontWeight: 'bold',
    lineHeight: '1.15',  // Slightly looser
    color: textColor,
    margin: '0',
    marginRight: '10px'  // Increased margin
  };

  const categoryStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',  // Increased from 4px
    marginTop: '3px'  // Increased from 2px
  };

  const categoryTextStyle = {
    fontSize: '10px',  // Increased from 9px
    fontWeight: '500',
    color: category.color || "#F5C842"
  };

  const mapContainerStyle = {
    position: 'relative',
    minHeight: '110px',   // Increased from 100px
    maxHeight: '150px',   // Increased from 140px
    flex: '0 0 auto',
    height: '130px'       // Increased from 120px
  };

  const mapImageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    backgroundColor: theme === "dark" ? "#262626" : "#f5f5f5"
  };

  const mainContentStyle = {
    backgroundColor: cardBg,
    padding: '14px',  // Increased from 12px
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',  // Increased from 8px
    flex: '1 1 auto',
    minHeight: '0',
    overflow: 'hidden'
  };

  const descriptionStyle = {
    fontSize: '12px',  // Increased from 11px
    lineHeight: '1.35',  // Slightly looser
    color: textColor,
    margin: '0 0 10px 0',  // Increased bottom margin
    fontWeight: '400',
    // Better text truncation with word boundaries
    display: '-webkit-box',
    WebkitLineClamp: 2,  // Keep at 2 lines
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };

  const detailsContainerStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '7px 10px',  // Increased from 6px 8px
    flex: '1 1 auto',
    alignItems: 'start'
  };

  const detailRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px'  // Increased from 4px
  };

  const iconContainerStyle = {
    width: '16px',  // Increased from 14px
    height: '16px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  };

  const detailTextStyle = {
    fontSize: '10px',  // Increased from 9px
    lineHeight: '1.2',  // Slightly looser
    color: secondaryTextColor,
    margin: '0',
    flex: 1,
    wordBreak: 'break-word'
  };

  const footerStyle = {
    padding: '8px 14px',  // Increased padding
    textAlign: 'center',
    borderTop: `1px solid ${borderColor}`,
    backgroundColor: bgColor,
    flexShrink: 0
  };

  const footerTextStyle = {
    fontSize: '8px',  // Increased from 7px
    color: secondaryTextColor,
    margin: '0 0 2px 0'  // Increased margin
  };

  const brandingStyle = {
    fontSize: '11px',  // Increased from 10px
    fontWeight: 'bold',
    color: "#F5C842",
    margin: '0'
  };

  const eventIdStyle = {
    fontSize: '8px',  // Increased from 7px
    color: secondaryTextColor,
    margin: '3px 0 0 0'  // Increased margin
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
              style={{ width: '13px', height: '13px', color: category.color || "#F5C842" }}
            />
            <span style={categoryTextStyle}>
              {category.label || event.category}
            </span>
            {event.verified && (
              <div style={{
                marginLeft: '7px',  // Slightly increased
                padding: '2px 5px',  // Better padding
                backgroundColor: '#16a34a',
                color: 'white',
                fontSize: '9px',  // Slightly larger
                borderRadius: '4px',  // Better radius
                fontWeight: 'bold'
              }}>
                VERIFIED
              </div>
            )}
          </div>
          {/* Engagement stats */}
          {event.interest_count > 0 && (
            <div style={{
              fontSize: '9px',
              color: theme === "dark" ? '#94a3b8' : '#64748b',
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
                {event.interest_count} interested
              </span>
            </div>
          )}
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
              {event.description}
            </p>
          </div>
        )}
        
        {/* Event details in two-column grid */}
        <div style={detailsContainerStyle}>
          {/* Date */}
          <div style={detailRowStyle}>
            <div style={{
              ...iconContainerStyle,
              backgroundColor: theme === "dark" ? "rgba(30, 64, 175, 0.2)" : "#dbeafe"
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" 
                  stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={detailTextStyle}>
              {formatDate(event)}
            </p>
          </div>
          
          {/* Time */}
          <div style={detailRowStyle}>
            <div style={{
              ...iconContainerStyle,
              backgroundColor: theme === "dark" ? "rgba(30, 64, 175, 0.2)" : "#dbeafe"
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="2"/>
                <polyline points="12,6 12,12 16,14" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={detailTextStyle}>
              {formatTime(event)}
            </p>
          </div>
        
          {/* Location (spans two columns for longer addresses) */}
          <div style={{...detailRowStyle, gridColumn: '1 / -1'}}>
            <div style={{
              ...iconContainerStyle,
              backgroundColor: theme === "dark" ? "rgba(220, 38, 38, 0.2)" : "#fee2e2"
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
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
                  style={{ width: '10px', height: '10px', color: '#16a34a' }}
                />
              </div>
              <p style={detailTextStyle}>
                {event.host_name}
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
                  style={{ width: '10px', height: '10px', color: '#eab308' }}
                />
              ) : (
                <FreeIcon 
                  style={{ width: '10px', height: '10px', color: '#16a34a' }}
                />
              )}
            </div>
            <p style={detailTextStyle}>
              {isPaidEvent(event) ? 'Paid Event' : 'Free Event'}
            </p>
          </div>
          
          {/* Secondary Category (only if it exists and is different from primary) */}
          {event.secondary_category && event.secondary_category !== event.category && (
            <div style={{...detailRowStyle, gridColumn: '1 / -1'}}>
              <div style={{
                ...iconContainerStyle,
                backgroundColor: theme === "dark" ? "rgba(139, 92, 246, 0.2)" : "#ede9fe"
              }}>
                <CategoryIcon 
                  category={event.secondary_category} 
                  style={{ width: '10px', height: '10px', color: '#8b5cf6' }}
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