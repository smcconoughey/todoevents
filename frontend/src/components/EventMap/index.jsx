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
  Shield
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

import { API_URL } from '@/config';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';


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
  if (!event) return null;
  
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.title,
    "startDate": `${event.date}T${event.time}:00`,
    "location": {
      "@type": "Place",
      "name": event.address,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": event.address
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": event.lat,
        "longitude": event.lng
      }
    },
    "description": event.description || `${event.category} event at ${event.address}`,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "organizer": {
      "@type": "Organization",
      "name": "todo-events",
      "url": "https://todo-events.com"
    },
    "url": `https://todo-events.com/event/${event.id}`,
    "image": event.shareImage || "https://todo-events.com/images/pin-logo.svg",
    "offers": {
      "@type": "Offer",
      "availability": "https://schema.org/InStock",
      "price": "0",
      "priceCurrency": "USD"
    }
  };
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

const EventDetailsPanel = ({ event, user, onClose, onEdit, onDelete, activeTab, setActiveTab, shareCardRef, downloadStatus, handleDownload, handleCopyLink, handleFacebookShare }) => {

  if (!event) return null;

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
    <div className="absolute right-4 top-4 w-96 bg-neutral-900/95 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden z-20 shadow-2xl">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-spark-yellow/10 border border-spark-yellow/20">
              <Icon className={`w-6 h-6 ${category.color}`} />
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-display font-semibold text-white">{event.title}</h2>
              <span className="text-xs text-white/40 font-mono">ID: {event.id}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 mb-2">
          <button
            className={`px-3 py-1 font-medium rounded-t ${activeTab === 'details' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`}
            onClick={() => setActiveTab('details')}
          >Details</button>
          <button
            className={`px-3 py-1 font-medium rounded-t ${activeTab === 'share' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`}
            onClick={() => setActiveTab('share')}
          >Share</button>
        </div>
        {activeTab === 'details' ? (
          <>
            <p className="text-white/90 font-body leading-relaxed">{event.description}</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-white/70">
                <div className="p-1.5 rounded-md bg-pin-blue/10">
                  <Calendar className="w-4 h-4 text-pin-blue" />
                </div>
                <span className="font-data">{event.date}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/70">
                <div className="p-1.5 rounded-md bg-fresh-teal/10">
                  <Clock className="w-4 h-4 text-fresh-teal" />
                </div>
                <span className="font-data">{event.time}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/70">
                <div className="p-1.5 rounded-md bg-vibrant-magenta/10">
                  <MapPin className="w-4 h-4 text-vibrant-magenta" />
                </div>
                <span className="font-body">{event.address}</span>
              </div>
              {event.distance !== undefined && (
                <div className="text-sm text-white/70 font-data">
                  📍 {event.distance.toFixed(1)} miles away
                </div>
              )}
            </div>
            {user && (user.id === event.created_by || user.role === 'admin') && (
              <div className="pt-4 space-y-3 border-t border-white/10">
                <Button
                  variant="ghost"
                  className="w-full btn-secondary text-white font-medium transition-all duration-200 hover:scale-[1.02]"
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
                className="w-full bg-spark-yellow text-neutral-900 font-bold min-h-[44px]"
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
            {downloadStatus && <div className="text-xs text-white/70 mt-1 text-center">{downloadStatus}</div>}
            <div className="text-xs text-white/40 mt-1 text-center">Instagram does not allow direct web sharing. Download and upload the image to your story or feed!</div>
          </div>
        )}
      </div>
    </div>
  );
};

const renderEventList = (events, selectedEvent, handleEventClick, user, mapCenter) => (
  <div className="flex-1 overflow-y-auto p-4 space-y-3">
    {events.map(event => (
      <div
        key={event.id}
        className={`
          w-full p-4 rounded-xl transition-all duration-200 cursor-pointer hover:scale-[1.02]
          ${selectedEvent?.id === event.id
            ? 'bg-spark-yellow/20 border-spark-yellow/40 shadow-lg'
            : 'bg-white/5 hover:bg-white/10 border-white/10'
          }
          border backdrop-blur-sm
        `}
        onClick={() => handleEventClick(event)}
      >
        <div className="flex items-center gap-3">
          {(() => {
            const category = getCategory(event.category);
            const Icon = category.icon;
            return (
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                <Icon className={`w-5 h-5 ${category.color}`} />
              </div>
            );
          })()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-display font-medium truncate">{event.title}</h3>
              <span className="text-xs text-white/30 font-mono">#{event.id}</span>
              {user && event.created_by === user.id && (
                <span className="text-xs text-spark-yellow font-data px-2 py-0.5 bg-spark-yellow/10 rounded-full border border-spark-yellow/20">
                  Your event
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-white/60">
              <Calendar className="w-4 h-4" />
              <span className="font-data">{event.date}</span>
              {event.distance !== undefined && (
                <>
                  <span className="text-white/30">•</span>
                  <span className="font-data">{event.distance.toFixed(1)} mi</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);


const EventMap = ({ mapsLoaded = false }) => {
  const { user, token, logout } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);

  const [events, setEvents] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [proximityRange, setProximityRange] = useState(15);
  const [selectedDate, setSelectedDate] = useState({ from: null, to: null });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showDesktopList, setShowDesktopList] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState('map');
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [loginMode, setLoginMode] = useState('login');
  const [editingEvent, setEditingEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [downloadStatus, setDownloadStatus] = useState('');

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
    setSelectedDate({ from: null, to: null });
    setSelectedCategory('all');
    setSelectedEvent(null);
    
    if (mapRef.current) {
      mapRef.current.resetView();
    }
  };

  const toggleDesktopList = () => {
    setShowDesktopList(!showDesktopList);
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setSelectedEvent(null);
  };

  const fetchEvents = async () => {
    try {
      // fetchWithTimeout already returns parsed JSON data, not a Response object
      const data = await fetchWithTimeout(`${API_URL}/events`);
      
      if (Array.isArray(data)) {
        // Calculate distances if we have a map center
        const eventsWithDistance = mapCenter ? data.map(event => ({
          ...event,
          distance: calculateDistance(
            mapCenter.lat,
            mapCenter.lng,
            event.lat,
            event.lng
          )
        })).filter(event => event.distance <= proximityRange)
          .sort((a, b) => a.distance - b.distance) : data;
        
        setEvents(eventsWithDistance);
      } else {
        console.error('Expected array but got:', typeof data);
        setEvents([]);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [mapCenter, proximityRange]);

  // Handle URL parameters for event deep linking
  useEffect(() => {
    const handleUrlParams = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const eventId = urlParams.get('event');
      
      if (eventId && events.length > 0) {
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

    // Only run after events are loaded
    if (events.length > 0) {
      handleUrlParams();
    }
  }, [events]); // Run when events change

  const filteredEvents = events.filter(event => {
    const categoryMatch = selectedCategory === 'all' || event.category === selectedCategory;
    const dateMatch = isDateInRange(event.date, selectedDate);
    return categoryMatch && dateMatch;
  });

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    
    if (activeView === 'list') {
      setActiveView('map');
    }
  };

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

  const handleCreateEvent = async (newEvent) => {
    try {
      // fetchWithTimeout already returns parsed JSON data, not a Response object
      await fetchWithTimeout(`${API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newEvent)
      });

      await fetchEvents();
      setIsCreateFormOpen(false);
      setSelectedLocation(null);
      setSearchValue('');
    } catch (error) {
      console.error('Error creating event:', error);
      if (error.message && error.message.includes('401')) {
        setShowLoginDialog(true);
      }
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
            useCORS: true,
            allowTaint: true,
            foreignObjectRendering: true,
            skipFonts: false,
            cacheBust: true,
            style: {
              transform: 'scale(1)',
              transformOrigin: 'top left'
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
            
            // Draw category
            ctx.fillStyle = "#FFEC3A";
            ctx.font = "18px Arial, sans-serif";
            ctx.fillText(getCategory(selectedEvent.category).label, canvas.width/2, 300);
            
            // Draw branding
            ctx.fillStyle = "#FFEC3A";
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
      setDownloadStatus('Preparing image for Facebook...');
      
      // First generate the image using the same logic as download
      const shareCardElement = shareCardRef.current?.querySelector('#share-card-root');
      if (!shareCardElement) {
        throw new Error('ShareCard element not found');
      }

      // Create temporary wrapper for proper sizing
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
        await new Promise(resolve => setTimeout(resolve, 300));

        // Generate image
        const options = {
          backgroundColor: theme === "dark" ? "#0f0f0f" : "#ffffff",
          width: shareCardElement.offsetWidth,
          height: shareCardElement.offsetHeight,
          pixelRatio: 3,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: true,
          skipFonts: false,
          cacheBust: true,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left'
          }
        };

        const dataUrl = await htmlToImage.toPng(shareCardElement, options);

        // Restore ShareCard to original position
        if (originalNextSibling) {
          originalParent.insertBefore(shareCardElement, originalNextSibling);
        } else {
          originalParent.appendChild(shareCardElement);
        }

        // Clean up temp wrapper
        document.body.removeChild(tempWrapper);

        // For now, we'll open Facebook with the event URL and copy the image to clipboard
        // Note: Facebook doesn't allow direct image uploads from web browsers for security
        const eventUrl = `${window.location.origin}/?event=${selectedEvent.id}`;
        const encodedUrl = encodeURIComponent(eventUrl);
        const shareText = encodeURIComponent(`Check out this event: ${selectedEvent.title}!`);
        
        // Copy image to clipboard for user to paste
        const img = new Image();
        img.onload = async () => {
          try {
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
                setDownloadStatus('Image copied to clipboard! Paste it in your Facebook post.');
                setTimeout(() => setDownloadStatus(''), 4000);
              } catch (e) {
                setDownloadStatus('Opening Facebook... Download the image separately to post it.');
                setTimeout(() => setDownloadStatus(''), 4000);
              }
            });
          } catch (e) {
            setDownloadStatus('Opening Facebook... Download the image separately to post it.');
            setTimeout(() => setDownloadStatus(''), 4000);
          }
        };
        img.src = dataUrl;

        // Open Facebook sharing
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${shareText}`, '_blank');

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
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
      setDownloadStatus('Opened Facebook sharing. Download the image separately to include it.');
      setTimeout(() => setDownloadStatus(''), 3000);
    }
  };

  const proximityOptions = [
    { value: 1, label: '1mi', description: 'Walking distance' },
    { value: 5, label: '5mi', description: 'Short drive' },
    { value: 15, label: '15mi', description: 'Local area' },
    { value: 30, label: '30mi', description: 'Regional' }
  ];

  return (
    <div className="h-screen w-full relative bg-neutral-950">
      {/* Mobile Header */}
      <div className="sm:hidden fixed top-0 left-0 right-0 z-30 bg-neutral-900/95 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between p-2 min-h-[2.5rem]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-white hover:bg-white/10 transition-colors duration-200 min-h-[36px] min-w-[36px]"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-display font-bold text-white truncate px-2">todo-events</h1>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveView(activeView === 'map' ? 'list' : 'map')}
              className="text-white hover:bg-white/10 transition-colors duration-200 min-h-[36px] min-w-[36px]"
            >
              {activeView === 'map' ? <Filter className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className={`
        hidden sm:flex fixed left-4 top-4 bottom-4 z-20
        flex-col bg-neutral-900/95 backdrop-blur-sm rounded-xl
        border border-white/10 transition-all duration-300 shadow-2xl
        ${isSidebarCollapsed ? 'w-16' : 'w-80'}
      `}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center justify-between flex-1 mr-2">
              <h2 className="text-xl font-display font-bold text-white">todo-events</h2>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                {user ? (
                  <div className="flex items-center gap-2">
                    {user.role === 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                        onClick={() => window.open('/admin', '_blank')}
                        title="Admin Dashboard"
                      >
                        <Shield className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                      onClick={logout}
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                    onClick={() => {
                      setLoginMode('login');
                      setShowLoginDialog(true);
                    }}
                  >
                    <User className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
          {isSidebarCollapsed && (
            <ThemeToggle />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0 transition-all duration-200"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        </div>

        {!isSidebarCollapsed && (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-6">
                <AddressAutocomplete
                  value={searchValue}
                  onChange={setSearchValue}
                  onSelect={handleAddressSelect}
                  className="w-full"
                />
                <div className="space-y-3">
                  <label className="text-sm font-medium text-white/70">Date Filter</label>
                  <CalendarFilter
                    selectedDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    onClear={() => setSelectedDate({ from: null, to: null })}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-white/70">Search Radius</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-pin-blue hover:text-pin-blue-300 hover:bg-pin-blue/10 transition-all duration-200"
                      onClick={handleResetView}
                    >
                      Reset View
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {proximityOptions.map(option => (
                      <Button
                        key={option.value}
                        onClick={() => setProximityRange(option.value)}
                        variant="outline"
                        className={`
                            flex flex-col items-center p-3 h-auto rounded-lg transition-all duration-200 hover:scale-[1.02]
                            ${proximityRange === option.value
                            ? 'bg-spark-yellow/20 text-white border-spark-yellow/40 shadow-lg'
                            : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                          }
                          `}
                      >
                        <span className="text-base font-data font-medium">{option.label}</span>
                        <span className="text-xs opacity-70 font-body">{option.description}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {categories.map((category) => {
                    const Icon = category.icon;
                    const count = events.filter(e =>
                      category.id === 'all' ? true : e.category === category.id
                    ).length;

                    return (
                      <button
                        key={category.id}
                        onClick={() => handleCategorySelect(category.id)}
                        className={`
                            w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 hover:scale-[1.02]
                            ${selectedCategory === category.id
                            ? 'bg-pin-blue/20 border border-pin-blue/40 shadow-lg'
                            : 'hover:bg-white/5 border border-transparent'
                          }
                          `}
                      >
                        <div className="flex items-center">
                          <div className="p-1.5 rounded-md bg-white/5 mr-3">
                            <Icon className={`w-5 h-5 ${category.color}`} />
                          </div>
                          <span className="text-white text-sm font-body">{category.name}</span>
                        </div>
                        <span className={`
                            text-xs px-2 py-1 rounded-full font-data
                            ${selectedCategory === category.id
                            ? 'bg-pin-blue/30 text-white'
                            : 'bg-white/5 text-white/60'
                          }
                          `}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10">
              <Button
                className="w-full btn-primary font-display font-semibold text-lg py-3 transition-all duration-200 hover:scale-[1.02] animate-bounce-in"
                onClick={() => {
                  if (!user) {
                    setLoginMode('login');
                    setShowLoginDialog(true);
                    return;
                  }
                  setIsCreateFormOpen(true);
                }}
              >
                <Plus className="w-5 h-5 mr-2" />
                {user ? 'Create Event' : 'Sign in to Create'}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Mobile Sheet */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent
          side="left"
          className="w-full sm:w-[400px] p-0 border-r border-white/10 bg-neutral-900/80 backdrop-blur-sm"
        >
          <div className="flex flex-col h-full">
            <SheetHeader className="px-4 py-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-white font-display font-bold">todo-events</SheetTitle>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  {user ? (
                    <div className="flex items-center gap-2">
                      {user.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                          onClick={() => window.open('/admin', '_blank')}
                          title="Admin Dashboard"
                        >
                          <Shield className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                        onClick={() => {
                          logout();
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <LogOut className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                      onClick={() => {
                        setLoginMode('login');
                        setShowLoginDialog(true);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <User className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-6">
                <AddressAutocomplete
                  value={searchValue}
                  onChange={setSearchValue}
                  onSelect={handleAddressSelect}
                  className="w-full"
                />
                <div className="space-y-3">
                  <label className="text-sm font-medium text-white/70">Date Filter</label>
                  <CalendarFilter
                    selectedDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    onClear={() => setSelectedDate(null)}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-white/70">Search Radius</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-pin-blue hover:text-pin-blue-300 hover:bg-pin-blue/10 transition-all duration-200"
                      onClick={handleResetView}
                    >
                      Reset View
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {proximityOptions.map(option => (
                      <Button
                        key={option.value}
                        onClick={() => setProximityRange(option.value)}
                        variant="outline"
                        className={`
                            flex flex-col items-center p-3 h-auto rounded-lg transition-all duration-200 hover:scale-[1.02]
                            ${proximityRange === option.value
                            ? 'bg-spark-yellow/20 text-white border-spark-yellow/40 shadow-lg'
                            : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                          }
                          `}
                      >
                        <span className="text-base font-data font-medium">{option.label}</span>
                        <span className="text-xs opacity-70 font-body">{option.description}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {categories.map((category) => {
                    const Icon = category.icon;
                    const count = events.filter(e =>
                      category.id === 'all' ? true : e.category === category.id
                    ).length;

                    return (
                      <button
                        key={category.id}
                        onClick={() => handleCategorySelect(category.id)}
                        className={`
                            w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 hover:scale-[1.02]
                            ${selectedCategory === category.id
                            ? 'bg-pin-blue/20 border border-pin-blue/40 shadow-lg'
                            : 'hover:bg-white/5 border border-transparent'
                          }
                          `}
                      >
                        <div className="flex items-center">
                          <div className="p-1.5 rounded-md bg-white/5 mr-3">
                            <Icon className={`w-5 h-5 ${category.color}`} />
                          </div>
                          <span className="text-white text-sm font-body">{category.name}</span>
                        </div>
                        <span className={`
                            text-xs px-2 py-1 rounded-full font-data
                            ${selectedCategory === category.id
                            ? 'bg-pin-blue/30 text-white'
                            : 'bg-white/5 text-white/60'
                          }
                          `}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 mt-auto border-t border-white/10">
              <Button
                className="w-full btn-primary font-display font-semibold text-lg py-3 transition-all duration-200 hover:scale-[1.02] animate-bounce-in"
                onClick={() => {
                  if (!user) {
                    setLoginMode('login');
                    setShowLoginDialog(true);
                    setIsMobileMenuOpen(false);
                    return;
                  }
                  setIsCreateFormOpen(true);
                  setIsMobileMenuOpen(false);
                }}
              >
                <Plus className="w-5 h-5 mr-2" />
                {user ? 'Create Event' : 'Sign in to Create'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className={`
  flex-1 h-[calc(100dvh-2.5rem)] sm:h-screen
  ${isSidebarCollapsed ? 'sm:pl-24' : 'sm:pl-88'}
  pt-10 sm:pt-4
  relative
`}>
        {activeView === 'map' ? (
          <div className="absolute inset-0 flex">
            {/* Map Container */}
            <div className={`relative flex-1 transition-all duration-300 ${showDesktopList ? 'sm:pr-96' : ''}`}>
              <MapContainer
                ref={mapRef}
                events={mapCenter ? filteredEvents : events}
                onEventClick={handleEventClick}
                selectedCategory={selectedCategory}
                mapCenter={mapCenter}
                proximityRange={proximityRange}
                selectedEvent={selectedEvent}
                currentUser={user}
                onEventDelete={handleEventDelete}
                defaultCenter={DEFAULT_CENTER}
                defaultZoom={DEFAULT_ZOOM}
                selectedDate={selectedDate}  // Add this line
              />

              {/* Desktop Event Details Panel */}
              <div className="hidden sm:block">
                <EventDetailsPanel
                  event={selectedEvent}
                  user={user}
                  onClose={() => setSelectedEvent(null)}
                  onEdit={() => {
                    setIsCreateFormOpen(true);
                    setSelectedLocation({
                      lat: selectedEvent.lat,
                      lng: selectedEvent.lng,
                      address: selectedEvent.address
                    });
                  }}
                  onDelete={handleEventDelete}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  shareCardRef={shareCardRef}
                  downloadStatus={downloadStatus}
                  handleDownload={handleDownload}
                  handleCopyLink={handleCopyLink}
                  handleFacebookShare={handleFacebookShare}
                />
              </div>
            </div>

            {/* Desktop Event List */}
            <div className={`
        hidden sm:block fixed right-4 top-4 bottom-4
        transition-all duration-300 ease-in-out
        ${showDesktopList ? 'w-96' : 'w-0'}
      `}>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleDesktopList}
                className={`
            absolute -left-10 top-4 
            text-white/70 hover:text-white hover:bg-pin-blue/10
            bg-neutral-900/95 backdrop-blur-sm
            border border-white/10 rounded-lg
            transition-all duration-300
            ${showDesktopList ? 'rotate-180' : ''}
          `}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className={`
          h-full w-full
          bg-neutral-900/95 backdrop-blur-sm
          border border-white/10 rounded-xl 
          overflow-hidden shadow-2xl
          transition-all duration-300
          ${showDesktopList ? 'opacity-100' : 'opacity-0'}
        `}>
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-white/10">
                    <h2 className="text-lg font-display font-semibold text-white">
                      {mapCenter ? 'Events Nearby' : 'All Events'}
                    </h2>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {renderEventList(
                      filteredEvents.length > 0 || selectedDate || selectedCategory !== 'all' || mapCenter
                        ? filteredEvents
                        : events,
                      selectedEvent,
                      handleEventClick,
                      user,
                      mapCenter
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto bg-neutral-950">
            {renderEventList(
              filteredEvents.length > 0 || selectedDate || selectedCategory !== 'all' || mapCenter
                ? filteredEvents
                : events,
              selectedEvent,
              handleEventClick,
              user,
              mapCenter
            )}
          </div>
        )}
      </div>


      {/* Mobile Event Details Bottom Sheet */}
      {selectedEvent && (
        <div className={`
          fixed bottom-0 left-0 right-0 
          bg-neutral-900/95 backdrop-blur-sm
          border-t border-white/10 
          rounded-t-lg z-40
          sm:hidden
          transform transition-transform duration-300
          max-h-[80vh] overflow-y-auto shadow-2xl
          ${selectedEvent ? 'translate-y-0' : 'translate-y-full'}
        `}>
          <div className="p-3 space-y-3 pb-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {(() => {
                  const category = getCategory(selectedEvent.category);
                  const Icon = category.icon;
                  return (
                    <div className="p-2 rounded-lg bg-spark-yellow/10 border border-spark-yellow/20 flex-shrink-0">
                      <Icon className={`w-5 h-5 ${category.color}`} />
                    </div>
                  );
                })()}
                <div className="flex flex-col min-w-0 flex-1">
                  <h2 className="text-lg font-display font-semibold text-white break-words leading-tight">{selectedEvent.title}</h2>
                  <span className="text-xs text-white/40 font-mono mt-0.5">ID: {selectedEvent.id}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200 flex-shrink-0"
                onClick={() => setSelectedEvent(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Mobile Tabs */}
            <div className="flex gap-1 border-b border-white/10 -mx-3 px-3">
              <button
                className={`px-3 py-2 font-medium rounded-t-lg text-sm min-h-[36px] ${
                  activeTab === 'details' 
                    ? 'bg-white/10 text-white border-b-2 border-spark-yellow' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                }`}
                onClick={() => setActiveTab('details')}
              >
                Details
              </button>
              <button
                className={`px-3 py-2 font-medium rounded-t-lg text-sm min-h-[36px] ${
                  activeTab === 'share' 
                    ? 'bg-white/10 text-white border-b-2 border-spark-yellow' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                }`}
                onClick={() => setActiveTab('share')}
              >
                Share
              </button>
            </div>
            
            {activeTab === 'details' ? (
              <div className="space-y-4">
                <p className="text-white/90 font-body leading-relaxed text-sm">{selectedEvent.description}</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-white/70">
                    <div className="p-1.5 rounded-md bg-pin-blue/10 flex-shrink-0">
                      <Calendar className="w-4 h-4 text-pin-blue" />
                    </div>
                    <span className="font-data">{selectedEvent.date}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-white/70">
                    <div className="p-1.5 rounded-md bg-fresh-teal/10 flex-shrink-0">
                      <Clock className="w-4 h-4 text-fresh-teal" />
                    </div>
                    <span className="font-data">{selectedEvent.time}</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-white/70">
                    <div className="p-1.5 rounded-md bg-vibrant-magenta/10 flex-shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-vibrant-magenta" />
                    </div>
                    <span className="font-body break-words leading-relaxed">{selectedEvent.address}</span>
                  </div>
                  {selectedEvent.distance !== undefined && (
                    <div className="text-sm text-white/70 font-data ml-8">
                      📍 {selectedEvent.distance.toFixed(1)} miles away
                    </div>
                  )}
                </div>
                {user && (user.id === selectedEvent.created_by || user.role === 'admin') && (
                  <div className="pt-3 space-y-2 border-t border-white/10">
                    <Button
                      variant="ghost"
                      className="w-full btn-secondary text-white font-medium transition-all duration-200 hover:scale-[1.02] min-h-[40px] text-sm"
                      onClick={() => {
                        setIsCreateFormOpen(true);
                        setSelectedLocation({
                          lat: selectedEvent.lat,
                          lng: selectedEvent.lng,
                          address: selectedEvent.address
                        });
                      }}
                    >
                      Edit Event
                    </Button>
                    <Button
                      className="w-full bg-vibrant-magenta/20 hover:bg-vibrant-magenta/30 text-vibrant-magenta border border-vibrant-magenta/30 font-medium transition-all duration-200 hover:scale-[1.02] min-h-[40px] text-sm"
                      onClick={() => handleEventDelete(selectedEvent.id)}
                    >
                      Delete Event
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div ref={shareCardRef} className="my-1">
                  <ShareCard event={selectedEvent} />
                </div>
                <div className="flex flex-col gap-3 w-full">
                  <Button 
                    onClick={handleDownload} 
                    className="w-full bg-spark-yellow text-neutral-900 font-bold min-h-[44px]"
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
                {downloadStatus && <div className="text-xs text-white/70 mt-1 text-center">{downloadStatus}</div>}
                <div className="text-xs text-white/40 mt-1 text-center">Instagram does not allow direct web sharing. Download and upload the image to your story or feed!</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Event Form Dialog */}
      {isCreateFormOpen && (
        <CreateEventForm
          isOpen={isCreateFormOpen}
          onClose={() => {
            setIsCreateFormOpen(false);
            setSelectedLocation(null);
          }}
          onSubmit={handleCreateEvent}
          selectedLocation={selectedLocation}
          onLocationSelect={setSelectedLocation}
          initialEvent={selectedEvent}
        />
      )}

      {/* Login Dialog */}
      <Dialog
        open={showLoginDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowLoginDialog(false);
            setTimeout(() => setLoginMode('login'), 300);
          }
        }}
      >
        <DialogContent 
          className="bg-neutral-900/95 backdrop-blur-sm border-white/10 p-6"
          aria-describedby="login-dialog-description"
        >
          <DialogHeader>
            <DialogTitle className="text-white mb-4">
              {loginMode === 'login' ? 'Sign In' : 'Create Account'}
            </DialogTitle>
            <DialogDescription id="login-dialog-description" className="text-white/60 mb-4">
              {loginMode === 'login' ? 'Sign in to your account' : 'Create a new account'}
            </DialogDescription>
          </DialogHeader>
          <LoginForm
            mode={loginMode}
            onSuccess={() => {
              setShowLoginDialog(false);
              setIsCreateFormOpen(true);
            }}
            onModeChange={(newMode) => setLoginMode(newMode)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventMap;