import React, { useState, useEffect, useRef, useContext } from "react";
import { ThemeContext } from "../ThemeContext";
import { AuthContext } from "./AuthContext";
import CreateEventForm from "./CreateEventForm";
import LoginForm from "./LoginForm";
import CalendarFilter from "./CalendarFilter";
import MapContainer from "./MapContainer";
import ShareCard from "./ShareCard";
import categories, { getCategory } from "./categoryConfig";
import { CategoryIcon } from "./CategoryIcons";
import * as htmlToImage from 'html-to-image';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "../ui/radix-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Settings,
  User,
  LogOut,
  X,
  Calendar,
  MapPin,
  Clock,
  Menu,
  Filter,
  Search,
  Shield,
  Navigation,
  AlertCircle,
  HelpCircle,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DialogDescription
} from "@/components/ui/radix-dialog";
import {
  SheetClose
} from "@/components/ui/sheet";
import ThemeToggle from '@/components/ui/ThemeToggle';
import AddressAutocomplete from './AddressAutocomplete';
import WelcomePopup from '../WelcomePopup';
import EventInteractionComponents from './EventInteractionComponents';

import { API_URL } from '@/config';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { createMarkerIcon } from './markerUtils';
import { batchedSync } from '@/utils/batchedSync';
import CacheManager from './CacheManager';


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

// Add this function before the EventDetailsPanel component
const generateEventSchema = (event) => {
  // Add comprehensive null/undefined checks
  if (!event || typeof event !== 'object') {
    console.warn('generateEventSchema: Invalid event object', event);
    return null;
  }

  // Ensure required fields exist
  const requiredFields = ['title', 'description', 'date', 'start_time', 'address', 'lat', 'lng'];
  for (const field of requiredFields) {
    if (!event[field] && event[field] !== 0) { // Allow 0 for lat/lng
      console.warn(`generateEventSchema: Missing required field '${field}'`, event);
      return null;
    }
  }

  try {
    const startDateTime = `${event.date}T${event.start_time}:00`;
    
    // Handle end date/time with proper null checks
    const endDate = (event.end_date && event.end_time)
      ? `${event.end_date}T${event.end_time}:00`
      : (event.end_time ? `${event.date}T${event.end_time}:00` : null);

    const schema = {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": event.title || 'Untitled Event',
      "description": event.description || 'No description available',
      "startDate": startDateTime,
      "location": {
        "@type": "Place",
        "name": event.address || 'Location not specified',
        "address": event.address || 'Address not available',
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": event.lat || 0,
          "longitude": event.lng || 0
        }
      },
      "organizer": {
        "@type": "Organization",
        "name": "TodoEvents"
      }
    };

    // Only add endDate if we have valid end time information
    if (endDate) {
      schema.endDate = endDate;
    }

    return schema;
  } catch (error) {
    console.error('generateEventSchema: Error generating schema', error, event);
    return null;
  }
};

// Add this function to inject schema into the document head
const injectEventSchema = (event) => {
  // Remove any existing event schema
  const existingSchema = document.querySelector('script[data-event-schema]');
  if (existingSchema) {
    existingSchema.remove();
  }
  
  if (!event) return;
  
  // Create new schema script
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-event-schema', 'true');
  script.textContent = JSON.stringify(generateEventSchema(event));
  document.head.appendChild(script);
};

// Add this function before the EventDetailsPanel component
const getTimePeriod = (timeString) => {
  if (!timeString) return null;
  
  try {
    // Extract hour from time string (assuming format like "09:00", "14:30", etc.)
    const hour = parseInt(timeString.split(':')[0], 10);
    
    if (hour >= 5 && hour < 12) return 'morning';      // 5 AM - 11:59 AM
    if (hour >= 12 && hour < 17) return 'afternoon';   // 12 PM - 4:59 PM
    if (hour >= 17 && hour < 21) return 'evening';     // 5 PM - 8:59 PM
    return 'night';                                     // 9 PM - 4:59 AM
  } catch (error) {
    console.warn('Error parsing time:', timeString, error);
    return null;
  }
};

