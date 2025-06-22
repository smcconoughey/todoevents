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
  ChevronLeft
} from 'lucide-react';
import { WebIcon } from './EventMap/WebIcons';
import { CategoryIcon } from './EventMap/CategoryIcons';
import categories, { getCategory } from './EventMap/categoryConfig';
import { API_URL } from '../config';

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

const RecommendationsPanel = ({ userLocation, onEventClick, onExploreMore }) => {
  const { theme } = useTheme();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // City suggestions state
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);

  // LOCATION SYSTEM - Clear and Simple
  const [gpsLocation, setGpsLocation] = useState(null); // User's GPS coordinates
  const [manualLocation, setManualLocation] = useState(null); // User selected location (search/city)
  const [useGPS, setUseGPS] = useState(true); // Toggle between GPS and manual
  const [lastFetchedLocation, setLastFetchedLocation] = useState(null); // Track last fetched location to prevent duplicates

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

  const emotionalMessages = [
    "Discover amazing events near you",
    "Connect with your community",
    "Find your next adventure",
    "Explore local experiences",
    "Create lasting memories"
  ];

  const [currentMessage, setCurrentMessage] = useState(0);

  // Rotate emotional messages
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage(prev => (prev + 1) % emotionalMessages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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
          
          // Update refs immediately
          gpsLocationRef.current = location;
          useGPSRef.current = true;
        },
        (error) => {
          console.log('GPS access denied or failed:', error);
          setUseGPS(false); // Fall back to manual mode
          useGPSRef.current = false;
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
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
      setUseGPS(true);
      useGPSRef.current = true;
    } else {
      // Request GPS if we don't have it
      requestGPSLocation();
    }
  };

  // Stable fetch function that uses refs
  const fetchRecommendations = useCallback(async () => {
    // Get current location from refs to avoid stale state
    const activeLocation = getActiveLocationFromRefs();
    const locationKey = getLocationKey(activeLocation);
    
    console.log('🔍 fetchRecommendations using refs:', {
      activeLocation,
      locationKey,
      lastFetchedLocation
    });
    
    // Prevent duplicate API calls for the same location and filter
    if (locationKey === lastFetchedLocation) {
      console.log('🚫 Skipping API call - same location and filter');
      return;
    }

    console.log('📡 Making API call for location:', activeLocation);
    setLoading(true);
    setLastFetchedLocation(locationKey);

    try {
      const requestBody = {
        lat: activeLocation?.lat || null,
        lng: activeLocation?.lng || null,
        city: activeLocation?.city || null,
        time_filter: selectedFilter,
        limit: 8
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

  // Single effect to handle all location and filter changes
  useEffect(() => {
    const activeLocation = getActiveLocation();
    const locationKey = getLocationKey(activeLocation);
    
    console.log('🔍 Location or filter changed:', {
      activeLocation,
      locationKey,
      lastFetchedLocation
    });

    // Only fetch if location or filter actually changed
    if (locationKey !== lastFetchedLocation) {
      shouldFetchRef.current = true;
      // Use setTimeout to ensure state has settled
      setTimeout(() => {
        if (shouldFetchRef.current) {
          shouldFetchRef.current = false;
          fetchRecommendations();
        }
      }, 100);
    }
  }, [gpsLocation, manualLocation, useGPS, selectedFilter, userLocation]);

  // Initial fetch when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecommendations();
    }, 1000); // Delay initial fetch slightly
    return () => clearTimeout(timer);
  }, []); // Only run once on mount

  const fetchCitySuggestions = async () => {
    setLoadingCities(true);
    try {
      const activeLocation = getActiveLocation();
      
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

  const EventCard = ({ event, index }) => {
    const category = getCategory(event.category);
    const Icon = category.icon;

    return (
      <div
        className={`
          group relative overflow-hidden rounded-2xl backdrop-blur-sm
          transition-all duration-500 hover:scale-[1.02] cursor-pointer
          animate-slide-in-up
          ${theme === 'frost' 
            ? 'bg-white/15 border border-white/20 hover:bg-white/25' 
            : 'bg-white/5 border border-white/10 hover:bg-white/10'
          }
        `}
        style={{
          animationDelay: `${index * 100}ms`,
          animationFillMode: 'both'
        }}
        onClick={() => onEventClick && onEventClick(event)}
      >
        {/* Gradient overlay */}
        <div className={`
          absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
          ${theme === 'frost' 
            ? 'bg-gradient-to-br from-blue-400/10 to-purple-400/10' 
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
                ${theme === 'frost' 
                  ? 'bg-white/20 group-hover:bg-white/30' 
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
                      ${theme === 'frost'
                        ? 'bg-blue-400/20 text-blue-100 border border-blue-300/30'
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
          <h3 className="font-display font-semibold text-white text-base lg:text-lg leading-tight line-clamp-2 group-hover:text-spark-yellow transition-colors duration-200">
            {event.title}
          </h3>

          {/* Event details */}
          <div className="space-y-1.5 lg:space-y-2 text-xs lg:text-sm text-white/70">
            <div className="flex items-center gap-1.5 lg:gap-2">
              <Calendar className="w-3 h-3 lg:w-4 lg:h-4 text-pin-blue" />
              <span className="font-medium">
                {formatEventDate(event)}
                {formatEventTime(event) && (
                  <>
                    <span className="text-white/50 mx-1">•</span>
                    {formatEventTime(event)}
                  </>
                )}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 lg:gap-2">
              <MapPin className="w-3 h-3 lg:w-4 lg:h-4 text-fresh-teal" />
              <span className="truncate flex-1">
                {event.address?.split(',')[0] || 'Location TBD'}
              </span>
              {event.distance && (
                <span className="text-xs text-white/50">
                  {getDistanceText(event.distance)}
                </span>
              )}
            </div>
          </div>

          {/* Description preview - hide on very small screens */}
          {event.description && (
            <p className="hidden sm:block text-xs lg:text-sm text-white/60 line-clamp-2 leading-relaxed">
              {event.description}
            </p>
          )}

          {/* Action hint */}
          <div className="flex items-center justify-between pt-1.5 lg:pt-2">
            <div className="flex items-center gap-1 text-xs text-white/50">
              <Zap className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
              <span className="hidden sm:inline">Click to explore</span>
              <span className="sm:hidden">Tap</span>
            </div>
            <ArrowRight className="w-3 h-3 lg:w-4 lg:h-4 text-white/30 group-hover:text-white/60 transition-colors duration-200" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`
        fixed z-30 backdrop-blur-md rounded-2xl shadow-2xl transition-all duration-500
        flex flex-col
        ${theme === 'frost'
          ? 'bg-white/10 border border-white/20'
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
        lg:left-auto lg:max-h-none
      `}
    >
      {/* Desktop collapsed state - show expand tab */}
      {!isExpanded && (
        <div className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full">
          <button
            onClick={() => setIsExpanded(true)}
            className={`
              p-3 rounded-l-xl transition-all duration-200 shadow-lg
              ${theme === 'frost'
                ? 'bg-white/15 border border-white/25 hover:bg-white/25'
                : 'bg-neutral-900/90 border border-white/15 hover:bg-neutral-800/90'
              }
            `}
            title="Show recommendations"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      {/* Mobile collapsed state - floating action button */}
      {!isExpanded && (
        <div className="lg:hidden flex items-center justify-center w-full h-full">
          <button
            onClick={() => setIsExpanded(true)}
            className={`
              w-full h-full rounded-full flex items-center justify-center transition-all duration-200
              ${theme === 'frost'
                ? 'bg-gradient-to-br from-blue-400/30 to-purple-400/30 hover:from-blue-400/40 hover:to-purple-400/40'
                : 'bg-gradient-to-br from-spark-yellow/30 to-pin-blue/30 hover:from-spark-yellow/40 hover:to-pin-blue/40'
              }
            `}
            title="Show recommendations"
          >
            <Compass className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* Main content - only show when expanded */}
      {isExpanded && (
        <>
          {/* Mobile Handle Bar - only show on mobile when expanded */}
          <div className="lg:hidden flex justify-center p-2 border-b border-white/10">
            <div className="w-12 h-1 bg-white/30 rounded-full" />
          </div>

          {/* Header */}
          <div className="p-4 lg:p-5 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`
                  p-2 rounded-xl
                  ${theme === 'frost' 
                    ? 'bg-gradient-to-br from-blue-400/20 to-purple-400/20' 
                    : 'bg-gradient-to-br from-spark-yellow/20 to-pin-blue/20'
                  }
                `}>
                  <Compass className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg lg:text-xl font-display font-bold text-white flex items-center gap-2 flex-wrap">
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
                  <p className="text-xs lg:text-sm text-white/60">
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
              <button
                onClick={() => setIsExpanded(false)}
                className={`
                  p-2 rounded-lg transition-colors duration-200 hover:scale-105
                  ${theme === 'frost'
                    ? 'hover:bg-white/20'
                    : 'hover:bg-white/10'
                  }
                `}
                title="Hide recommendations"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>

            {/* Emotional message */}
            <div className="text-center py-2 lg:py-3">
              <p 
                className="text-sm lg:text-base font-medium text-white bg-gradient-to-r from-spark-yellow to-pin-blue bg-clip-text text-transparent"
              >
                {emotionalMessages[currentMessage]}
              </p>
            </div>

            {/* Location Control Buttons - Improved spacing and consistency */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={switchToGPS}
                className={`
                  flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                  text-sm font-medium transition-all duration-200 hover:scale-[1.02]
                  ${useGPS && gpsLocation
                    ? 'bg-green-400/20 text-green-400 border border-green-400/40'
                    : theme === 'frost'
                      ? 'bg-blue-400/20 text-blue-400 border border-blue-400/40 hover:bg-blue-400/30'
                      : 'bg-pin-blue/20 text-pin-blue border border-pin-blue/40 hover:bg-pin-blue/30'
                  }
                `}
                title={gpsLocation ? (useGPS ? 'Using GPS location' : 'Switch to GPS location') : 'Get GPS location'}
              >
                <Navigation className="w-4 h-4" />
                <span className="text-xs lg:text-sm">
                  {gpsLocation ? (useGPS ? 'GPS Active' : 'Use GPS') : 'Get GPS'}
                </span>
              </button>
              
              <button
                onClick={handleExploreCities}
                className={`
                  flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                  text-sm font-medium transition-all duration-200 hover:scale-[1.02]
                  ${theme === 'frost'
                    ? 'bg-purple-400/20 text-purple-400 border border-purple-400/40 hover:bg-purple-400/30'
                    : 'bg-spark-yellow/20 text-spark-yellow border border-spark-yellow/40 hover:bg-spark-yellow/30'
                  }
                `}
                title="Explore nearby cities"
              >
                <Globe className="w-4 h-4" />
                <span className="text-xs lg:text-sm">Cities</span>
              </button>
            </div>

            {/* Filter tabs - Grid layout for better consistency */}
            <div className="grid grid-cols-4 gap-1 mt-4">
              {[
                { key: 'all', label: 'All', icon: Clock },
                { key: 'upcoming', label: 'Soon', icon: Clock },
                { key: 'this_weekend', label: 'Weekend', icon: Calendar },
                { key: 'next_2_weeks', label: '2 Weeks', icon: Calendar }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSelectedFilter(key)}
                  className={`
                    flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg
                    text-xs font-medium transition-all duration-200 hover:scale-[1.02]
                    ${selectedFilter === key
                      ? theme === 'frost'
                        ? 'bg-white/30 text-white border border-white/40'
                        : 'bg-spark-yellow/20 text-spark-yellow border border-spark-yellow/40'
                      : 'text-white/60 hover:bg-white/10 border border-transparent'
                    }
                  `}
                >
                  <Icon className="w-3 h-3" />
                  <span className="leading-none">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content - Full height with scroll */}
          <div className="flex-1 overflow-y-auto p-3 lg:p-4">
            {loading ? (
              <div className="space-y-3 lg:space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className={`
                      h-24 lg:h-32 rounded-2xl animate-pulse
                      ${theme === 'frost' ? 'bg-white/20' : 'bg-white/10'}
                    `}
                  />
                ))}
              </div>
            ) : recommendations.length > 0 ? (
              <div className="space-y-3 lg:space-y-4">
                {recommendations.map((event, index) => (
                  <EventCard key={event.id} event={event} index={index} />
                ))}
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <div className={`
                  w-12 h-12 rounded-full mx-auto flex items-center justify-center
                  ${theme === 'frost' ? 'bg-white/20' : 'bg-white/10'}
                `}>
                  <MapPin className="w-6 h-6 text-white/60" />
                </div>
                <div>
                  <h4 className="font-medium text-white mb-1">
                    {getActiveLocation() 
                      ? 'No events found nearby' 
                      : 'Share your location to find events'
                    }
                  </h4>
                  <p className="text-white/60 text-sm">
                    {getActiveLocation() 
                      ? 'Try adjusting your filters or exploring other areas'
                      : 'Get your current location to discover amazing events near you'
                    }
                  </p>
                </div>
                {!getActiveLocation() && (
                  <button
                    onClick={switchToGPS}
                    className={`
                      px-4 py-2 rounded-lg font-medium transition-all duration-200
                      ${theme === 'frost'
                        ? 'bg-blue-400/20 text-blue-400 border border-blue-400/30 hover:bg-blue-400/30'
                        : 'bg-pin-blue/20 text-pin-blue border border-pin-blue/30 hover:bg-pin-blue/30'}
                    `}
                  >
                    <Navigation className="w-4 h-4 inline mr-2" />
                    Get Location
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Location Permission Popup */}
      {showLocationPopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`
            relative max-w-sm lg:max-w-md w-full rounded-2xl p-4 lg:p-6 shadow-2xl animate-scale-in
            ${theme === 'frost'
              ? 'bg-white/20 border border-white/30'
              : 'bg-neutral-900/90 border border-white/20'
            }
          `}>
            <button
              onClick={() => {
                setShowLocationPopup(false);
                setLocationPermissionAsked(true);
                localStorage.setItem('locationPermissionAsked', 'true');
              }}
              className="absolute top-3 right-3 lg:top-4 lg:right-4 p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 lg:w-5 lg:h-5 text-white/70" />
            </button>
            
            <div className="text-center space-y-3 lg:space-y-4">
              <div className={`
                w-12 h-12 lg:w-16 lg:h-16 rounded-full mx-auto flex items-center justify-center
                ${theme === 'frost' 
                  ? 'bg-gradient-to-br from-blue-400/30 to-purple-400/30' 
                  : 'bg-gradient-to-br from-spark-yellow/30 to-pin-blue/30'
                }
              `}>
                <Navigation className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
              </div>
              
              <div>
                <h3 className="text-lg lg:text-xl font-bold text-white mb-2">
                  Find Events Near You
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  Share your location to discover amazing events happening right around you. 
                  We'll show you the most relevant local experiences based on your exact location.
                </p>
              </div>
              
              <div className="space-y-3 pt-2">
                <button
                  onClick={requestGPSLocation}
                  className={`
                    w-full py-3 px-4 rounded-xl font-medium transition-all duration-200
                    hover:scale-[1.02] flex items-center justify-center gap-2 text-sm lg:text-base
                    ${theme === 'frost'
                      ? 'bg-gradient-to-r from-blue-400/40 to-purple-400/40 text-white border border-white/40 hover:from-blue-400/50 hover:to-purple-400/50'
                      : 'bg-gradient-to-r from-spark-yellow/30 to-pin-blue/30 text-white border border-spark-yellow/40 hover:from-spark-yellow/40 hover:to-pin-blue/40'
                    }
                  `}
                >
                  <Navigation className="w-4 h-4 lg:w-5 lg:h-5" />
                  Share My Location
                </button>
                
                <button
                  onClick={() => {
                    setShowLocationPopup(false);
                    setLocationPermissionAsked(true);
                    localStorage.setItem('locationPermissionAsked', 'true');
                  }}
                  className="w-full py-3 px-4 rounded-xl font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 text-sm lg:text-base"
                >
                  Maybe Later
                </button>
              </div>
              
              <p className="text-xs text-white/50 mt-4">
                Your location is only used to find nearby events and is never stored on our servers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* City Suggestions Modal */}
      {showCitySuggestions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`
            relative max-w-lg w-full rounded-2xl p-4 lg:p-6 shadow-2xl animate-scale-in max-h-[80vh] overflow-y-auto
            ${theme === 'frost'
              ? 'bg-white/20 border border-white/30'
              : 'bg-neutral-900/90 border border-white/20'
            }
          `}>
            <button
              onClick={() => setShowCitySuggestions(false)}
              className="absolute top-3 right-3 lg:top-4 lg:right-4 p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 lg:w-5 lg:h-5 text-white/70" />
            </button>
            
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className={`
                  w-12 h-12 lg:w-16 lg:h-16 rounded-full mx-auto flex items-center justify-center
                  ${theme === 'frost' 
                    ? 'bg-gradient-to-br from-blue-400/30 to-purple-400/30' 
                    : 'bg-gradient-to-br from-spark-yellow/30 to-pin-blue/30'
                  }
                `}>
                  <Globe className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
                </div>
                
                <div>
                  <h3 className="text-lg lg:text-xl font-bold text-white mb-1">
                    Explore Other Cities
                  </h3>
                  <p className="text-white/70 text-sm">
                    Discover events in nearby cities with active communities
                  </p>
                </div>
              </div>

              {loadingCities ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`
                        h-16 rounded-xl animate-pulse
                        ${theme === 'frost' ? 'bg-white/20' : 'bg-white/10'}
                      `}
                    />
                  ))}
                </div>
              ) : citySuggestions.length > 0 ? (
                <div className="space-y-2">
                  {citySuggestions.map((city, index) => (
                    <button
                      key={`${city.city}-${city.state}`}
                      onClick={() => handleCitySelect(city)}
                      className={`
                        w-full p-3 lg:p-4 rounded-xl text-left transition-all duration-200
                        hover:scale-[1.02] border
                        ${theme === 'frost'
                          ? 'bg-white/10 border-white/20 hover:bg-white/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white truncate">
                            {city.city}, {city.state}
                          </h4>
                          <div className="flex items-center gap-3 mt-1 text-sm text-white/70">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {city.event_count} events
                            </span>
                            {city.distance > 0 && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {city.distance} miles away
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-white/40 flex-shrink-0 ml-2" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <div className={`
                    w-12 h-12 rounded-full mx-auto flex items-center justify-center
                    ${theme === 'frost' ? 'bg-white/20' : 'bg-white/10'}
                  `}>
                    <Lightbulb className="w-6 h-6 text-white/60" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white mb-1">
                      No nearby cities found
                    </h4>
                    <p className="text-white/60 text-sm">
                      Try exploring the map to discover more areas
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowCitySuggestions(false);
                      onExploreMore && onExploreMore();
                    }}
                    className={`
                      mt-3 px-4 py-2 rounded-lg font-medium transition-all duration-200
                      ${theme === 'frost'
                        ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30'
                        : 'bg-spark-yellow/20 text-spark-yellow border border-spark-yellow/30 hover:bg-spark-yellow/30'}
                    `}
                  >
                    View All Events
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationsPanel;