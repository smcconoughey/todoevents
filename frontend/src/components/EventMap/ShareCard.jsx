import React, { useContext, useEffect, useState } from "react";
import { ThemeContext } from "../ThemeContext";
import { getCategory } from "./categoryConfig";

// Todo-Events logo as embedded SVG
const TodoEventsLogo = ({ theme }) => (
  <svg width="48" height="48" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="80" fill="#3B82F6" />
    <path d="M100 40C78.1 40 60 58.1 60 80C60 110 100 160 100 160C100 160 140 110 140 80C140 58.1 121.9 40 100 40ZM100 100C89.1 100 80 90.9 80 80C80 69.1 89.1 60 100 60C110.9 60 120 69.1 120 80C120 90.9 110.9 100 100 100Z" 
          fill={theme === "dark" ? "white" : "#1F2937"} />
    <path d="M85 80L95 90L115 70" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
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
    return `${dateStr} ${timeStr}`;
  }
}

const ShareCard = ({ event }) => {
  const { theme } = useContext(ThemeContext);
  const category = getCategory(event.category);
  const [mapUrl, setMapUrl] = useState("");
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  
  const bgColor = theme === "dark" ? "#171717" : "#ffffff";
  const textColor = theme === "dark" ? "#ffffff" : "#171717";
  const secondaryTextColor = theme === "dark" ? "#d4d4d4" : "#525252";
  const borderColor = theme === "dark" ? "#404040" : "#e5e5e5";

  // Generate Google Maps Static API URL with a pin and circle
  useEffect(() => {
    if (event?.lat && event?.lng) {
      // Create a URL for a static map with the event location
      // Include a marker and a circle with 5-mile radius (≈ 8047 meters)
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      
      // Parameters for the Static Maps API
      const center = `${event.lat},${event.lng}`;
      const zoom = 13;
      const size = "400x200";
      const scale = 2; // For higher resolution
      const mapType = theme === "dark" ? "roadmap" : "roadmap";
      
      // Custom marker for the event location
      const markerColor = encodeURIComponent(category.color?.replace('#', '') || "FF4444");
      const marker = `markers=color:${markerColor}%7C${center}`;
      
      // Circle showing 5-mile radius
      // API uses path=fillcolor:0xAARRGGBB|strokecolor:0xAARRGGBB|weight:N|enc:encoded_polyline
      // We'll use a simple circle around the center point
      const radiusInMeters = 8047; // 5 miles ≈ 8047 meters
      const circleParams = `path=fillcolor:0x0000AA20|strokecolor:0x0000AA80|weight:2|${center}|circle:${radiusInMeters}`;
      
      // Style parameter for dark mode
      const mapStyle = theme === "dark" 
        ? "&style=element:geometry%7Ccolor:0x212121&style=element:labels.icon%7Cvisibility:off&style=element:labels.text.fill%7Ccolor:0x757575&style=element:labels.text.stroke%7Ccolor:0x212121&style=feature:administrative%7Celement:geometry%7Ccolor:0x757575&style=feature:administrative.country%7Celement:labels.text.fill%7Ccolor:0x9e9e9e&style=feature:administrative.land_parcel%7Cvisibility:off&style=feature:administrative.locality%7Celement:labels.text.fill%7Ccolor:0xbdbdbd&style=feature:administrative.neighborhood%7Cvisibility:off&style=feature:poi%7Celement:labels.text%7Cvisibility:off&style=feature:poi%7Celement:labels.text.fill%7Ccolor:0x757575&style=feature:poi.business%7Cvisibility:off&style=feature:poi.park%7Celement:geometry%7Ccolor:0x181818&style=feature:poi.park%7Celement:labels.text.fill%7Ccolor:0x616161&style=feature:poi.park%7Celement:labels.text.stroke%7Ccolor:0x1b1b1b&style=feature:road%7Celement:geometry.fill%7Ccolor:0x2c2c2c&style=feature:road%7Celement:labels%7Cvisibility:off&style=feature:road%7Celement:labels.text.fill%7Ccolor:0x8a8a8a&style=feature:road.arterial%7Celement:geometry%7Ccolor:0x373737&style=feature:road.highway%7Celement:geometry%7Ccolor:0x3c3c3c&style=feature:road.highway.controlled_access%7Celement:geometry%7Ccolor:0x4e4e4e&style=feature:road.local%7Celement:labels.text.fill%7Ccolor:0x616161&style=feature:transit%7Celement:labels.text.fill%7Ccolor:0x757575&style=feature:water%7Celement:geometry%7Ccolor:0x000000&style=feature:water%7Celement:labels.text%7Cvisibility:off&style=feature:water%7Celement:labels.text.fill%7Ccolor:0x3d3d3d"
        : "";
      
      // Construct the full URL
      const url = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${size}&scale=${scale}&maptype=${mapType}&${marker}&${circleParams}${mapStyle}&key=${apiKey}`;
      
      setMapUrl(url);
    }
  }, [event?.lat, event?.lng, theme, category.color]);

  return (
    <div
      className={`w-[500px] overflow-hidden rounded-2xl shadow-xl flex flex-col relative`}
      style={{ 
        backgroundColor: bgColor,
        color: textColor,
        border: `2px solid ${borderColor}`,
        fontFamily: 'Inter, sans-serif',
        height: '650px'
      }}
      id="share-card-root"
    >
      {/* Event title and logo header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: borderColor }}>
        <h1 className="text-2xl font-bold truncate flex-1" style={{ color: textColor }}>
          {event.title}
        </h1>
        <div className="ml-3">
          <TodoEventsLogo theme={theme} />
        </div>
      </div>
      
      {/* Map image */}
      <div className="w-full h-48 bg-gray-200 relative">
        {mapUrl ? (
          <img 
            src={mapUrl} 
            alt="Event location map"
            className="w-full h-full object-cover"
            onLoad={() => setIsMapLoaded(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: theme === "dark" ? "#333" : "#eee" }}>
            <p style={{ color: secondaryTextColor }}>Map loading...</p>
          </div>
        )}
        
        {/* Category badge overlaid on map */}
        <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full flex items-center gap-2" 
             style={{ backgroundColor: bgColor, borderColor: borderColor, border: '1px solid' }}>
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color || "#FFEC3A" }}></span>
          <span className="font-semibold text-sm">{category.label || event.category}</span>
        </div>
      </div>
      
      {/* Event details */}
      <div className="p-5 flex-1">
        <div className="flex flex-col gap-4">
          {/* Date and time */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full" style={{ backgroundColor: theme === "dark" ? "#2563eb33" : "#dbeafe" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" 
                  stroke={theme === "dark" ? "#3b82f6" : "#2563eb"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-lg" style={{ color: textColor }}>
              {formatDate(event.date, event.time)}
            </span>
          </div>
          
          {/* Location */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full" style={{ backgroundColor: theme === "dark" ? "#e11d4833" : "#fee2e2" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" 
                  stroke={theme === "dark" ? "#e11d48" : "#be123c"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 22C12 22 20 18 20 10.5C20 6.36 16.42 3 12 3C7.58 3 4 6.36 4 10.5C4 18 12 22 12 22Z" 
                  stroke={theme === "dark" ? "#e11d48" : "#be123c"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ color: textColor }}>
              {event.address}
            </span>
          </div>
          
          {/* Event description (shortened) */}
          <div className="mt-2">
            <p className="text-sm line-clamp-3" style={{ color: secondaryTextColor }}>
              {event.description || "Join us for this exciting event!"}
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer with branding */}
      <div className="px-5 py-4 border-t" style={{ borderColor: borderColor }}>
        <div className="flex flex-col items-center">
          <p className="text-sm mb-1" style={{ color: secondaryTextColor }}>
            Discover more local events at
          </p>
          <p className="text-xl font-bold" style={{ color: "#FFEC3A" }}>
            todo-events.com
          </p>
          <p className="text-xs mt-3" style={{ color: secondaryTextColor }}>
            Event ID: {event.id} • 5-mile radius highlighted
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShareCard; 