const EventDetailsPanel = ({ event, user, onClose, onEdit, onDelete, activeTab, setActiveTab, shareCardRef, downloadStatus, handleDownload, handleCopyLink, handleFacebookShare }) => {
  // Add comprehensive null checks
  if (!event || typeof event !== 'object') {
    return (
      <div className="p-6 text-center">
        <p className="text-themed-secondary">Event not found</p>
      </div>
    );
  }

  const formatEventDate = (event) => {
    if (!event.date) return 'Date not specified';
    
    try {
      const startDate = new Date(event.date);
      const endDate = event.end_date ? new Date(event.end_date) : null;
      
      if (endDate && event.end_date !== event.date) {
        return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
      }
      return startDate.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return event.date || 'Date not specified';
    }
  };

  const formatEventTime = (event) => {
    if (!event.start_time) return 'Time not specified';
    
    try {
      const startTime = event.start_time;
      const endTime = event.end_time;
      
      if (endTime) {
        return `${startTime} - ${endTime}`;
      }
      return startTime;
    } catch (error) {
      console.error('Error formatting time:', error);
      return event.start_time || 'Time not specified';
    }
  };

  const formatDateRange = (event) => {
    if (!event.date) return 'Date not specified';
    
    try {
      const startDate = new Date(event.date);
      let dateRange = startDate.toLocaleDateString();
      
      // Only add end date if it exists and is different from start date
      if (event.end_date && event.end_date !== event.date) {
        const endDate = new Date(event.end_date);
        dateRange += ` - ${endDate.toLocaleDateString()}`;
      }
      
      return dateRange;
    } catch (error) {
      console.error('Error formatting date range:', error);
      return event.date || 'Date not specified';
    }
  };

  const category = getCategory(event.category);
  const Icon = category.icon;

  // Inject schema data when event is displayed
  useEffect(() => {
    if (event) {
      injectEventSchema(event);
      
      // Update page title and meta description for this event
      const originalTitle = document.title;
      const originalDescription = document.querySelector('meta[name="description"]')?.content;
      
      document.title = `${event.title} | todo-events - Local Event Discovery`;
      
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.content = `${event.title} - ${event.description || `${event.category} event`} at ${event.address}. Find this and more local events on todo-events.`;
      }
      
      // Cleanup function to restore original meta data
      return () => {
        document.title = originalTitle;
        if (metaDescription && originalDescription) {
          metaDescription.content = originalDescription;
        }
        injectEventSchema(null); // Remove schema when panel closes
      };
    }
  }, [event]);

  return (
    <div className="absolute right-4 top-4 w-96 dialog-themed backdrop-blur-sm rounded-xl overflow-hidden z-20 shadow-2xl">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-spark-yellow/10 border border-spark-yellow/20">
              <Icon className={`w-6 h-6 ${category.color}`} />
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-display font-semibold text-themed-primary">{event.title}</h2>
              <span className="text-xs event-id-text font-mono">ID: {event.id}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-themed-secondary hover:text-themed-primary hover:bg-white/10 rounded-full transition-all duration-200"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 mb-2">
          <button
            className={`px-3 py-1 font-medium rounded-t ${activeTab === 'details' ? 'bg-white/10 text-themed-primary' : 'text-themed-secondary hover:bg-white/5'}`}
            onClick={() => setActiveTab('details')}
          >Details</button>
          <button
            className={`px-3 py-1 font-medium rounded-t ${activeTab === 'share' ? 'bg-white/10 text-themed-primary' : 'text-themed-secondary hover:bg-white/5'}`}
            onClick={() => setActiveTab('share')}
          >Share</button>
        </div>
        {activeTab === 'details' ? (
          <>
            <p className="text-themed-primary font-body leading-relaxed">{event.description}</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-themed-secondary">
                <div className="p-1.5 rounded-md bg-pin-blue/10">
                  <Calendar className="w-4 h-4 text-pin-blue" />
                </div>
                <span className="font-data">
                  {formatEventDate(event)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-themed-secondary">
                <div className="p-1.5 rounded-md bg-fresh-teal/10">
                  <Clock className="w-4 h-4 text-fresh-teal" />
                </div>
                <span className="font-data">
                  {formatEventTime(event)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-themed-secondary">
                <div className="p-1.5 rounded-md bg-vibrant-magenta/10">
                  <MapPin className="w-4 h-4 text-vibrant-magenta" />
                </div>
                <span className="font-body">{event.address || 'No address provided'}</span>
              </div>
              {event.distance !== undefined && (
                <div className="text-sm text-themed-secondary font-data">
                  📍 {event.distance.toFixed(1)} miles away
                </div>
              )}
              
              {/* Interest and View Tracking */}
              <EventInteractionComponents eventId={event.id} />
            </div>
            {user && (user.id === event.created_by || user.role === 'admin') && (
              <div className="pt-4 space-y-3 border-t border-white/10">
                <Button
                  variant="ghost"
                  className="w-full btn-secondary text-themed-primary font-medium transition-all duration-200 hover:scale-[1.02]"
                  onClick={onEdit}
                >
                  Edit Event
                </Button>
                <Button
                  className="w-full bg-vibrant-magenta/20 hover:bg-vibrant-magenta/30 text-vibrant-magenta border border-vibrant-magenta/30 font-medium transition-all duration-200 hover:scale-[1.02]"
                  onClick={() => onDelete(event.id)}
                >
                  Delete Event
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div ref={shareCardRef} className="my-2">
              <ShareCard event={event} />
            </div>
            <div className="flex flex-col gap-3 w-full">
              <Button 
                onClick={handleDownload} 
                className="w-full btn-yellow-themed font-bold min-h-[44px]"
              >
                Download Image
              </Button>
              <div className="flex gap-2">
                <Button 
                  onClick={handleCopyLink} 
                  variant="secondary" 
                  className="flex-1 min-h-[40px]"
                >
                  Copy Link
                </Button>
                <Button 
                  onClick={handleFacebookShare} 
                  variant="secondary" 
                  className="flex-1 min-h-[40px]"
                >
                  Share to Facebook
                </Button>
              </div>
            </div>
            {downloadStatus && <div className="text-xs text-themed-secondary mt-1 text-center">{downloadStatus}</div>}
            <div className="text-xs text-themed-muted mt-1 text-center">
              <strong>Facebook:</strong> Image will auto-download, then upload it in Facebook.<br/>
              <strong>Instagram:</strong> Download and upload the image to your story or feed!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
};

// Helper function to format event date
const formatEventDate = (event) => {
  if (!event?.date) return 'Date not specified';
  
  try {
    const startDate = new Date(event.date);
    let dateStr = startDate.toLocaleDateString();
    
    if (event.end_date && event.end_date !== event.date) {
      const endDate = new Date(event.end_date);
      dateStr += ` - ${endDate.toLocaleDateString()}`;
    }
    
    return dateStr;
  } catch (error) {
    console.error('Error formatting date:', error);
    return event.date || 'Date not specified';
  }
};

// Helper function to format event time
const formatEventTime = (event) => {
  if (!event?.start_time) return 'Time not specified';
  
  try {
    let timeStr = event.start_time;
    if (event.end_time) {
      timeStr += ` - ${event.end_time}`;
    }
    return timeStr;
  } catch (error) {
    console.error('Error formatting time:', error);
    return event.start_time || 'Time not specified';
  }
};

const renderEventList = (events, selectedEvent, handleEventClick, user, mapCenter) => (
  <div className="space-y-2 p-4">
    {events && events.length > 0 ? events.filter(event => 
      // Filter out null or invalid events
      event && typeof event === 'object' && event.title && event.date && event.lat != null && event.lng != null
    ).map(event => {
      const category = getCategory(event.category);
      const distance = mapCenter ? calculateDistance(
        mapCenter.lat, mapCenter.lng, event.lat, event.lng
      ) : null;
      
      return (
        <div
          key={event.id}
          className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:scale-[1.02] ${
            selectedEvent?.id === event.id
              ? 'border-spark-yellow/40 bg-spark-yellow/10 shadow-lg'
              : 'border-white/10 bg-white/5 hover:bg-white/10'
          }`}
          onClick={() => handleEventClick(event)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {React.createElement(category.icon, {
                  className: `w-4 h-4 ${category.color}`
                })}
                <h3 className="font-semibold text-themed-primary text-sm truncate">
                  {event.title || 'Untitled Event'}
                </h3>
              </div>
              
              <div className="space-y-1 text-xs text-themed-secondary">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatEventDate(event)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatEventTime(event)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{event.address || 'Location not specified'}</span>
                </div>
                {distance !== null && (
                  <div className="flex items-center gap-1">
                    <Navigation className="w-3 h-3" />
                    <span>{distance.toFixed(1)} miles away</span>
                  </div>
                )}
              </div>
              
              {/* Event Interaction Components */}
              <div className="mt-2 pt-2 border-t border-white/10">
                <EventInteractionComponents eventId={event.id} />
              </div>
            </div>
          </div>
        </div>
      );
    }) : (
      <div className="text-center py-8 text-themed-muted">
        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No events found in this area</p>
      </div>
    )}
  </div>
);


const EventMap = ({ mapsLoaded = false }) => {
  const { user, token, logout } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);

  const [events, setEvents] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(['all']);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('all');
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [proximityRange, setProximityRange] = useState(15);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState('map');
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [loginMode, setLoginMode] = useState('login');
  const [editingEvent, setEditingEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [downloadStatus, setDownloadStatus] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState('date');
  const [error, setError] = useState(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCacheManager, setShowCacheManager] = useState(false);

  const mapRef = useRef(null);
  const shareCardRef = useRef();

  const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
  const DEFAULT_ZOOM = 4;

  const mapCenter = selectedLocation ? {
    lat: selectedLocation.lat,
    lng: selectedLocation.lng
  } : null;

  const handleResetView = () => {
    setSelectedLocation(null);
    setSearchValue('');
    setProximityRange(15);
    setSelectedDate(null);
    setSelectedTime('all');
    setSelectedCategory(['all']);
    setSelectedEvent(null);
    
    if (mapRef.current) {
      mapRef.current.resetView();
    }
  };

  const handleCategorySelect = (categoryId) => {
    if (categoryId === 'all') {
      // If "All Events" is clicked, select only "all"
      setSelectedCategory(['all']);
    } else {
      setSelectedCategory(prevSelected => {
        // Remove "all" if it's currently selected
        const withoutAll = prevSelected.filter(id => id !== 'all');
        
        if (withoutAll.includes(categoryId)) {
          // Category is currently selected, remove it
          const newSelection = withoutAll.filter(id => id !== categoryId);
          // If no categories left, default to "all"
          return newSelection.length === 0 ? ['all'] : newSelection;
        } else {
          // Category is not selected, add it
          return [...withoutAll, categoryId];
        }
      });
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      if (selectedDate) {
        params.append('date', selectedDate);
      }
      if (mapCenter) {
        params.append('lat', mapCenter.lat.toString());
        params.append('lng', mapCenter.lng.toString());
        params.append('radius', '25');
      }

      const url = `${API_URL}/events${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetchWithTimeout(url, { method: 'GET' }, 10000);
      
      // Initialize batchedSync cache with the event data that includes interest_count and view_count
      if (response && Array.isArray(response)) {
        // Get current event IDs from server
        const currentEventIds = new Set(response.map(event => event.id.toString()));
        
        // Clean up any cached events that no longer exist on the server
        const cachedEventIds = Array.from(batchedSync.localCache.keys());
        for (const cachedEventId of cachedEventIds) {
          if (!currentEventIds.has(cachedEventId.toString())) {
            console.log(`🗑️ Cleaning up deleted event ${cachedEventId} from cache`);
            batchedSync.removeEvent(cachedEventId);
          }
        }
        
        // Initialize cache with server data for each event
        response.forEach(event => {
          batchedSync.updateCache(event.id, {
            interested: false, // Will be determined by individual interest check if needed
            interest_count: event.interest_count || 0,
            view_count: event.view_count || 0,
            viewTracked: false,
            lastSync: Date.now(),
            isOptimistic: false
          });
        });
        console.log(`🎯 Initialized cache for ${response.length} events with interest/view counts from server`);
      }
      
      setEvents(response || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      setError('Failed to load events. Please try again.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []); // Only fetch events once on component mount

  // Handle URL parameters for event deep linking
  useEffect(() => {
    const handleUrlParams = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const eventId = urlParams.get('event');
      
      if (eventId && events.length > 0 && !selectedEvent) {
        const targetEvent = events.find(event => event.id.toString() === eventId.toString());
        
        if (targetEvent) {
          console.log('Found event from URL parameter:', targetEvent.title);
          setSelectedEvent(targetEvent);
          setActiveTab('details'); // Start with details tab
          
          // Update URL without the event parameter to clean it up
          const newUrl = new URL(window.location);
          newUrl.searchParams.delete('event');
          window.history.replaceState({}, '', newUrl.pathname + newUrl.search);
          
          // If the event has coordinates, center the map on it
          if (targetEvent.lat && targetEvent.lng) {
            setSelectedLocation({
              lat: targetEvent.lat,
              lng: targetEvent.lng,
              address: targetEvent.address
            });
          }
        } else {
          console.warn(`Event with ID ${eventId} not found in current events list`);
        }
      }
    };

    // Only run after events are loaded and we don't already have a selected event
    if (events.length > 0) {
      handleUrlParams();
    }
  }, [events.length]); // Only depend on events.length, not the entire events array

  const handleAddressSelect = (data) => {
    setSelectedLocation({
      lat: data.lat,
      lng: data.lng,
      address: data.address
    });
    setSearchValue(data.address);
    
    // Close mobile menu if open
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  const filteredEvents = events.filter(event => {
    // Basic null/validity check
    if (!event || !event.id || event.lat == null || event.lng == null) return false;
    
    // Category filter
    const categoryMatch = selectedCategory.includes('all') || selectedCategory.some(categoryId => categoryId === event.category);
    if (!categoryMatch) return false;
    
    // Date filter
    const dateMatch = isDateInRange(event.date, selectedDate);
    if (!dateMatch) return false;
    
    // Time filter
    if (selectedTime !== 'all') {
      const eventTimePeriod = getTimePeriod(event.start_time);
      if (eventTimePeriod !== selectedTime) return false;
    }
    
    // Proximity filter - only apply if we have a selected location
    if (selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null) {
      const distance = calculateDistance(
        selectedLocation.lat,
        selectedLocation.lng,
        event.lat,
        event.lng
      );
      
      // Filter by proximity range
      if (distance > proximityRange) return false;
      
      // Add distance to event for display purposes
      event.distance = distance;
    }
    
    return true;
  }).sort((a, b) => {
    // Sort by distance if available, otherwise by date
    if (a.distance != null && b.distance != null) {
      return a.distance - b.distance;
    }
    return new Date(a.date) - new Date(b.date);
  });

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    
    if (activeView === 'list') {
      setActiveView('map');
    }
  };

  const handleCreateEvent = async (newEvent, skipApiCall = false) => {
    if (!user) {
      setError('Please log in to create events');
      return;
    }

    // Validate event data
    if (!newEvent || typeof newEvent !== 'object') {
      setError('Invalid event data');
      return;
    }

    const requiredFields = ['title', 'description', 'date', 'start_time', 'category', 'address'];
    for (const field of requiredFields) {
      if (!newEvent[field]) {
        setError(`Missing required field: ${field}`);
        return;
      }
    }

    if (!newEvent.location || typeof newEvent.location !== 'object' || 
        newEvent.location.lat == null || newEvent.location.lng == null) {
      setError('Please select a valid location');
      return;
    }

    if (skipApiCall) {
      // Event was already created by the form, just update the UI
      try {
        await fetchEvents();
        setIsCreateFormOpen(false);
        setError(null);
      } catch (error) {
        console.error('Error refreshing events:', error);
        setError('Event created but failed to refresh event list');
      }
      return;
    }

    try {
      setIsCreatingEvent(true);
      setError(null);

      // Prepare event data with proper null handling
      const eventData = {
        title: newEvent.title || '',
        description: newEvent.description || '',
        category: newEvent.category || 'other',
        date: newEvent.date || '',
        start_time: newEvent.start_time || '',
        end_time: newEvent.end_time || null,
        end_date: newEvent.end_date || null,
        address: newEvent.address || '',
        lat: Number(newEvent.location.lat) || 0,
        lng: Number(newEvent.location.lng) || 0,
        recurring: Boolean(newEvent.recurring),
        frequency: newEvent.frequency || null
      };

      // Validate coordinates
      if (Math.abs(eventData.lat) > 90 || Math.abs(eventData.lng) > 180) {
        throw new Error('Invalid coordinates');
      }

      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const createdEvent = await response.json();
      
      // Validate the created event
      if (!createdEvent || typeof createdEvent !== 'object') {
        throw new Error('Invalid response from server');
      }

      // Update events list
      await fetchEvents();
      
      setIsCreateFormOpen(false);
      setSelectedEvent(createdEvent);

    } catch (error) {
      console.error('Error creating event:', error);
      setError(error.message || 'Failed to create event. Please try again.');
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const handleEventDelete = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      // fetchWithTimeout already returns parsed JSON data, not a Response object
      await fetchWithTimeout(`${API_URL}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      await fetchEvents();
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      if (error.message && error.message.includes('401')) {
        setShowLoginDialog(true);
      }
    }
  };

  // Download ShareCard as image
  const handleDownload = async () => {
    setDownloadStatus('Generating...');
    
    try {
      if (!selectedEvent) {
        throw new Error('No event selected');
      }

      // Ensure we're on the share tab
      if (activeTab !== 'share') {
        console.log('Switching to share tab...');
        setActiveTab('share');
        // Wait for tab to switch and component to render
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      const node = shareCardRef.current;
      if (!node) {
        throw new Error('Share card ref not found - please ensure you are on the Share tab');
      }

      console.log('=== Download Debug Info ===');
      console.log('Theme:', theme);
      console.log('Selected event:', selectedEvent.title);
      console.log('Active tab:', activeTab);
      
      // Wait for component to fully render and fonts to load
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Find the actual ShareCard element
      const shareCardElement = node.querySelector('#share-card-root') || node.querySelector('[id*="share"]') || node;
      
      console.log('=== Element Debug ===');
      console.log('Wrapper node dimensions:', node.offsetWidth, 'x', node.offsetHeight);
      console.log('ShareCard element dimensions:', shareCardElement.offsetWidth, 'x', shareCardElement.offsetHeight);
      
      // Create a temporary wrapper div with fixed dimensions
      let tempWrapper = null;
      let originalParent = null;
      let originalNextSibling = null;
      
      try {
        // Create temporary wrapper with fixed dimensions
        tempWrapper = document.createElement('div');
        tempWrapper.style.cssText = `
          position: fixed !important;
          left: -9999px !important;
          top: 0px !important;
          width: 380px !important;
          height: auto !important;
          visibility: visible !important;
          display: block !important;
          z-index: -1 !important;
          background: transparent !important;
        `;
        
        // Store original position info
        originalParent = shareCardElement.parentNode;
        originalNextSibling = shareCardElement.nextSibling;
        
        // Move ShareCard to temporary wrapper
        tempWrapper.appendChild(shareCardElement);
        document.body.appendChild(tempWrapper);
        
        // Force ShareCard to have proper dimensions
        shareCardElement.style.cssText = `
          width: 380px !important;
          max-width: 380px !important;
          min-width: 380px !important;
          height: auto !important;
          display: flex !important;
          flex-direction: column !important;
          visibility: visible !important;
          position: relative !important;
          margin: 0 !important;
          padding: 0 !important;
        `;
        
        // Force a reflow and wait for layout
        shareCardElement.offsetHeight;
        await new Promise(resolve => setTimeout(resolve, 300));
        
        console.log('=== After Repositioning ===');
        console.log('TempWrapper dimensions:', tempWrapper.offsetWidth, 'x', tempWrapper.offsetHeight);
        console.log('ShareCard dimensions:', shareCardElement.offsetWidth, 'x', shareCardElement.offsetHeight);
        
        if (shareCardElement.offsetWidth === 0 || shareCardElement.offsetHeight === 0) {
          throw new Error('ShareCard still has no dimensions. Component structure may be problematic.');
        }

        let dataUrl = null;
        let lastError = null;

        // Method 1: Try with html-to-image on the properly positioned element
        try {
          console.log('Trying method 1: html-to-image capture...');
          
          const options = {
            backgroundColor: theme === "dark" ? "#0f0f0f" : "#ffffff",
            width: shareCardElement.offsetWidth,
            height: shareCardElement.offsetHeight,
            pixelRatio: 3,
            useCORS: false,
            allowTaint: false,
            foreignObjectRendering: false,
            skipFonts: true,
            cacheBust: true,
            filter: (node) => {
              // Skip external stylesheets and Google Fonts
              if (node.tagName === 'LINK' && node.href && 
                  (node.href.includes('fonts.googleapis.com') || 
                   node.href.includes('fonts.gstatic.com') ||
                   node.href.includes('maps.googleapis.com'))) {
                return false;
              }
              // Skip style elements that might contain external CSS
              if (node.tagName === 'STYLE' && node.textContent && 
                  (node.textContent.includes('googleapis.com') || 
                   node.textContent.includes('gstatic.com'))) {
                return false;
              }
              return true;
            }
          };
          
          console.log('Capture options:', options);
          dataUrl = await htmlToImage.toPng(shareCardElement, options);
          console.log('Method 1 successful - data URL length:', dataUrl.length);
        } catch (error) {
          lastError = error;
          console.warn('Method 1 failed:', error.message);
        }

        // Method 2: Canvas fallback if html-to-image fails
        if (!dataUrl || dataUrl.length < 100) {
          try {
            console.log('Trying method 2: Canvas fallback...');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size
            canvas.width = 1200;
            canvas.height = 900;
            
            // Fill background
            ctx.fillStyle = theme === "dark" ? "#0f0f0f" : "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Set text properties
            ctx.fillStyle = theme === "dark" ? "#ffffff" : "#000000";
            ctx.font = "bold 32px Arial, sans-serif";
            ctx.textAlign = "center";
            
            // Draw event title
            const title = selectedEvent.title;
            const wrappedTitle = title.length > 30 ? title.substring(0, 30) + "..." : title;
            ctx.fillText(wrappedTitle, canvas.width/2, 100);
            
            // Draw event details
            ctx.font = "20px Arial, sans-serif";
            ctx.fillText(`${selectedEvent.date} at ${selectedEvent.time}`, canvas.width/2, 200);
            
            // Draw location
            ctx.font = "16px Arial, sans-serif";
            const address = selectedEvent.address;
            const wrappedAddress = address.length > 50 ? address.substring(0, 50) + "..." : address;
            ctx.fillText(wrappedAddress, canvas.width/2, 250);
            
            // Draw category with dark text on yellow background
            ctx.fillStyle = "#F5C842"; // Our themed yellow color
            ctx.fillRect(canvas.width/2 - 100, 280, 200, 40); // Background rectangle
            ctx.fillStyle = "#1A1A1A"; // Dark text on yellow background
            ctx.font = "18px Arial, sans-serif";
            ctx.fillText(getCategory(selectedEvent.category).label, canvas.width/2, 305);
            
            // Draw branding with dark text on yellow background
            ctx.fillStyle = "#F5C842"; // Our themed yellow color
            ctx.fillRect(canvas.width/2 - 120, 470, 240, 50); // Background rectangle
            ctx.fillStyle = "#1A1A1A"; // Dark text on yellow background
            ctx.font = "bold 24px Arial, sans-serif";
            ctx.fillText("todo-events.com", canvas.width/2, 500);
            
            dataUrl = canvas.toDataURL('image/png');
            console.log('Method 2 successful - Canvas fallback generated, data URL length:', dataUrl.length);
          } catch (error) {
            lastError = error;
            console.warn('Method 2 failed:', error.message);
          }
        }

        // Check if we have a valid data URL
        if (!dataUrl || dataUrl.length < 100) {
          console.error('All methods failed. Last error:', lastError);
          throw new Error(`Failed to generate image. ${lastError?.message || 'Unknown error occurred'}`);
        }

        // Create and trigger download
        const link = document.createElement('a');
        link.download = `event-${selectedEvent.id}-share.png`;
        link.href = dataUrl;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('Download completed successfully');
        setDownloadStatus('Downloaded!');
        setTimeout(() => setDownloadStatus(''), 2000);
        
      } finally {
        // Cleanup: restore ShareCard to original position
        if (originalParent && shareCardElement) {
          try {
            // Remove forced styles
            shareCardElement.style.cssText = '';
            
            // Restore to original position
            if (originalNextSibling) {
              originalParent.insertBefore(shareCardElement, originalNextSibling);
            } else {
              originalParent.appendChild(shareCardElement);
            }
          } catch (restoreError) {
            console.warn('Error restoring ShareCard position:', restoreError);
          }
        }
        
        // Remove temporary wrapper
        if (tempWrapper && tempWrapper.parentNode) {
          try {
            tempWrapper.parentNode.removeChild(tempWrapper);
          } catch (cleanupError) {
            console.warn('Error removing temp wrapper:', cleanupError);
          }
        }
      }
      
    } catch (err) {
      console.error('Download error:', err);
      
      setDownloadStatus(`Error: ${err.message}`);
      setTimeout(() => setDownloadStatus(''), 6000);
    }
  };

  // Copy event link
  const handleCopyLink = () => {
    const url = `${window.location.origin}/?event=${selectedEvent.id}`;
    navigator.clipboard.writeText(url);
    setDownloadStatus('Link copied!');
    setTimeout(() => setDownloadStatus(''), 1500);
  };

  // Facebook share
  const handleFacebookShare = async () => {
    try {
      setDownloadStatus('Preparing for Facebook sharing...');
      
      // First generate and download the image automatically
      const shareCardElement = shareCardRef.current?.querySelector('#share-card-root');
      if (!shareCardElement) {
        throw new Error('ShareCard element not found');
      }

      // Create temporary wrapper for proper sizing (same as download function)
      const tempWrapper = document.createElement('div');
      tempWrapper.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: 380px !important;
        height: auto !important;
        overflow: visible;
        z-index: -1;
      `;
      document.body.appendChild(tempWrapper);

      try {
        // Move ShareCard to temp wrapper
        const originalParent = shareCardElement.parentNode;
        const originalNextSibling = shareCardElement.nextSibling;
        tempWrapper.appendChild(shareCardElement);

        // Force proper dimensions
        shareCardElement.style.cssText = `
          width: 380px !important;
          max-width: 380px !important;
          min-width: 380px !important;
          height: auto !important;
          display: flex !important;
          flex-direction: column !important;
          visibility: visible !important;
          position: relative !important;
          margin: 0 !important;
          padding: 0 !important;
        `;

        // Wait for layout
        shareCardElement.offsetHeight;
        await new Promise(resolve => setTimeout(resolve, 500));

        let dataUrl = null;
        let method = '';

        // Try multiple methods with better error handling
        try {
          // Method 1: Safe mode with Google Fonts filtering
          console.log('Trying Facebook share method 1: Safe mode...');
          const safeOptions = {
            backgroundColor: theme === "dark" ? "#0f0f0f" : "#ffffff",
            width: shareCardElement.offsetWidth,
            height: shareCardElement.offsetHeight,
            pixelRatio: 2, // Lower quality for more reliability
            useCORS: false,
            allowTaint: false,
            foreignObjectRendering: false,
            skipFonts: true,
            cacheBust: true,
            filter: (node) => {
              // Skip external stylesheets and Google Fonts
              if (node.tagName === 'LINK' && node.href && 
                  (node.href.includes('fonts.googleapis.com') || 
                   node.href.includes('fonts.gstatic.com') ||
                   node.href.includes('maps.googleapis.com'))) {
                return false;
              }
              // Skip style elements that might contain external CSS
              if (node.tagName === 'STYLE' && node.textContent && 
                  (node.textContent.includes('googleapis.com') || 
                   node.textContent.includes('gstatic.com'))) {
                return false;
              }
              return true;
            }
          };

          dataUrl = await htmlToImage.toPng(shareCardElement, safeOptions);
          method = 'Safe mode';
        } catch (safeError) {
          console.log('Safe mode failed, trying method 2:', safeError.message);
          
          // Method 2: Canvas fallback - create basic image
          try {
            console.log('Trying Facebook share method 2: Canvas fallback...');
            const canvas = document.createElement('canvas');
            canvas.width = 1200;
            canvas.height = 900;
            const ctx = canvas.getContext('2d');
            
            // Fill background
            ctx.fillStyle = theme === "dark" ? "#0f0f0f" : "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add event info as text
            ctx.fillStyle = theme === "dark" ? "#ffffff" : "#000000";
            ctx.font = 'bold 48px Arial, sans-serif';
            ctx.textAlign = 'center';
            
            const wrapText = (text, x, y, maxWidth, lineHeight) => {
              const words = text.split(' ');
              let line = '';
              let currentY = y;
              
              for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                
                if (testWidth > maxWidth && n > 0) {
                  ctx.fillText(line, x, currentY);
                  line = words[n] + ' ';
                  currentY += lineHeight;
                } else {
                  line = testLine;
                }
              }
              ctx.fillText(line, x, currentY);
              return currentY + lineHeight;
            };
            
            // Draw event details
            let currentY = 150;
            currentY = wrapText(selectedEvent.title, canvas.width/2, currentY, 1000, 60) + 40;
            
            ctx.font = '32px Arial, sans-serif';
            currentY = wrapText(`📅 ${selectedEvent.date} at ${selectedEvent.time}`, canvas.width/2, currentY, 1000, 40) + 20;
            currentY = wrapText(`📍 ${selectedEvent.address}`, canvas.width/2, currentY, 1000, 40) + 40;
            
            ctx.font = '24px Arial, sans-serif';
            currentY = wrapText(selectedEvent.description || '', canvas.width/2, currentY, 1000, 35) + 60;
            
            // Add branding
            ctx.font = 'bold 28px Arial, sans-serif';
            ctx.fillStyle = '#3B82F6';
            ctx.fillText('Find more events at todo-events.com', canvas.width/2, canvas.height - 100);
            
            dataUrl = canvas.toDataURL('image/png');
            method = 'Canvas fallback';
          } catch (canvasError) {
            console.error('Canvas fallback failed:', canvasError);
            throw new Error('All image generation methods failed');
          }
        }

        // Restore ShareCard to original position
        if (originalNextSibling) {
          originalParent.insertBefore(shareCardElement, originalNextSibling);
        } else {
          originalParent.appendChild(shareCardElement);
        }

        // Clean up temp wrapper
        document.body.removeChild(tempWrapper);

        console.log(`Facebook share image generated using: ${method}`);

        // Automatically download the image
        const link = document.createElement('a');
        link.download = `${selectedEvent.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_event.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Also try to copy to clipboard as backup
        try {
          const img = new Image();
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob(async (blob) => {
              try {
                await navigator.clipboard.write([
                  new ClipboardItem({ 'image/png': blob })
                ]);
                console.log('Image also copied to clipboard');
              } catch (e) {
                console.log('Clipboard copy failed, but download succeeded');
              }
            });
          };
          img.src = dataUrl;
        } catch (e) {
          console.log('Clipboard backup failed, but download succeeded');
        }

        // Open Facebook with event URL and helpful text
        const eventUrl = `${window.location.origin}/?event=${selectedEvent.id}`;
        const encodedUrl = encodeURIComponent(eventUrl);
        const shareText = encodeURIComponent(`Check out this amazing event: ${selectedEvent.title}!\n\n📅 ${selectedEvent.date} at ${selectedEvent.time}\n📍 ${selectedEvent.address}\n\n${selectedEvent.description}\n\nFind more local events at todo-events.com`);
        
        // Small delay to let download start
        setTimeout(() => {
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${shareText}`, '_blank');
          
          setDownloadStatus(`✅ Image downloaded (${method})! Upload it to your Facebook post.`);
          setTimeout(() => setDownloadStatus(''), 5000);
        }, 500);

      } catch (error) {
        // Clean up on error
        if (tempWrapper.parentNode) {
          document.body.removeChild(tempWrapper);
        }
        throw error;
      }

    } catch (error) {
      console.error('Facebook share error:', error);
      // Fallback to simple URL sharing
      const url = encodeURIComponent(`${window.location.origin}/?event=${selectedEvent.id}`);
      const shareText = encodeURIComponent(`Check out this event: ${selectedEvent.title}!`);
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${shareText}`, '_blank');
      setDownloadStatus('❌ Facebook opened. Use "Download Image" button to get the image separately.');
      setTimeout(() => setDownloadStatus(''), 4000);
    }
  };

  const proximityOptions = [
    { value: 1, label: '1mi', description: 'Walking distance' },
    { value: 5, label: '5mi', description: 'Short drive' },
    { value: 15, label: '15mi', description: 'Local area' },
    { value: 30, label: '30mi', description: 'Regional' }
  ];

  return (
    <div className="h-screen flex flex-col bg-themed-surface">
      {/* ... existing JSX ... */}
      
      {/* Desktop Layout */}
      {isDesktop && (
        <div className="flex-1 flex relative">
          {/* Sidebar */}
          <div className={`bg-themed-surface border-r border-themed transition-all duration-300 flex flex-col ${
            isSidebarCollapsed ? 'w-16' : 'w-80'
          }`}>
            {/* Sidebar Header */}
            <div className="p-4 border-b border-themed flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!isSidebarCollapsed && (
                  <>
                    <div className="text-xl font-display">TodoEvents</div>
                    <div className="text-xs text-themed-muted bg-themed-surface-hover px-2 py-1 rounded">
                      BETA
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isSidebarCollapsed && (
                  <button
                    onClick={() => setShowCacheManager(true)}
                    className="p-2 text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover rounded-md transition-colors"
                    title="Manage Maps Cache"
                  >
                    <Database className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="p-2 text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover rounded-md transition-colors"
                >
                  {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* ... rest of sidebar content ... */}
          </div>

          {/* ... rest of desktop layout ... */}
        </div>
      )}

      {/* Mobile Layout */}
      {!isDesktop && (
        // ... existing mobile layout ...
        <div className="flex-1 flex flex-col relative">
          {/* Mobile Header */}
          <div className="bg-themed-surface border-b border-themed p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-lg font-display">TodoEvents</div>
              <div className="text-xs text-themed-muted bg-themed-surface-hover px-2 py-1 rounded">
                BETA
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCacheManager(true)}
                className="p-2 text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover rounded-md transition-colors"
                title="Manage Maps Cache"
              >
                <Database className="w-4 h-4" />
              </button>
              {/* ... other mobile header buttons ... */}
            </div>
          </div>

          {/* ... rest of mobile layout ... */}
        </div>
      )}

      {/* Cache Manager Modal */}
      <CacheManager 
        isOpen={showCacheManager}
        onClose={() => setShowCacheManager(false)}
      />

      {/* ... rest of existing components ... */}
    </div>
  );
};

export default EventMap;