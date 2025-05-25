import React, { useState, useEffect, useContext, useRef } from 'react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/radix-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose
} from "@/components/ui/sheet";
import ThemeToggle from '@/components/ui/ThemeToggle';
import CreateEventForm from './CreateEventForm';
import MapContainer from './MapContainer';
import categories, { getCategory } from './categoryConfig';
import AddressAutocomplete from './AddressAutocomplete';
import { AuthContext } from './AuthContext';
import LoginForm from './LoginForm';
import CalendarFilter from './CalendarFilter';

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


const EventDetailsPanel = ({ event, user, onClose, onEdit, onDelete }) => {
  if (!event) return null;

  const category = getCategory(event.category);
  const Icon = category.icon;

  return (
    <div className="absolute right-4 top-4 w-96 bg-neutral-900/95 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden z-20 shadow-2xl">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-spark-yellow/10 border border-spark-yellow/20">
              <Icon className={`w-6 h-6 ${category.color}`} />
            </div>
            <h2 className="text-xl font-display font-semibold text-white">{event.title}</h2>
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

  const mapRef = useRef(null);

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
      const response = await fetchWithTimeout(`${API_URL}/events`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
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
      const response = await fetchWithTimeout(`${API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newEvent)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
      const response = await fetchWithTimeout(`${API_URL}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await fetchEvents();
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      if (error.message && error.message.includes('401')) {
        setShowLoginDialog(true);
      }
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
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-white hover:bg-white/10 transition-colors duration-200"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-display font-bold text-white">todo-events</h1>
          <div className="flex items-center">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveView(activeView === 'map' ? 'list' : 'map')}
              className="text-white hover:bg-white/10 ml-1 transition-colors duration-200"
            >
              {activeView === 'map' ? <Filter className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                    onClick={logout}
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
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
  flex-1 h-[calc(100dvh-4rem)] sm:h-screen
  ${isSidebarCollapsed ? 'sm:pl-24' : 'sm:pl-88'}
  pt-16 sm:pt-4
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
          rounded-t-xl z-40
          sm:hidden
          transform transition-transform duration-300
          max-h-[80vh] overflow-y-auto shadow-2xl
          ${selectedEvent ? 'translate-y-0' : 'translate-y-full'}
        `}>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const category = getCategory(selectedEvent.category);
                  const Icon = category.icon;
                  return (
                    <div className="p-2 rounded-lg bg-spark-yellow/10 border border-spark-yellow/20">
                      <Icon className={`w-5 h-5 ${category.color}`} />
                    </div>
                  );
                })()}
                <h2 className="text-xl font-display font-semibold text-white">{selectedEvent.title}</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
                onClick={() => setSelectedEvent(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-white/90 font-body leading-relaxed">{selectedEvent.description}</p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-white/70">
                <div className="p-1.5 rounded-md bg-pin-blue/10">
                  <Calendar className="w-4 h-4 text-pin-blue" />
                </div>
                <span className="font-data">{selectedEvent.date}</span>
              </div>

              <div className="flex items-center gap-3 text-sm text-white/70">
                <div className="p-1.5 rounded-md bg-fresh-teal/10">
                  <Clock className="w-4 h-4 text-fresh-teal" />
                </div>
                <span className="font-data">{selectedEvent.time}</span>
              </div>

              <div className="flex items-center gap-3 text-sm text-white/70">
                <div className="p-1.5 rounded-md bg-vibrant-magenta/10">
                  <MapPin className="w-4 h-4 text-vibrant-magenta" />
                </div>
                <span className="font-body">{selectedEvent.address}</span>
              </div>

              {selectedEvent.distance !== undefined && (
                <div className="text-sm text-white/70 font-data">
                  📍 {selectedEvent.distance.toFixed(1)} miles away
                </div>
              )}
            </div>

            {user && (user.id === selectedEvent.created_by || user.role === 'admin') && (
              <div className="pt-4 space-y-3 border-t border-white/10">
                <Button
                  variant="ghost"
                  className="w-full btn-secondary text-white font-medium transition-all duration-200 hover:scale-[1.02]"
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
                  className="w-full bg-vibrant-magenta/20 hover:bg-vibrant-magenta/30 text-vibrant-magenta border border-vibrant-magenta/30 font-medium transition-all duration-200 hover:scale-[1.02]"
                  onClick={() => handleEventDelete(selectedEvent.id)}
                >
                  Delete Event
                </Button>
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

      {/* User Menu or Account Section */}
      {user && (
        <div className="user-menu">
          {/* Existing menu items */}
          
          {/* Add this new admin dashboard link if user is admin */}
          {user.role === 'admin' && (
            <a 
              href="/admin" 
              className="flex items-center gap-2 p-2 text-sm hover:bg-black/20 rounded-md"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Shield size={16} />
              Admin Dashboard
            </a>
          )}
          
          {/* Logout button or other options */}
        </div>
      )}
    </div>
  );
};

export default EventMap;