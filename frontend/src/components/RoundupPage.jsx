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
import AddressAutocomplete from './EventMap/AddressAutocomplete';

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
  const [searchValue, setSearchValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Refs for image generation
  const cardRef = useRef(null);
  const abortControllerRef = useRef(null);

  const fetchEvents = useCallback(async () => {
    if (!selectedLocation) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    
    try {
      const requestData = {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        city: selectedLocation.city,
        max_distance: 50.0,
        limit: 12,
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

        if (!selectedCategories.includes('all') && selectedCategories.length > 0) {
          filteredEvents = filteredEvents.filter(event => 
            selectedCategories.includes(event.category)
          );
        }

        // Remove duplicates based on event title and date
        const uniqueEvents = [];
        const seen = new Set();
        
        for (const event of filteredEvents) {
          const key = `${event.title}-${event.date}-${event.start_time}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueEvents.push(event);
          }
        }

        setEvents(uniqueEvents.slice(0, 8));
      } else {
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

  useEffect(() => {
    if (selectedLocation) {
      fetchEvents();
    }
  }, [fetchEvents]);

  const handleLocationSelect = (locationData) => {
    console.log('Location selected:', locationData);
    setSelectedLocation({
      lat: locationData.lat,
      lng: locationData.lng,
      city: locationData.address || locationData.city || 'Selected Location'
    });
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
        width: 630,
        height: 1200,
        scale: 2,
        backgroundColor: theme === 'dark' ? '#1a1a2e' : '#667eea',
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
                Select Location
              </label>
              <div className="relative">
                <AddressAutocomplete
                  onSelect={handleLocationSelect}
                  value={searchValue}
                  onChange={setSearchValue}
                  theme={theme}
                />
              </div>
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
              Select a Location to Get Started
            </h3>
            <p className={`${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
              Search for any city, address, or location above to see available events
            </p>
          </div>
        ) : loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Finding Events...
            </h3>
            <p className={`${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
              Searching for {getFilterLabel(selectedFilter).toLowerCase()} events near {selectedLocation.city}
            </p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`} />
            <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              No Events Found
            </h3>
            <p className={`${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
              No events found for {getFilterLabel(selectedFilter).toLowerCase()} near {selectedLocation.city}. Try a different time period or location.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Preview Controls */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {getFilterLabel(selectedFilter)} near {selectedLocation.city}
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
        className="w-[630px] h-[1200px] relative overflow-hidden"
      >
        <div 
          className="w-full h-full flex flex-col relative"
          style={{ 
            background: theme === 'dark' 
              ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)'
          }}
        >
          {/* Header */}
          <div className="p-8 pb-6 text-white">
            <div className="text-center">
              <h1 className="text-5xl font-bold mb-3 drop-shadow-lg">
                {getFilterLabel(selectedFilter)}
              </h1>
              <h2 className="text-3xl font-semibold mb-2 opacity-90">
                {selectedLocation?.city}
              </h2>
              <p className="text-xl opacity-80">
                {events.length} amazing events happening
              </p>
            </div>
          </div>

          {/* Map Section */}
          <div className="flex-1 px-6 pb-6">
            <div 
              className="w-full h-80 rounded-2xl overflow-hidden shadow-2xl mb-6 relative"
              style={{ backgroundColor: '#e8f4f8' }}
            >
              {/* Simulated Map Background */}
              <div 
                className="w-full h-full relative"
                style={{
                  backgroundImage: `
                    linear-gradient(45deg, rgba(34, 197, 94, 0.1) 0%, transparent 25%),
                    linear-gradient(-45deg, rgba(59, 130, 246, 0.1) 25%, transparent 50%),
                    linear-gradient(135deg, rgba(168, 85, 247, 0.1) 50%, transparent 75%),
                    radial-gradient(circle at 30% 30%, rgba(34, 197, 94, 0.15) 0%, transparent 40%),
                    radial-gradient(circle at 70% 70%, rgba(59, 130, 246, 0.15) 0%, transparent 40%)
                  `,
                  backgroundColor: '#f8fafc'
                }}
              >
                {/* Map Grid Lines */}
                <svg className="absolute inset-0 w-full h-full opacity-10">
                  <defs>
                    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#64748b" strokeWidth="1"/>
                    </pattern>
                    <pattern id="roads" width="100" height="100" patternUnits="userSpaceOnUse">
                      <path d="M 0 50 L 100 50" fill="none" stroke="#e2e8f0" strokeWidth="3"/>
                      <path d="M 50 0 L 50 100" fill="none" stroke="#e2e8f0" strokeWidth="2"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  <rect width="100%" height="100%" fill="url(#roads)" />
                </svg>

                {/* Simulated Roads */}
                <svg className="absolute inset-0 w-full h-full opacity-20">
                  {/* Main highway */}
                  <path
                    d="M 0 60 Q 150 40 300 80 T 600 60"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  {/* Secondary road */}
                  <path
                    d="M 100 0 Q 120 100 140 200 T 180 300"
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  {/* Local street */}
                  <path
                    d="M 300 20 L 320 180"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Geographic features */}
                <div className="absolute inset-0">
                  {/* Park/Green space */}
                  <div 
                    className="absolute w-16 h-12 rounded-lg opacity-30"
                    style={{ 
                      top: '20%', 
                      left: '60%', 
                      backgroundColor: '#22c55e',
                      borderRadius: '50% 20% 50% 20%'
                    }}
                  />
                  {/* Water body */}
                  <div 
                    className="absolute w-12 h-8 rounded-full opacity-40"
                    style={{ 
                      top: '65%', 
                      left: '15%', 
                      backgroundColor: '#3b82f6'
                    }}
                  />
                  {/* Built area */}
                  <div 
                    className="absolute w-20 h-16 opacity-20"
                    style={{ 
                      top: '40%', 
                      left: '35%', 
                      backgroundColor: '#6b7280',
                      clipPath: 'polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)'
                    }}
                  />
                </div>

                {/* Event Pins on Map */}
                {events.slice(0, 6).map((event, index) => {
                  const category = getCategory(event.category);
                  const positions = [
                    { x: '25%', y: '20%' },
                    { x: '65%', y: '35%' },
                    { x: '45%', y: '55%' },
                    { x: '75%', y: '70%' },
                    { x: '20%', y: '75%' },
                    { x: '55%', y: '25%' }
                  ];
                  const pos = positions[index] || positions[0];
                  
                  return (
                    <div
                      key={event.id}
                      className="absolute transform -translate-x-1/2 -translate-y-full"
                      style={{ 
                        left: pos.x, 
                        top: pos.y
                      }}
                    >
                      {/* Pin Drop Shadow */}
                      <div 
                        className="absolute top-12 left-1/2 transform -translate-x-1/2 w-6 h-3 rounded-full opacity-20 blur-sm"
                        style={{ backgroundColor: '#000' }}
                      />
                      
                      {/* Main Pin */}
                      <div className="relative">
                        {/* Pin Shape using SVG */}
                        <svg 
                          width="40" 
                          height="52" 
                          viewBox="0 0 40 52" 
                          className="drop-shadow-lg"
                        >
                          {/* Pin Body */}
                          <path
                            d="M20 0C8.954 0 0 8.954 0 20c0 11.046 20 32 20 32s20-20.954 20-32C40 8.954 31.046 0 20 0z"
                            fill={category.color}
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="2"
                          />
                          {/* Inner circle for icon */}
                          <circle
                            cx="20"
                            cy="20"
                            r="12"
                            fill="rgba(255,255,255,0.9)"
                          />
                        </svg>
                        
                        {/* Category Icon */}
                        <div 
                          className="absolute top-2 left-1/2 transform -translate-x-1/2 flex items-center justify-center w-6 h-6"
                        >
                          <CategoryIcon 
                            category={event.category} 
                            className="w-5 h-5" 
                            style={{ color: category.color }}
                          />
                        </div>
                        
                        {/* Pin Highlight */}
                        <div 
                          className="absolute top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full opacity-30"
                          style={{ backgroundColor: 'white' }}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Location Label */}
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-800">
                      {selectedLocation?.city}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Events List */}
            <div className="space-y-4">
              {events.slice(0, 6).map((event, index) => {
                const category = getCategory(event.category);
                return (
                  <div
                    key={event.id}
                    className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border-l-4"
                    style={{ borderLeftColor: category.color }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Event Icon */}
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center shadow-md flex-shrink-0"
                        style={{ backgroundColor: `${category.color}20` }}
                      >
                        <CategoryIcon 
                          category={event.category} 
                          className="w-6 h-6" 
                          style={{ color: category.color }}
                        />
                      </div>

                      {/* Event Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-gray-900 mb-1 leading-tight">
                          {event.title}
                        </h3>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Calendar className="w-4 h-4" style={{ color: category.color }} />
                            <span className="font-medium">
                              {formatEventDate(event)}
                              {event.start_time && ` • ${formatEventTime(event)}`}
                            </span>
                          </div>
                          
                          {event.address && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <MapPin className="w-4 h-4" style={{ color: category.color }} />
                              <span className="text-sm truncate">
                                {event.address}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Category Badge */}
                        <div className="mt-2">
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: category.color }}
                          >
                            {category.name}
                            {event.verified && (
                              <span className="ml-1 w-3 h-3 bg-green-400 rounded-full flex items-center justify-center">
                                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 text-white text-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-2xl font-bold mb-1">
                todo-events.com
              </div>
              <div className="text-lg opacity-90">
                /roundup
              </div>
              <div className="text-sm opacity-75 mt-2">
                Find local events wherever you are
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundupPage; 