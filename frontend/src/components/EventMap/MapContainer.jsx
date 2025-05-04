// src/components/EventMap/MapContainer.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import categories from './categoryConfig';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
const DEFAULT_ZOOM = 4;

const createMarkerIcon = (categoryId) => {
  const category = categories.find(cat => cat.id === categoryId) || categories[0];
  
  if (category.markerSVG) {
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(category.markerSVG)}`,
      scaledSize: new google.maps.Size(40, 50),
      anchor: new google.maps.Point(20, 50)
    };
  }

  return {
    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    fillColor: category.markerColor || '#6B7280',
    fillOpacity: 1,
    strokeColor: 'white',
    strokeWeight: 2,
    scale: 7
  };
};

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

  // Initialize map
  useEffect(() => {
    let timeoutId;

    const initMap = async () => {
      try {
        const loader = new Loader({
          apiKey: GOOGLE_MAPS_API_KEY,
          version: 'weekly',
          libraries: ['places']
        });

        await loader.load();

        await new Promise(resolve => {
          timeoutId = setTimeout(resolve, 100);
        });

        if (!mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: mapCenter || DEFAULT_CENTER,
          zoom: mapCenter ? 13 : DEFAULT_ZOOM,
          styles: [
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
          ],
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false
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

      proximityCircleRef.current = new google.maps.Circle({
        strokeColor: '#FFFFFF',
        strokeOpacity: 0.3,
        strokeWeight: 2,
        fillColor: '#FFFFFF',
        fillOpacity: 0.1,
        map: map,
        center: mapCenter,
        radius: proximityRange * 1609.34
      });
    } else if (proximityCircleRef.current) {
      proximityCircleRef.current.setMap(null);
      proximityCircleRef.current = null;
    }
  }, [mapCenter, proximityRange]);

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
      // Category filter
      const categoryMatch = selectedCategory === 'all' || event.category === selectedCategory;
      
      // Date filter
      const dateMatch = isDateInRange(event.date, selectedDate);

      // Location validation
      const hasValidLocation = event?.lat && event?.lng;

      return categoryMatch && dateMatch && hasValidLocation;
    });

    const markers = validEvents.map(event => {
      const marker = new google.maps.Marker({
        position: { lat: event.lat, lng: event.lng },
        map: mapInstanceRef.current,
        icon: createMarkerIcon(event.category),
        optimized: true
      });

      marker.addListener('click', () => {
        onEventClick?.(event);
      });

      return marker;
    });

    markersRef.current = markers;

    if (markers.length > 0) {
      clustererRef.current = new MarkerClusterer({
        map: mapInstanceRef.current,
        markers: markers,
        renderer: {
          render: ({ count, position }) => {
            return new google.maps.Marker({
              position,
              label: {
                text: String(count),
                color: 'white',
                fontSize: '13px',
                fontWeight: '600'
              },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: 'rgba(25, 118, 210, 0.9)',
                fillOpacity: 0.9,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: Math.min(10 + Math.log2(count) * 2, 22),
              },
              zIndex: Number.MAX_SAFE_INTEGER,
            });
          },
        },
      });
    }
  }, [events, selectedCategory, selectedDate]);

  return (
    <div className="relative h-full w-full bg-[#0A1A2F]">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0A1A2F]">
          <div className="text-white text-lg">Loading map...</div>
        </div>
      )}
      <div ref={mapRef} className="absolute inset-0" />
    </div>
  );
});

export default MapContainer;