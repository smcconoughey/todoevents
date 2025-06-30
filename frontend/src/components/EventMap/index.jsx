import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ThemeContext } from "../ThemeContext";
import { AuthContext } from "./AuthContext";
import CreateEventForm from "./CreateEventForm";
import LoginForm from "./LoginForm";
import CalendarFilter from "./CalendarFilter";
import MapContainer from "./MapContainer";
import ShareCard from "./ShareCard";
import FirstTimeSignInPopup from "../FirstTimeSignInPopup";
import ReportDialog from './ReportDialog';
import RecommendationsPanel from '../RecommendationsPanel';

import { getMarkerStyle, setMarkerStyle } from "./markerUtils";
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

  Navigation,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Users,
  DollarSign,
  ExternalLink,
  Mail,
  Tag,
  Target,
  Lightbulb,
  Sun,
  Moon,
  Cog,
  CheckCircle,
  Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DialogDescription
} from "@/components/ui/radix-dialog";
import {
  SheetClose
} from "@/components/ui/sheet";
import ThemeSelector from '@/components/ui/ThemeToggle';
import AddressAutocomplete from './AddressAutocomplete';
import WelcomePopup from '../WelcomePopup';
import RoutePlanner from './RoutePlanner';
import RouteTimeline from './RouteTimeline';

import { API_URL } from '@/config';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import EventInteractionComponents from './EventInteractionComponents';
import ExternalLinkWarning from './ExternalLinkWarning';
import EmailContactPopup from './EmailContactPopup';
import { batchedSync } from '@/utils/batchedSync';
import { WebIcon } from './WebIcons';
import UserDropdown from "../UserDropdown";
import { useAuth } from './AuthContext';
import { useTheme } from '../ThemeContext';
import { AnimatedModalWrapper, StaggeredListAnimation, SmoothLoader, PanelSlideAnimation, PremiumWelcomeAnimation } from '../ui/loading-animations';

