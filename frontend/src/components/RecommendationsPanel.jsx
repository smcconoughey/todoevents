import React, { useState, useEffect, useRef } from 'react';
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
  X
} from 'lucide-react';
import { WebIcon } from './EventMap/WebIcons';
import { CategoryIcon } from './EventMap/CategoryIcons';
import categories, { getCategory } from './EventMap/categoryConfig';
import { API_URL } from '../config';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const RecommendationsPanel = ({ userLocation, onEventClick, onExploreMore }) => {
  const { theme } = useTheme();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('upcoming');
  const [isExpanded, setIsExpanded] = useState(true);
  const [animationKey, setAnimationKey] = useState(0);
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [userActualLocation, setUserActualLocation] = useState(null);
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false);
  const containerRef = useRef(null);

  // Emotional copy variations
  const emotionalMessages = [
    "Discover magic happening near you",
    "Your next adventure awaits",
    "Life's too short for boring weekends",
    "The world is full of wonder",
    "Connect with your community",
    "Create memories that last forever"
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
      // Show popup after a short delay for better UX
      setTimeout(() => {
        setShowLocationPopup(true);
      }, 1500);
    }
  }, []);

  // Request user's actual location
  const requestUserLocation = () => {
    setLocationPermissionAsked(true);
    localStorage.setItem('locationPermissionAsked', 'true');
    setShowLocationPopup(false);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            city: 'Your location'
          };
          setUserActualLocation(location);
          localStorage.setItem('userLocation', JSON.stringify(location));
        },
        (error) => {
          console.log('Location access denied or failed:', error);
          // Continue with fallback location
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    }
  };

  // Load saved location on startup
  useEffect(() => {
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
      try {
        setUserActualLocation(JSON.parse(savedLocation));
      } catch (e) {
        console.error('Error parsing saved location:', e);
      }
    }
  }, []);

  // Fetch recommendations with actual user location if available
  useEffect(() => {
    fetchRecommendations();
  }, [userLocation, selectedFilter, userActualLocation]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      // Use actual user location if available, otherwise fall back to provided location
      const locationToUse = userActualLocation || userLocation;
      
      const requestBody = {
        lat: locationToUse?.lat || null,
        lng: locationToUse?.lng || null,
        city: locationToUse?.city || null,
        time_filter: selectedFilter,
        limit: 8
      };

      const response = await fetchWithTimeout(`${API_URL}/api/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }, 10000);

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.events || []);
        setAnimationKey(prev => prev + 1);
      } else {
        console.error('Failed to fetch recommendations');
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
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
      ref={containerRef}
      className={`
        fixed z-30 backdrop-blur-md rounded-2xl shadow-2xl transition-all duration-500
        ${theme === 'frost'
          ? 'bg-white/10 border border-white/20'
          : 'bg-neutral-900/80 border border-white/10'
        }
        ${isExpanded ? 'translate-x-0' : 'translate-x-full'}
        /* Desktop: Right panel */
        lg:right-4 lg:top-4 lg:w-96 lg:max-h-[calc(100vh-2rem)]
        /* Mobile: Bottom sheet */
        bottom-0 right-0 left-0 max-h-[80vh] lg:left-auto
        /* Mobile collapsed state - show as bottom tab */
        ${!isExpanded ? 'lg:translate-x-80' : ''}
      `}
    >
      {/* Mobile Handle Bar - only show on mobile when expanded */}
      <div className="lg:hidden flex justify-center p-2 border-b border-white/10">
        <div className="w-12 h-1 bg-white/30 rounded-full" />
      </div>

      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`
              p-2 rounded-xl
              ${theme === 'frost' 
                ? 'bg-gradient-to-br from-blue-400/20 to-purple-400/20' 
                : 'bg-gradient-to-br from-spark-yellow/20 to-pin-blue/20'
              }
            `}>
              <Compass className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg lg:text-xl font-display font-bold text-white flex items-center gap-2 flex-wrap">
                Discover
                {userActualLocation && (
                  <div className="flex items-center gap-1">
                    <Navigation className="w-4 h-4 text-green-400" />
                    <span className="text-xs bg-green-400/20 text-green-400 px-2 py-1 rounded-full border border-green-400/30">
                      Precise
                    </span>
                  </div>
                )}
              </h2>
              <p className="text-xs lg:text-sm text-white/60">
                {userActualLocation ? 'Events near your location' : 'Events near you'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`
              p-2 rounded-lg transition-colors duration-200
              ${theme === 'frost'
                ? 'hover:bg-white/20'
                : 'hover:bg-white/10'
              }
            `}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-white/70" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/70" />
            )}
          </button>
        </div>

        {/* Emotional message - smaller on mobile */}
        <div className="text-center py-2 lg:py-3">
          <p 
            key={currentMessage}
            className="text-base lg:text-lg font-medium text-white animate-fade-in bg-gradient-to-r from-spark-yellow to-pin-blue bg-clip-text text-transparent"
          >
            {emotionalMessages[currentMessage]}
          </p>
        </div>

        {/* Filter tabs - responsive layout */}
        <div className="flex gap-1 lg:gap-2 mt-4">
          {[
            { key: 'upcoming', label: 'Soon', icon: Clock },
            { key: 'this_weekend', label: 'Weekend', icon: Star },
            { key: 'next_2_weeks', label: '2 Weeks', icon: TrendingUp }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSelectedFilter(key)}
              className={`
                flex-1 flex items-center justify-center gap-1 lg:gap-2 py-2 px-2 lg:px-3 rounded-lg
                text-xs lg:text-sm font-medium transition-all duration-200
                ${selectedFilter === key
                  ? theme === 'frost'
                    ? 'bg-white/30 text-white border border-white/40'
                    : 'bg-spark-yellow/20 text-spark-yellow border border-spark-yellow/40'
                  : 'text-white/60 hover:bg-white/10 border border-transparent'
                }
              `}
            >
              <Icon className="w-3 h-3 lg:w-4 lg:h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-3 lg:p-4 overflow-y-auto max-h-60 lg:max-h-96">
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
            <div key={animationKey} className="space-y-3 lg:space-y-4">
              {recommendations.map((event, index) => (
                <EventCard key={event.id} event={event} index={index} />
              ))}
              
              {/* Explore more button */}
              <button
                onClick={onExploreMore}
                className={`
                  w-full py-3 lg:py-4 rounded-2xl font-medium transition-all duration-200
                  hover:scale-[1.02] flex items-center justify-center gap-2
                  text-sm lg:text-base
                  ${theme === 'frost'
                    ? 'bg-gradient-to-r from-blue-400/30 to-purple-400/30 text-white border border-white/30 hover:from-blue-400/40 hover:to-purple-400/40'
                    : 'bg-gradient-to-r from-spark-yellow/20 to-pin-blue/20 text-white border border-spark-yellow/30 hover:from-spark-yellow/30 hover:to-pin-blue/30'
                  }
                `}
              >
                <Globe className="w-4 h-4 lg:w-5 lg:h-5" />
                Explore all events on map
                <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
            </div>
          ) : (
            <div className="text-center py-6 lg:py-8 space-y-4">
              <div className={`
                w-12 h-12 lg:w-16 lg:h-16 rounded-full mx-auto flex items-center justify-center
                ${theme === 'frost' ? 'bg-white/20' : 'bg-white/10'}
              `}>
                <Lightbulb className="w-6 h-6 lg:w-8 lg:h-8 text-white/60" />
              </div>
              <div>
                <h3 className="text-base lg:text-lg font-medium text-white mb-2">
                  Nothing nearby right now
                </h3>
                <p className="text-white/60 text-sm mb-4">
                  But there's a whole world of events to discover!
                </p>
                <button
                  onClick={onExploreMore}
                  className={`
                    px-4 lg:px-6 py-2 lg:py-3 rounded-xl font-medium transition-all duration-200
                    hover:scale-[1.02] flex items-center gap-2 mx-auto text-sm lg:text-base
                    ${theme === 'frost'
                      ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30'
                      : 'bg-spark-yellow/20 text-spark-yellow border border-spark-yellow/30 hover:bg-spark-yellow/30'
                    }
                  `}
                >
                  <Target className="w-3 h-3 lg:w-4 lg:h-4" />
                  Explore other cities
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsed state hint */}
      {!isExpanded && (
        <div className="p-3 lg:p-4 text-center">
          <Sparkles className="w-5 h-5 lg:w-6 lg:h-6 text-spark-yellow mx-auto animate-pulse" />
          <p className="text-xs text-white/60 mt-1">Recommendations</p>
        </div>
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
                  onClick={requestUserLocation}
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
    </div>
  );
};

export default RecommendationsPanel;