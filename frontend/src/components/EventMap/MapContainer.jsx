// src/components/EventMap/MapContainer.jsx
import React, { useEffect, useRef, useState, useContext } from 'react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import categories from './categoryConfig';
import { initGoogleMaps } from '@/googleMapsLoader';
import { ThemeContext, THEME_DARK, THEME_LIGHT, MAP_TYPE_ROADMAP, MAP_TYPE_SATELLITE } from '@/components/ThemeContext';
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
    stylers: [{ visibility: "off" }]
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
      const endDate = normalizeDate(event.end_date);
      endDate.setHours(23, 59, 59, 999); // End of the end date
      return endDate < now;
    }
    
    // If no end date, check if the event date has passed
    const eventDate = normalizeDate(event.date);
    eventDate.setHours(23, 59, 59, 999); // End of the event date
    return eventDate < now;
  } catch (error) {
    console.warn('Error checking if event is past:', error);
    return false; // Don't filter out events if we can't determine
  }
};

// Function to add slight random offsets to events at the same location
const addPositionOffsets = (events) => {
  // Group events by their exact coordinates
  const locationGroups = {};
  
  events.forEach(event => {
    if (event.lat && event.lng) {
      const locationKey = `${event.lat.toFixed(6)}_${event.lng.toFixed(6)}`;
      if (!locationGroups[locationKey]) {
        locationGroups[locationKey] = [];
      }
      locationGroups[locationKey].push(event);
    }
  });
  
  // Add offsets to events that share the same location
  return events.map(event => {
    if (!event.lat || !event.lng) return event;
    
    const locationKey = `${event.lat.toFixed(6)}_${event.lng.toFixed(6)}`;
    const eventsAtLocation = locationGroups[locationKey];
    
    // If only one event at this location, no offset needed
    if (eventsAtLocation.length === 1) {
      return event;
    }
    
    // Find this event's index in the group
    const eventIndex = eventsAtLocation.findIndex(e => e.id === event.id);
    
    // Create a deterministic but seemingly random offset based on event ID
    // This ensures the same event always gets the same offset
    const seed = event.id || 0;
    const pseudoRandom1 = ((seed * 9301 + 49297) % 233280) / 233280;
    const pseudoRandom2 = ((seed * 9301 + 49297 + 1) % 233280) / 233280;
    
    // Create small offsets in a circle pattern around the original location
    // Use very small values to keep events visually grouped but individually clickable
    const offsetRadius = 0.0004; // About 40-60 meters at most latitudes
    const angle = (eventIndex / eventsAtLocation.length) * 2 * Math.PI + (pseudoRandom1 * 0.5);
    const distance = offsetRadius * (0.3 + pseudoRandom2 * 0.7); // Vary distance slightly
    
    const latOffset = distance * Math.cos(angle);
    const lngOffset = distance * Math.sin(angle);
    
    return {
      ...event,
      lat: event.lat + latOffset,
      lng: event.lng + lngOffset,
      originalLat: event.lat, // Keep original coordinates for reference
      originalLng: event.lng
    };
  });
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
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [mapBounds, setMapBounds] = useState(null);
  const resizeObserverRef = useRef(null);
  const boundsTimeoutRef = useRef(null);
  const zoomTimeoutRef = useRef(null);
  const lastUserZoomRef = useRef(DEFAULT_ZOOM);
  const isUserZoomingRef = useRef(false);
  
  // Get current theme from context
  const { theme, mapType } = useContext(ThemeContext);
  const isDarkMode = theme === THEME_DARK;

  // Performance optimization: filter events based on zoom level and viewport
  const getOptimizedEvents = (events, zoom, bounds) => {
    // Base event filtering (past events, category, date) - NO zoom-based optimization
    const baseFilteredEvents = events.filter(event => {
      // Filter out past events
      if (isEventPast(event)) return false;
      
      // Category filter - handle both array and string formats
      let categoryMatch;
      if (Array.isArray(selectedCategory)) {
        categoryMatch = selectedCategory.includes('all') || selectedCategory.includes(event.category);
      } else {
        categoryMatch = selectedCategory === 'all' || event.category === selectedCategory;
      }
      
      // Date filter
      const dateMatch = isDateInRange(event.date, selectedDate);

      // Location validation
      const hasValidLocation = event?.lat && event?.lng;

      return categoryMatch && dateMatch && hasValidLocation;
    });

    // Only apply viewport filtering for very high zoom levels (>12) to reduce rendering load
    if (zoom > 12 && bounds && baseFilteredEvents.length > 1500) {
      const viewportEvents = baseFilteredEvents.filter(event => {
        const eventLatLng = new google.maps.LatLng(event.lat, event.lng);
        return bounds.contains(eventLatLng);
      });
      
      // Only use viewport filtering if it actually reduces the count significantly
      if (viewportEvents.length < baseFilteredEvents.length * 0.7) {
        return viewportEvents;
      }
    }
    
    // Return all filtered events - let clustering handle the display optimization
    return baseFilteredEvents;
  };

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

  // Update map styles and type when theme or map type changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      console.log("Updating map to:", mapType, isDarkMode ? "dark mode" : "light mode");
      
      const mapOptions = {
        mapTypeId: mapType === MAP_TYPE_SATELLITE ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP,
      };

      // Only apply custom styles for roadmap mode
      if (mapType === MAP_TYPE_ROADMAP) {
        mapOptions.styles = isDarkMode ? darkMapStyles : lightMapStyles;
      } else {
        // Remove custom styles for hybrid/satellite mode
        mapOptions.styles = [];
      }

      mapInstanceRef.current.setOptions(mapOptions);
    }
  }, [theme, mapType]);

  // Initialize map
  useEffect(() => {
    let timeoutId;

    const initMap = async () => {
      try {
        // Use the shared loader instead of creating a new one
        await initGoogleMaps(GOOGLE_MAPS_API_KEY);

        if (!mapRef.current) return;

        // Configure map options based on theme and map type
        const mapOptions = {
          center: mapCenter || DEFAULT_CENTER,
          zoom: mapCenter ? 13 : DEFAULT_ZOOM,
          mapTypeId: mapType === MAP_TYPE_SATELLITE ? google.maps.MapTypeId.HYBRID : google.maps.MapTypeId.ROADMAP,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
          // Prevent auto-zoom behaviors that cause snapping
          disableDoubleClickZoom: false,
          scrollwheel: true,
          // Add zoom constraints to prevent extreme zooming
          minZoom: 1,
          maxZoom: 18,
          // Disable auto-pan and auto-zoom behaviors
          panControl: false,
          zoomControl: true,
          scaleControl: false
        };

        // Only apply custom styles for roadmap mode, hybrid/satellite mode shows labels and borders by default
        if (mapType === MAP_TYPE_ROADMAP) {
          mapOptions.styles = isDarkMode ? darkMapStyles : lightMapStyles;
        }

        const map = new google.maps.Map(mapRef.current, mapOptions);

        mapInstanceRef.current = map;

        // Simple zoom change listener with basic debouncing
        map.addListener('zoom_changed', () => {
          if (zoomTimeoutRef.current) {
            clearTimeout(zoomTimeoutRef.current);
          }
          
          zoomTimeoutRef.current = setTimeout(() => {
            const newZoom = map.getZoom();
            const zoomDiff = Math.abs(newZoom - currentZoom);
            
            // Update zoom if it changed significantly
            if (zoomDiff > 0.1) {
              setCurrentZoom(newZoom);
            }
          }, 150);
        });

        // Add bounds change listener for viewport-based filtering
        map.addListener('bounds_changed', () => {
          // Debounce bounds changes to prevent excessive re-rendering
          if (boundsTimeoutRef.current) {
            clearTimeout(boundsTimeoutRef.current);
          }
          
          boundsTimeoutRef.current = setTimeout(() => {
            const bounds = map.getBounds();
            setMapBounds(bounds);
          }, 200); // 200ms debounce for bounds (longer than zoom)
        });

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
      if (boundsTimeoutRef.current) clearTimeout(boundsTimeoutRef.current);
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (proximityCircleRef.current) {
        proximityCircleRef.current.setMap(null);
        proximityCircleRef.current = null;
      }
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
      if (markersRef.current) {
        markersRef.current.forEach(marker => {
          marker.setMap(null);
        });
        markersRef.current = [];
      }
      if (mapInstanceRef.current) {
        google.maps.event.clearInstanceListeners(mapInstanceRef.current);
        mapInstanceRef.current = null;
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

    const validEvents = getOptimizedEvents(events, currentZoom, mapBounds);
    
    // Add position offsets to prevent stacking of events at the same location
    const eventsWithOffsets = addPositionOffsets(validEvents);

    console.log(`Map performance: Zoom ${currentZoom}, rendering ${validEvents.length}/${events.length} events`);

    const markers = eventsWithOffsets.map(event => {
      // Find the category for this event
      const eventCategory = categories.find(cat => cat.id === event.category) || categories[0];
      
      // Use light theme for pins when in satellite mode for better visibility
      const pinTheme = mapType === MAP_TYPE_SATELLITE ? THEME_LIGHT : theme;
      
      const marker = new google.maps.Marker({
        position: { lat: event.lat, lng: event.lng },
        map: mapInstanceRef.current,
        icon: createMarkerIcon(eventCategory.id, true, pinTheme, event.verified || event.is_premium_event),
        optimized: true,
        title: event.title,
        zIndex: event.id
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
      // Simple, static clustering configuration to prevent auto-zoom behaviors
      const clusterOptions = {
        map: mapInstanceRef.current,
        markers: markers,
        // Static clustering settings that don't change based on zoom
        gridSize: 60,           // Fixed grid size
        maxZoom: 15,            // Never cluster above zoom 15
        minimumClusterSize: 2,  // Always cluster 2+ markers
        renderer: {
          render: ({ count, position, markers }) => {
            // Get ALL category IDs from markers for proper cluster rendering
            const allMarkerCategoryIds = markers.map(marker => marker.category.id);
            
            // Create a cluster marker with proper category passing
            const clusterIcon = createClusterIcon(count, allMarkerCategoryIds, theme);
            
            const marker = new google.maps.Marker({
              position,
              icon: clusterIcon,
              zIndex: Number.MAX_SAFE_INTEGER,
            });
            
            // No labels for clean icon-only appearance
            marker.setLabel(null);
            
            return marker;
          },
        },
      };

      clustererRef.current = new MarkerClusterer(clusterOptions);
    }
  }, [events, selectedCategory, selectedDate, theme, currentZoom, mapBounds]);

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