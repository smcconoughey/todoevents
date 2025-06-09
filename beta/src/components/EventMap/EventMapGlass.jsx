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
  AlertCircle,
  HelpCircle,
  Users,
  DollarSign,
  ExternalLink,
  Mail,
  Tag,
  Sparkles
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

import { API_URL } from '@/config';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import EventInteractionComponents from './EventInteractionComponents';
import ExternalLinkWarning from './ExternalLinkWarning';
import EmailContactPopup from './EmailContactPopup';
import { batchedSync } from '@/utils/batchedSync';

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

// Glass UI Navigation Component
const GlassNavigation = ({ user, onShowLogin, onLogout, onCreateEvent, isCreating, onShowWelcome }) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  return (
    <nav className="glass-nav flex items-center justify-between glass-animate-in">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold glass-text-primary">TodoEvents</h1>
          <span className="glass-badge glass-badge-primary text-xs">BETA GLASS</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <ThemeToggle />
        
        {user ? (
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="glass-button flex items-center gap-2 px-4 py-2"
            >
              <User className="w-4 h-4" />
              <span className="hidden md:inline glass-text-secondary">{user.email}</span>
            </button>
            
            {isUserMenuOpen && (
              <div className="absolute right-0 top-full mt-2 glass-dropdown min-w-48 z-50">
                <div 
                  onClick={onShowWelcome}
                  className="glass-dropdown-item flex items-center gap-2"
                >
                  <HelpCircle className="w-4 h-4" />
                  Show Guide
                </div>
                <button
                  onClick={onCreateEvent}
                  disabled={isCreating}
                  className="glass-dropdown-item flex items-center gap-2 w-full text-left"
                >
                  <Plus className="w-4 h-4" />
                  Create Event
                </button>
                <div className="glass-dropdown-item flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </div>
                <hr className="border-glass-border-subtle my-1" />
                <button
                  onClick={() => {
                    onLogout();
                    setIsUserMenuOpen(false);
                  }}
                  className="glass-dropdown-item flex items-center gap-2 w-full text-left text-red-400"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={onShowLogin} className="glass-button-primary">
            <User className="w-4 h-4" />
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
};

// Glass UI Category Filter
const GlassCategoryFilter = ({ selectedCategory, onCategorySelect }) => {
  return (
    <div className="glass-panel p-4 mb-4 glass-slide-in">
      <h3 className="glass-text-primary text-sm font-semibold mb-3 flex items-center gap-2">
        <Filter className="w-4 h-4" />
        Categories
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => onCategorySelect(category.id)}
            className={`glass-button text-left p-3 flex items-center gap-2 transition-all ${
              selectedCategory === category.id ? 'glass-border-glow' : ''
            }`}
          >
            <CategoryIcon category={category.id} className="w-4 h-4" />
            <span className="text-sm glass-text-secondary">{category.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// Glass UI Event Card
const GlassEventCard = ({ event, onEventClick, user, isSelected }) => {
  const formatEventDate = (event) => {
    if (!event.date) return 'Date TBD';
    try {
      const date = new Date(event.date);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      });
    } catch {
      return 'Date TBD';
    }
  };

  const formatEventTime = (event) => {
    if (!event.start_time) return '';
    try {
      const convertTo12Hour = (time24) => {
        const [hours, minutes] = time24.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
      };
      return convertTo12Hour(event.start_time);
    } catch {
      return '';
    }
  };

  return (
    <div 
      onClick={() => onEventClick(event)}
      className={`glass-card cursor-pointer transition-all hover:scale-[1.02] ${
        isSelected ? 'glass-border-glow' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <CategoryIcon category={event.category} className="w-5 h-5" />
          <span className="glass-badge glass-badge-primary text-xs">
            {getCategory(event.category)?.name || 'Event'}
          </span>
        </div>
        {event.fee_required && (
          <div className="glass-badge glass-badge-success">
            <DollarSign className="w-3 h-3" />
          </div>
        )}
      </div>
      
      <h3 className="glass-text-primary font-semibold mb-2 line-clamp-2">
        {event.title}
      </h3>
      
      <p className="glass-text-tertiary text-sm mb-3 line-clamp-3">
        {event.description}
      </p>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2 glass-text-secondary text-sm">
          <Calendar className="w-4 h-4" />
          {formatEventDate(event)}
          {formatEventTime(event) && (
            <>
              <Clock className="w-4 h-4 ml-2" />
              {formatEventTime(event)}
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2 glass-text-secondary text-sm">
          <MapPin className="w-4 h-4" />
          <span className="truncate">{event.address}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-glass-border-subtle">
        <div className="flex items-center gap-4 text-xs glass-text-tertiary">
          {event.interest_count > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {event.interest_count}
            </span>
          )}
          {event.view_count > 0 && (
            <span className="flex items-center gap-1">
              👁️ {event.view_count}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {event.event_url && (
            <ExternalLink className="w-4 h-4 glass-text-tertiary" />
          )}
          {event.host_name && (
            <Tag className="w-4 h-4 glass-text-tertiary" />
          )}
        </div>
      </div>
    </div>
  );
};

// Glass UI Sidebar
const GlassSidebar = ({ 
  isOpen, 
  onClose, 
  events, 
  selectedEvent, 
  onEventClick, 
  user, 
  selectedCategory, 
  onCategorySelect,
  searchQuery,
  onSearchChange,
  selectedDate,
  onDateSelect,
  onClearFilters
}) => {
  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 glass-overlay z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <div className={`glass-sidebar ${isOpen ? 'open' : ''} pt-20 p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="glass-text-primary text-lg font-bold">Events</h2>
          <button 
            onClick={onClose}
            className="glass-button p-2 lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 glass-text-tertiary" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="glass-input pl-10"
            />
          </div>
        </div>
        
        {/* Filters */}
        <div className="space-y-4 mb-6">
          <GlassCategoryFilter 
            selectedCategory={selectedCategory}
            onCategorySelect={onCategorySelect}
          />
          
          <div className="glass-panel-secondary p-4">
            <h3 className="glass-text-primary text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date Filter
            </h3>
            <CalendarFilter
              selectedDate={selectedDate}
              onDateSelect={onDateSelect}
              onClear={() => onDateSelect(null)}
            />
          </div>
          
          {(selectedCategory !== 'all' || selectedDate || searchQuery) && (
            <button
              onClick={onClearFilters}
              className="glass-button w-full justify-center text-red-400"
            >
              <X className="w-4 h-4" />
              Clear Filters
            </button>
          )}
        </div>
        
        {/* Events List */}
        <div className="space-y-4">
          <h3 className="glass-text-primary text-sm font-semibold">
            {events.length} Events Found
          </h3>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {events.map(event => (
              <GlassEventCard
                key={event.id}
                event={event}
                onEventClick={onEventClick}
                user={user}
                isSelected={selectedEvent?.id === event.id}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

// Main EventMap Component with Glass UI
const EventMapGlass = ({ 
  mapsLoaded = false, 
  eventSlug = false,
  presetCategory = false,
  presetFilters = {}
}) => {
  // State management
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDate, setSelectedDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  
  const { user, token, logout } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);

  // Fetch events on component mount
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetchWithTimeout(`${API_URL}/events`, {}, 10000);
        setEvents(response);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      }
    };

    fetchEvents();
    // Track homepage visit
    trackPageVisit('homepage', '/');
  }, []);

  // Filter events based on current filters
  const filteredEvents = events.filter(event => {
    const matchesCategory = selectedCategory === 'all' || event.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = !selectedDate || event.date === selectedDate.toISOString().split('T')[0];
    
    return matchesCategory && matchesSearch && matchesDate;
  });

  const handleClearFilters = () => {
    setSelectedCategory('all');
    setSelectedDate(null);
    setSearchQuery('');
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    // Track event detail view
    trackPageVisit('event_detail', `/events/${event.id}`);
  };

  const handleCreateEvent = async (newEvent, skipApiCall = false) => {
    if (!skipApiCall) {
      // Handle event creation if needed
    }
    setEvents(prev => [...prev, newEvent]);
    setShowCreateForm(false);
  };

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Glass Navigation */}
      <GlassNavigation
        user={user}
        onShowLogin={() => setShowLogin(true)}
        onLogout={logout}
        onCreateEvent={() => setShowCreateForm(true)}
        isCreating={showCreateForm}
        onShowWelcome={() => setShowWelcome(true)}
      />
      
      {/* Main Content */}
      <div className="flex h-full pt-16">
        {/* Glass Sidebar */}
        <GlassSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          events={filteredEvents}
          selectedEvent={selectedEvent}
          onEventClick={handleEventClick}
          user={user}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          onClearFilters={handleClearFilters}
        />
        
        {/* Map Area */}
        <div className="flex-1 relative">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden fixed bottom-6 left-6 z-30 glass-button-primary w-14 h-14 rounded-full flex items-center justify-center"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          {/* Create Event Button */}
          {user && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="fixed bottom-6 right-6 z-30 glass-button-primary w-14 h-14 rounded-full flex items-center justify-center"
            >
              <Plus className="w-6 h-6" />
            </button>
          )}
          
          {/* Map Container */}
          <div className="w-full h-full">
            <MapContainer
              events={filteredEvents}
              selectedEvent={selectedEvent}
              onEventClick={handleEventClick}
              mapsLoaded={mapsLoaded}
              theme={theme}
            />
          </div>
          
          {/* Selected Event Panel */}
          {selectedEvent && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 max-w-md w-full mx-4">
              <div className="glass-modal p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={selectedEvent.category} className="w-5 h-5" />
                    <span className="glass-badge glass-badge-primary">
                      {getCategory(selectedEvent.category)?.name}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="glass-button p-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <h3 className="glass-text-primary text-lg font-bold mb-2">
                  {selectedEvent.title}
                </h3>
                
                <p className="glass-text-secondary text-sm mb-4">
                  {selectedEvent.description}
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 glass-text-secondary">
                    <Calendar className="w-4 h-4" />
                    {selectedEvent.date}
                  </div>
                  <div className="flex items-center gap-2 glass-text-secondary">
                    <Clock className="w-4 h-4" />
                    {selectedEvent.start_time}
                  </div>
                  <div className="flex items-center gap-2 glass-text-secondary">
                    <MapPin className="w-4 h-4" />
                    {selectedEvent.address}
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button className="glass-button-primary flex-1">
                    View Details
                  </button>
                  <button className="glass-button">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Modals */}
      {showCreateForm && (
        <CreateEventForm
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onSubmit={handleCreateEvent}
        />
      )}
      
      {showLogin && (
        <LoginForm
          isOpen={showLogin}
          onClose={() => setShowLogin(false)}
        />
      )}
      
      {showWelcome && (
        <WelcomePopup
          onClose={() => setShowWelcome(false)}
          forceShow={true}
        />
      )}
    </div>
  );
};

export default EventMapGlass; 