// Simple page visit tracking (privacy-friendly)
const trackPageVisit = async (pageType, pagePath = window.location.pathname) => {
  try {
    const params = new URLSearchParams({
      page_type: pageType,
      page_path: pagePath
    });
    
    await fetchWithTimeout(`${API_URL}/api/track-visit?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') && {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        })
      }
    }, 3000);
  } catch (error) {
    // Silently fail - don't disrupt user experience
    console.debug('Page tracking failed:', error);
  }
};

const normalizeDate = (date) => {
  if (!date) return null;
  
  // Parse date as local date to avoid timezone issues
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // For YYYY-MM-DD format, parse as local date (this is how HTML date inputs store dates)
    const [year, month, day] = date.split('-').map(Number);
    // Create date at start of day in local timezone to avoid timezone shifts
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  
  // If it's already a Date object, normalize it to start of day
  if (date instanceof Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }
  
  // For other string formats, try to parse and normalize
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    console.warn('Invalid date:', date);
    return null;
  }
  
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
};

const isDateInRange = (dateStr, range) => {
  if (!range || (!range.from && !range.to)) return true;

  // Parse the event date string and normalize it
  const eventDate = normalizeDate(dateStr);
  if (!eventDate) return false; // Invalid date should be filtered out
  
  if (range.from) {
    const fromDate = normalizeDate(range.from);
    if (!fromDate) return false;
    
    if (range.to) {
      const toDate = normalizeDate(range.to);
      if (!toDate) return false;
      
      // For range filtering, check if event date falls within the range (inclusive)
      const isInRange = eventDate >= fromDate && eventDate <= toDate;
      
      // Debug logging for weekend filter
      if (range.from.getDay() === 6 || range.to.getDay() === 0) { // Saturday or Sunday
        console.log('Date range check:', {
          eventDateStr: dateStr,
          eventDate: eventDate.toLocaleDateString(),
          eventTime: eventDate.getTime(),
          fromDate: fromDate.toLocaleDateString(),
          fromTime: fromDate.getTime(),
          toDate: toDate.toLocaleDateString(),
          toTime: toDate.getTime(),
          isInRange: isInRange
        });
      }
      
      return isInRange;
    }
    
    // For single date filtering, check if it's the same day
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

    // Generate canonical URL for the event
    const eventUrl = event.slug 
      ? `${window.location.origin}/e/${event.slug}`
      : `${window.location.origin}/?event=${event.id}`;
      
    // Generate image URL (use share card or default image)
    const imageUrl = event.id 
      ? `${window.location.origin}/api/events/${event.id}/share-card` 
      : `${window.location.origin}/images/todosharecard.png`;

    const schema = {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": event.title || 'Untitled Event',
      "description": event.description || 'No description available',
      "startDate": startDateTime,
      "url": eventUrl,
      "image": imageUrl,
      "eventStatus": "https://schema.org/EventScheduled",
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
        "name": event.host_name || "TodoEvents",
        "url": event.organizer_url || window.location.origin
      },
      "offers": {
        "@type": "Offer",
        "price": event.price ? String(event.price) : "0",
        "priceCurrency": event.currency || "USD",
        "availability": "https://schema.org/InStock",
        "url": eventUrl
      },
      "performer": {
        "@type": "PerformingGroup",
        "name": event.host_name || event.title || "Event Performers"
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

// Create canonical URL from event data
const generateCanonicalUrl = (event) => {
  if (!event) return window.location.origin;
  if (event.slug) {
    if (event.city && event.state) {
      const citySlug = event.city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const stateSlug = event.state.toLowerCase();
      return `${window.location.origin}/us/${stateSlug}/${citySlug}/events/${event.slug}`;
    }
    return `${window.location.origin}/events/${event.slug}`;
  }
  return `${window.location.origin}/?event=${event.id}`;
};

// Inject or update canonical link element
const injectCanonicalLink = (url) => {
  let link = document.querySelector('link[rel="canonical"]');
  const previousHref = link ? link.getAttribute('href') : null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
  return { element: link, previousHref };
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

const EventDetailsPanel = ({ event, user, onClose, onEdit, onDelete, onReport, activeTab, setActiveTab, shareCardRef, downloadStatus, handleDownload, handleCopyLink, handleFacebookShare, setExternalLinkDialog }) => {
  // Add comprehensive null checks
  if (!event || typeof event !== 'object') {
    return (
      <div className="p-6 text-center">
        <p className="text-white/70">Event not found</p>
      </div>
    );
  }

  const formatEventDate = (event) => {
    if (!event.date) return 'Date not specified';
    
    try {
      // Use normalizeDate to parse dates correctly
      const startDate = normalizeDate(event.date);
      const endDate = event.end_date ? normalizeDate(event.end_date) : null;
      
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
      const convertTo12Hour = (time24) => {
        if (!time24) return time24;
        
        // Handle time strings like "20:00" or "08:30"
        const [hours, minutes] = time24.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return time24;
        
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const minutesStr = minutes.toString().padStart(2, '0');
        
        return `${hours12}:${minutesStr} ${period}`;
      };
      
      const startTime = convertTo12Hour(event.start_time);
      const endTime = event.end_time ? convertTo12Hour(event.end_time) : null;
      
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
      // Use normalizeDate to parse dates correctly
      const startDate = normalizeDate(event.date);
      let dateRange = startDate.toLocaleDateString();
      
      // Only add end date if it exists and is different from start date
      if (event.end_date && event.end_date !== event.date) {
        const endDate = normalizeDate(event.end_date);
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

      const canonicalUrl = generateCanonicalUrl(event);
      const { element: canonicalEl, previousHref: originalCanonical } = injectCanonicalLink(canonicalUrl);
      
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
        if (originalCanonical) {
          canonicalEl.setAttribute('href', originalCanonical);
        } else if (canonicalEl) {
          canonicalEl.remove();
        }
      };
    }
  }, [event]);

  return (
    <AnimatedModalWrapper isOpen={true} className="absolute right-4 top-4 w-96 dialog-themed backdrop-blur-sm rounded-xl overflow-hidden z-20 shadow-2xl">
      <PanelSlideAnimation isOpen={true} direction="right">
      
      {/* Premium Banner Image */}
      {event.banner_image && (
        <div className="relative h-32 w-full" key={`banner-${event.id}`}>
          <img
            key={`banner-img-${event.id}`}
            src={event.banner_image}
            alt="Event Banner"
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide the banner image if it fails to load
              e.target.style.display = 'none';
              e.target.parentElement.style.display = 'none';
            }}
          />
        </div>
      )}
      
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Image or Category Icon */}
            {event.logo_image ? (
              <div className="relative" key={`logo-${event.id}`}>
                <img
                  key={`logo-img-${event.id}`}
                  src={event.logo_image}
                  alt="Event Logo"
                  className="w-12 h-12 object-cover rounded-lg"
                  onError={(e) => {
                    // Hide logo if it fails to load
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            ) : (
            <div className="p-2 rounded-lg bg-spark-yellow/10 border border-spark-yellow/20">
              <Icon className={`w-6 h-6 ${category.color}`} />
            </div>
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-display font-semibold text-white">{event.title}</h2>
                {event.verified && (
                  <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded-full border border-green-500/30">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-xs font-medium text-green-400">Verified</span>
                  </div>
                )}
              </div>
              <span className="text-xs event-id-text font-mono">ID: {event.id}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Desktop close button clicked');
              onClose();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
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
                <span className="font-data">
                  {formatEventDate(event)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/70">
                <div className="p-1.5 rounded-md bg-fresh-teal/10">
                  <Clock className="w-4 h-4 text-fresh-teal" />
                </div>
                <span className="font-data">
                  {formatEventTime(event)}
                </span>
              </div>
              {/* Enhanced Category Display */}
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <div className="p-1.5 rounded-md bg-spark-yellow/10">
                    {React.createElement(category.icon, {
                      className: `w-4 h-4 ${category.color}`
                    })}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-white/50">Primary Category</span>
                    <span className="font-body font-medium text-white">{category.name}</span>
                  </div>
                </div>
                
                {/* Secondary Category Display */}
                {event.secondary_category && (
                  <div className="flex items-center gap-3 text-sm text-white/70">
                    <div className="p-1.5 rounded-md bg-purple-500/10">
                      {React.createElement(getCategory(event.secondary_category).icon, {
                        className: `w-4 h-4 ${getCategory(event.secondary_category).color}`
                      })}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-white/50">Secondary Category</span>
                      <span className="font-body font-medium text-white">{getCategory(event.secondary_category).name}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 text-sm text-white/70">
                <div className="p-1.5 rounded-md bg-vibrant-magenta/10">
                  <MapPin className="w-4 h-4 text-vibrant-magenta" />
                </div>
                <span className="font-body">{event.address || 'No address provided'}</span>
              </div>
              
              {event.distance !== undefined && (
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <div className="p-1.5 rounded-md bg-blue-500/10">
                    <WebIcon emoji="📍" size={14} className="text-blue-400" />
                  </div>
                  <span className="font-data">{event.distance.toFixed(1)} miles away</span>
                </div>
              )}
              
              {/* New UX enhancement fields */}
              {event.host_name && (
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <div className="p-1.5 rounded-md bg-green-500/10">
                    <Users className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-white/50">Hosted by</span>
                    <span className="font-body">{event.host_name}</span>
                  </div>
                </div>
              )}
              
              {event.fee_required && (
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <div className="p-1.5 rounded-md bg-yellow-500/10">
                    <DollarSign className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-white/50">Entry Requirements</span>
                    <span className="font-body">{event.fee_required}</span>
                  </div>
                </div>
              )}
              
              {event.event_url && (
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <div className="p-1.5 rounded-md bg-blue-500/10">
                    <ExternalLink className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="text-xs text-white/50">More Information</span>
                    <button
                      onClick={() => setExternalLinkDialog({ isOpen: true, url: event.event_url })}
                      className="font-body text-blue-400 hover:text-blue-300 underline text-left transition-colors"
                    >
                      Visit Event Website
                    </button>
                  </div>
                </div>
              )}
              
              {/* Add to Calendar Button */}
              <div className="flex items-center gap-3 text-sm text-white/70">
                <div className="p-1.5 rounded-md bg-green-500/10">
                  <Calendar className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-xs text-white/50">Calendar</span>
                  <a
                    href={`/events/${event.id}/calendar`}
                    className="font-body text-green-400 hover:text-green-300 underline text-left transition-colors"
                    download={`event_${event.id}.ics`}
                  >
                    Add to Google Calendar
                  </a>
                </div>
              </div>
            </div>
            
            {/* Add event interaction components to the details panel */}
            <EventInteractionComponents eventId={String(event.id)} onReport={onReport} />
            
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
            {downloadStatus && <div className="text-xs text-white/70 mt-1 text-center">{downloadStatus}</div>}
            <div className="text-xs text-white/40 mt-1 text-center">
              <strong>Facebook:</strong> Image will auto-download, then upload it in Facebook.<br/>
              <strong>Instagram:</strong> Download and upload the image to your story or feed!
            </div>
          </div>
        )}
      </div>
      </PanelSlideAnimation>
    </AnimatedModalWrapper>
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
    // Use normalizeDate to parse dates correctly
    const startDate = normalizeDate(event.date);
    let dateStr = startDate.toLocaleDateString();
    
    if (event.end_date && event.end_date !== event.date) {
      const endDate = normalizeDate(event.end_date);
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
    const convertTo12Hour = (time24) => {
      if (!time24) return time24;
      
      // Handle time strings like "20:00" or "08:30"
      const [hours, minutes] = time24.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return time24;
      
      const period = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const minutesStr = minutes.toString().padStart(2, '0');
      
      return `${hours12}:${minutesStr} ${period}`;
    };
    
    const startTime = convertTo12Hour(event.start_time);
    const endTime = event.end_time ? convertTo12Hour(event.end_time) : null;
    
    if (endTime) {
      return `${startTime} - ${endTime}`;
    }
    return startTime;
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
          className={`p-3 rounded-lg border transition-all duration-300 cursor-pointer hover:scale-[1.03] hover:shadow-lg animate-slide-in-up ${
            selectedEvent?.id === event.id
              ? 'border-spark-yellow/40 bg-spark-yellow/10 shadow-lg animate-pulse-glow'
              : (event.verified || event.is_premium_event)
                ? 'border-amber-400/40 bg-amber-500/10 shadow-md hover:bg-amber-500/20 hover:border-amber-400/60 hover:shadow-amber-400/30'
                : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
          }`}
          onClick={() => handleEventClick(event)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {React.createElement(category.icon, {
                  className: `w-4 h-4 ${category.color}`
                })}
                <h3 className="font-semibold text-white text-sm truncate flex items-center gap-1">
                  {event.title || 'Untitled Event'}
                  {(event.verified || event.is_premium_event) && (
                    <span className="text-amber-400 flex-shrink-0">⭐</span>
                  )}
                </h3>
              </div>
              
              <div className="space-y-1 text-xs text-white/70">
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
              
              {/* Use proper EventInteractionComponents instead of simple inline display */}
              <EventInteractionComponents eventId={String(event.id)} />
            </div>
          </div>
        </div>
      );
    }) : (
      <div className="text-center py-8 text-white/50">
        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No events found in this area</p>
      </div>
    )}
  </div>
);


const EventMap = ({ 
  mapsLoaded = false, 
  eventSlug = false,
  presetCategory = false,
  presetFilters = {}
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { slug, city, state, year, month, day, category } = params;
  const { user, token, logout } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);

  const [events, setEvents] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(['all']);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('all');
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
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
  const [externalLinkDialog, setExternalLinkDialog] = useState({ isOpen: false, url: '' });
  const [showFirstTimeSignInPopup, setShowFirstTimeSignInPopup] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showEmailContactPopup, setShowEmailContactPopup] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  // Add new state for misc filters
  const [miscFilters, setMiscFilters] = useState({
    feeFilter: 'all' // 'all', 'free', 'paid'
  });
  // Track events that were manually closed to prevent re-opening from URL
  const [manuallyClosed, setManuallyClosed] = useState(new Set());
  // Premium welcome animation state
  const [showPremiumWelcome, setShowPremiumWelcome] = useState(false);
  const [premiumWelcomeData, setPremiumWelcomeData] = useState(null);
  
  // Route planning state
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [routeSteps, setRouteSteps] = useState([]);
  const [routeEvents, setRouteEvents] = useState([]);
  const [showRouteTimeline, setShowRouteTimeline] = useState(false);
  const [routeDirectionsRenderer, setRouteDirectionsRenderer] = useState(null);
  const [isMobileRecommendationsOpen, setIsMobileRecommendationsOpen] = useState(false);


  const mapRef = useRef(null);
  const shareCardRef = useRef();
  const timeoutRefs = useRef(new Set()); // Track all timeouts for cleanup

  const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
  const DEFAULT_ZOOM = 4;

  // Compute effective map center (for map positioning)
  const effectiveMapCenter = mapCenter || (selectedLocation ? {
    lat: selectedLocation.lat,
    lng: selectedLocation.lng
  } : null);
  
  // Compute effective location for recommendations (manual selection first, then map center)
  const effectiveLocationForRecommendations = (() => {
    if (selectedLocation && typeof selectedLocation.lat === 'number' && typeof selectedLocation.lng === 'number') {
      return {
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        city: selectedLocation.city || selectedLocation.address || null
      };
    }
    if (mapCenter && typeof mapCenter.lat === 'number' && typeof mapCenter.lng === 'number') {
      return {
        lat: mapCenter.lat,
        lng: mapCenter.lng,
        city: null
      };
    }
    return null;
  })();
  
  // Debug: Check what we're passing to RecommendationsPanel
  console.log('🎯 EventMap passing to RecommendationsPanel:', {
    selectedLocation,
    mapCenter,
    effectiveLocationForRecommendations,
    selectedLocationCheck: !!selectedLocation,
    mapCenterCheck: !!mapCenter,
    finalUserLocation: effectiveLocationForRecommendations || DEFAULT_CENTER
  });

  const handleResetView = () => {
    setSelectedLocation(null);
    setSearchValue('');
    setProximityRange(15);
    setSelectedDate(null);
    setSelectedTime('all');
    setSelectedCategory(['all']);
    handleCloseEventDetails(); // Use helper to also restore URL
    setMiscFilters({
      feeFilter: 'all'
    });
    
    // Reset map center to show all events
    setMapCenter(null);
    
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
    try {
      setError(null);

      // Mobile-optimized fetching: smaller initial load for mobile devices
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSlowConnection = navigator.connection && (
        navigator.connection.effectiveType === '2g' || 
        navigator.connection.effectiveType === 'slow-2g' ||
        navigator.connection.saveData === true
      );
      
      // Adaptive limits based on device and connection
      let eventLimit = 1000;
      let fetchTimeout = 45000;
      
      if (isMobile || isSlowConnection) {
        eventLimit = 500; // Smaller initial load for mobile
        fetchTimeout = 90000; // Much longer timeout for mobile (1.5 minutes)
        console.log('📱 Mobile/slow connection detected - using reduced limit and extended timeout');
      }

      // Fetch events with adaptive parameters
      const response = await fetchWithTimeout(`${API_URL}/events?limit=${eventLimit}`, {}, fetchTimeout);
      
      if (!response || !Array.isArray(response)) {
        console.warn('Invalid response format from events API:', response);
        setEvents([]);
        setIsInitialLoading(false);
        return;
      }

      // Filter and validate events to prevent null reference errors
      const validEvents = response.filter(event => {
        // Basic null/undefined check
        if (!event || typeof event !== 'object') {
          console.warn('Skipping invalid event (null/not object):', event);
          return false;
        }

        // Required fields check
        const requiredFields = ['id', 'title', 'date', 'lat', 'lng'];
        for (const field of requiredFields) {
          if (event[field] == null || event[field] === '') {
            console.warn(`Skipping event with missing ${field}:`, event);
            return false;
          }
        }

        // Validate coordinates
        if (typeof event.lat !== 'number' || typeof event.lng !== 'number' ||
            isNaN(event.lat) || isNaN(event.lng) ||
            Math.abs(event.lat) > 90 || Math.abs(event.lng) > 180) {
          console.warn('Skipping event with invalid coordinates:', event);
          return false;
        }

        return true;
      }).map(event => {
        // Ensure all expected properties exist with fallbacks
        return {
          ...event,
          title: event.title || 'Untitled Event',
          description: event.description || 'No description available',
          start_time: event.start_time || '12:00',
          end_time: event.end_time || null,
          end_date: event.end_date || null,
          category: event.category || 'other',
          address: event.address || 'Location not specified',
          recurring: Boolean(event.recurring),
          frequency: event.frequency || null,
          // Ensure view and interest counts are properly initialized
          view_count: event.view_count || 0,
          interest_count: event.interest_count || 0
        };
      });

      console.log(`📊 Fetched ${response.length} events, ${validEvents.length} valid events (mobile: ${isMobile})`);
      
      // Debug: Log first few events to see their data
                      console.log('Sample events data:', validEvents.slice(0, 2).map(e => ({
        id: e.id,
        title: e.title,
        view_count: e.view_count,
        interest_count: e.interest_count
      })));
      
      // Initialize batchedSync cache with event data
      validEvents.forEach(event => {
        const eventIdString = String(event.id); // Ensure consistent string type for cache keys
        
        batchedSync.updateCache(eventIdString, {
          view_count: event.view_count || 0,
          interest_count: event.interest_count || 0,
          interested: false, // This will be updated by checkUserInterestStatus for logged in users
          viewTracked: false,
          interestStatusChecked: false
        });
      });
      
      console.log('Initialized batchedSync cache with event interaction data');
      
      // Debug: Check cache contents
      console.log('📦 Cache sample:', Array.from(batchedSync.localCache.entries()).slice(0, 2));
      
      setEvents(validEvents);
      setIsInitialLoading(false);

      // For mobile with small initial load, optionally fetch more events in background
      if ((isMobile || isSlowConnection) && eventLimit < 1000 && validEvents.length === eventLimit) {
        console.log('📱 Mobile: Scheduling background fetch for remaining events');
        setTimeout(async () => {
          try {
            console.log('📱 Background fetching remaining events...');
            const backgroundResponse = await fetchWithTimeout(`${API_URL}/events?limit=1000&offset=${eventLimit}`, {}, 120000);
            if (backgroundResponse && Array.isArray(backgroundResponse)) {
              const additionalEvents = backgroundResponse.filter(event => 
                event && typeof event === 'object' && 
                event.id && event.title && event.date && event.lat && event.lng
              );
              if (additionalEvents.length > 0) {
                setEvents(prev => [...prev, ...additionalEvents]);
                console.log(`📱 Background fetch added ${additionalEvents.length} more events`);
              }
            }
          } catch (error) {
            console.log('📱 Background fetch failed (non-critical):', error.message);
          }
        }, 5000); // Wait 5 seconds before background fetch
      }

    } catch (error) {
      console.error('Error fetching events:', error);
      
      // More specific error messages for mobile users
      let errorMessage = 'Failed to load events. Please try again.';
      if (error.message.includes('timed out') || error.message.includes('timeout')) {
        errorMessage = 'Connection is taking longer than usual. Please wait a moment or try refreshing the page.';
      } else if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
      } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
        errorMessage = 'Server is temporarily busy. Please try again in a moment.';
      }
      
      setError(errorMessage);
      setEvents([]); // Set empty array as fallback
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    
    // Mobile-adaptive backup fetch mechanism
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const backupDelay = isMobile ? 15000 : 5000; // 15 seconds for mobile, 5 for desktop
    
    const backupTimer = setTimeout(() => {
      if (events.length === 0 && !error) {
        console.log(`🔄 Backup fetch triggered - no events loaded after ${backupDelay/1000} seconds (mobile: ${isMobile})`);
        fetchEvents();
      }
    }, backupDelay);
    
    return () => clearTimeout(backupTimer);
  }, []); // Only fetch events once on component mount

  // Handle preset filters from URL routing  
  useEffect(() => {
    console.log('Preset filters handler running - eventSlug:', eventSlug, 'slug:', slug, 'selectedEvent:', selectedEvent?.slug || 'none');
    
    // Handle individual event slug routes
    if (eventSlug && slug) {
      // Check if this event was manually closed by the user
      const wasManuallyClosed = manuallyClosed.has(slug);
      
      // Only handle if we don't already have this event selected AND it wasn't manually closed
      if ((!selectedEvent || selectedEvent.slug !== slug) && !wasManuallyClosed) {
        console.log('Preset handler: Calling handleEventFromSlug for:', slug);
        // For event routes like /e/:slug, /event/:slug, or /events/2025/06/06/:slug
        handleEventFromSlug(slug);
      } else if (wasManuallyClosed) {
        console.log('🚫 Preset handler: Event was manually closed, skipping:', slug);
      } else {
        console.log('🚫 Preset handler: Event already selected, skipping:', slug);
      }
      return;
    }

    // Handle preset category routes like /events/music
    if (presetCategory && category) {
      setSelectedCategory([category]);
      return;
    }

    // Handle preset filters from URL patterns
    if (Object.keys(presetFilters).length > 0) {
      applyPresetFilters(presetFilters);
    }
  }, [eventSlug, slug, presetCategory, category, presetFilters, city, state, selectedEvent?.slug, manuallyClosed]); // Track selectedEvent slug and manually closed events

  // Use a ref to track if we're currently processing a slug to prevent duplicate calls
  const processingSlugRef = useRef(null);

  const handleEventFromSlug = async (eventSlug) => {
    try {
      // Check if this event was manually closed by the user
      if (manuallyClosed.has(eventSlug)) {
        console.log('Event was manually closed, ignoring handleEventFromSlug for:', eventSlug);
        return;
      }

      // Check if we're still on a URL that should have this event selected
      const currentPath = window.location.pathname;
      if (!currentPath.includes(eventSlug)) {
        console.log('Current URL no longer contains slug, ignoring:', eventSlug);
        return;
      }

      // Prevent processing the same slug multiple times simultaneously
      if (processingSlugRef.current === eventSlug) {
        console.log('Already processing slug, ignoring duplicate call:', eventSlug);
        return;
      }

      // Prevent selecting the same event multiple times
      if (selectedEvent && selectedEvent.slug === eventSlug) {
        console.log('Event with slug already selected, ignoring:', eventSlug);
        return;
      }

      processingSlugRef.current = eventSlug;

      // Try to find event by slug in current events
      const event = events.find(e => e.slug === eventSlug);
      if (event) {
        console.log('Found event in current events for slug:', eventSlug);
        setSelectedEvent(event);
        processingSlugRef.current = null;
        return;
      }

      // If not found in current events, try to fetch from API
      console.log('Fetching event from API for slug:', eventSlug);
      const response = await fetchWithTimeout(`${API_URL}/api/seo/events/by-slug/${eventSlug}`);
      if (response && response.id) {
        setSelectedEvent(response);
        // Also add to events list if not there
        if (!events.find(e => e.id === response.id)) {
          setEvents(prev => [response, ...prev]);
        }
      }
      
      processingSlugRef.current = null;
    } catch (error) {
      console.error('Error fetching event by slug:', error);
      processingSlugRef.current = null;
    }
  };

  const applyPresetFilters = (filters) => {
    // Handle time-based filters
    if (filters.timeFilter) {
      setSelectedTime(filters.timeFilter);
      
      // Convert timeFilter to date for weekend/week filters
      if (filters.timeFilter === 'this-weekend') {
        // Set date range for this weekend - use local dates to avoid timezone issues
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        // Calculate Saturday of this week
        const daysUntilSaturday = (6 - dayOfWeek) % 7;
        const saturday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysUntilSaturday);
        
        // Calculate Sunday of this week (if today is Sunday, use today; otherwise, use next Sunday)
        const sunday = dayOfWeek === 0 
          ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
          : new Date(saturday.getFullYear(), saturday.getMonth(), saturday.getDate() + 1);
        
        console.log('This weekend filter:', {
          today: today.toLocaleDateString(),
          dayOfWeek: dayOfWeek,
          saturday: saturday.toLocaleDateString(),
          sunday: sunday.toLocaleDateString(),
          saturdayTime: saturday.getTime(),
          sundayTime: sunday.getTime()
        });
        
        setSelectedDate({
          from: saturday,
          to: sunday
        });
      } else if (filters.timeFilter === 'this-week') {
        // Set date range for this week - Monday to Sunday
        const today = new Date();
        const dayOfWeek = today.getDay();
        
        // Calculate Monday of this week
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Handle Sunday as day 0
        const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysFromMonday);
        
        // Calculate Sunday of this week
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
        
        setSelectedDate({
          from: monday,
          to: sunday
        });
      } else if (filters.timeFilter === 'today') {
        const today = new Date();
        setSelectedDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
      } else if (filters.timeFilter === 'tomorrow') {
        const today = new Date();
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        setSelectedDate(tomorrow);
      }
    }

    // Handle category filters
    if (filters.category) {
      setSelectedCategory([filters.category]);
    }

    // Handle location-based filters
    if (filters.locationBased && city) {
      // Convert city param to search location
      const cityName = city.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      setSearchValue(cityName);
      // Try to geocode and set location
      geocodeCityForFilters(cityName);
    }

    // Handle state-based filters
    if (filters.stateBased && state) {
      const stateName = state.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      setSearchValue(stateName);
      geocodeCityForFilters(stateName);
    }

    // Handle city-state filters
    if (filters.cityState && city && state) {
      const cityName = city.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const stateName = state.toUpperCase();
      const locationQuery = `${cityName}, ${stateName}`;
      setSearchValue(locationQuery);
      geocodeCityForFilters(locationQuery);
    }

    // Handle free events filter
    if (filters.freeOnly) {
      setMiscFilters(prev => ({
        ...prev,
        feeFilter: 'free'
      }));
    }

    // Handle "near me" filters
    if (filters.nearMe) {
      // Try to get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setSelectedLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              address: 'Your location',
              city: 'Your location'
            });
            setProximityRange(25); // Set a reasonable radius
          },
          (error) => {
            console.warn('Could not get user location for "near me" filter:', error);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000, // Increased timeout for better reliability
            maximumAge: 1800000 // 30 minutes to reduce frequent GPS requests
          }
        );
      }
    }
  };

  const geocodeCityForFilters = async (query) => {
    try {
      if (window.google && window.google.maps) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: query }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const location = results[0].geometry.location;
            setSelectedLocation({
              lat: location.lat(),
              lng: location.lng()
            });
            setProximityRange(25); // Set reasonable search radius
          }
        });
      }
    } catch (error) {
      console.warn('Geocoding failed for preset filter:', error);
    }
  };

  // Track page visit for analytics (privacy-friendly)
  useEffect(() => {
    trackPageVisit('homepage', '/');
  }, []);

  // Cleanup all timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear all tracked timeouts
      timeoutRefs.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      timeoutRefs.current.clear();
    };
  }, []);

  // Track first-time sign-in to show welcome popup
  useEffect(() => {
    if (user && !localStorage.getItem('hasSeenFirstTimeSignIn')) {
      setShowFirstTimeSignInPopup(true);
      localStorage.setItem('hasSeenFirstTimeSignIn', 'true');
    }
  }, [user]);

  // Check for premium subscription success redirect
  useEffect(() => {
    const checkPremiumSuccess = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      const success = urlParams.get('success');
      const tier = urlParams.get('tier');

      if (success === 'true' && sessionId && tier && user) {
        console.log('Premium subscription success detected:', { sessionId, tier, userId: user.id });
        
        // Clear the URL parameters
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('session_id');
        newUrl.searchParams.delete('success');
        newUrl.searchParams.delete('tier');
        window.history.replaceState({}, '', newUrl.pathname + newUrl.search);

        // Set welcome data and show animation
        setPremiumWelcomeData({
          tier: tier,
          userName: user.email?.split('@')[0] || user.name || ''
        });
        setShowPremiumWelcome(true);

        // Track the subscription success
        trackPageVisit('subscription_success', `/?success=true&tier=${tier}`);
      }
    };

    // Check on component mount and when user changes
    if (user) {
      checkPremiumSuccess();
    }
  }, [user]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      // If we're back to the home page, clear selected event
      const currentPath = window.location.pathname;
      if (currentPath === '/' || !currentPath.startsWith('/e/')) {
        console.log('Clearing event due to popstate - URL:', currentPath);
        setSelectedEvent(null);
        // Clear manually closed events when navigating away
        setManuallyClosed(new Set());
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle URL parameters for event deep linking and create trigger
  useEffect(() => {
    let timeoutId;
    
    const handleUrlParams = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const eventId = urlParams.get('event');
      const shouldCreate = urlParams.get('create');
      
      console.log('🔄 URL params handler running - slug:', slug);
      
      // Handle slug-based URLs (/e/{slug})
      // Check current URL path to ensure we're still on a slug-based URL
      const currentPath = window.location.pathname;
      if (slug && events.length > 0 && currentPath.startsWith('/e/')) {
        const targetEvent = events.find(event => event.slug === slug);
        
        if (targetEvent) {
          // Check if this event was manually closed by the user
          const eventIdentifier = targetEvent.slug || targetEvent.id;
          const wasManuallyClosed = manuallyClosed.has(eventIdentifier);
          
          console.log('URL handler check:', {
            eventSlug: slug,
            eventTitle: targetEvent.title,
            wasManuallyClosed,
            selectedEventId: selectedEvent?.id,
            targetEventId: targetEvent.id
          });
          
          // Only select the event if:
          // 1. No event is currently selected OR it's a different event
          // 2. AND the event was not manually closed by the user
          if ((!selectedEvent || selectedEvent.id !== targetEvent.id) && !wasManuallyClosed) {
            console.log('URL handler: Selecting event from slug:', targetEvent.title);
            setSelectedEvent(targetEvent);
            setActiveTab('details'); // Start with details tab
            
            // If the event has coordinates, center the map on it
            if (targetEvent.lat && targetEvent.lng) {
              setSelectedLocation({
                lat: targetEvent.lat,
                lng: targetEvent.lng,
                address: targetEvent.address
              });
            }
          } else if (wasManuallyClosed) {
            console.log('URL handler: Skipping event - was manually closed:', targetEvent.title);
          }
        } else {
          console.warn(`Event with slug "${slug}" not found in current events list`);
          // Optionally redirect to home page if event not found
          // navigate('/');
        }
      }
      // Clear selected event if we're not on an event URL and an event is selected
      else if (!currentPath.startsWith('/e/') && !currentPath.includes('?event=') && selectedEvent) {
        console.log('🧹 URL handler: Clearing selected event - not on event URL');
        setSelectedEvent(null);
      }
      
      // Handle old-style event ID URLs (?event=123) for backward compatibility
      else if (eventId && events.length > 0 && !selectedEvent) {
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
      
      // Handle create parameter to open create form
      if (shouldCreate === 'true') {
        // Clear the URL parameter first
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('create');
        window.history.replaceState({}, '', newUrl.pathname + newUrl.search);
        
        // If user is logged in, open create form immediately
        if (user) {
          setEditingEvent(null);
          setSelectedEvent(null);
          setIsCreateFormOpen(true);
        } else {
          // If not logged in, show login dialog first
          setLoginMode('login');
          setShowLoginDialog(true);
        }
      }
    };

    // Run on component mount and when events are loaded
    // Only run if we're actually on a URL that should have an event selected
    const currentPath = window.location.pathname;
    if (events.length > 0 && (currentPath.startsWith('/e/') || new URLSearchParams(window.location.search).get('event'))) {
      // Add a small delay to prevent race conditions
      timeoutId = setTimeout(() => {
        handleUrlParams();
      }, 100);
    } else if (events.length === 0) {
      // Also check for create parameter even when no events loaded
      const urlParams = new URLSearchParams(window.location.search);
      const shouldCreate = urlParams.get('create');
      
      if (shouldCreate === 'true') {
        // Clear the URL parameter first
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('create');
        window.history.replaceState({}, '', newUrl.pathname + newUrl.search);
        
        // If user is logged in, open create form immediately
        if (user) {
          setEditingEvent(null);
          setSelectedEvent(null);
          setIsCreateFormOpen(true);
        } else {
          // If not logged in, show login dialog first
          setLoginMode('login');
          setShowLoginDialog(true);
        }
      }
    }

    // Cleanup timeout
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [events.length, user, slug, manuallyClosed, selectedEvent]); // Include manuallyClosed to react to close actions

  const handleAddressSelect = (data) => {
    setSelectedLocation({ lat: data.lat, lng: data.lng, address: data.address, city: data.address });
    setSearchValue(data.address);
    
    // Center map on the chosen location
    setMapCenter({ lat: data.lat, lng: data.lng });

    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  // Filter events based on selected criteria and sort by distance when location is set
  const filteredEvents = events.filter(event => {
    if (!event || !event.id || event.lat == null || event.lng == null) return false;
    
    // Filter out past events
    if (isEventPast(event)) return false;
    
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
    
    // Proximity filter
    if (selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null) {
      const distance = calculateDistance(
        selectedLocation.lat,
        selectedLocation.lng,
        event.lat,
        event.lng
      );
      if (proximityRange !== 9999 && distance > proximityRange) return false;
    }
    
    // Misc filters - Fee filter
    if (miscFilters.feeFilter !== 'all') {
      const hasFee = event.fee_required && event.fee_required.trim() !== '';
      if (miscFilters.feeFilter === 'free' && hasFee) return false;
      if (miscFilters.feeFilter === 'paid' && !hasFee) return false;
    }
    
    return true;
  }).sort((a, b) => {
    // Calculate priority scores for both events
    const calculatePriorityScore = (event) => {
      let score = 0;
      
      // Distance component (when location is set)
    if (selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null) {
        const distance = calculateDistance(
        selectedLocation.lat,
        selectedLocation.lng,
          event.lat,
          event.lng
      );
        // Closeness factor: inverse of distance (closer = higher score)
        // Add 1 to avoid division by zero, normalize to reasonable range
        const closeness = 1 / (distance + 0.1);
        score += closeness * 100; // Scale up for better weighting
      }
      
      // Time proximity component (equally important as distance)
      const eventDateTime = new Date(`${event.date} ${event.start_time}`);
      const now = new Date();
      const hoursUntilEvent = (eventDateTime - now) / (1000 * 60 * 60); // Convert to hours
      
      if (hoursUntilEvent > 0) {
        // Time closeness: events happening sooner get higher scores
        // Use similar inverse formula as distance, but with hours
        // Add 1 to avoid division by zero, cap at reasonable range
        const timeCloseness = 1 / (hoursUntilEvent / 24 + 0.1); // Normalize to days
        score += timeCloseness * 100; // Same weight as distance
      }
      
      // Verification multiplier (2x boost for verified events)
      const verificationMultiplier = event.verified ? 2 : 1;
      score *= verificationMultiplier;
      
      // Interest count component (0.1 * interest_count)
      const interestCount = event.interest_count || 0;
      score += 0.1 * interestCount;
      
      return score;
    };
    
    // If address is set, use priority scoring
    if (selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null) {
      const scoreA = calculatePriorityScore(a);
      const scoreB = calculatePriorityScore(b);
      
      // Higher score = higher priority (sort descending)
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      
      // Fallback to date if scores are equal
      const dateA = new Date(`${a.date} ${a.start_time}`);
      const dateB = new Date(`${b.date} ${b.start_time}`);
      return dateA - dateB;
    }
    
    // When no location is set, prioritize verified events, then by interest, then by date
    const verifiedA = a.verified ? 1 : 0;
    const verifiedB = b.verified ? 1 : 0;
    
    if (verifiedB !== verifiedA) {
      return verifiedB - verifiedA; // Verified events first
    }
    
    // Then by interest count
    const interestA = a.interest_count || 0;
    const interestB = b.interest_count || 0;
    
    if (interestB !== interestA) {
      return interestB - interestA; // Higher interest first
    }
    
    // Finally by date and time (earliest first)
    const dateA = new Date(`${a.date} ${a.start_time}`);
    const dateB = new Date(`${b.date} ${b.start_time}`);
    return dateA - dateB;
  });

  // Route planning handlers
  const handleRouteCalculated = (directionsResult, steps) => {
    setRouteData(directionsResult);
    setRouteSteps(steps);
    
    if (directionsResult && mapRef.current) {
      // Clear any existing directions renderer
      if (routeDirectionsRenderer) {
        routeDirectionsRenderer.setMap(null);
      }
      
      // Create new directions renderer
      const renderer = new window.google.maps.DirectionsRenderer({
        map: mapRef.current,
        directions: directionsResult,
        draggable: true,
        panel: null
      });
      
      setRouteDirectionsRenderer(renderer);
      setShowRouteTimeline(true);
    }
  };

  const handleRouteEventsDiscovered = (events) => {
    console.log('🎯 handleRouteEventsDiscovered called with:', events?.length, 'events');
    console.log('🔍 First few route events:', events?.slice(0, 3));
    setRouteEvents(events || []);
  };

  const handleCloseRoutePlanner = () => {
    setShowRoutePlanner(false);
    
    if (routeDirectionsRenderer) {
      routeDirectionsRenderer.setMap(null);
      setRouteDirectionsRenderer(null);
    }
    
    setRouteData(null);
    setRouteSteps([]);
    setRouteEvents([]);
    setShowRouteTimeline(false);
  };

  const handleToggleRoutePlanner = () => {
    if (showRoutePlanner) {
      handleCloseRoutePlanner();
    } else {
      setShowRoutePlanner(true);
      if (activeView !== 'map') {
        setActiveView('map');
      }
    }
  };

  // Helper function to close event details and restore URL
  const handleCloseEventDetails = () => {
    console.log('Desktop close button clicked');
    console.log('Closing event details, selectedEvent:', selectedEvent?.title);
    
    // Mark this event as manually closed to prevent re-opening from URL
    if (selectedEvent) {
      setManuallyClosed(prev => new Set(prev).add(selectedEvent.slug || selectedEvent.id));
      console.log('Marked event as manually closed:', selectedEvent.slug || selectedEvent.id);
    }
    
    // Clear the selected event state immediately
    setSelectedEvent(null);
    console.log('Event cleared immediately');
    
    // Only update URL if we're currently on an event URL
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/e/')) {
      // Change URL to prevent re-selection by useEffect
      window.history.replaceState(null, '', '/');
      console.log('URL changed from', currentPath, 'to:', '/');
    } else {
      console.log('Not changing URL - not on event page:', currentPath);
    }
  };

  const handleEventClick = (event, openInNewTab = false) => {
    // Generate canonical URL (location-based if available)
    let eventUrl;
    if (event.slug) {
      if (event.city && event.state) {
        const citySlug = event.city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const stateSlug = event.state.toLowerCase();
        eventUrl = `/us/${stateSlug}/${citySlug}/events/${event.slug}`;
      } else {
        eventUrl = `/events/${event.slug}`;
      }
    } else {
      eventUrl = `/?event=${event.id}`;
    }

    // If opening in new tab or user specifically wants the detail page
    if (openInNewTab) {
      window.open(eventUrl, '_blank');
      return;
    }

    // Prevent clicking the same event multiple times
    if (selectedEvent && selectedEvent.id === event.id) {
      console.log('Event already selected, ignoring duplicate click');
      return;
    }

    console.log('Selecting event:', event.title);
    
    // Clear manually closed flag when user actively selects an event
    const eventIdentifier = event.slug || event.id;
    setManuallyClosed(prev => {
      const newSet = new Set(prev);
      newSet.delete(eventIdentifier);
      return newSet;
    });
    
    setSelectedEvent(event);
    
    // Track event detail view
    trackPageVisit('event_detail', eventUrl);
    
    // Update the browser URL to reflect the event being viewed
    window.history.replaceState(null, '', eventUrl);
    
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
        
        // If we have the created event data, redirect to its URL
        if (newEvent && newEvent.slug) {
          // Small delay to ensure the events list is updated
          setTimeout(() => {
            window.location.href = `/e/${newEvent.slug}`;
          }, 500);
        } else if (newEvent && newEvent.id) {
          // Fallback: try to find and select the event
          setTimeout(async () => {
            await fetchEvents(); // Refresh again to be sure
            setEvents(currentEvents => {
              const createdEvent = currentEvents.find(e => e.id === newEvent.id);
              if (createdEvent) {
                setSelectedEvent(createdEvent);
                // Update URL to reflect the selected event
                if (createdEvent.slug) {
                  window.history.pushState({}, '', `/e/${createdEvent.slug}`);
                }
              }
              return currentEvents;
            });
          }, 1000);
        }
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

      console.log('Event created successfully:', createdEvent);
      
      // Close the form immediately
      setIsCreateFormOpen(false);
      setEditingEvent(null);
      setSelectedLocation(null);
      
      // Show success message briefly
      setError(null);
      
      // Redirect to the event page if we have a slug
      if (createdEvent.slug) {
        // Small delay to show success, then redirect
      setTimeout(() => {
          window.location.href = `/e/${createdEvent.slug}`;
        }, 500);
      } else {
        // Fallback: refresh events and select the new one
        try {
          await fetchEvents();
          
          // Try multiple times to find and select the event
          let attempts = 0;
          const maxAttempts = 5;
          
          const trySelectEvent = async () => {
            attempts++;
            
            // Refresh events list
            await fetchEvents();
            
        setEvents(currentEvents => {
          const refreshedEvent = currentEvents.find(e => e.id === createdEvent.id);
          if (refreshedEvent) {
                console.log('Found and selecting created event:', refreshedEvent.title);
            setSelectedEvent(refreshedEvent);
                
                // Update URL if we have a slug
                if (refreshedEvent.slug) {
                  window.history.pushState({}, '', `/e/${refreshedEvent.slug}`);
                }
                return currentEvents;
              } else if (attempts < maxAttempts) {
                // Try again after a short delay
                setTimeout(trySelectEvent, 1000);
          } else {
                console.warn('Could not find created event after', maxAttempts, 'attempts');
                // As a last resort, just set the created event data
            setSelectedEvent(createdEvent);
          }
          return currentEvents;
        });
          };
          
          // Start the selection process
          setTimeout(trySelectEvent, 500);
          
        } catch (refreshError) {
          console.error('Error refreshing events after creation:', refreshError);
          // Still try to select the created event
          setSelectedEvent(createdEvent);
        }
      }

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
      handleCloseEventDetails(); // Use helper to also restore URL
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
            foreignObjectRendering: false,
            skipFonts: true,
            cacheBust: true,
            filter: (node) => {
              // Skip external stylesheets and Google Fonts
              if (node.tagName === 'LINK' && node.href && 
                  (node.href.includes('fonts.googleapis.com') || 
                   node.href.includes('fonts.gstatic.com'))) {
                return false;
              }
              // Skip style elements that might contain external CSS
              if (node.tagName === 'STYLE' && node.textContent && 
                  (node.textContent.includes('googleapis.com') || 
                   node.textContent.includes('gstatic.com'))) {
                return false;
              }
              // Always include images (including maps), even if they're external or data URLs
              if (node.tagName === 'IMG') {
                return true;
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
        
        // Clean up the data URL to prevent memory leaks
        if (dataUrl.startsWith('data:')) {
          // For data URLs, we can't revoke them, but we can clear the reference
          dataUrl = null;
        }
        
        console.log('Download completed successfully');
        setDownloadStatus('Downloaded!');
        const timeoutId = setTimeout(() => setDownloadStatus(''), 2000);
        timeoutRefs.current.add(timeoutId);
        
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
      const timeoutId = setTimeout(() => setDownloadStatus(''), 6000);
      timeoutRefs.current.add(timeoutId);
    }
  };

  // Copy event link
  const handleCopyLink = () => {
    // Generate canonical URL (location-based if available, Google-friendly format)
    let url;
    if (selectedEvent.slug) {
      // Use location-based URL if city and state are available
      if (selectedEvent.city && selectedEvent.state) {
        const citySlug = selectedEvent.city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const stateSlug = selectedEvent.state.toLowerCase();
        url = `${window.location.origin}/us/${stateSlug}/${citySlug}/events/${selectedEvent.slug}`;
      } else {
        url = `${window.location.origin}/events/${selectedEvent.slug}`;
      }
    } else {
      // Fallback to old format for events without slugs
      url = `${window.location.origin}/?event=${selectedEvent.id}`;
    }
    
    navigator.clipboard.writeText(url);
    setDownloadStatus('Link copied!');
    const timeoutId = setTimeout(() => setDownloadStatus(''), 1500);
    timeoutRefs.current.add(timeoutId);
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
            useCORS: true,
            allowTaint: true,
            foreignObjectRendering: false,
            skipFonts: true,
            cacheBust: true,
            filter: (node) => {
              // Skip external stylesheets and Google Fonts
              if (node.tagName === 'LINK' && node.href && 
                  (node.href.includes('fonts.googleapis.com') || 
                   node.href.includes('fonts.gstatic.com'))) {
                return false;
              }
              // Skip style elements that might contain external CSS
              if (node.tagName === 'STYLE' && node.textContent && 
                  (node.textContent.includes('googleapis.com') || 
                   node.textContent.includes('gstatic.com'))) {
                return false;
              }
              // Always include images (including maps), even if they're external or data URLs
              if (node.tagName === 'IMG') {
                return true;
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
            currentY = wrapText(`${selectedEvent.date} at ${selectedEvent.time}`, canvas.width/2, currentY, 1000, 40) + 20;
            currentY = wrapText(`${selectedEvent.address}`, canvas.width/2, currentY, 1000, 40) + 40;
            
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
        // Generate URL using canonical format (location-based if available)
        let eventUrl;
        if (selectedEvent.slug) {
          // Use location-based URL if city and state are available (Google-friendly format)
          if (selectedEvent.city && selectedEvent.state) {
            const citySlug = selectedEvent.city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const stateSlug = selectedEvent.state.toLowerCase();
            eventUrl = `${window.location.origin}/us/${stateSlug}/${citySlug}/events/${selectedEvent.slug}`;
          } else {
            eventUrl = `${window.location.origin}/events/${selectedEvent.slug}`;
          }
        } else {
          eventUrl = `${window.location.origin}/?event=${selectedEvent.id}`;
        }
        const encodedUrl = encodeURIComponent(eventUrl);
        const shareText = encodeURIComponent(`Check out this amazing event: ${selectedEvent.title}!\n\n${selectedEvent.date} at ${selectedEvent.time}\n${selectedEvent.address}\n\n${selectedEvent.description}\n\nFind more local events at todo-events.com`);
        
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
      // Fallback to simple URL sharing using canonical format
      let fallbackUrl;
      if (selectedEvent.slug) {
        // Use location-based URL if city and state are available (Google-friendly format)
        if (selectedEvent.city && selectedEvent.state) {
          const citySlug = selectedEvent.city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          const stateSlug = selectedEvent.state.toLowerCase();
          fallbackUrl = `${window.location.origin}/us/${stateSlug}/${citySlug}/events/${selectedEvent.slug}`;
        } else {
          fallbackUrl = `${window.location.origin}/events/${selectedEvent.slug}`;
        }
      } else {
        fallbackUrl = `${window.location.origin}/?event=${selectedEvent.id}`;
      }
      const url = encodeURIComponent(fallbackUrl);
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
    { value: 30, label: '30mi', description: 'Regional' },
    { value: 9999, label: 'All', description: 'Show all events by distance' }
  ];



  // Show initial loading animation only if we're still on the very first load and have no events
  if (isInitialLoading && events.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center" style={{backgroundColor: 'var(--bg-main)'}}>
        <SmoothLoader message="Loading your events..." />
      </div>
    );
  }

  // Handle explicit current-location request
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        setSelectedLocation({ lat: latitude, lng: longitude, address: 'Your location', city: 'Your location' });
        setMapCenter({ lat: latitude, lng: longitude });
      },
      () => {
        // silently ignore errors
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, // Increased timeout for better reliability
        maximumAge: 1800000 // 30 minutes to reduce frequent GPS requests
      }
    );
  };

  return (
    <div className="h-screen w-full relative" style={{backgroundColor: 'var(--bg-main)'}}>
      {/* Mobile Header */}
      <div className="sm:hidden fixed top-0 left-0 right-0 z-30 dialog-themed backdrop-blur-sm border-b border-themed">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => user ? window.open('/hosts', '_blank') : setShowWelcomePopup(true)}
              className="text-white hover:bg-white/10 transition-colors duration-200 min-h-[36px] min-w-[36px]"
              title={user ? "Hosting Guide" : "Help & Tutorial"}
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
            <ThemeSelector />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileRecommendationsOpen(true)}
              className="text-white hover:bg-white/10 transition-colors duration-200 min-h-[36px] min-w-[36px]"
              title="Recommendations"
            >
              <Compass className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className={`
        fixed left-0 top-0 z-40 h-full
        transition-all duration-300 ease-in-out
        ${isSidebarCollapsed ? 'w-24' : 'w-96'}
        dialog-themed backdrop-blur-sm border-r border-themed
        hidden sm:flex flex-col
      `}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center justify-between flex-1 mr-2">
              <h2 className="text-xl font-display font-bold text-white">todo-events</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                  onClick={() => setShowEmailContactPopup(true)}
                  title="Contact Support"
                >
                  <Mail className="w-4 h-4" />
                </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                  onClick={() => user ? window.open('/hosts', '_blank') : setShowWelcomePopup(true)}
                  title={user ? "Hosting Guide" : "Help & Tutorial"}
                      >
                  <HelpCircle className="w-4 h-4" />
                      </Button>
                <ThemeSelector />
                {user ? (
                  <UserDropdown />
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
            <div className="flex flex-col gap-2">
              <ThemeSelector />
            </div>
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
              <div className="p-4 space-y-4">
                {/* Location Section - Compact */}
                <div className="space-y-2 p-3 bg-themed-surface rounded-lg border border-themed">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-1 h-4 bg-pin-blue rounded-full"></span>
                      <label className="text-sm font-medium text-themed-primary">Location</label>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-pin-blue hover:text-pin-blue-300 hover:bg-pin-blue/10 transition-all duration-200 h-6 px-2"
                      onClick={handleResetView}
                    >
                      Reset All
                    </Button>
                  </div>
                  <AddressAutocomplete
                    value={searchValue}
                    onChange={setSearchValue}
                    onSelect={handleAddressSelect}
                    theme={theme}
                    className="w-full"
                  />
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="mt-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    Use Current Location
                  </button>
                  
                  {/* Compact Search Radius */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-themed-secondary">Search Radius</label>
                    <div className="grid grid-cols-3 gap-1">
                      {proximityOptions.slice(0, 3).map(option => (
                        <button
                          key={option.value}
                          className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 ${
                            proximityRange === option.value
                              ? 'bg-pin-blue text-white border-pin-blue'
                              : 'bg-themed-surface text-themed-secondary border-themed hover:bg-themed-surface-hover'
                          }`}
                          onClick={() => setProximityRange(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {proximityOptions.slice(3).map(option => (
                        <button
                          key={option.value}
                          className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 ${
                            proximityRange === option.value
                              ? 'bg-pin-blue text-white border-pin-blue'
                              : 'bg-themed-surface text-themed-secondary border-themed hover:bg-themed-surface-hover'
                          }`}
                          onClick={() => setProximityRange(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 dark:text-red-200 light:text-red-800 text-sm">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium">Error</p>
                        <p className="text-red-200/80 dark:text-red-200/80 light:text-red-700 mt-1">{error}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-200/80 dark:text-red-200/80 light:text-red-700 hover:text-red-200 dark:hover:text-red-200 light:hover:text-red-600 mt-2 h-6 px-2 text-xs"
                          onClick={() => setError(null)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filters Tab Interface */}
                <div className="space-y-3 p-3 bg-themed-surface rounded-lg border border-themed">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1 h-4 bg-spark-yellow rounded-full"></span>
                    <span className="text-sm font-medium text-themed-primary">Search Filters</span>
                    <div className="text-xs text-themed-tertiary bg-themed-surface-hover px-2 py-0.5 rounded-full ml-auto">
                      Combine for better results
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 bg-themed-surface-hover rounded-lg p-1 border border-themed">
                    <button
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                        activeFilterTab === 'date' 
                          ? 'bg-themed-surface-active text-themed-primary shadow-sm' 
                          : 'text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover'
                      }`}
                      onClick={() => setActiveFilterTab('date')}
                    >
                      Date
                    </button>
                    <button
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                        activeFilterTab === 'time' 
                          ? 'bg-themed-surface-active text-themed-primary shadow-sm' 
                          : 'text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover'
                      }`}
                      onClick={() => setActiveFilterTab('time')}
                    >
                      Time
                    </button>
                    <button
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                        activeFilterTab === 'category' 
                          ? 'bg-themed-surface-active text-themed-primary shadow-sm' 
                          : 'text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover'
                      }`}
                      onClick={() => setActiveFilterTab('category')}
                    >
                      Type
                    </button>
                    <button
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                        activeFilterTab === 'misc' 
                          ? 'bg-themed-surface-active text-themed-primary shadow-sm' 
                          : 'text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover'
                      }`}
                      onClick={() => setActiveFilterTab('misc')}
                    >
                      Misc
                    </button>
                  </div>

                  {/* Date Filter Tab */}
                  {activeFilterTab === 'date' && (
                    <div className="space-y-2 animate-in fade-in duration-200 p-2 bg-themed-surface-hover rounded-md border border-themed">
                      {/* Quick Date Presets */}
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { label: 'Today', getValue: () => ({ from: new Date(), to: new Date() }) },
                          { label: 'Tomorrow', getValue: () => {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            return { from: tomorrow, to: tomorrow };
                          }},
                          { label: 'This Week', getValue: () => {
                            const today = new Date();
                            const endOfWeek = new Date(today);
                            endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
                            return { from: today, to: endOfWeek };
                          }},
                          { label: 'Weekend', getValue: () => {
                            const today = new Date();
                            const saturday = new Date(today);
                            saturday.setDate(today.getDate() + (6 - today.getDay()));
                            const sunday = new Date(saturday);
                            sunday.setDate(saturday.getDate() + 1);
                            return { from: saturday, to: sunday };
                          }}
                        ].map(preset => (
                          <button
                            key={preset.label}
                            className="px-2 py-1.5 text-xs font-medium rounded-md bg-themed-surface text-themed-secondary border border-themed hover:bg-themed-surface-hover transition-all duration-200"
                            onClick={() => setSelectedDate(preset.getValue())}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      
                      <CalendarFilter
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                        onClear={() => setSelectedDate(null)}
                      />
                    </div>
                  )}

                  {/* Time Filter Tab */}
                  {activeFilterTab === 'time' && (
                    <div className="space-y-2 animate-in fade-in duration-200 p-2 bg-themed-surface-hover rounded-md border border-themed">
                                              <div className="text-xs text-themed-secondary mb-2 px-1">
                          Filter events by time of day
                        </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { value: 'all', label: 'All Times', icon: '', description: 'Any time' },
                          { value: 'morning', label: 'Morning', icon: '', description: '5 AM - 12 PM' },
                          { value: 'afternoon', label: 'Afternoon', icon: '', description: '12 PM - 5 PM' },
                          { value: 'evening', label: 'Evening', icon: '', description: '5 PM - 9 PM' },
                          { value: 'night', label: 'Night', icon: '', description: '9 PM - 5 AM' }
                        ].map(timeOption => {
                          // Calculate event count for this time period
                          const eventCount = events.filter(event => {
                            if (!event || !event.id || event.lat == null || event.lng == null) return false;
                            
                            // Filter out past events
                            if (isEventPast(event)) return false;
                            
                            // Apply other filters but not time filter
                            const categoryMatch = selectedCategory.includes('all') || selectedCategory.some(categoryId => categoryId === event.category);
                            if (!categoryMatch) return false;
                            
                            const dateMatch = isDateInRange(event.date, selectedDate);
                            if (!dateMatch) return false;
                            
                            // Proximity filter
                            if (selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null) {
                              const distance = calculateDistance(
                                selectedLocation.lat,
                                selectedLocation.lng,
                                event.lat,
                                event.lng
                              );
                              if (proximityRange !== 9999 && distance > proximityRange) return false;
                            }
                            
                            // Time filter for this specific option
                            if (timeOption.value === 'all') return true;
                            const eventTimePeriod = getTimePeriod(event.start_time);
                            return eventTimePeriod === timeOption.value;
                          }).length;
                          
                          return (
                            <button
                              key={timeOption.value}
                              className={`p-2 rounded-md border-2 transition-all duration-200 text-left ${
                                selectedTime === timeOption.value
                                  ? 'bg-white/20 dark:bg-white/20 light:bg-black/10 border-pin-blue text-white dark:text-white light:text-black shadow-lg transform scale-[1.02]'
                                  : 'bg-white/5 dark:bg-white/5 light:bg-black/5 border-white/20 dark:border-white/20 light:border-black/30 text-white/70 dark:text-white/70 light:text-black/70 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/10 hover:border-white/30 dark:hover:border-white/30 light:hover:border-black/40'
                              }`}
                              onClick={() => setSelectedTime(timeOption.value)}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                
                                <span className="text-xs font-medium">{timeOption.label}</span>
                              </div>
                              <div className={`text-xs transition-colors duration-200 ${
                                selectedTime === timeOption.value ? 'text-white/80 dark:text-white/80 light:text-black/80' : 'text-white/50 dark:text-white/50 light:text-black/50'
                              }`}>
                                {timeOption.description}
                              </div>
                              <div className={`text-xs mt-1 transition-colors duration-200 ${
                                selectedTime === timeOption.value ? 'text-white/80 dark:text-white/80 light:text-black/80' : 'text-white/50 dark:text-white/50 light:text-black/50'
                              }`}>
                                {eventCount} events
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Category Filter Tab */}
                  {activeFilterTab === 'category' && (
                    <div className="space-y-2 animate-in fade-in duration-200 p-2 bg-white/5 dark:bg-white/5 light:bg-black/5 rounded-md border border-white/10 dark:border-white/10 light:border-black/20">
                      <div className="text-xs text-white/60 dark:text-white/60 light:text-black/60 mb-2 px-1">
                        Tap categories to toggle them on/off. You can select multiple!
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {categories.map(category => {
                          // Calculate filtered event count for this specific category
                          let eventCount;
                          if (category.id === 'all') {
                            eventCount = filteredEvents.length;
                          } else {
                            // Count events that match this category AND other active filters
                            eventCount = events.filter(event => {
                              if (!event || !event.id || event.lat == null || event.lng == null) return false;
                              
                              // Filter out past events
                              if (isEventPast(event)) return false;
                              
                              // Must match this specific category
                              if (event.category !== category.id) return false;
                              
                              // Apply other filters (date, proximity) but not category filter
                              const dateMatch = isDateInRange(event.date, selectedDate);
                              if (!dateMatch) return false;
                              
                              // Proximity filter
                              if (selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null) {
                                const distance = calculateDistance(
                                  selectedLocation.lat,
                                  selectedLocation.lng,
                                  event.lat,
                                  event.lng
                                );
                                if (proximityRange !== 9999 && distance > proximityRange) return false;
                              }
                              
                              return true;
                            }).length;
                          }
                          
                          // Map category colors to border classes
                          const getBorderColor = (categoryId) => {
                            const colorMap = {
                              'all': 'border-gray-400',
                              'food-drink': 'border-vibrant-magenta',
                              'music': 'border-pin-blue',
                              'arts': 'border-fresh-teal',
                              'sports': 'border-spark-yellow',
                              'automotive': 'border-vibrant-magenta',
                              'airshows': 'border-pin-blue',
                              'vehicle-sports': 'border-spark-yellow',
                              'community': 'border-fresh-teal',
                              'religious': 'border-pin-blue',
                              'education': 'border-fresh-teal',
                              'veteran': 'border-pin-blue',
                              'cookout': 'border-vibrant-magenta',
                              'graduation': 'border-spark-yellow',
                              'tech-education': 'border-fresh-teal',
                              'other': 'border-gray-400'
                            };
                            return colorMap[categoryId] || 'border-gray-400';
                          };
                          
                          return (
                            <button
                              key={category.id}
                              className={`relative p-2 rounded-md border-2 transition-all duration-200 text-left ${
                                selectedCategory.includes(category.id)
                                  ? `bg-white/20 dark:bg-white/20 light:bg-black/10 ${getBorderColor(category.id)} text-white dark:text-white light:text-black shadow-lg transform scale-[1.02]`
                                  : 'bg-white/5 dark:bg-white/5 light:bg-black/5 border-white/20 dark:border-white/20 light:border-black/30 text-white/70 dark:text-white/70 light:text-black/70 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/10 hover:border-white/30 dark:hover:border-white/30 light:hover:border-black/40'
                              }`}
                              onClick={() => handleCategorySelect(category.id)}
                            >
                              {/* Selected indicator */}
                              {selectedCategory.includes(category.id) && (
                                <div className="absolute top-0.5 right-0.5">
                                  <div className="w-1.5 h-1.5 bg-white dark:bg-white light:bg-black rounded-full opacity-80"></div>
                                </div>
                              )}
                              <div className="flex items-center gap-1 mb-0.5">
                                {React.createElement(category.icon, {
                                  className: `w-3 h-3 transition-colors duration-200 ${
                                    selectedCategory.includes(category.id) 
                                      ? 'text-white dark:text-white light:text-black' 
                                      : category.color
                                  }`
                                })}
                                <span className="text-xs font-medium truncate">{category.name}</span>
                              </div>
                              <div className={`text-xs transition-colors duration-200 ${
                                selectedCategory.includes(category.id) ? 'text-white/80 dark:text-white/80 light:text-black/80' : 'text-white/50 dark:text-white/50 light:text-black/50'
                              }`}>
                                {eventCount} events
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Misc Filter Tab */}
                  {activeFilterTab === 'misc' && (
                    <div className="space-y-2 animate-in fade-in duration-200 p-2 bg-white/5 dark:bg-white/5 light:bg-black/5 rounded-md border border-white/10 dark:border-white/10 light:border-black/20">
                      <div className="text-xs text-white/60 dark:text-white/60 light:text-black/60 mb-2 px-1">
                        Additional filters for event attributes
                      </div>
                      
                      {/* Fee Filter */}
                      <div className="space-y-1.5">
                        <div className="text-xs text-white/70 dark:text-white/70 light:text-black/70 font-medium px-1">
                          💰 Event Cost
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { value: 'all', label: 'All Events', icon: '🎫', description: 'Free & Paid' },
                            { value: 'free', label: 'Free', icon: '🆓', description: 'No cost' },
                            { value: 'paid', label: 'Paid', icon: '💳', description: 'Requires fee' }
                          ].map(feeOption => {
                            // Calculate event count for this fee filter
                            const eventCount = events.filter(event => {
                              if (!event || !event.id || event.lat == null || event.lng == null) return false;
                              
                              // Filter out past events
                              if (isEventPast(event)) return false;
                              
                              // Apply other filters but not misc filter
                              const categoryMatch = selectedCategory.includes('all') || selectedCategory.some(categoryId => categoryId === event.category);
                              if (!categoryMatch) return false;
                              
                              const dateMatch = isDateInRange(event.date, selectedDate);
                              if (!dateMatch) return false;
                              
                              // Time filter
                              if (selectedTime !== 'all') {
                                const eventTimePeriod = getTimePeriod(event.start_time);
                                if (eventTimePeriod !== selectedTime) return false;
                              }
                              
                              // Proximity filter
                              if (selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null) {
                                const distance = calculateDistance(
                                  selectedLocation.lat,
                                  selectedLocation.lng,
                                  event.lat,
                                  event.lng
                                );
                                if (proximityRange !== 9999 && distance > proximityRange) return false;
                              }
                              
                              // Fee filter for this specific option
                              if (feeOption.value === 'all') return true;
                              const hasFee = event.fee_required && event.fee_required.trim() !== '';
                              if (feeOption.value === 'free' && hasFee) return false;
                              if (feeOption.value === 'paid' && !hasFee) return false;
                              
                              return true;
                            }).length;
                            
                            return (
                              <button
                                key={feeOption.value}
                                className={`p-2 rounded-md border-2 transition-all duration-200 text-left ${
                                  miscFilters.feeFilter === feeOption.value
                                    ? 'bg-white/20 dark:bg-white/20 light:bg-black/10 border-pin-blue text-white dark:text-white light:text-black shadow-lg transform scale-[1.02]'
                                    : 'bg-white/5 dark:bg-white/5 light:bg-black/5 border-white/20 dark:border-white/20 light:border-black/30 text-white/70 dark:text-white/70 light:text-black/70 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/10 hover:border-white/30 dark:hover:border-white/30 light:hover:border-black/40'
                                }`}
                                onClick={() => setMiscFilters(prev => ({ ...prev, feeFilter: feeOption.value }))}
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-sm">{feeOption.icon}</span>
                                  <span className="text-xs font-medium">{feeOption.label}</span>
                                </div>
                                <div className={`text-xs transition-colors duration-200 ${
                                  miscFilters.feeFilter === feeOption.value ? 'text-white/80 dark:text-white/80 light:text-black/80' : 'text-white/50 dark:text-white/50 light:text-black/50'
                                }`}>
                                  {feeOption.description}
                                </div>
                                <div className={`text-xs mt-1 transition-colors duration-200 ${
                                  miscFilters.feeFilter === feeOption.value ? 'text-white/80 dark:text-white/80 light:text-black/80' : 'text-white/50 dark:text-white/50 light:text-black/50'
                                }`}>
                                  {eventCount} events
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Filters Summary */}
                {(!selectedCategory.includes('all') || selectedDate || selectedTime !== 'all' || proximityRange !== 15 || selectedLocation) && (
                  <div className="p-2 bg-white/5 dark:bg-white/5 light:bg-black/5 rounded-lg border border-white/10 dark:border-white/10 light:border-black/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white/70 dark:text-white/70 light:text-black/70">Active Filters</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-white/50 dark:text-white/50 light:text-black/50 hover:text-white/70 dark:hover:text-white/70 light:hover:text-black/70 h-5 px-1"
                        onClick={() => {
                          setSelectedCategory(['all']);
                          setSelectedDate(null);
                          setSelectedTime('all');
                          setProximityRange(15);
                          if (!selectedLocation) setSearchValue('');
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {!selectedCategory.includes('all') && (
                        <span className="px-2 py-0.5 text-xs bg-white/10 dark:bg-white/10 light:bg-black/10 text-white/80 dark:text-white/80 light:text-black/80 rounded-full">
                          {selectedCategory.length} categories selected
                        </span>
                      )}
                      {selectedDate && (
                        <span className="px-2 py-0.5 text-xs bg-white/10 dark:bg-white/10 light:bg-black/10 text-white/80 dark:text-white/80 light:text-black/80 rounded-full">
                          Date filter
                        </span>
                      )}
                      {selectedTime !== 'all' && (
                        <span className="px-2 py-0.5 text-xs bg-white/10 dark:bg-white/10 light:bg-black/10 text-white/80 dark:text-white/80 light:text-black/80 rounded-full">
                          {selectedTime.charAt(0).toUpperCase() + selectedTime.slice(1)} events
                        </span>
                      )}
                      {proximityRange !== 15 && (
                        <span className="px-2 py-0.5 text-xs bg-white/10 dark:bg-white/10 light:bg-black/10 text-white/80 dark:text-white/80 light:text-black/80 rounded-full">
                          {proximityRange}mi radius
                        </span>
                      )}
                      {selectedLocation && (
                        <span className="px-2 py-0.5 text-xs bg-white/10 dark:bg-white/10 light:bg-black/10 text-white/80 dark:text-white/80 light:text-black/80 rounded-full">
                          Location set
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Event Count & Quick Actions */}
                <div className="flex items-center justify-between text-xs text-white/50 dark:text-white/50 light:text-black/50 bg-white/5 dark:bg-white/5 light:bg-black/5 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                  <span>{filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found</span>
                    {selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null && (
                      <span className="text-xs text-pin-blue bg-pin-blue/10 px-2 py-1 rounded-full flex items-center gap-1">
                        <Navigation className="w-3 h-3" />
                        sorted by distance
                      </span>
                    )}
                  </div>
                </div>

                {/* Event List */}
                <div className="flex-1 overflow-y-auto">
                  <div className="space-y-2">
                    {filteredEvents.length > 0 ? filteredEvents.filter(event => 
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
                                <h3 className="font-semibold text-white text-sm truncate">
                                  {event.title || 'Untitled Event'}
                                </h3>
                              </div>
                              
                              <div className="space-y-1 text-xs text-white/70">
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
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="text-center py-8 text-white/50">
                        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No events found</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10">
              <Button
                className="w-full btn-primary font-display font-semibold text-base py-2.5 transition-all duration-200 hover:scale-[1.02] animate-bounce-in"
                onClick={() => {
                  if (!user) {
                    setLoginMode('login');
                    setShowLoginDialog(true);
                    return;
                  }
                  setEditingEvent(null); // Ensure this is always a create operation
                  setSelectedEvent(null); // Clear any selected event
                  setIsCreateFormOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
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
          className="w-full sm:w-[400px] max-w-[100vw] p-0 border-r border-white/10 bg-neutral-900/80 backdrop-blur-sm overflow-hidden"
        >
          <div className="flex flex-col h-full">
            <SheetHeader className="px-4 py-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-white font-display font-bold">todo-events</SheetTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                    onClick={() => {
                      setShowEmailContactPopup(true);
                      setIsMobileMenuOpen(false);
                    }}
                    title="Contact Support"
                  >
                    <Mail className="w-4 h-4" />
                  </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                    onClick={() => user ? window.open('/hosts', '_blank') : setShowWelcomePopup(true)}
                    title={user ? "Hosting Guide" : "Help & Tutorial"}
                        >
                    <HelpCircle className="w-4 h-4" />
                        </Button>
                  <ThemeSelector />
                  {user ? (
                    <UserDropdown />
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
              <div className="p-4 space-y-4">
                {/* Location Section - Compact */}
                <div className="space-y-2 p-3 bg-white/5 dark:bg-white/5 light:bg-black/5 rounded-lg border border-white/10 dark:border-white/10 light:border-black/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-1 h-4 bg-pin-blue rounded-full"></span>
                      <label className="text-sm font-medium text-white dark:text-white light:text-black">Location</label>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-pin-blue hover:text-pin-blue-300 hover:bg-pin-blue/10 transition-all duration-200 h-6 px-2"
                      onClick={handleResetView}
                    >
                      Reset All
                    </Button>
                  </div>
                  <AddressAutocomplete
                    value={searchValue}
                    onChange={setSearchValue}
                    onSelect={handleAddressSelect}
                    theme={theme}
                    className="w-full"
                  />
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="mt-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    Use Current Location
                  </button>
                  
                  {/* Compact Search Radius */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-white/50 dark:text-white/50 light:text-black/50">Search Radius</label>
                    <div className="grid grid-cols-3 gap-1">
                      {proximityOptions.slice(0, 3).map(option => (
                        <button
                          key={option.value}
                          className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 ${
                            proximityRange === option.value
                              ? 'bg-pin-blue text-white border-pin-blue'
                              : 'bg-white/5 dark:bg-white/5 light:bg-black/5 text-white/70 dark:text-white/70 light:text-black/70 border-white/20 dark:border-white/20 light:border-black/30 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/10'
                          }`}
                          onClick={() => setProximityRange(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {proximityOptions.slice(3).map(option => (
                        <button
                          key={option.value}
                          className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 ${
                            proximityRange === option.value
                              ? 'bg-pin-blue text-white border-pin-blue'
                              : 'bg-white/5 dark:bg-white/5 light:bg-black/5 text-white/70 dark:text-white/70 light:text-black/70 border-white/20 dark:border-white/20 light:border-black/30 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/10'
                          }`}
                          onClick={() => setProximityRange(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 dark:text-red-200 light:text-red-800 text-sm">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium">Error</p>
                        <p className="text-red-200/80 dark:text-red-200/80 light:text-red-700 mt-1">{error}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-200/80 dark:text-red-200/80 light:text-red-700 hover:text-red-200 dark:hover:text-red-200 light:hover:text-red-600 mt-2 h-6 px-2 text-xs"
                          onClick={() => setError(null)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filters Tab Interface */}
                <div className="space-y-3 p-3 bg-themed-surface rounded-lg border border-themed">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1 h-4 bg-spark-yellow rounded-full"></span>
                    <span className="text-sm font-medium text-themed-primary">Search Filters</span>
                    <div className="text-xs text-themed-tertiary bg-themed-surface-hover px-2 py-0.5 rounded-full ml-auto">
                      Combine for better results
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 bg-themed-surface-hover rounded-lg p-1 border border-themed">
                    <button
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                        activeFilterTab === 'date' 
                          ? 'bg-themed-surface-active text-themed-primary shadow-sm' 
                          : 'text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover'
                      }`}
                      onClick={() => setActiveFilterTab('date')}
                    >
                      Date
                    </button>
                    <button
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                        activeFilterTab === 'time' 
                          ? 'bg-themed-surface-active text-themed-primary shadow-sm' 
                          : 'text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover'
                      }`}
                      onClick={() => setActiveFilterTab('time')}
                    >
                      Time
                    </button>
                    <button
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                        activeFilterTab === 'category' 
                          ? 'bg-themed-surface-active text-themed-primary shadow-sm' 
                          : 'text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover'
                      }`}
                      onClick={() => setActiveFilterTab('category')}
                    >
                      Type
                    </button>
                    <button
                      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                        activeFilterTab === 'misc' 
                          ? 'bg-themed-surface-active text-themed-primary shadow-sm' 
                          : 'text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover'
                      }`}
                      onClick={() => setActiveFilterTab('misc')}
                    >
                      Misc
                    </button>
                  </div>

                  {/* Date Filter Tab */}
                  {activeFilterTab === 'date' && (
                    <div className="space-y-2 animate-in fade-in duration-200 p-2 bg-white/5 dark:bg-white/5 light:bg-black/5 rounded-md border border-white/10 dark:border-white/10 light:border-black/20">
                      {/* Quick Date Presets */}
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { label: 'Today', getValue: () => ({ from: new Date(), to: new Date() }) },
                          { label: 'Tomorrow', getValue: () => {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            return { from: tomorrow, to: tomorrow };
                          }},
                          { label: 'This Week', getValue: () => {
                            const today = new Date();
                            const endOfWeek = new Date(today);
                            endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
                            return { from: today, to: endOfWeek };
                          }},
                          { label: 'Weekend', getValue: () => {
                            const today = new Date();
                            const saturday = new Date(today);
                            saturday.setDate(today.getDate() + (6 - today.getDay()));
                            const sunday = new Date(saturday);
                            sunday.setDate(saturday.getDate() + 1);
                            return { from: saturday, to: sunday };
                          }}
                        ].map(preset => (
                          <button
                            key={preset.label}
                            className="px-2 py-1.5 text-xs font-medium rounded-md bg-white/5 dark:bg-white/5 light:bg-black/5 text-white/70 dark:text-white/70 light:text-black/70 border border-white/20 dark:border-white/20 light:border-black/30 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/10 transition-all duration-200"
                            onClick={() => setSelectedDate(preset.getValue())}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      
                      <CalendarFilter
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                        onClear={() => setSelectedDate(null)}
                      />
                    </div>
                  )}

                  {/* Time Filter Tab */}
                  {activeFilterTab === 'time' && (
                    <div className="space-y-2 animate-in fade-in duration-200 p-2 bg-white/5 dark:bg-white/5 light:bg-black/5 rounded-md border border-white/10 dark:border-white/10 light:border-black/20">
                      <div className="text-xs text-white/60 dark:text-white/60 light:text-black/60 mb-2 px-1">
                        Filter events by time of day
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { value: 'all', label: 'All Times', icon: '', description: 'Any time' },
                          { value: 'morning', label: 'Morning', icon: '', description: '5 AM - 12 PM' },
                          { value: 'afternoon', label: 'Afternoon', icon: '', description: '12 PM - 5 PM' },
                          { value: 'evening', label: 'Evening', icon: '', description: '5 PM - 9 PM' },
                          { value: 'night', label: 'Night', icon: '', description: '9 PM - 5 AM' }
                        ].map(timeOption => {
                          // Calculate event count for this time period
                          const eventCount = events.filter(event => {
                            if (!event || !event.id || event.lat == null || event.lng == null) return false;
                            
                            // Filter out past events
                            if (isEventPast(event)) return false;
                            
                            // Apply other filters but not time filter
                            const categoryMatch = selectedCategory.includes('all') || selectedCategory.some(categoryId => categoryId === event.category);
                            if (!categoryMatch) return false;
                            
                            const dateMatch = isDateInRange(event.date, selectedDate);
                            if (!dateMatch) return false;
                            
                            // Proximity filter
                            if (selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null) {
                              const distance = calculateDistance(
                                selectedLocation.lat,
                                selectedLocation.lng,
                                event.lat,
                                event.lng
                              );
                              if (proximityRange !== 9999 && distance > proximityRange) return false;
                            }
                            
                            // Time filter for this specific option
                            if (timeOption.value === 'all') return true;
                            const eventTimePeriod = getTimePeriod(event.start_time);
                            return eventTimePeriod === timeOption.value;
                          }).length;
                          
                          return (
                            <button
                              key={timeOption.value}
                              className={`p-2 rounded-md border-2 transition-all duration-200 text-left ${
                                selectedTime === timeOption.value
                                  ? 'bg-white/20 dark:bg-white/20 light:bg-black/10 border-pin-blue text-white dark:text-white light:text-black shadow-lg transform scale-[1.02]'
                                  : 'bg-white/5 dark:bg-white/5 light:bg-black/5 border-white/20 dark:border-white/20 light:border-black/30 text-white/70 dark:text-white/70 light:text-black/70 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/10 hover:border-white/30 dark:hover:border-white/30 light:hover:border-black/40'
                              }`}
                              onClick={() => setSelectedTime(timeOption.value)}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                
                                <span className="text-xs font-medium">{timeOption.label}</span>
                              </div>
                              <div className={`text-xs transition-colors duration-200 ${
                                selectedTime === timeOption.value ? 'text-white/80 dark:text-white/80 light:text-black/80' : 'text-white/50 dark:text-white/50 light:text-black/50'
                              }`}>
                                {timeOption.description}
                              </div>
                              <div className={`text-xs mt-1 transition-colors duration-200 ${
                                selectedTime === timeOption.value ? 'text-white/80 dark:text-white/80 light:text-black/80' : 'text-white/50 dark:text-white/50 light:text-black/50'
                              }`}>
                                {eventCount} events
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Category Filter Tab */}
                  {activeFilterTab === 'category' && (
                    <div className="space-y-2 animate-in fade-in duration-200 p-2 bg-white/5 dark:bg-white/5 light:bg-black/5 rounded-md border border-white/10 dark:border-white/10 light:border-black/20">
                      <div className="text-xs text-white/60 dark:text-white/60 light:text-black/60 mb-2 px-1">
                        Tap categories to toggle them on/off. You can select multiple!
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {categories.map(category => {
                          // Calculate filtered event count for this specific category
                          let eventCount;
                          if (category.id === 'all') {
                            eventCount = filteredEvents.length;
                          } else {
                            // Count events that match this category AND other active filters
                            eventCount = events.filter(event => {
                              if (!event || !event.id || event.lat == null || event.lng == null) return false;
                              
                              // Filter out past events
                              if (isEventPast(event)) return false;
                              
                              // Must match this specific category
                              if (event.category !== category.id) return false;
                              
                              // Apply other filters (date, proximity) but not category filter
                              const dateMatch = isDateInRange(event.date, selectedDate);
                              if (!dateMatch) return false;
                              
                              // Proximity filter
                              if (selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null) {
                                const distance = calculateDistance(
                                  selectedLocation.lat,
                                  selectedLocation.lng,
                                  event.lat,
                                  event.lng
                                );
                                if (proximityRange !== 9999 && distance > proximityRange) return false;
                              }
                              
                              return true;
                            }).length;
                          }
                          
                          // Map category colors to border classes
                          const getBorderColor = (categoryId) => {
                            const colorMap = {
                              'all': 'border-gray-400',
                              'food-drink': 'border-vibrant-magenta',
                              'music': 'border-pin-blue',
                              'arts': 'border-fresh-teal',
                              'sports': 'border-spark-yellow',
                              'automotive': 'border-vibrant-magenta',
                              'airshows': 'border-pin-blue',
                              'vehicle-sports': 'border-spark-yellow',
                              'community': 'border-fresh-teal',
                              'religious': 'border-pin-blue',
                              'education': 'border-fresh-teal',
                              'veteran': 'border-pin-blue',
                              'cookout': 'border-vibrant-magenta',
                              'graduation': 'border-spark-yellow',
                              'tech-education': 'border-fresh-teal',
                              'other': 'border-gray-400'
                            };
                            return colorMap[categoryId] || 'border-gray-400';
                          };
                          
                          return (
                            <button
                              key={category.id}
                              className={`relative p-2 rounded-md border-2 transition-all duration-200 text-left ${
                                selectedCategory.includes(category.id)
                                  ? `bg-white/20 dark:bg-white/20 light:bg-black/10 ${getBorderColor(category.id)} text-white dark:text-white light:text-black shadow-lg transform scale-[1.02]`
                                  : 'bg-white/5 dark:bg-white/5 light:bg-black/5 border-white/20 dark:border-white/20 light:border-black/30 text-white/70 dark:text-white/70 light:text-black/70 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/10 hover:border-white/30 dark:hover:border-white/30 light:hover:border-black/40'
                              }`}
                              onClick={() => handleCategorySelect(category.id)}
                            >
                              {/* Selected indicator */}
                              {selectedCategory.includes(category.id) && (
                                <div className="absolute top-0.5 right-0.5">
                                  <div className="w-1.5 h-1.5 bg-white dark:bg-white light:bg-black rounded-full opacity-80"></div>
                                </div>
                              )}
                              <div className="flex items-center gap-1 mb-0.5">
                                {React.createElement(category.icon, {
                                  className: `w-3 h-3 transition-colors duration-200 ${
                                    selectedCategory.includes(category.id) 
                                      ? 'text-white dark:text-white light:text-black' 
                                      : category.color
                                  }`
                                })}
                                <span className="text-xs font-medium truncate">{category.name}</span>
                              </div>
                              <div className={`text-xs transition-colors duration-200 ${
                                selectedCategory.includes(category.id) ? 'text-white/80 dark:text-white/80 light:text-black/80' : 'text-white/50 dark:text-white/50 light:text-black/50'
                              }`}>
                                {eventCount} events
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Misc Filter Tab */}
                  {activeFilterTab === 'misc' && (
                    <div className="space-y-2 animate-in fade-in duration-200 p-2 bg-white/5 dark:bg-white/5 light:bg-black/5 rounded-md border border-white/10 dark:border-white/10 light:border-black/20">
                      <div className="text-xs text-white/60 dark:text-white/60 light:text-black/60 mb-2 px-1">
                        Additional filters for event attributes
                      </div>
                      
                      {/* Fee Filter */}
                      <div className="space-y-1.5">
                        <div className="text-xs text-white/70 dark:text-white/70 light:text-black/70 font-medium px-1">
                          💰 Event Cost
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { value: 'all', label: 'All Events', icon: '🎫', description: 'Free & Paid' },
                            { value: 'free', label: 'Free', icon: '🆓', description: 'No cost' },
                            { value: 'paid', label: 'Paid', icon: '💳', description: 'Requires fee' }
                          ].map(feeOption => {
                            // Calculate event count for this fee filter
                            const eventCount = events.filter(event => {
                              if (!event || !event.id || event.lat == null || event.lng == null) return false;
                              
                              // Filter out past events
                              if (isEventPast(event)) return false;
                              
                              // Apply other filters but not misc filter
                              const categoryMatch = selectedCategory.includes('all') || selectedCategory.some(categoryId => categoryId === event.category);
                              if (!categoryMatch) return false;
                              
                              const dateMatch = isDateInRange(event.date, selectedDate);
                              if (!dateMatch) return false;
                              
                              // Time filter
                              if (selectedTime !== 'all') {
                                const eventTimePeriod = getTimePeriod(event.start_time);
                                if (eventTimePeriod !== selectedTime) return false;
                              }
                              
                              // Proximity filter
                              if (selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null) {
                                const distance = calculateDistance(
                                  selectedLocation.lat,
                                  selectedLocation.lng,
                                  event.lat,
                                  event.lng
                                );
                                if (proximityRange !== 9999 && distance > proximityRange) return false;
                              }
                              
                              // Fee filter for this specific option
                              if (feeOption.value === 'all') return true;
                              const hasFee = event.fee_required && event.fee_required.trim() !== '';
                              if (feeOption.value === 'free' && hasFee) return false;
                              if (feeOption.value === 'paid' && !hasFee) return false;
                              
                              return true;
                            }).length;
                            
                            return (
                              <button
                                key={feeOption.value}
                                className={`p-2 rounded-md border-2 transition-all duration-200 text-left ${
                                  miscFilters.feeFilter === feeOption.value
                                    ? 'bg-white/20 dark:bg-white/20 light:bg-black/10 border-pin-blue text-white dark:text-white light:text-black shadow-lg transform scale-[1.02]'
                                    : 'bg-white/5 dark:bg-white/5 light:bg-black/5 border-white/20 dark:border-white/20 light:border-black/30 text-white/70 dark:text-white/70 light:text-black/70 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/10 hover:border-white/30 dark:hover:border-white/30 light:hover:border-black/40'
                                }`}
                                onClick={() => setMiscFilters(prev => ({ ...prev, feeFilter: feeOption.value }))}
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-sm">{feeOption.icon}</span>
                                  <span className="text-xs font-medium">{feeOption.label}</span>
                                </div>
                                <div className={`text-xs transition-colors duration-200 ${
                                  miscFilters.feeFilter === feeOption.value ? 'text-white/80 dark:text-white/80 light:text-black/80' : 'text-white/50 dark:text-white/50 light:text-black/50'
                                }`}>
                                  {feeOption.description}
                                </div>
                                <div className={`text-xs mt-1 transition-colors duration-200 ${
                                  miscFilters.feeFilter === feeOption.value ? 'text-white/80 dark:text-white/80 light:text-black/80' : 'text-white/50 dark:text-white/50 light:text-black/50'
                                }`}>
                                  {eventCount} events
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Filters Summary */}
                {(!selectedCategory.includes('all') || selectedDate || selectedTime !== 'all' || proximityRange !== 15 || selectedLocation) && (
                  <div className="p-2 bg-white/5 dark:bg-white/5 light:bg-black/5 rounded-lg border border-white/10 dark:border-white/10 light:border-black/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white/70 dark:text-white/70 light:text-black/70">Active Filters</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-white/50 dark:text-white/50 light:text-black/50 hover:text-white/70 dark:hover:text-white/70 light:hover:text-black/70 h-5 px-1"
                        onClick={() => {
                          setSelectedCategory(['all']);
                          setSelectedDate(null);
                          setSelectedTime('all');
                          setProximityRange(15);
                          if (!selectedLocation) setSearchValue('');
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {!selectedCategory.includes('all') && (
                        <span className="px-2 py-0.5 text-xs bg-white/10 dark:bg-white/10 light:bg-black/10 text-white/80 dark:text-white/80 light:text-black/80 rounded-full">
                          {selectedCategory.length} categories selected
                        </span>
                      )}
                      {selectedDate && (
                        <span className="px-2 py-0.5 text-xs bg-white/10 dark:bg-white/10 light:bg-black/10 text-white/80 dark:text-white/80 light:text-black/80 rounded-full">
                          Date filter
                        </span>
                      )}
                      {selectedTime !== 'all' && (
                        <span className="px-2 py-0.5 text-xs bg-white/10 dark:bg-white/10 light:bg-black/10 text-white/80 dark:text-white/80 light:text-black/80 rounded-full">
                          {selectedTime.charAt(0).toUpperCase() + selectedTime.slice(1)} events
                        </span>
                      )}
                      {proximityRange !== 15 && (
                        <span className="px-2 py-0.5 text-xs bg-white/10 dark:bg-white/10 light:bg-black/10 text-white/80 dark:text-white/80 light:text-black/80 rounded-full">
                          {proximityRange}mi radius
                        </span>
                      )}
                      {selectedLocation && (
                        <span className="px-2 py-0.5 text-xs bg-white/10 dark:bg-white/10 light:bg-black/10 text-white/80 dark:text-white/80 light:text-black/80 rounded-full">
                          Location set
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Event Count & Quick Actions */}
                <div className="flex items-center justify-between text-xs text-white/50 dark:text-white/50 light:text-black/50 bg-white/5 dark:bg-white/5 light:bg-black/5 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                  <span>{filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found</span>
                    {selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null && (
                      <span className="text-xs text-pin-blue bg-pin-blue/10 px-2 py-1 rounded-full flex items-center gap-1">
                        <Navigation className="w-3 h-3" />
                        sorted by distance
                      </span>
                    )}
                  </div>
                </div>

                {/* Event List */}
                <div className="flex-1 overflow-y-auto">
                  <div className="space-y-2">
                    {filteredEvents.length > 0 ? filteredEvents.filter(event => 
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
                                <h3 className="font-semibold text-white text-sm truncate">
                                  {event.title || 'Untitled Event'}
                                </h3>
                              </div>
                              
                              <div className="space-y-1 text-xs text-white/70">
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
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="text-center py-8 text-white/50">
                        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No events found</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10">
              <Button
                className="w-full btn-primary font-display font-semibold text-base py-2.5 transition-all duration-200 hover:scale-[1.02] animate-bounce-in"
                onClick={() => {
                  if (!user) {
                    setLoginMode('login');
                    setShowLoginDialog(true);
                    return;
                  }
                  setEditingEvent(null); // Ensure this is always a create operation
                  setSelectedEvent(null); // Clear any selected event
                  setIsCreateFormOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                {user ? 'Create Event' : 'Sign in to Create'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className={`
  flex-1 h-[calc(100dvh-2.5rem)] sm:h-screen
  ${isSidebarCollapsed ? 'sm:pl-24' : 'sm:pl-96'}
  pt-10 sm:pt-0
  relative
`}>
        {activeView === 'map' ? (
          <div className="absolute inset-0 flex">
            {/* Map Container */}
            <div className="relative flex-1 transition-all duration-300">
              <MapContainer
                ref={mapRef}
                events={(() => {
                  // If we have route events, show only actual events from the route (not waypoints)
                  if (routeEvents && routeEvents.length > 0) {
                    const actualRouteEvents = routeEvents.filter(event => !event.isRouteWaypoint);
                    console.log('🗺️ Route mode - showing only route events:', {
                      totalRouteEvents: routeEvents.length,
                      actualEvents: actualRouteEvents.length,
                      waypoints: routeEvents.length - actualRouteEvents.length
                    });
                    return actualRouteEvents;
                  }
                  
                  // Normal mode - show regular events based on filters
                  const regularEvents = (
                  // Always show all events unless filters are active
                  selectedDate || 
                  selectedTime !== 'all' || 
                  !selectedCategory.includes('all') || 
                  mapCenter ||
                  miscFilters.feeFilter !== 'all'
                    ? filteredEvents
                    : events
                  ) || [];
                  
                  console.log('🗺️ Normal mode - showing regular events:', regularEvents.length);
                  return regularEvents;
                })()}
                onEventClick={handleEventClick}
                selectedCategory={selectedCategory}
                mapCenter={mapCenter}
                proximityRange={proximityRange}
                selectedEvent={selectedEvent}
                currentUser={user}
                onEventDelete={handleEventDelete}
                defaultCenter={DEFAULT_CENTER}
                defaultZoom={DEFAULT_ZOOM}
                selectedDate={selectedDate}
              />

              {/* Route Planning Overlay - Right Side */}
              {showRoutePlanner && (
                <div className="absolute top-4 right-4 z-30 max-w-md sm:max-w-sm">
                  <RoutePlanner
                    onRouteCalculated={handleRouteCalculated}
                    onEventsDiscovered={handleRouteEventsDiscovered}
                    mapInstance={mapRef.current}
                    apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                    onClose={handleCloseRoutePlanner}
                    theme={theme}
                  />
                </div>
              )}





              {/* Marker Style Toggle - Top Right Corner */}


              {/* Desktop Event Details Panel */}
              {selectedEvent && (
              <div className="hidden sm:block">
                <EventDetailsPanel
                  event={selectedEvent}
                  user={user}
                    onClose={handleCloseEventDetails}
                  onEdit={() => {
                    setEditingEvent(selectedEvent);
                    setIsCreateFormOpen(true);
                    setSelectedLocation({
                      lat: selectedEvent.lat,
                      lng: selectedEvent.lng,
                      address: selectedEvent.address
                    });
                  }}
                  onDelete={handleEventDelete}
                  onReport={() => setShowReportDialog(true)}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  shareCardRef={shareCardRef}
                  downloadStatus={downloadStatus}
                  handleDownload={handleDownload}
                  handleCopyLink={handleCopyLink}
                  handleFacebookShare={handleFacebookShare}
                    setExternalLinkDialog={setExternalLinkDialog}
                />
              </div>
              )}

              {/* Recommendations Panel - Desktop Only */}
              {!selectedEvent && (
                <div className="hidden sm:block">
                  <RecommendationsPanel
                    userLocation={selectedLocation}
                    onEventClick={handleEventClick}
                    onExploreMore={(city) => {
                      if (city && city.lat && city.lng) {
                        // City was selected, center map on the city
                        setMapCenter({ lat: city.lat, lng: city.lng });
                        setSelectedLocation({ lat: city.lat, lng: city.lng, city: city.city + ', ' + city.state });
                        setSearchValue(city.city + ', ' + city.state);
                      } else {
                        // No city selected, just reset view to show all events
                        setSelectedDate(null);
                        setSelectedTime('all');
                        setSelectedCategory(['all']);
                        setMapCenter(null);
                        setMiscFilters({ feeFilter: 'all' });
                      }
                    }}
                    onRouteCalculated={handleRouteCalculated}
                    onRouteEventsDiscovered={handleRouteEventsDiscovered}
                    mapInstance={mapRef.current}
                    routeEvents={routeEvents}
                    onClearRoute={handleCloseRoutePlanner}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto" style={{backgroundColor: 'var(--bg-main)'}}>
            {renderEventList(
              (() => {
                // If we have route events, show only actual events from the route (not waypoints)
                if (routeEvents && routeEvents.length > 0) {
                  return routeEvents.filter(event => !event.isRouteWaypoint);
                }
                
                // Normal mode - show regular events based on filters
                return (
              // Always show all events unless filters are active
              selectedDate || 
              selectedTime !== 'all' || 
              !selectedCategory.includes('all') || 
              effectiveMapCenter ||
              miscFilters.feeFilter !== 'all'
                ? filteredEvents
                    : events
                ) || [];
              })(),
              selectedEvent,
              handleEventClick,
              user,
              effectiveMapCenter
            )}
          </div>
        )}
      </div>


      {/* Mobile Event Details Bottom Sheet */}
      {selectedEvent && (
        <>
          {/* Backdrop overlay for mobile */}
          <div 
            className="fixed inset-0 bg-black/30 sm:hidden z-40"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Mobile backdrop clicked');
              handleCloseEventDetails();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Mobile backdrop touched');
              handleCloseEventDetails();
            }}
          />
          
        <div className={`
          fixed bottom-0 left-0 right-0 
          dialog-themed backdrop-blur-sm
          border-t border-themed
            rounded-t-lg z-50
          sm:hidden
          max-h-[80vh] overflow-y-auto shadow-2xl
          `}
          onClick={(e) => e.stopPropagation()}
          >
            <PanelSlideAnimation isOpen={selectedEvent} direction="up">
          {/* Drag handle for mobile */}
          <div 
            className="flex justify-center pt-2 pb-1 cursor-pointer"
            onClick={handleCloseEventDetails}
          >
            <div className="w-8 h-1 bg-white/20 rounded-full"></div>
          </div>
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
                  <span className="text-xs event-id-text font-mono mt-0.5">ID: {selectedEvent.id}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200 flex-shrink-0 touch-manipulation bg-black/20 backdrop-blur-sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Mobile close button clicked');
                  handleCloseEventDetails();
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Mobile close button touched');
                  handleCloseEventDetails();
                }}
                style={{ 
                  touchAction: 'manipulation',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Mobile Tabs */}
            <div className="flex gap-1 border-b border-white/10 -mx-3 px-3">
              <button
                className={`px-3 py-2 font-medium rounded-t-lg text-sm min-h-[36px] ${
                  activeTab === 'details' 
                    ? 'bg-themed-surface-hover text-themed-primary border-b-2 border-spark-yellow' 
                    : 'text-themed-secondary hover:bg-themed-surface hover:text-themed-primary'
                }`}
                onClick={() => setActiveTab('details')}
              >
                Details
              </button>
              <button
                className={`px-3 py-2 font-medium rounded-t-lg text-sm min-h-[36px] ${
                  activeTab === 'share' 
                    ? 'bg-themed-surface-hover text-themed-primary border-b-2 border-spark-yellow' 
                    : 'text-themed-secondary hover:bg-themed-surface hover:text-themed-primary'
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
                    <span className="font-data">
                      {formatEventDate(selectedEvent)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-white/70">
                    <div className="p-1.5 rounded-md bg-fresh-teal/10">
                      <Clock className="w-4 h-4 text-fresh-teal" />
                    </div>
                    <span className="font-data">
                      {formatEventTime(selectedEvent)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-white/70">
                    <div className="p-1.5 rounded-md bg-vibrant-magenta/10 flex-shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-vibrant-magenta" />
                    </div>
                    <span className="font-body break-words leading-relaxed">{selectedEvent.address || 'No address provided'}</span>
                  </div>
                  {selectedEvent.distance !== undefined && (
                    <div className="text-sm text-white/70 font-data ml-8">
                      \{selectedEvent.distance.toFixed(1)} miles away
                    </div>
                  )}
                  
                  {/* New UX enhancement fields - Mobile */}
                  {selectedEvent.host_name && (
                    <div className="flex items-center gap-3 text-sm text-white/70">
                      <div className="p-1.5 rounded-md bg-green-500/10 flex-shrink-0">
                        <Users className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-white/50">Hosted by</span>
                        <span className="font-body">{selectedEvent.host_name}</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedEvent.fee_required && (
                    <div className="flex items-center gap-3 text-sm text-white/70">
                      <div className="p-1.5 rounded-md bg-yellow-500/10 flex-shrink-0">
                        <DollarSign className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-white/50">Entry Requirements</span>
                        <span className="font-body">{selectedEvent.fee_required}</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedEvent.event_url && (
                    <div className="flex items-center gap-3 text-sm text-white/70">
                      <div className="p-1.5 rounded-md bg-blue-500/10 flex-shrink-0">
                        <ExternalLink className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className="text-xs text-white/50">More Information</span>
                        <button
                          onClick={() => setExternalLinkDialog({ isOpen: true, url: selectedEvent.event_url })}
                          className="font-body text-blue-400 hover:text-blue-300 underline text-left transition-colors"
                        >
                          Visit Event Website
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Event Interaction Components */}
                <EventInteractionComponents eventId={String(selectedEvent.id)} onReport={() => setShowReportDialog(true)} />
                
                {user && (user.id === selectedEvent.created_by || user.role === 'admin') && (
                  <div className="pt-3 space-y-2 border-t border-white/10">
                    <Button
                      variant="ghost"
                      className="w-full btn-secondary text-white font-medium transition-all duration-200 hover:scale-[1.02] min-h-[40px] text-sm"
                      onClick={() => {
                        setEditingEvent(selectedEvent);
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
                {downloadStatus && <div className="text-xs text-white/70 mt-1 text-center">{downloadStatus}</div>}
                <div className="text-xs text-white/40 mt-1 text-center">
                  <strong>Facebook:</strong> Image will auto-download, then upload it in Facebook.<br/>
                  <strong>Instagram:</strong> Download and upload the image to your story or feed!
                </div>
              </div>
            )}
          </div>
            </PanelSlideAnimation>
        </div>
        </>
      )}

      {/* Mobile Recommendations Bottom Sheet */}
      {isMobileRecommendationsOpen && (
        <>
          {/* Backdrop overlay for mobile */}
          <div 
            className="fixed inset-0 bg-black/30 sm:hidden z-40"
            onClick={() => setIsMobileRecommendationsOpen(false)}
          />
          
          <div className={`
            fixed bottom-0 left-0 right-0 
            dialog-themed backdrop-blur-sm
            border-t border-themed
            rounded-t-lg z-50
            sm:hidden
            h-[85vh] shadow-2xl
            flex flex-col
            `}>

            
            {/* Mobile Recommendations Panel */}
            <div className="flex-1 min-h-0">
              <RecommendationsPanel
                userLocation={selectedLocation}
                onEventClick={(event) => {
                  handleEventClick(event);
                  setIsMobileRecommendationsOpen(false);
                }}
                onExploreMore={(city) => {
                  if (city && city.lat && city.lng) {
                    setMapCenter({ lat: city.lat, lng: city.lng });
                    setSelectedLocation({ lat: city.lat, lng: city.lng, city: city.city + ', ' + city.state });
                    setSearchValue(city.city + ', ' + city.state);
                  } else {
                    setSelectedDate(null);
                    setSelectedTime('all');
                    setSelectedCategory(['all']);
                    setMapCenter(null);
                    setMiscFilters({ feeFilter: 'all' });
                  }
                  setIsMobileRecommendationsOpen(false);
                }}
                onRouteCalculated={handleRouteCalculated}
                onRouteEventsDiscovered={handleRouteEventsDiscovered}
                mapInstance={mapRef.current}
                embedded={true}
                routeEvents={routeEvents}
                onClearRoute={handleCloseRoutePlanner}
                onClose={() => setIsMobileRecommendationsOpen(false)}
              />
            </div>
        </div>
        </>
      )}

      {/* Create Event Form Dialog */}
      {isCreateFormOpen && (
        <CreateEventForm
          isOpen={isCreateFormOpen}
          onClose={() => {
            setIsCreateFormOpen(false);
            setSelectedLocation(null);
            setEditingEvent(null);
            setError(null); // Clear errors when form is closed
          }}
          onSubmit={handleCreateEvent}
          selectedLocation={selectedLocation}
          onLocationSelect={setSelectedLocation}
          initialEvent={editingEvent}
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
          className="dialog-themed backdrop-blur-sm p-6"
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
            }}
            onModeChange={(newMode) => setLoginMode(newMode)}
          />
        </DialogContent>
      </Dialog>

      {/* Welcome/Help Popup */}
      {showWelcomePopup && (
        <WelcomePopup 
          onClose={() => setShowWelcomePopup(false)}
          forceShow={true}
        />
      )}

      {/* First Time Sign In Popup */}
      <FirstTimeSignInPopup
        isOpen={showFirstTimeSignInPopup}
        onClose={() => setShowFirstTimeSignInPopup(false)}
        onCreateEvent={() => {
          setIsCreateFormOpen(true);
        }}
      />

      {/* External Link Warning Dialog */}
      <ExternalLinkWarning
        isOpen={externalLinkDialog.isOpen}
        onClose={() => setExternalLinkDialog({ isOpen: false, url: '' })}
        onConfirm={() => window.open(externalLinkDialog.url, '_blank', 'noopener,noreferrer')}
        url={externalLinkDialog.url}
      />

      {/* Email Contact Popup */}
      <EmailContactPopup
        isOpen={showEmailContactPopup}
        onClose={() => setShowEmailContactPopup(false)}
      />

      {/* Report Event Dialog */}
      <ReportDialog
        isOpen={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        event={selectedEvent}
        user={user}
      />

      {/* Premium Welcome Animation */}
      {showPremiumWelcome && premiumWelcomeData && (
        <PremiumWelcomeAnimation
          tier={premiumWelcomeData.tier}
          userName={premiumWelcomeData.userName}
          onComplete={() => {
            setShowPremiumWelcome(false);
            setPremiumWelcomeData(null);
          }}
        />
      )}
    </div>
  );
};

export default EventMap;