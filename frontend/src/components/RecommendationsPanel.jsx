import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import { 
  Calendar,
  Clock,
  MapPin,
  Star,
  Sparkles,
  Heart,
  Compass,
  Globe,
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Target,
  TrendingUp,
  Gift,
  Navigation,
  X,
  ChevronLeft,
  Search,
  Users,
  Filter,
  ChevronRight
} from 'lucide-react';
import { WebIcon } from './EventMap/WebIcons';
import { CategoryIcon } from './EventMap/CategoryIcons';
import categories, { getCategory } from './EventMap/categoryConfig';
import { API_URL } from '../config';

// Import route planner component
import RoutePlanner from './EventMap/RoutePlanner';

// Debounce helper function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

const RecommendationsPanel = ({ userLocation, onEventClick, onExploreMore, onRouteCalculated, onRouteEventsDiscovered, mapInstance, embedded = false, routeEvents = [], onClearRoute, onClose }) => {
  const { theme } = useTheme();
  const [activeMode, setActiveMode] = useState('recommendations'); // 'recommendations' or 'route'
  
  // Debug activeMode changes
  useEffect(() => {
    console.log('🎯 activeMode changed to:', activeMode);
  }, [activeMode]);
  
  // Auto-switch to route mode when route events are available
  useEffect(() => {
    if (routeEvents && routeEvents.length > 0) {
      setActiveMode('route');
    }
  }, [routeEvents]);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true); // Always open by default

  // City suggestions state
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);

  // LOCATION SYSTEM - Clear and Simple
  const [gpsLocation, setGpsLocation] = useState(null); // User's GPS coordinates
  const [manualLocation, setManualLocation] = useState(null); // User selected location (search/city)
  const [useGPS, setUseGPS] = useState(true); // Toggle between GPS and manual
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  const [lastFetchedLocation, setLastFetchedLocation] = useState('no-location');
  const [gpsRequestedThisSession, setGpsRequestedThisSession] = useState(false); // Track if GPS was already requested

  // Use refs to store current state for immediate access
  const gpsLocationRef = useRef(null);
  const manualLocationRef = useRef(null);
  const useGPSRef = useRef(true);
  const userLocationRef = useRef(null);

  // Update refs whenever state changes
  useEffect(() => {
    gpsLocationRef.current = gpsLocation;
  }, [gpsLocation]);

  useEffect(() => {
    manualLocationRef.current = manualLocation;
  }, [manualLocation]);

  useEffect(() => {
    useGPSRef.current = useGPS;
  }, [useGPS]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  // Get the active location based on user preference
  const getActiveLocation = () => {
    console.log('🎯 getActiveLocation called with state:', {
      useGPS,
      gpsLocation,
      manualLocation,
      userLocation
    });

    if (useGPS && gpsLocation) {
      console.log('✅ Using GPS location:', gpsLocation);
      return gpsLocation;
    }
    if (manualLocation) {
      console.log('✅ Using manual location:', manualLocation);
      return manualLocation;
    }
    if (userLocation) {
      console.log('✅ Using userLocation prop:', userLocation);
      return userLocation; // Fallback to prop from EventMap
    }
    console.log('❌ No location available');
    return null;
  };

  // Get active location using refs (always current)
  const getActiveLocationFromRefs = () => {
    let activeLocation = null;
    if (useGPSRef.current && gpsLocationRef.current) {
      activeLocation = gpsLocationRef.current;
    } else if (manualLocationRef.current) {
      activeLocation = manualLocationRef.current;
    } else if (userLocationRef.current) {
      activeLocation = userLocationRef.current;
    }
    
    console.log('🎯 getActiveLocationFromRefs called with refs:', {
      useGPSRef: useGPSRef.current,
      gpsLocationRef: gpsLocationRef.current,
      manualLocationRef: manualLocationRef.current,
      userLocationRef: userLocationRef.current,
      activeLocation
    });
    
    return activeLocation;
  };

  // Create a stable key for location comparison
  const getLocationKey = (location) => {
    if (!location || !location.lat || !location.lng) return 'no-location';
    return `${location.lat.toFixed(6)},${location.lng.toFixed(6)},${selectedFilter}`;
  };

  // Check if we should ask for location on first load
  useEffect(() => {
    const hasAskedBefore = localStorage.getItem('locationPermissionAsked');
    if (!hasAskedBefore && !locationPermissionAsked) {
      const timeoutId = setTimeout(() => {
        setShowLocationPopup(true);
      }, 1500);
      return () => clearTimeout(timeoutId);
    }
  }, []);

  // Request user's GPS location
  const requestGPSLocation = () => {
    setLocationPermissionAsked(true);
    localStorage.setItem('locationPermissionAsked', 'true');
    setShowLocationPopup(false);
    setIsLoadingGPS(true);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            city: 'Your current location'
          };
          setGpsLocation(location);
          setUseGPS(true); // Switch to GPS mode
          setGpsRequestedThisSession(true); // Mark as requested this session
          setIsLoadingGPS(false);
          
          // Update refs immediately
          gpsLocationRef.current = location;
          useGPSRef.current = true;
          
          console.log('📍 GPS location obtained:', location);
        },
        (error) => {
          console.log('GPS access denied or failed:', error);
          setUseGPS(false); // Fall back to manual mode
          useGPSRef.current = false;
          setIsLoadingGPS(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // Increased timeout for better reliability
          maximumAge: 1800000 // 30 minutes instead of 5 minutes to reduce frequent requests
        }
      );
    }
  };

  // Handle manual location selection (from search or city)
  const selectManualLocation = (location) => {
    console.log('📍 Selecting manual location:', location);
    const newLocation = {
      lat: location.lat,
      lng: location.lng,
      city: location.city || location.address || 'Selected location'
    };
    setManualLocation(newLocation);
    setUseGPS(false); // Switch to manual mode
    
    // Update refs immediately
    manualLocationRef.current = newLocation;
    useGPSRef.current = false;
  };

  // Toggle back to GPS
  const switchToGPS = () => {
    if (gpsLocation) {
      // If we already have GPS location, just switch to using it
      setUseGPS(true);
      useGPSRef.current = true;
      console.log('📍 Switched to existing GPS location:', gpsLocation);
    } else if (!gpsRequestedThisSession) {
      // Only request GPS if we haven't already requested it this session
      requestGPSLocation();
    } else if (gpsRequestedThisSession && !gpsLocation) {
      // GPS was requested but failed, ask user if they want to try again
      if (confirm('GPS location was not available earlier. Would you like to try again?')) {
        requestGPSLocation();
      }
    }
  };

  // Stable fetch function that uses refs
  const fetchRecommendations = useCallback(async () => {
    // Get current location from refs to avoid stale state
    const activeLocation = getActiveLocationFromRefs();
    const locationKey = getLocationKey(activeLocation);
    
    // Prevent duplicate API calls for the same location and filter
    if (locationKey === lastFetchedLocation) {
      console.log('🚫 Skipping API call - same location and filter');
      return;
    }

    console.log('📡 Making API call for location:', activeLocation);
    setLoading(true);
    setLastFetchedLocation(locationKey);

    try {
      // Map frontend filter to backend filter
      let backendFilter = selectedFilter;
      let eventLimit = 8;
      
      if (selectedFilter === 'all') {
        backendFilter = 'upcoming';
        eventLimit = 20; // Show more events for 'all' filter
      }
      
      const requestBody = {
        lat: activeLocation?.lat || null,
        lng: activeLocation?.lng || null,
        city: activeLocation?.city || null,
        time_filter: backendFilter,
        limit: eventLimit
      };

      console.log('📍 Recommendations fetch using:', requestBody);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${API_URL}/api/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Recommendations fetched successfully:', data.events?.length || 0, 'events');
        setRecommendations(data.events || []);
      } else {
        console.error('❌ Failed to fetch recommendations - HTTP status:', response.status);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('❌ Error fetching recommendations:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedFilter]); // Only depend on selectedFilter

  // Use a ref to track when we need to fetch
  const shouldFetchRef = useRef(false);
  const lastLocationKeyRef = useRef('no-location');

  // Sync with EventMap location selections - but don't trigger immediate fetch
  useEffect(() => {
    if (userLocation && userLocation.lat && userLocation.lng) {
      // EventMap has selected a location via search
      console.log('🔄 Syncing with EventMap location:', userLocation);
      selectManualLocation({
        lat: userLocation.lat,
        lng: userLocation.lng,
        city: userLocation.city || userLocation.address || 'Selected location'
      });
    }
  }, [userLocation?.lat, userLocation?.lng]); // Only trigger on coordinate changes

  // Single consolidated effect to handle all location and filter changes
  useEffect(() => {
    const activeLocation = getActiveLocationFromRefs();
    const locationKey = getLocationKey(activeLocation);
    
    // Only fetch if location or filter actually changed
    if (locationKey !== lastLocationKeyRef.current) {
      console.log('🔍 Location or filter changed:', {
        activeLocation,
        locationKey,
        lastLocationKey: lastLocationKeyRef.current
      });
      
      lastLocationKeyRef.current = locationKey;
      setLastFetchedLocation(locationKey);
      
      // Immediate fetch without setTimeout to prevent excessive delays
      fetchRecommendations();
    }
  }, [gpsLocation, manualLocation, useGPS, selectedFilter, userLocation]);

  const fetchCitySuggestions = async () => {
    setLoadingCities(true);
    try {
      const activeLocation = getActiveLocationFromRefs();
      
      const params = new URLSearchParams();
      if (activeLocation?.lat && activeLocation?.lng) {
        params.append('lat', activeLocation.lat.toString());
        params.append('lng', activeLocation.lng.toString());
      }
      params.append('limit', '8');
      params.append('max_distance', '500');

      const response = await fetch(`${API_URL}/api/recommendations/nearby-cities?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const cities = await response.json();
        setCitySuggestions(cities || []);
      } else {
        console.error('Failed to fetch city suggestions');
        setCitySuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching city suggestions:', error);
      setCitySuggestions([]);
    } finally {
      setLoadingCities(false);
    }
  };

  const handleExploreCities = async () => {
    setShowCitySuggestions(true);
    if (citySuggestions.length === 0) {
      await fetchCitySuggestions();
    }
  };

  const handleCitySelect = (city) => {
    selectManualLocation({
      lat: city.lat,
      lng: city.lng,
      city: `${city.city}, ${city.state}`
    });
    if (onExploreMore) {
      onExploreMore(city);
    }
    setShowCitySuggestions(false);
  };

  // Reset function similar to the left sidebar's handleResetView
  const handleReset = () => {
    // Reset local state
    setSelectedFilter('all');
    setGpsLocation(null);
    setManualLocation(null);
    setUseGPS(true);
    setShowCitySuggestions(false);
    setActiveMode('recommendations');
    
    // Update refs
    gpsLocationRef.current = null;
    manualLocationRef.current = null;
    useGPSRef.current = true;
    
    // Call onExploreMore with no parameters to reset the main map view
    if (onExploreMore) {
      onExploreMore(); // No city parameter = reset to show all events
    }
  };

  const formatEventDate = (event) => {
    try {
      const date = new Date(event.date);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
      } else {
        return date.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        });
      }
    } catch {
      return event.date;
    }
  };

  const formatEventTime = (event) => {
    try {
      if (!event.start_time) return '';
      const [hours, minutes] = event.start_time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return event.start_time || '';
    }
  };

  const getDistanceText = (distance) => {
    if (!distance || distance === Infinity) return '';
    if (distance < 1) return 'Very close';
    if (distance < 5) return `${distance.toFixed(1)} mi`;
    if (distance < 25) return `${Math.round(distance)} mi`;
    return 'Worth the trip';
  };

  // Memoized EventList to prevent re-renders when emotional message changes
  const EventList = React.memo(({ events, onEventClick }) => (
    <div className="space-y-3 lg:space-y-4">
      {events.map((event, index) => (
        <EventCard key={event.id} event={event} index={index} onEventClick={onEventClick} />
      ))}
    </div>
  ));

  const EventCard = React.memo(({ event, index, onEventClick }) => {
    const category = getCategory(event.category);
    const Icon = category.icon;

    return (
      <div
        className={`
          group relative overflow-hidden rounded-2xl backdrop-blur-sm
          transition-all duration-300 hover:scale-[1.02] cursor-pointer
          ${theme === 'light'
              ? 'bg-white/80 border border-gray-200 hover:bg-white/90 shadow-sm'
            : 'bg-white/5 border border-white/10 hover:bg-white/10'
          }
        `}
        onClick={() => onEventClick && onEventClick(event)}
      >
        {/* Gradient overlay */}
        <div className={`
          absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
          ${theme === 'light'
              ? 'bg-gradient-to-br from-blue-50/50 to-indigo-50/50'
            : 'bg-gradient-to-br from-spark-yellow/5 to-pin-blue/5'
          }
        `} />

        {/* Content */}
        <div className="relative p-3 lg:p-4 space-y-2 lg:space-y-3">
          {/* Header with category icon and tags */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className={`
                p-1.5 lg:p-2 rounded-xl transition-colors duration-200
                ${theme === 'light'
                    ? 'bg-blue-50 group-hover:bg-blue-100'
                  : 'bg-spark-yellow/10 group-hover:bg-spark-yellow/20'
                }
              `}>
                <Icon className={`w-3 h-3 lg:w-4 lg:h-4 ${category.color}`} />
              </div>
              <div className="flex flex-wrap gap-1">
                {event.tags?.slice(0, 2).map((tag, i) => (
                  <span
                    key={i}
                    className={`
                      px-1.5 lg:px-2 py-0.5 lg:py-1 text-xs font-medium rounded-full
                      ${theme === 'light'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-spark-yellow/20 text-spark-yellow border border-spark-yellow/30'
                      }
                    `}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Event title */}
          <h3 className={`
            font-display font-semibold text-base lg:text-lg leading-tight line-clamp-2 
            transition-colors duration-200
            ${theme === 'light'
              ? 'text-gray-900 group-hover:text-blue-600'
              : 'text-white group-hover:text-spark-yellow'
            }
          `}>
            {event.title}
          </h3>

          {/* Event details */}
          <div className={`
            space-y-1.5 lg:space-y-2 text-xs lg:text-sm
            ${theme === 'light' ? 'text-gray-600' : 'text-white/70'}
          `}>
            <div className="flex items-center gap-1.5 lg:gap-2">
              <Calendar className={`
                w-3 h-3 lg:w-4 lg:h-4
                ${theme === 'light' ? 'text-blue-500' : 'text-pin-blue'}
              `} />
              <span className="font-medium">
                {formatEventDate(event)}
                {formatEventTime(event) && (
                  <>
                    <span className={`mx-1 ${theme === 'light' ? 'text-gray-400' : 'text-white/50'}`}>•</span>
                    {formatEventTime(event)}
                  </>
                )}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 lg:gap-2">
              <MapPin className={`
                w-3 h-3 lg:w-4 lg:h-4
                ${theme === 'light' ? 'text-emerald-500' : 'text-fresh-teal'}
              `} />
              <span className="truncate flex-1">
                {event.address?.split(',')[0] || 'Location TBD'}
              </span>
              {event.distance && (
                <span className={`text-xs ${theme === 'light' ? 'text-gray-400' : 'text-white/50'}`}>
                  {getDistanceText(event.distance)}
                </span>
              )}
            </div>
          </div>

          {/* Description preview - hide on very small screens */}
          {event.description && (
            <p className={`
              hidden sm:block text-xs lg:text-sm line-clamp-2 leading-relaxed
              ${theme === 'light' ? 'text-gray-500' : 'text-white/60'}
            `}>
              {event.description}
            </p>
          )}

          {/* Action hint */}
          <div className="flex items-center justify-between pt-1.5 lg:pt-2">
            <div className={`
              flex items-center gap-1 text-xs
              ${theme === 'light' ? 'text-gray-400' : 'text-white/50'}
            `}>
              <Zap className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
              <span className="hidden sm:inline">Click to explore</span>
              <span className="sm:hidden">Tap</span>
            </div>
            <ArrowRight className={`
              w-3 h-3 lg:w-4 lg:h-4 transition-colors duration-200
              ${theme === 'light' 
                ? 'text-gray-300 group-hover:text-gray-500' 
                : 'text-white/30 group-hover:text-white/60'
              }
            `} />
          </div>
        </div>
      </div>
    );
  });

  return (
    <div
      className={`
        ${embedded 
          ? 'w-full h-full flex flex-col' 
          : `fixed z-30 backdrop-blur-md rounded-2xl shadow-2xl transition-all duration-500 flex flex-col
            ${theme === 'light'
                ? 'bg-white/95 border border-gray-200 shadow-xl'
          : 'bg-neutral-900/80 border border-white/10'
        }
            /* Desktop: Right panel - full height, always partially visible */
            lg:right-4 lg:top-4 lg:bottom-4 lg:w-96
            ${isExpanded ? 'lg:translate-x-0' : 'lg:translate-x-72'} /* Leave 6rem visible when collapsed */
            
        /* Mobile: Bottom sheet */
            ${isExpanded 
              ? 'bottom-0 right-0 left-0 max-h-[85vh]' 
              : 'bottom-4 right-4 left-auto w-16 h-16 rounded-full'
            }
            lg:left-auto lg:max-h-none`
        }
      `}
    >
      {/* Desktop collapsed state - show expand tab */}
      {!embedded && !isExpanded && (
        <div className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full">
          <button
            onClick={() => setIsExpanded(true)}
            className={`
              p-3 rounded-l-xl transition-all duration-200 shadow-lg
              ${theme === 'light'
                  ? 'bg-white/95 border border-gray-200 hover:bg-white shadow-lg'
                  : 'bg-neutral-900/90 border border-white/15 hover:bg-neutral-800/90'
              }
            `}
            title="Show recommendations"
          >
            <ChevronLeft className={`w-5 h-5 ${theme === 'light' ? 'text-gray-600' : 'text-white'}`} />
          </button>
      </div>
      )}

      {/* Mobile collapsed state - floating action button */}
      {!embedded && !isExpanded && (
        <div className="lg:hidden flex items-center justify-center w-full h-full">
          <button
            onClick={() => setIsExpanded(true)}
            className={`
              w-full h-full rounded-full flex items-center justify-center transition-all duration-200
              ${theme === 'light'
                  ? 'bg-gradient-to-br from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 shadow-lg'
                  : 'bg-gradient-to-br from-spark-yellow/30 to-pin-blue/30 hover:from-spark-yellow/40 hover:to-pin-blue/40'
              }
            `}
            title="Show recommendations"
          >
            <Compass className={`w-6 h-6 ${theme === 'light' ? 'text-blue-600' : 'text-white'}`} />
          </button>
        </div>
      )}

      {/* Main content - only show when expanded or embedded */}
      {(isExpanded || embedded) && (
        <>
      {/* Header */}
          <div className={`p-4 lg:p-5 ${!embedded ? 'border-b' : ''} ${theme === 'light' ? 'border-gray-200' : 'border-white/10'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`
              p-2 rounded-xl
                  ${theme === 'light'
                      ? 'bg-gradient-to-br from-blue-100 to-indigo-100'
                : 'bg-gradient-to-br from-spark-yellow/20 to-pin-blue/20'
              }
            `}>
                  <Compass className={`w-5 h-5 ${theme === 'light' ? 'text-blue-600' : 'text-white'}`} />
            </div>
            <div>
                  <h2 className={`
                    text-lg lg:text-xl font-display font-bold flex items-center gap-2 flex-wrap
                    ${theme === 'light' ? 'text-gray-900' : 'text-white'}
                  `}>
                Discover
                    {gpsLocation && useGPS && (
                  <div className="flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-green-400" />
                        <span className="text-xs bg-green-400/20 text-green-400 px-1.5 py-0.5 rounded-full border border-green-400/30">
                          GPS
                        </span>
                      </div>
                    )}
                    {manualLocation && !useGPS && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-400" />
                        <span className="text-xs bg-blue-400/20 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-400/30">
                          Manual
                    </span>
                  </div>
                )}
              </h2>
                  <p className={`text-xs lg:text-sm ${theme === 'light' ? 'text-gray-600' : 'text-white/60'}`}>
                    {(() => {
                      const activeLocation = getActiveLocation();
                      if (activeLocation?.city) {
                        return `Events near ${activeLocation.city}`;
                      }
                      return 'Events near you';
                    })()}
              </p>
            </div>
          </div>
              <div className="flex items-center gap-2">
          <button
                  onClick={handleReset}
            className={`
                    px-3 py-1.5 rounded-lg transition-all duration-200
                    text-xs font-medium
                    ${theme === 'light'
                        ? 'text-blue-600 hover:bg-blue-50 border border-blue-200'
                        : 'text-pin-blue hover:bg-pin-blue/10 border border-pin-blue/40'
              }
            `}
                  title="Reset all filters and location"
                >
                  Reset All
          </button>
                {embedded ? (
                  <button
                    onClick={() => {
                      console.log('Mobile X button clicked - embedded inline', { onClose, embedded });
                      onClose?.();
                    }}
                    className={`
                      p-2 rounded-lg transition-all duration-200 border
                      ${theme === 'light'
                          ? 'hover:bg-gray-100 text-gray-600 border-gray-200 bg-white'
                          : 'hover:bg-white/20 text-white border-white/20 bg-white/10'
                      }
                    `}
                    title="Close recommendations"
                  >
                    <X className={`w-5 h-5`} />
                  </button>
                ) : (
            <button
                    onClick={() => setIsExpanded(false)}
              className={`
                      hidden lg:block p-2 rounded-lg transition-all duration-200
                      ${theme === 'light'
                          ? 'hover:bg-gray-100'
                          : 'hover:bg-white/10'
                      }
                    `}
                    title="Hide recommendations"
            >
                    <X className={`w-4 h-4 ${theme === 'light' ? 'text-gray-500' : 'text-white/70'}`} />
            </button>
                )}
        </div>
      </div>

            {/* Mode Toggle Slider - Desktop and Mobile */}
            <div className="mb-3">
                <div className={`
                  relative p-1 rounded-xl border
                  ${theme === 'light'
                      ? 'bg-gray-100 border-gray-200'
                      : 'bg-white/5 border-white/10'
                  }
                `}>
                  <div className="grid grid-cols-2 relative">
                    {/* Sliding background */}
                <div
                  className={`
                        absolute top-1 bottom-1 w-1/2 rounded-lg transition-all duration-300 ease-out
                        ${theme === 'light'
                            ? 'bg-white border border-gray-300 shadow-sm'
                            : 'bg-gradient-to-r from-spark-yellow/30 to-pin-blue/30 border border-spark-yellow/40'
                        }
                      `}
                      style={{
                        transform: activeMode === 'route' ? 'translateX(100%)' : 'translateX(0%)'
                      }}
                    />
                    
                    {/* Buttons */}
              <button
                      onClick={() => setActiveMode('recommendations')}
                className={`
                        relative z-10 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg
                        font-medium transition-all duration-200
                        ${embedded ? 'text-xs' : 'text-sm'}
                        ${activeMode === 'recommendations'
                          ? theme === 'light' ? 'text-gray-900' : 'text-white'
                          : theme === 'light' ? 'text-gray-500 hover:text-gray-700' : 'text-white/60 hover:text-white/80'
                  }
                `}
              >
                      <Compass className="w-4 h-4" />
                      <span>Discover</span>
              </button>
                    
                <button
                      onClick={() => {
                        console.log('🎯 Plan Route tab clicked, switching to route mode');
                        setActiveMode('route');
                      }}
                  className={`
                        relative z-10 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg
                        font-medium transition-all duration-200
                        ${embedded ? 'text-xs' : 'text-sm'}
                        ${activeMode === 'route'
                          ? theme === 'light' ? 'text-gray-900' : 'text-white'
                          : theme === 'light' ? 'text-gray-500 hover:text-gray-700' : 'text-white/60 hover:text-white/80'
                    }
                  `}
                >
                      <Navigation className="w-4 h-4" />
                      <span>Plan Route</span>
                </button>
              </div>
            </div>
        </div>

            {/* Location Control Buttons - Only show in recommendations mode */}
            {activeMode === 'recommendations' && (
              <>
                {/* Compact Location Controls */}
                <div className={`grid grid-cols-2 gap-2 ${embedded ? 'mt-2' : 'mt-4'}`}>
            <button
                    onClick={switchToGPS}
                    disabled={isLoadingGPS}
                    className={`
                      flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                      text-sm font-medium transition-all duration-200 active:scale-95
                      ${isLoadingGPS 
                        ? 'bg-gray-400/20 text-gray-400 border border-gray-400/40 cursor-not-allowed'
                        : useGPS && gpsLocation
                          ? 'bg-green-400/20 text-green-400 border border-green-400/40'
                          : theme === 'light'
                              ? 'bg-blue-50 text-blue-600 border border-blue-200 active:bg-blue-100'
                              : 'bg-pin-blue/20 text-pin-blue border border-pin-blue/40 active:bg-pin-blue/30'
                      }
                    `}
                    title={
                      isLoadingGPS 
                        ? 'Getting GPS location...' 
                        : gpsLocation 
                          ? (useGPS ? 'Using GPS location' : 'Switch to GPS location') 
                          : 'Get GPS location'
                    }
            >
                    <Navigation className={`w-4 h-4 ${isLoadingGPS ? 'animate-spin' : ''}`} />
                    <span className="text-xs lg:text-sm">
                      {isLoadingGPS 
                        ? 'Loading...' 
                        : gpsLocation 
                          ? (useGPS ? 'GPS Active' : 'Use GPS') 
                          : 'Get GPS'
                      }
                    </span>
            </button>
            
                  <button
                    onClick={handleExploreCities}
                    className={`
                      flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                      text-sm font-medium transition-all duration-200 active:scale-95
                      ${theme === 'light'
                          ? 'bg-amber-50 text-amber-600 border border-amber-200 active:bg-amber-100'
                          : 'bg-spark-yellow/20 text-spark-yellow border border-spark-yellow/40 active:bg-spark-yellow/30'
                }
                    `}
                    title="Explore nearby cities"
                  >
                    <Globe className="w-4 h-4" />
                    <span className="text-xs lg:text-sm">Cities</span>
                  </button>
              </div>
              
                {/* Compact Filter tabs */}
                <div className={`grid grid-cols-4 gap-1 ${embedded ? 'mt-2' : 'mt-4'}`}>
                  {[
                    { key: 'all', label: 'All', icon: Clock },
                    { key: 'upcoming', label: 'Soon', icon: Clock },
                    { key: 'this_weekend', label: 'Weekend', icon: Calendar },
                    { key: 'next_2_weeks', label: '2 Weeks', icon: Calendar }
                  ].map(({ key, label, icon: Icon }, index) => (
                <button
                      key={`${key}-${index}`} // Use index to allow duplicate keys
                      onClick={() => setSelectedFilter(key)}
                  className={`
                        flex flex-col items-center justify-center gap-1 rounded-lg
                        text-xs font-medium transition-all duration-200 active:scale-95
                        ${embedded ? 'py-1.5 px-1' : 'py-2 px-1'}
                        ${selectedFilter === key
                          ? theme === 'light'
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-spark-yellow/20 text-spark-yellow border border-spark-yellow/40'
                          : theme === 'light'
                            ? 'text-gray-500 active:bg-gray-100 border border-transparent'
                            : 'text-white/60 active:bg-white/10 border border-transparent'
                    }
                  `}
                >
                      <Icon className="w-3 h-3" />
                      <span className="leading-none">{label}</span>
                </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Content Area */}
          <div className={`
            flex-1 overflow-y-auto 
            ${embedded ? 'px-4 pt-2 pb-4 min-h-0' : 'p-3 lg:p-4'}
          `}>
            {/* Show route results when in route mode and have route events */}
            {(() => {
              console.log('🔍 Content area conditions:', {
                activeMode,
                embedded,
                routeEventsLength: routeEvents?.length,
                hasRouteEvents: routeEvents && routeEvents.length > 0
              });
              return null;
            })()}
            {activeMode === 'route' && routeEvents && routeEvents.length > 0 ? (
              <div className="space-y-4">
                {/* Route Results Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className={`w-5 h-5 ${theme === 'light' ? 'text-blue-600' : 'text-green-400'}`} />
                    <h3 className={`font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                      Route Events
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-white/70'}`}>
                      {routeEvents.filter(e => !e.isRouteWaypoint).length} events found
                    </span>
                <button
                  onClick={() => {
                        setActiveMode('recommendations');
                        onClearRoute?.();
                  }}
                      className={`
                        p-1.5 rounded-lg transition-colors
                        ${theme === 'light' ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-white/10 text-white/70'}
                      `}
                      title="Clear route"
                    >
                      <X className="w-4 h-4" />
                </button>
                  </div>
              </div>
              
                {/* Route Events List */}
                <div className="space-y-3">
                  {routeEvents
                    .filter(event => !event.isRouteWaypoint) // Show only actual events, not waypoints
                    .map((event, index) => (
                      <EventCard key={event.id || `route-event-${index}`} event={event} index={index} onEventClick={onEventClick} />
                    ))}
            </div>

                {routeEvents.filter(e => !e.isRouteWaypoint).length === 0 && (
                  <div className="text-center py-6 space-y-3">
          <div className={`
                      w-12 h-12 rounded-full mx-auto flex items-center justify-center
                      ${'bg-white/10'}
                `}>
                      <Navigation className="w-6 h-6 text-white/60" />
                </div>
                <div>
                      <h4 className={`font-medium mb-1 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                        Route calculated successfully
                      </h4>
                      <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-white/60'}`}>
                        No events found along this route. Try adjusting your search radius or travel dates.
                  </p>
                </div>
              </div>
                )}
              </div>
            ) : activeMode === 'recommendations' ? (
              loading ? (
                <div className="space-y-3 lg:space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className={`
                        h-24 lg:h-32 rounded-2xl animate-pulse
                        ${'bg-white/10'}
                      `}
                    />
                  ))}
                </div>
              ) : recommendations.length > 0 ? (
                <EventList events={recommendations} onEventClick={onEventClick} />
              ) : (
                <div className="text-center py-6 space-y-3">
                  <div className={`
                    w-12 h-12 rounded-full mx-auto flex items-center justify-center
                    ${'bg-white/10'}
                  `}>
                    <MapPin className="w-6 h-6 text-white/60" />
                  </div>
                  <div>
                    <h4 className={`font-medium mb-1 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                      {getActiveLocation() 
                        ? 'No events found nearby' 
                        : 'Share your location to find events'
                      }
                    </h4>
                    <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-white/60'}`}>
                      {getActiveLocation() 
                        ? 'Try adjusting your filters or exploring other areas'
                        : 'Get your current location to discover amazing events near you'
                      }
                    </p>
                  </div>
                  {!getActiveLocation() && (
                  <button
                      onClick={switchToGPS}
                      disabled={isLoadingGPS}
                    className={`
                        px-4 py-2 rounded-lg font-medium transition-all duration-200
                        ${isLoadingGPS
                            ? 'bg-gray-400/20 text-gray-400 border border-gray-400/40 cursor-not-allowed'
                            : theme === 'light'
                                ? 'bg-blue-100 text-blue-600 border border-blue-200 hover:bg-blue-200'
                                : 'bg-pin-blue/20 text-pin-blue border border-pin-blue/30 hover:bg-pin-blue/30'}
                    `}
                  >
                      <Navigation className={`w-4 h-4 inline mr-2 ${isLoadingGPS ? 'animate-spin' : ''}`} />
                      {isLoadingGPS ? 'Getting Location...' : 'Get Location'}
                  </button>
              )}
            </div>
              )
            ) : activeMode === 'route' ? (
              // Route Planner Content (when in route mode but no route events yet)
              <div className="h-full">
                <RoutePlanner
                  onRouteCalculated={onRouteCalculated}
                  onEventsDiscovered={onRouteEventsDiscovered}
                  mapInstance={mapInstance}
                  apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                  theme={theme}
                  embedded={true} // Add embedded prop to adjust styling
                />
          </div>
            ) : null}
        </div>
        </>
      )}
    </div>
  );
};

export default RecommendationsPanel;