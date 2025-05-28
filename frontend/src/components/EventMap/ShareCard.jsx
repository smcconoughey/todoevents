import React, { useContext, useEffect, useState } from "react";
import { ThemeContext } from "../ThemeContext";
import { getCategory } from "./categoryConfig";

// Custom logo component - Replace with your actual logo
// User can import their own logo image here
const TodoEventsLogo = ({ theme, className = "" }) => (
  <svg width="48" height="48" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
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

  // Generate Google Maps Static API URL with a custom marker showing the category icon
  useEffect(() => {
    if (event?.lat && event?.lng) {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      
      // Parameters for the Static Maps API
      const center = `${event.lat},${event.lng}`;
      const zoom = 13;
      const size = "500x250"; // Larger map for better appearance
      const scale = 2; // For higher resolution
      const mapType = "roadmap";
      
      // To show the actual category icon on the map, we need to create a custom marker
      // This requires creating an SVG icon that includes the category's icon
      // For this we'll need to get the actual SVG path of the icon (e.g., fire)
      
      // Get category color for styling
      const categoryColor = category.color?.replace('#', '') || "FFEC3A";
      
      // We'll use the category's actual icon when possible
      // Here we'll use a simple example (e.g., for fire icon for "cookout")
      // In production, this should be customized for each category
      
      // Custom marker SVG for "cookout" (fire) category
      const getCategoryIconSVG = () => {
        // Use category ID to determine which icon to use
        switch(category.id) {
          case 'food-drink':
            // Fork and knife icon
            return `
              <path d="M7 3V21M14 3V21M7 3H14M7 21H14M14 8C14 8 18 9 18 12C18 15 14 16 14 16" 
                    stroke="${categoryColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            `;
          case 'music':
            // Music note icon
            return `
              <path d="M9 18V5L21 3V16M9 18C9 19.1046 7.88071 20 6.5 20C5.11929 20 4 19.1046 4 18C4 16.8954 5.11929 16 6.5 16C7.88071 16 9 16.8954 9 18ZM21 16C21 17.1046 19.8807 18 18.5 18C17.1193 18 16 17.1046 16 16C16 14.8954 17.1193 14 18.5 14C19.8807 14 21 14.8954 21 16Z" 
                    stroke="${categoryColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            `;
          case 'arts':
            // Paintbrush icon
            return `
              <path d="M20 10C20 13.3137 17.3137 16 14 16C12.4633 16 11.0615 15.4223 10 14.4722C8.93854 15.4223 7.53665 16 6 16C2.68629 16 0 13.3137 0 10C0 6.68629 2.68629 4 6 4H14C17.3137 4 20 6.68629 20 10Z"
                    fill="${categoryColor}"/>
            `;
          case 'sports':
            // Trophy icon
            return `
              <path d="M8 21V16.8C8 16.8 3 16.4 3 12V5H5M16 21V16.8C16 16.8 21 16.4 21 12V5H19M12 12H12.01M5 5V3H19V5M12 12C10.9 12 10 11.1 10 10V5H14V10C14 11.1 13.1 12 12 12Z" 
                    stroke="${categoryColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            `;
          default:
            // Default (fire/cookout icon)
            return `
              <path d="M12 22C16.4183 22 20 18.4183 20 14C20 11 18 8 16 6C16 10 12.5 10.5 12 12C11.5 10.5 8 10 8 6C6 8 4 11 4 14C4 18.4183 7.58172 22 12 22Z" 
                    stroke="${categoryColor}" fill="${categoryColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            `;
        }
      };
      
      // Create a custom SVG marker with a pin and the category icon
      const customMarkerSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 24 30" fill="none" stroke="none">
          <!-- Pin Background -->
          <path d="M12 0C5.4 0 0 5.4 0 12C0 20.4 12 30 12 30C12 30 24 20.4 24 12C24 5.4 18.6 0 12 0Z" 
                fill="${theme === 'dark' ? '#2E2E2E' : '#FFFFFF'}" 
                stroke="${categoryColor}" stroke-width="1.5"/>
          
          <!-- Category Icon in center of pin -->
          <g transform="translate(0, 1) scale(0.6)">
            ${getCategoryIconSVG()}
          </g>
        </svg>
      `;
      
      // Base64 encode the SVG for the URL
      const base64Marker = btoa(customMarkerSVG);
      const marker = `markers=icon:data:image/svg+xml;base64,${base64Marker}%7C${center}`;
      
      // Circle showing 5-mile radius
      const radiusInMeters = 8047; // 5 miles ≈ 8047 meters
      const circleParams = `path=fillcolor:0x${categoryColor}20|strokecolor:0x${categoryColor}80|weight:2|${center}|circle:${radiusInMeters}`;
      
      // Improved style parameters to hide business names and POIs
      const baseStyles = [
        // Hide all POI labels
        "feature:poi|element:labels|visibility:off",
        // Hide business names
        "feature:poi.business|visibility:off",
        // Hide transit stations
        "feature:transit|element:labels|visibility:off",
        // Simplify road labels
        "feature:road|element:labels|visibility:simplified",
        // Remove neighborhood labels
        "feature:administrative.neighborhood|visibility:off"
      ];
      
      // Dark mode specific styles
      const darkStyles = [
        "element:geometry|color:0x212121",
        "element:labels.text.fill|color:0x757575",
        "element:labels.text.stroke|color:0x212121",
        "feature:administrative|element:geometry|color:0x757575",
        "feature:road|element:geometry.fill|color:0x2c2c2c",
        "feature:road.arterial|element:geometry|color:0x373737",
        "feature:road.highway|element:geometry|color:0x3c3c3c",
        "feature:water|element:geometry|color:0x000000"
      ];
      
      // Light mode specific styles
      const lightStyles = [
        "feature:water|element:geometry|color:0xdee8f1",
        "feature:landscape|element:geometry.fill|color:0xf1f1f1",
        "feature:road|element:geometry|color:0xffffff"
      ];
      
      // Combine styles based on theme
      const combinedStyles = [...baseStyles, ...(theme === "dark" ? darkStyles : lightStyles)];
      
      // Create style parameters string
      const mapStyle = combinedStyles.map(style => `&style=${style}`).join('');
      
      // Construct the full URL
      const url = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${size}&scale=${scale}&maptype=${mapType}&${marker}&${circleParams}${mapStyle}&key=${apiKey}`;
      
      setMapUrl(url);
    }
  }, [event?.lat, event?.lng, theme, category]);

  return (
    <div
      className="overflow-hidden rounded-2xl shadow-xl flex flex-col relative"
      style={{ 
        backgroundColor: bgColor,
        color: textColor,
        border: `2px solid ${borderColor}`,
        fontFamily: 'Inter, sans-serif',
        width: '550px',  // Wider card for better proportions
        maxWidth: '100%' // Responsive
      }}
      id="share-card-root"
    >
      {/* Event title and logo header */}
      <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: borderColor }}>
        <h1 className="text-2xl font-bold truncate flex-1 mr-3" style={{ color: textColor }}>
          {event.title}
        </h1>
        <TodoEventsLogo theme={theme} className="flex-shrink-0" />
      </div>
      
      {/* Map image */}
      <div className="w-full h-64 bg-gray-200 relative"> {/* Taller map */}
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
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-md" 
             style={{ backgroundColor: `${bgColor}ee`, borderColor: borderColor, border: '1px solid' }}>
          {(() => {
            // Use the actual category icon component if available
            const Icon = category.icon;
            return Icon ? (
              <Icon className="w-5 h-5" style={{ color: category.color || "#FFEC3A" }} />
            ) : (
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color || "#FFEC3A" }}></span>
            );
          })()}
          <span className="font-semibold text-sm">{category.label || event.category}</span>
        </div>
      </div>
      
      {/* Event details */}
      <div className="p-6 flex-1">
        <div className="flex flex-col gap-5"> {/* Increased gap */}
          {/* Date and time */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full" style={{ backgroundColor: theme === "dark" ? "#2563eb33" : "#dbeafe" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" 
                  stroke={theme === "dark" ? "#3b82f6" : "#2563eb"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-lg font-medium" style={{ color: textColor }}>
              {formatDate(event.date, event.time)}
            </span>
          </div>
          
          {/* Location */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full" style={{ backgroundColor: theme === "dark" ? "#e11d4833" : "#fee2e2" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" 
                  stroke={theme === "dark" ? "#e11d48" : "#be123c"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 22C12 22 20 18 20 10.5C20 6.36 16.42 3 12 3C7.58 3 4 6.36 4 10.5C4 18 12 22 12 22Z" 
                  stroke={theme === "dark" ? "#e11d48" : "#be123c"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-base" style={{ color: textColor }}>
              {event.address}
            </span>
          </div>
          
          {/* Event description (shortened) */}
          <div className="mt-1">
            <p className="text-base line-clamp-3" style={{ color: secondaryTextColor }}>
              {event.description || "Join us for this exciting event!"}
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer with branding */}
      <div className="px-6 py-5 border-t" style={{ borderColor: borderColor }}>
        <div className="flex flex-col items-center">
          <p className="text-base mb-1" style={{ color: secondaryTextColor }}>
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