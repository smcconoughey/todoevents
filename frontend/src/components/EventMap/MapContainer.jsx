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
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [mapBounds, setMapBounds] = useState(null);
  const resizeObserverRef = useRef(null);
  const boundsTimeoutRef = useRef(null);
  const zoomTimeoutRef = useRef(null);
  const lastUserZoomRef = useRef(DEFAULT_ZOOM);
  const isUserZoomingRef = useRef(false);
  
  // Get current theme from context
  const { theme } = useContext(ThemeContext);
  const isDarkMode = theme === THEME_DARK;

  // Performance optimization: filter events based on zoom level and viewport
  const getOptimizedEvents = (events, zoom, bounds) => {
    // Base event filtering (past events, category, date)
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

    // Much more gradual optimization to prevent zoom snapping
    const totalEvents = baseFilteredEvents.length;
    
    // Always show at least verified events to maintain visual consistency
    const verifiedEvents = baseFilteredEvents.filter(event => event.verified);
    
    // Very gradual percentage increase based on zoom (no abrupt changes)
    let percentage;
    if (zoom < 4) {
      percentage = 0.25; // 25%
    } else if (zoom < 5) {
      percentage = 0.35; // 35%
    } else if (zoom < 6) {
      percentage = 0.45; // 45%
    } else if (zoom < 7) {
      percentage = 0.55; // 55%
    } else if (zoom < 8) {
      percentage = 0.65; // 65%
    } else if (zoom < 9) {
      percentage = 0.75; // 75%
    } else if (zoom < 10) {
      percentage = 0.85; // 85%
    } else if (zoom < 11) {
      percentage = 0.95; // 95%
    } else {
      // Very close zoom: show all events, but limit to viewport if too many
      if (bounds && totalEvents > 1000) {
        const viewportEvents = baseFilteredEvents.filter(event => {
          const eventLatLng = new google.maps.LatLng(event.lat, event.lng);
          return bounds.contains(eventLatLng);
        });
        return viewportEvents.length > 0 ? viewportEvents : baseFilteredEvents.slice(0, 1000);
      }
      return baseFilteredEvents;
    }
    
    // Calculate target count with minimum to always show verified events
    const targetCount = Math.max(
      verifiedEvents.length, // Always show all verified events
      Math.min(1000, Math.floor(totalEvents * percentage))
    );
    
    // If we're showing less than total, use stable sampling
    if (targetCount < totalEvents) {
      // Always include all verified events first
      const nonVerifiedEvents = baseFilteredEvents.filter(event => !event.verified);
      const remainingSlots = targetCount - verifiedEvents.length;
      
      if (remainingSlots > 0) {
        // Use stable sampling for remaining slots
        const sampledNonVerified = nonVerifiedEvents
          .sort((a, b) => (a.id * 9301 + a.lat * 49297) % 233280 - (b.id * 9301 + b.lat * 49297) % 233280)
          .slice(0, remainingSlots);
        
        return [...verifiedEvents, ...sampledNonVerified];
      }
      
      return verifiedEvents;
    }
    
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
          gestureHandling: "greedy",
          // Prevent auto-zoom behaviors that cause snapping
          disableDoubleClickZoom: false,
          scrollwheel: true,
          // Add zoom constraints to prevent extreme zooming
          minZoom: 2,
          maxZoom: 18,
          // Disable auto-pan and auto-zoom behaviors
          panControl: false,
          zoomControl: true,
          scaleControl: false
        });

        mapInstanceRef.current = map;

        // Track user zoom interactions to prevent auto-zoom interference
        map.addListener('dragstart', () => {
          isUserZoomingRef.current = true;
        });
        
        map.addListener('dragend', () => {
          setTimeout(() => {
            isUserZoomingRef.current = false;
          }, 500);
        });

        // Track scroll wheel zoom
        mapRef.current.addEventListener('wheel', () => {
          isUserZoomingRef.current = true;
          setTimeout(() => {
            isUserZoomingRef.current = false;
          }, 1000);
        }, { passive: true });

        // Comprehensive zoom change listener with stability guards
        map.addListener('zoom_changed', () => {
          // Mark as user interaction if zoom controls are being used
          const zoomControlElements = mapRef.current?.querySelectorAll('[data-control-api-key]');
          if (zoomControlElements?.length > 0) {
            isUserZoomingRef.current = true;
            setTimeout(() => {
              isUserZoomingRef.current = false;
            }, 1000);
          }
          
          // Debounce zoom changes to prevent excessive re-rendering
          if (zoomTimeoutRef.current) {
            clearTimeout(zoomTimeoutRef.current);
          }
          
          zoomTimeoutRef.current = setTimeout(() => {
            const newZoom = map.getZoom();
            
            // Prevent extreme zoom changes that could be auto-zoom behavior
            const zoomDiff = Math.abs(newZoom - currentZoom);
            
            // If it's a very large zoom change (>3 levels) and user isn't actively zooming,
            // it might be auto-zoom behavior - prevent it
            if (zoomDiff > 3 && !isUserZoomingRef.current) {
              console.log('Preventing potential auto-zoom snap from', currentZoom, 'to', newZoom);
              // Restore the previous zoom level
              map.setZoom(currentZoom);
              return;
            }
            
            // Only update if zoom actually changed significantly
            if (zoomDiff > 0.1) {
              lastUserZoomRef.current = newZoom;
              setCurrentZoom(newZoom);
            }
          }, 150); // 150ms debounce for zoom changes
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

    const validEvents = getOptimizedEvents(events, currentZoom, mapBounds);

    console.log(`Map performance: Zoom ${currentZoom}, rendering ${validEvents.length}/${events.length} events`);

    const markers = validEvents.map(event => {
      // Find the category for this event
      const eventCategory = categories.find(cat => cat.id === event.category) || categories[0];
      
      const marker = new google.maps.Marker({
        position: { lat: event.lat, lng: event.lng },
        map: mapInstanceRef.current,
        icon: createMarkerIcon(eventCategory.id, true, theme),
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
      // Use adaptive clustering based on zoom level with smoother transitions
      const clusterOptions = {
        map: mapInstanceRef.current,
        markers: markers,
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

      // Much smoother clustering progression to prevent jarring transitions
      if (currentZoom < 4) {
        // Very aggressive clustering for world view
        clusterOptions.gridSize = 100;
        clusterOptions.maxZoom = 5;
        clusterOptions.minimumClusterSize = 3;
      } else if (currentZoom < 6) {
        // High clustering for continental view
        clusterOptions.gridSize = 80;
        clusterOptions.maxZoom = 7;
        clusterOptions.minimumClusterSize = 3;
      } else if (currentZoom < 8) {
        // Moderate clustering for regional view
        clusterOptions.gridSize = 70;
        clusterOptions.maxZoom = 9;
        clusterOptions.minimumClusterSize = 2;
      } else if (currentZoom < 10) {
        // Light clustering for city view
        clusterOptions.gridSize = 60;
        clusterOptions.maxZoom = 11;
        clusterOptions.minimumClusterSize = 2;
      } else if (currentZoom < 12) {
        // Very light clustering for neighborhood view
        clusterOptions.gridSize = 50;
        clusterOptions.maxZoom = 13;
        clusterOptions.minimumClusterSize = 2;
      } else {
        // Minimal clustering for street view
        clusterOptions.gridSize = 40;
        clusterOptions.maxZoom = 15;
        clusterOptions.minimumClusterSize = 2;
      }

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