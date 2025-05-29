import React, { useContext, useEffect, useState } from "react";
import { ThemeContext } from "../ThemeContext";
import { getCategory } from "./categoryConfig";
import { CategoryIcon } from "./CategoryIcons";

// Custom logo component - Replace with your actual logo
const TodoEventsLogo = ({ theme, className = "" }) => {
  const [useStaticLogo, setUseStaticLogo] = useState(false);
  
  if (useStaticLogo) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <img 
          src="/images/pin-logo.svg" 
          alt="todo-events logo" 
          width="40" 
          height="40"
          onError={() => setUseStaticLogo(false)}
        />
      </div>
    );
  }
  
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg width="40" height="40" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#FFEC3A", stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: "#FFD700", stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="85" fill="url(#logoGradient)" stroke="#1F2937" strokeWidth="6" />
        <path d="M100 35C75.2 35 55 55.2 55 80C55 115 100 165 100 165C100 165 145 115 145 80C145 55.2 124.8 35 100 35ZM100 105C86.2 105 75 93.8 75 80C75 66.2 86.2 55 100 55C113.8 55 125 66.2 125 80C125 93.8 113.8 105 100 105Z" 
          fill="#1F2937" />
        <circle cx="100" cy="80" r="15" fill="#FFEC3A" stroke="#1F2937" strokeWidth="2" />
        <path d="M90 80L98 88L110 70" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
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
      backgroundImage: `radial-gradient(circle at 50% 50%, ${category.color || "#FFEC3A"}20 0%, transparent 50%)`
    }}
  >
    <div className="text-center">
      <div className="flex items-center justify-center mb-2">
        <div 
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg"
          style={{ backgroundColor: category.color || "#FFEC3A" }}
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
          <circle cx="12" cy="12" r="3" stroke={category.color || "#FFEC3A"} strokeWidth="2" />
          <circle cx="12" cy="12" r="8" stroke={category.color || "#FFEC3A"} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
        </svg>
        <span className="text-xs" style={{ color: theme === "dark" ? "#a3a3a3" : "#525252" }}>
          5-mile radius area
        </span>
      </div>
    </div>
  </div>
);

