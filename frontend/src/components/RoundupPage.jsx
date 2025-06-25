import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import { 
  Calendar,
  Clock,
  MapPin,
  Star,
  Sparkles,
  Compass,
  Globe,
  Download,
  Share2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Image as ImageIcon,
  Grid,
  Search
} from 'lucide-react';
import { WebIcon } from './EventMap/WebIcons';
import { CategoryIcon } from './EventMap/CategoryIcons';
import categories, { getCategory } from './EventMap/categoryConfig';
import { API_URL } from '../config';
import html2canvas from 'html2canvas';

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

const RoundupPage = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('this_weekend');
  const [selectedCategories, setSelectedCategories] = useState(['all']);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Refs for image generation
  const cardRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Load city suggestions on mount
  useEffect(() => {
    fetchCitySuggestions();
  }, []);

  const fetchCitySuggestions = async () => {
    setLoadingCities(true);
    try {
      const response = await fetch(`${API_URL}/api/recommendations/nearby-cities?limit=12&max_distance=500`, {
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

  const fetchEvents = useCallback(async () => {
    if (!selectedLocation) return;

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    
    try {
      const requestData = {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        city: selectedLocation.city,
        max_distance: 50.0,
        limit: 12, // Get more events to choose from
        time_filter: selectedFilter
      };

      const response = await fetch(`${API_URL}/api/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal: abortControllerRef.current.signal
      });

      if (response.ok) {
        const data = await response.json();
        let filteredEvents = data.events || [];

        // Filter by categories if not 'all'
        if (!selectedCategories.includes('all') && selectedCategories.length > 0) {
          filteredEvents = filteredEvents.filter(event => 
            selectedCategories.includes(event.category)
          );
        }

        // Limit to 6-8 events for the grid
        setEvents(filteredEvents.slice(0, 8));
      } else {
        console.error('Failed to fetch events');
        setEvents([]);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching events:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedLocation, selectedFilter, selectedCategories]);

  // Fetch events when parameters change
  useEffect(() => {
    if (selectedLocation) {
      fetchEvents();
    }
  }, [fetchEvents]);

  const handleCitySelect = (city) => {
    setSelectedLocation({
      lat: city.lat,
      lng: city.lng,
      city: `${city.city}, ${city.state}`
    });
    setSearchValue(`${city.city}, ${city.state}`);
    setShowCitySuggestions(false);
  };

  const handleCategoryToggle = (category) => {
    if (category === 'all') {
      setSelectedCategories(['all']);
    } else {
      setSelectedCategories(prev => {
        const newCategories = prev.filter(cat => cat !== 'all');
        if (newCategories.includes(category)) {
          const filtered = newCategories.filter(cat => cat !== category);
          return filtered.length === 0 ? ['all'] : filtered;
        } else {
          return [...newCategories, category];
        }
      });
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

  const getFilterLabel = (filter) => {
    switch (filter) {
      case 'upcoming': return 'Soon';
      case 'this_weekend': return 'This Weekend';
      case 'next_2_weeks': return 'Next 2 Weeks';
      default: return 'Soon';
    }
  };

  const generateShareImage = async () => {
    if (!cardRef.current || events.length === 0) return;

    setIsGenerating(true);
    
    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      cardRef.current.style.position = 'fixed';
      cardRef.current.style.top = '-9999px';
      cardRef.current.style.left = '0';
      cardRef.current.style.zIndex = '9999';
      cardRef.current.style.display = 'block';

      const canvas = await html2canvas(cardRef.current, {
        width: 1200,
        height: 630,
        scale: 2,
        backgroundColor: theme === 'dark' ? '#0f0f0f' : '#ffffff',
        logging: false,
        allowTaint: true,
        useCORS: true
      });

      cardRef.current.style.display = 'none';

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedLocation?.city?.replace(/[^a-zA-Z0-9]/g, '-')}-${getFilterLabel(selectedFilter).replace(/\s+/g, '-')}-events.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');

    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const shareToSocial = async () => {
    if (navigator.share && events.length > 0) {
      try {
        await navigator.share({
          title: `${getFilterLabel(selectedFilter)} Events in ${selectedLocation?.city}`,
          text: `Check out these amazing events happening ${getFilterLabel(selectedFilter).toLowerCase()} in ${selectedLocation?.city}!`,
          url: window.location.href
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-neutral-950' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`${theme === 'dark' ? 'bg-neutral-900' : 'bg-white'} shadow-sm border-b ${theme === 'dark' ? 'border-neutral-800' : 'border-gray-200'}`}>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={`
              p-3 rounded-xl
              ${theme === 'dark'
                ? 'bg-gradient-to-br from-spark-yellow/20 to-pin-blue/20'
                : 'bg-gradient-to-br from-blue-100 to-indigo-100'
              }
            `}>
              <Grid className={`w-6 h-6 ${theme === 'dark' ? 'text-white' : 'text-blue-600'}`} />
            </div>
            <div>
              <h1 className={`text-2xl lg:text-3xl font-display font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Event Roundup
              </h1>
              <p className={`text-sm lg:text-base ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                Create shareable event cards for any city and time period
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-6">
            {/* City Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-700'}`}>
                Select City
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    if (!showCitySuggestions && e.target.value.length > 0) {
                      setShowCitySuggestions(true);
                    }
                  }}
                  onFocus={() => setShowCitySuggestions(true)}
                  placeholder="Search for a city..."
                  className={`
                    w-full px-4 py-3 rounded-xl border transition-colors
                    ${theme === 'dark'
                      ? 'bg-neutral-800 border-neutral-700 text-white placeholder-white/50'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                  `}
                />
                <Search className={`absolute right-3 top-3 w-5 h-5 ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`} />
              </div>

              {/* City Suggestions */}
              {showCitySuggestions && (
                <div className={`
                  absolute z-50 mt-1 w-full rounded-xl shadow-lg border max-h-60 overflow-y-auto
                  ${theme === 'dark'
                    ? 'bg-neutral-800 border-neutral-700'
                    : 'bg-white border-gray-200'
                  }
                `}>
                  {loadingCities ? (
                    <div className="p-4 text-center">
                      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                    </div>
                  ) : (() => {
                      const filteredCities = citySuggestions.filter(city => 
                        searchValue === '' || 
                        city.city.toLowerCase().includes(searchValue.toLowerCase()) ||
                        city.state.toLowerCase().includes(searchValue.toLowerCase()) ||
                        `${city.city}, ${city.state}`.toLowerCase().includes(searchValue.toLowerCase())
                      );

                      return filteredCities.length > 0 ? (
                        filteredCities.map((city, index) => (
                          <button
                            key={index}
                            onClick={() => handleCitySelect(city)}
                            className={`
                              w-full px-4 py-3 text-left transition-colors
                              ${theme === 'dark'
                                ? 'hover:bg-neutral-700 text-white'
                                : 'hover:bg-gray-50 text-gray-900'
                              }
                            `}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{city.city}, {city.state}</div>
                                <div className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                                  {city.event_count} events
                                </div>
                              </div>
                              <MapPin className={`w-4 h-4 ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`} />
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center">
                          <p className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                            No cities found matching "{searchValue}"
                          </p>
                        </div>
                      );
                    })()}
                </div>
              )}
            </div>

            {/* Time Filter */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-700'}`}>
                Time Period
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'upcoming', label: 'Soon', icon: Clock },
                  { key: 'this_weekend', label: 'This Weekend', icon: Calendar },
                  { key: 'next_2_weeks', label: 'Next 2 Weeks', icon: Calendar }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedFilter(key)}
                    className={`
                      flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200
                      ${selectedFilter === key
                        ? theme === 'dark'
                          ? 'bg-gradient-to-br from-spark-yellow/20 to-pin-blue/20 border border-spark-yellow/40 text-white'
                          : 'bg-blue-100 border border-blue-300 text-blue-700'
                        : theme === 'dark'
                          ? 'bg-neutral-800 border border-neutral-700 text-white/70 hover:bg-neutral-700'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Category Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-700'}`}>
                Categories (optional)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                <button
                  onClick={() => handleCategoryToggle('all')}
                  className={`
                    flex items-center gap-2 p-2 rounded-lg transition-all duration-200
                    ${selectedCategories.includes('all')
                      ? theme === 'dark'
                        ? 'bg-gradient-to-br from-spark-yellow/20 to-pin-blue/20 border border-spark-yellow/40 text-white'
                        : 'bg-blue-100 border border-blue-300 text-blue-700'
                      : theme === 'dark'
                        ? 'bg-neutral-800 border border-neutral-700 text-white/70 hover:bg-neutral-700'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }
                  `}
                >
                  <Filter className="w-4 h-4" />
                  <span className="text-sm">All</span>
                </button>
                
                {Object.entries(categories).filter(([key]) => key !== 'all').map(([key, category]) => (
                  <button
                    key={key}
                    onClick={() => handleCategoryToggle(key)}
                    className={`
                      flex items-center gap-2 p-2 rounded-lg transition-all duration-200
                      ${selectedCategories.includes(key)
                        ? theme === 'dark'
                          ? 'bg-gradient-to-br from-spark-yellow/20 to-pin-blue/20 border border-spark-yellow/40 text-white'
                          : 'bg-blue-100 border border-blue-300 text-blue-700'
                        : theme === 'dark'
                          ? 'bg-neutral-800 border border-neutral-700 text-white/70 hover:bg-neutral-700'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }
                    `}
                  >
                    <CategoryIcon category={key} className="w-4 h-4" />
                    <span className="text-sm">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {!selectedLocation ? (
          <div className="text-center py-12">
            <Globe className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`} />
            <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Select a City to Get Started
            </h3>
            <p className={`${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
              Choose a city from the suggestions above to see available events
            </p>
          </div>
        ) : loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Finding Events...
            </h3>
            <p className={`${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
              Searching for {getFilterLabel(selectedFilter).toLowerCase()} events in {selectedLocation.city}
            </p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`} />
            <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              No Events Found
            </h3>
            <p className={`${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
              No events found for {getFilterLabel(selectedFilter).toLowerCase()} in {selectedLocation.city}. Try a different time period or city.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Preview Controls */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {getFilterLabel(selectedFilter)} in {selectedLocation.city}
                </h2>
                <p className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                  {events.length} events found
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={shareToSocial}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
                    ${theme === 'dark'
                      ? 'bg-neutral-800 border border-neutral-700 text-white hover:bg-neutral-700'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                
                <button
                  onClick={generateShareImage}
                  disabled={isGenerating}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
                    ${theme === 'dark'
                      ? 'bg-gradient-to-r from-spark-yellow/80 to-pin-blue/80 text-white hover:from-spark-yellow hover:to-pin-blue'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600'
                    }
                    ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {isGenerating ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isGenerating ? 'Generating...' : 'Download Image'}
                </button>
              </div>
            </div>

            {/* Event Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event, index) => {
                const category = getCategory(event.category);
                return (
                  <div
                    key={event.id}
                    className={`
                      rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:scale-105
                      ${theme === 'dark'
                        ? 'bg-neutral-800 border border-neutral-700'
                        : 'bg-white border border-gray-200'
                      }
                    `}
                  >
                    {/* Event Image/Category Header */}
                    <div 
                      className="h-32 flex items-center justify-center relative"
                      style={{ backgroundColor: `${category.color}20` }}
                    >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: category.color }}
                      >
                        <CategoryIcon 
                          category={event.category} 
                          className="w-6 h-6" 
                          style={{ color: '#1F2937' }}
                        />
                      </div>
                      {event.verified && (
                        <div className="absolute top-2 right-2">
                          <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                            Verified
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Event Details */}
                    <div className="p-4">
                      <h3 className={`font-semibold text-sm mb-2 line-clamp-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {event.title}
                      </h3>
                      
                      <div className="space-y-2 text-xs">
                        <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                          <Calendar className="w-3 h-3" />
                          <span>{formatEventDate(event)}</span>
                        </div>
                        
                        {event.start_time && (
                          <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                            <Clock className="w-3 h-3" />
                            <span>{formatEventTime(event)}</span>
                          </div>
                        )}
                        
                        {event.address && (
                          <div className={`flex items-center gap-2 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                            <MapPin className="w-3 h-3" />
                            <span className="line-clamp-1">{event.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Hidden Share Card for Image Generation */}
      <div 
        ref={cardRef}
        style={{ display: 'none' }}
        className="w-[1200px] h-[630px] relative overflow-hidden"
      >
        <div 
          className="w-full h-full flex flex-col relative"
          style={{ backgroundColor: theme === 'dark' ? '#0f0f0f' : '#ffffff' }}
        >
          {/* Header */}
          <div className="p-8 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-4xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {getFilterLabel(selectedFilter)} in {selectedLocation?.city}
                </h1>
                <p className={`text-xl ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                  {events.length} amazing events to check out
                </p>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  todo-events.com
                </div>
                <div className={`text-lg ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                  /roundup
                </div>
              </div>
            </div>
          </div>

          {/* Events Grid */}
          <div className="flex-1 px-8 pb-8">
            <div className="grid grid-cols-4 gap-6 h-full">
              {events.slice(0, 8).map((event, index) => {
                const category = getCategory(event.category);
                return (
                  <div
                    key={event.id}
                    className={`
                      rounded-xl overflow-hidden shadow-lg
                      ${theme === 'dark'
                        ? 'bg-neutral-800 border border-neutral-700'
                        : 'bg-gray-50 border border-gray-200'
                      }
                    `}
                  >
                    {/* Event Header */}
                    <div 
                      className="h-20 flex items-center justify-center"
                      style={{ backgroundColor: `${category.color}30` }}
                    >
                      <CategoryIcon 
                        category={event.category} 
                        className="w-8 h-8" 
                        style={{ color: category.color }}
                      />
                    </div>

                    {/* Event Details */}
                    <div className="p-3">
                      <h3 className={`font-semibold text-sm mb-2 line-clamp-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {event.title}
                      </h3>
                      
                      <div className="space-y-1 text-xs">
                        <div className={`flex items-center gap-1 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                          <Calendar className="w-3 h-3" />
                          <span>{formatEventDate(event)}</span>
                        </div>
                        
                        {event.start_time && (
                          <div className={`flex items-center gap-1 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                            <Clock className="w-3 h-3" />
                            <span>{formatEventTime(event)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close city suggestions */}
      {showCitySuggestions && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowCitySuggestions(false)}
        />
      )}
    </div>
  );
};

export default RoundupPage; 