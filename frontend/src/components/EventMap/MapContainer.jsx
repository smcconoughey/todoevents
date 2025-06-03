// src/components/EventMap/MapContainer.jsx
import React, { useEffect, useRef, useState, useContext } from 'react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import categories from './categoryConfig';
import { initGoogleMaps } from '@/googleMapsLoader';
import { ThemeContext, THEME_DARK, THEME_LIGHT } from '@/components/ThemeContext';
import { createMarkerIcon, createClusterIcon } from './markerUtils';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
const DEFAULT_ZOOM = 4;

// Dark mode map styles
const darkMapStyles = [
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#FFFFFF" }]
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#000000" }]
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#0A1A2F" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0F4C81" }]
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }]
  }
];

// Light mode map styles with mint green accents
const lightMapStyles = [
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#2D3E36" }]
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#F8F9F3" }]
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#E8F0E6" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#97CDC3" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#FFFFFF" }]
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#52B788" }]
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#D1E6CF" }]
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "on" }]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#52B788" }]
  }
];

const normalizeDate = (date) => {
  if (!date) return null;
  // Create date at noon to avoid timezone issues
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
};

const isDateInRange = (dateStr, range) => {
  if (!range || (!range.from && !range.to)) return true;

  // Parse the event date string and normalize it
  const eventDate = normalizeDate(new Date(dateStr));
  
  if (range.from) {
    const fromDate = normalizeDate(range.from);
    if (range.to) {
      const toDate = normalizeDate(range.to);
      return eventDate >= fromDate && eventDate <= toDate;
    }
    return eventDate.getTime() === fromDate.getTime();
  }
  return true;
};

// Add function to check if an event has passed
const isEventPast = (event) => {
  if (!event || !event.date) return false;
  
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    
    // If the event has an end date, use that for comparison
    if (event.end_date) {
      const endDate = new Date(event.end_date);
      endDate.setHours(23, 59, 59, 999); // End of the end date
      return endDate < now;
    }
    
    // If no end date, check if the event date has passed
    const eventDate = new Date(event.date);
    eventDate.setHours(23, 59, 59, 999); // End of the event date
    return eventDate < now;
  } catch (error) {
    console.warn('Error checking if event is past:', error);
    return false; // Don't filter out events if we can't determine
  }
};