// Helper to format date/time in a more social-friendly way
function formatDate(dateStr, timeStr) {
  try {
    const date = new Date(`${dateStr}T${timeStr}`);
    return date.toLocaleString(undefined, {
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return `${dateStr} at ${timeStr}`;
  }
}

const ShareCard = ({ event }) => {
  const { theme } = useContext(ThemeContext);
  const category = getCategory(event.category);
  const [mapUrl, setMapUrl] = useState("");
  
  const bgColor = theme === "dark" ? "#0f0f0f" : "#ffffff";
  const textColor = theme === "dark" ? "#ffffff" : "#0f0f0f";
  const secondaryTextColor = theme === "dark" ? "#a3a3a3" : "#525252";
  const borderColor = theme === "dark" ? "#262626" : "#e5e5e5";
  const cardBg = theme === "dark" ? "#171717" : "#fafafa";

  // Generate simplified Google Maps Static API URL
  useEffect(() => {
    if (event?.lat && event?.lng) {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        console.warn("Google Maps API key not found - using fallback map");
        return;
      }
      
      const center = `${event.lat},${event.lng}`;
      const zoom = 14;
      const size = "400x200"; // Smaller size for mobile
      const scale = 2;
      
      // Use a simple colored marker instead of complex SVG
      const markerColor = category.color?.replace('#', '') || "red";
      const marker = `markers=color:${markerColor}%7Csize:large%7C${center}`;
      
      // Simplified map styles for better readability
      const baseStyles = [
        "feature:poi|element:labels|visibility:off",
        "feature:road.local|element:labels|visibility:simplified"
      ];
      
      const darkStyles = theme === "dark" ? [
        "element:geometry|color:0x1a1a1a",
        "element:labels.text.fill|color:0x8a8a8a",
        "feature:road|element:geometry|color:0x2c2c2c",
        "feature:water|element:geometry|color:0x0f0f0f"
      ] : [];
      
      const allStyles = [...baseStyles, ...darkStyles];
      const styleParam = allStyles.map(style => `&style=${encodeURIComponent(style)}`).join('');
      
      const url = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${size}&scale=${scale}&maptype=roadmap&${marker}${styleParam}&key=${apiKey}`;
      
      setMapUrl(url);
    }
  }, [event?.lat, event?.lng, theme, category]);

  return (
    <div
      className="overflow-hidden rounded-xl sm:rounded-2xl shadow-xl sm:shadow-2xl flex flex-col"
      style={{ 
        backgroundColor: bgColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        fontFamily: 'Inter, system-ui, sans-serif',
        width: '100%',
        maxWidth: '380px', // More mobile-friendly max width
        minWidth: '280px'
      }}
      id="share-card-root"
    >
      {/* Header with title and logo */}
      <div 
        className="flex items-center justify-between p-3 sm:p-4"
        style={{ backgroundColor: cardBg, borderBottom: `1px solid ${borderColor}` }}
      >
        <div className="flex-1 mr-3">
          <h1 className="text-base sm:text-lg font-bold leading-tight" style={{ color: textColor }}>
            {event.title}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <CategoryIcon 
              category={event.category} 
              className="w-4 h-4" 
              style={{ color: category.color || "#FFEC3A" }}
            />
            <span className="text-xs font-medium" style={{ color: category.color || "#FFEC3A" }}>
              {category.label || event.category}
            </span>
          </div>
        </div>
        <TodoEventsLogo theme={theme} className="flex-shrink-0" />
      </div>
      
      {/* Map section */}
      <div className="relative">
        {mapUrl ? (
          <img 
            src={mapUrl} 
            alt="Event location map"
            className="w-full h-32 sm:h-48 object-cover"
            style={{ backgroundColor: theme === "dark" ? "#262626" : "#f5f5f5" }}
            onError={() => setMapUrl("")}
            loading="eager"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="h-32 sm:h-48">
            <FallbackMap event={event} category={category} theme={theme} />
          </div>
        )}
        
        {/* Floating location badge - only show with real map */}
        {mapUrl && (
          <div 
            className="absolute bottom-2 left-2 px-2 py-1 rounded-full shadow-lg backdrop-blur-sm"
            style={{ 
              backgroundColor: `${bgColor}f0`, 
              border: `1px solid ${borderColor}`,
              backdropFilter: 'blur(8px)'
            }}
          >
            <div className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" 
                  stroke="#ef4444" strokeWidth="2"/>
                <path d="M12 22C12 22 20 18 20 10.5C20 6.36 16.42 3 12 3C7.58 3 4 6.36 4 10.5C4 18 12 22 12 22Z" 
                  stroke="#ef4444" strokeWidth="2"/>
              </svg>
              <span className="text-xs font-medium" style={{ color: textColor }}>5mi radius</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Event details */}
      <div className="p-3 sm:p-4 space-y-3" style={{ backgroundColor: cardBg }}>
        {/* Date and time */}
        <div className="flex items-start gap-2">
          <div 
            className="p-2 rounded-full mt-0.5"
            style={{ backgroundColor: theme === "dark" ? "#1e40af20" : "#dbeafe" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" 
                stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-sm sm:text-base font-semibold leading-tight" style={{ color: textColor }}>
              {formatDate(event.date, event.time)}
            </p>
          </div>
        </div>
        
        {/* Location */}
        <div className="flex items-start gap-2">
          <div 
            className="p-2 rounded-full mt-0.5"
            style={{ backgroundColor: theme === "dark" ? "#dc262620" : "#fee2e2" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" 
                stroke="#dc2626" strokeWidth="2"/>
              <path d="M12 22C12 22 20 18 20 10.5C20 6.36 16.42 3 12 3C7.58 3 4 6.36 4 10.5C4 18 12 22 12 22Z" 
                stroke="#dc2626" strokeWidth="2"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm leading-relaxed break-words" style={{ color: textColor }}>
              {event.address}
            </p>
          </div>
        </div>
        
        {/* Description */}
        {event.description && (
          <div className="pt-1">
            <p className="text-xs sm:text-sm leading-relaxed line-clamp-2" style={{ color: secondaryTextColor }}>
              {event.description}
            </p>
          </div>
        )}
      </div>
      
      {/* Footer with branding */}
      <div 
        className="px-3 sm:px-4 py-3 text-center border-t"
        style={{ borderColor: borderColor, backgroundColor: bgColor }}
      >
        <p className="text-xs mb-1" style={{ color: secondaryTextColor }}>
          Discover more local events at
        </p>
        <p className="text-base sm:text-lg font-bold" style={{ color: "#FFEC3A" }}>
          todo-events.com
        </p>
        <p className="text-xs mt-2" style={{ color: secondaryTextColor }}>
          Event ID: {event.id} • 5-mile radius highlighted
        </p>
      </div>
    </div>
  );
};

export default ShareCard; 