const MapContainer = React.forwardRef(({
  events = [],
  onEventClick,
  selectedCategory,
  mapCenter,
  proximityRange,
  selectedEvent,
  currentUser,
  selectedDate,
}, ref) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const clustererRef = useRef(null);
  const proximityCircleRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const resizeObserverRef = useRef(null);
  
  // Get current theme from context
  const { theme } = useContext(ThemeContext);
  const isDarkMode = theme === THEME_DARK;

  // Reset view functionality
  React.useImperativeHandle(ref, () => ({
    resetView: () => {
      if (mapInstanceRef.current) {
        if (proximityCircleRef.current) {
          proximityCircleRef.current.setMap(null);
          proximityCircleRef.current = null;
        }
        mapInstanceRef.current.setZoom(DEFAULT_ZOOM);
        setTimeout(() => {
          mapInstanceRef.current.setCenter(DEFAULT_CENTER);
        }, 50);
      }
    }
  }));

  // Update map styles when theme changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      console.log("Updating map styles to:", isDarkMode ? "dark mode" : "light mode");
      mapInstanceRef.current.setOptions({
        styles: isDarkMode ? darkMapStyles : lightMapStyles
      });
    }
  }, [theme]);

  // Initialize map
  useEffect(() => {
    let timeoutId;

    const initMap = async () => {
      try {
        // Use the shared loader instead of creating a new one
        await initGoogleMaps(GOOGLE_MAPS_API_KEY);

        if (!mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: mapCenter || DEFAULT_CENTER,
          zoom: mapCenter ? 13 : DEFAULT_ZOOM,
          styles: isDarkMode ? darkMapStyles : lightMapStyles,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy"
        });

        mapInstanceRef.current = map;

        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
        }

        resizeObserverRef.current = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            google.maps.event.trigger(map, 'resize');
          }
        });

        resizeObserverRef.current.observe(mapRef.current);

        setTimeout(() => {
          google.maps.event.trigger(map, 'resize');
        }, 200);

        setIsLoading(false);
      } catch (error) {
        console.error('Map initialization failed:', error);
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (mapInstanceRef.current) {
        google.maps.event.clearInstanceListeners(mapInstanceRef.current);
      }
    };
  }, []);

  // Handle map center and zoom updates
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (mapCenter) {
      const map = mapInstanceRef.current;
      map.panTo(mapCenter);
      
      const zoomLevels = {
        1: 15,
        5: 13,
        15: 11,
        30: 10
      };

      map.setZoom(zoomLevels[proximityRange] || 13);

      if (proximityCircleRef.current) {
        proximityCircleRef.current.setMap(null);
      }

      // Adjust proximity circle color based on theme
      const circleColors = isDarkMode ? {
        stroke: '#FFFFFF',
        fill: '#FFFFFF'
      } : {
        stroke: '#52B788',
        fill: '#52B788'
      };

      proximityCircleRef.current = new google.maps.Circle({
        strokeColor: circleColors.stroke,
        strokeOpacity: 0.3,
        strokeWeight: 2,
        fillColor: circleColors.fill,
        fillOpacity: 0.1,
        map: map,
        center: mapCenter,
        radius: proximityRange * 1609.34
      });
    } else if (proximityCircleRef.current) {
      proximityCircleRef.current.setMap(null);
      proximityCircleRef.current = null;
    }
  }, [mapCenter, proximityRange, theme]);

  // Handle event markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    markersRef.current.forEach(marker => {
      if (marker.infoWindow) {
        marker.infoWindow.close();
      }
      marker.setMap(null);
    });
    markersRef.current = [];

    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }

    const validEvents = events.filter(event => {
      // Filter out past events
      if (isEventPast(event)) return false;
      
      // Category filter - handle both array and string formats
      let categoryMatch;
      if (Array.isArray(selectedCategory)) {
        categoryMatch = selectedCategory.includes('all') || selectedCategory.includes(event.category);
      } else {
        // Fallback for old string format
        categoryMatch = selectedCategory === 'all' || event.category === selectedCategory;
      }
      
      // Date filter
      const dateMatch = isDateInRange(event.date, selectedDate);

      // Location validation
      const hasValidLocation = event?.lat && event?.lng;

      return categoryMatch && dateMatch && hasValidLocation;
    });

    // Group events by category for the cluster renderer
    const eventsByCategory = {};
    validEvents.forEach(event => {
      const categoryId = event.category || 'all';
      if (!eventsByCategory[categoryId]) {
        eventsByCategory[categoryId] = [];
      }
      eventsByCategory[categoryId].push(event);
    });

    const markers = validEvents.map(event => {
      // Find the category for this event
      const eventCategory = categories.find(cat => cat.id === event.category) || categories[0];
      
      const marker = new google.maps.Marker({
        position: { lat: event.lat, lng: event.lng },
        map: mapInstanceRef.current,
        icon: createMarkerIcon(eventCategory.id, true, theme),
        optimized: true,
        title: event.title, // Add hover title for better UX
        zIndex: event.id // Use event ID for z-index to prioritize newer events
      });

      // Add click listener to show event details
      marker.addListener('click', () => {
        onEventClick?.(event);
      });

      // Store event category with marker for cluster rendering
      marker.category = eventCategory;

      return marker;
    });

    markersRef.current = markers;

    if (markers.length > 0) {
      // Use our custom cluster renderer with category-based colors
      clustererRef.current = new MarkerClusterer({
        map: mapInstanceRef.current,
        markers: markers,
        renderer: {
          render: ({ count, position, markers }) => {
            // Extract unique categories from the clustered markers
            const markerCategories = markers.map(marker => marker.category)
              .filter((cat, index, self) => 
                index === self.findIndex(c => c.id === cat.id)
              );
            
            // Create a cluster marker
            const clusterIcon = createClusterIcon(count, markerCategories.map(cat => cat.id), theme);
            
            // Check if we're using icon-only markers (they won't need labels)
            const isIconOnlyMode = clusterIcon.url && clusterIcon.url.includes('width="44"');
            
            return new google.maps.Marker({
              position,
              // Only show label for non-icon-only clusters
              label: isIconOnlyMode ? null : {
                text: String(count),
                color: 'black',
                fontSize: '13px',
                fontWeight: 'bold'
              },
              icon: clusterIcon,
              zIndex: Number.MAX_SAFE_INTEGER,
            });
          },
        },
      });
    }
  }, [events, selectedCategory, selectedDate, theme]);

  // Determine background color based on theme
  const bgColor = isDarkMode ? 'bg-[#0A1A2F]' : 'bg-[#E8F0E6]';

  return (
    <div className={`relative h-full w-full ${bgColor}`}>
      {isLoading && (
        <div className={`absolute inset-0 flex items-center justify-center ${bgColor}`}>
          <div className="text-primary text-lg">Loading map...</div>
        </div>
      )}
      <div ref={mapRef} className="absolute inset-0" />
    </div>
  );
});

export default MapContainer;