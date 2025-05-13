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
  Search
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
import CreateEventForm from './CreateEventForm';
import MapContainer from './MapContainer';
import categories, { getCategory } from './categoryConfig';
import AddressAutocomplete from './AddressAutocomplete';
import { AuthContext } from './AuthContext';
import LoginForm from './LoginForm';
import CalendarFilter from './CalendarFilter';

import { API_URL } from '@/config';


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
    <div className="absolute right-4 top-4 w-96 bg-neutral-900/95 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden z-20">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className={`w-6 h-6 ${category.color}`} />
            <h2 className="text-lg font-semibold text-white">{event.title}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-white/90">{event.description}</p>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Calendar className="w-4 h-4" />
            <span>{event.date}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-white/70">
            <Clock className="w-4 h-4" />
            <span>{event.time}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-white/70">
            <MapPin className="w-4 h-4" />
            <span>{event.address}</span>
          </div>

          {event.distance !== undefined && (
            <div className="text-sm text-white/70">
              {event.distance.toFixed(1)} miles away
            </div>
          )}
        </div>

        {user && (user.id === event.created_by || user.role === 'admin') && (
          <div className="pt-4 space-y-2 border-t border-white/10">
            <Button
              variant="ghost"
              className="w-full bg-white/5 hover:bg-white/10 text-white"
              onClick={onEdit}
            >
              Edit Event
            </Button>
            <Button
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500"
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
  <div className="flex-1 overflow-y-auto p-4 space-y-2">
    {events.map(event => (
      <div
        key={event.id}
        className={`
          w-full p-4 rounded-lg transition-colors cursor-pointer
          ${selectedEvent?.id === event.id
            ? 'bg-white/20 border-white/30'
            : 'bg-white/5 hover:bg-white/10 border-white/10'
          }
          border
        `}
        onClick={() => handleEventClick(event)}
      >
        <div className="flex items-center gap-3">
          {(() => {
            const category = getCategory(event.category);
            const Icon = category.icon;
            return <Icon className={`w-5 h-5 ${category.color}`} />;
          })()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-medium truncate">{event.title}</h3>
              {user && event.created_by === user.id && (
                <span className="text-xs text-white/50">(Your event)</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-white/60">
              <Calendar className="w-4 h-4" />
              <span>{event.date}</span>
              {event.distance !== undefined && (
                <>
                  <span className="text-white/30">•</span>
                  <span>{event.distance.toFixed(1)} mi</span>
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
  const [mapCenter, setMapCenter] = useState(null);
  const [showDesktopList, setShowDesktopList] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState(mapsLoaded ? 'map' : 'list');
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [loginMode, setLoginMode] = useState('login');
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState({ from: null, to: null });
  const mapRef = useRef(null);

  const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
  const DEFAULT_ZOOM = 4;

  const handleResetView = () => {
    setSearchValue('');
    setSelectedCategory('all');
    setMapCenter(null);
    setFilteredEvents([]);
    setProximityRange(15);
    setSelectedLocation(null);
    setSelectedEvent(null);
    setSelectedDate({ from: null, to: null }); // Updated this line

    if (mapRef.current) {
      mapRef.current.resetView();
    }

    if (window.innerWidth < 1536) {
      setActiveView('map');
    }

    fetchEvents();
  };

  const toggleDesktopList = () => {
    setShowDesktopList(!showDesktopList);
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setSelectedLocation(null);
    setIsMobileMenuOpen(false);
  };

  const fetchEvents = async () => {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/events`, { headers });
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 300000);
    return () => clearInterval(interval);
  }, [token]);

  // Replace the existing useEffect for filtering with this one
  useEffect(() => {
    let filtered = [...events];

    // Apply filters one by one
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(event => event.category === selectedCategory);
    }

    // Date range filter
    filtered = filtered.filter(event => isDateInRange(event.date, selectedDate));

    // Location filter
    if (mapCenter) {
      filtered = filtered.filter(event => {
        if (!event.lat || !event.lng) return false;
        const distance = calculateDistance(mapCenter.lat, mapCenter.lng, event.lat, event.lng);
        return distance <= proximityRange;
      });

      filtered = filtered.map(event => ({
        ...event,
        distance: calculateDistance(mapCenter.lat, mapCenter.lng, event.lat, event.lng)
      }));

      filtered.sort((a, b) => a.distance - b.distance);
    }

    setFilteredEvents(filtered);
  }, [events, mapCenter, proximityRange, selectedCategory, selectedDate]);

  const handleEventClick = (event) => {
    if (!event) return;
    setSelectedEvent(event);
    if (event.lat && event.lng) {
      setMapCenter({ lat: event.lat, lng: event.lng });
    }
    if (window.innerWidth < 1536) {
      setActiveView('map');
      setIsMobileMenuOpen(false);
    }
  };

  const handleAddressSelect = (data) => {
    if (!data || !data.location) return;
    setMapCenter(data.location);
    setSearchValue(data.address);
    setIsMobileMenuOpen(false);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleCreateEvent = async (newEvent) => {
    if (!user) {
      setShowLoginDialog(true);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newEvent),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setShowLoginDialog(true);
          return;
        }
        throw new Error('Failed to create event');
      }

      await fetchEvents();
      setIsCreateFormOpen(false);
      setSelectedLocation(null);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const handleEventDelete = async (eventId) => {
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          setShowLoginDialog(true);
          return;
        }
        throw new Error('Failed to delete event');
      }

      await fetchEvents();
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error deleting event:', error);
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
            className="text-white hover:bg-white/10"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="text-lg font-bold text-white">Events</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveView(activeView === 'map' ? 'list' : 'map')}
            className="text-white hover:bg-white/10"
          >
            {activeView === 'map' ? <Filter className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className={`
        hidden sm:flex fixed left-4 top-4 bottom-4 z-20
        flex-col bg-neutral-900/95 backdrop-blur-sm rounded-lg
        border border-white/10 transition-all duration-300
        ${isSidebarCollapsed ? 'w-16' : 'w-80'}
      `}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center justify-between flex-1 mr-2">
              <h2 className="text-xl font-bold text-white">Events</h2>
              {user ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  onClick={logout}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => {
                    setLoginMode('login');
                    setShowLoginDialog(true);
                  }}
                >
                  <User className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0"
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
                <AddressAutocomplete
                  value={searchValue}
                  onChange={setSearchValue}
                  onSelect={handleAddressSelect}
                  className="w-full"
                />
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Date Filter</label>
                  <CalendarFilter
                    selectedDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    onClear={() => setSelectedDate({ from: null, to: null })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-white/70">Search Radius</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-white/50 hover:text-white"
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
                            flex flex-col items-center p-2 h-auto
                            ${proximityRange === option.value
                            ? 'bg-white/20 text-white border-white/30'
                            : 'bg-white/5 text-white/70 border-white/10'
                          }
                          `}
                      >
                        <span className="text-base font-medium">{option.label}</span>
                        <span className="text-xs opacity-70">{option.description}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
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
                            w-full flex items-center justify-between px-3 py-2 rounded-lg 
                            ${selectedCategory === category.id
                            ? 'bg-white/10'
                            : 'hover:bg-white/5'
                          }
                          `}
                      >
                        <div className="flex items-center">
                          <Icon className={`w-5 h-5 mr-3 ${category.color}`} />
                          <span className="text-white text-sm">{category.name}</span>
                        </div>
                        <span className={`
                            text-xs px-2 py-0.5 rounded-full
                            ${selectedCategory === category.id
                            ? 'bg-white/20 text-white'
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
                className="w-full bg-white/10 hover:bg-white/15 text-white"
                onClick={() => {
                  if (!user) {
                    setLoginMode('login');
                    setShowLoginDialog(true);
                    return;
                  }
                  setIsCreateFormOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                {user ? 'New Event' : 'Sign in to Create Event'}
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
                <SheetTitle className="text-white">Events</SheetTitle>
                <div className="flex items-center gap-2">
                  {user ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/70 hover:text-white hover:bg-white/10"
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
                      className="text-white/70 hover:text-white hover:bg-white/10"
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
                    className="text-white/70 hover:text-white hover:bg-white/10"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                <AddressAutocomplete
                  value={searchValue}
                  onChange={setSearchValue}
                  onSelect={handleAddressSelect}
                  className="w-full"
                />
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Date Filter</label>
                  <CalendarFilter
                    selectedDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    onClear={() => setSelectedDate(null)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-white/70">Search Radius</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-white/50 hover:text-white"
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
                            flex flex-col items-center p-2 h-auto
                            ${proximityRange === option.value
                            ? 'bg-white/20 text-white border-white/30'
                            : 'bg-white/5 text-white/70 border-white/10'
                          }
                          `}
                      >
                        <span className="text-base font-medium">{option.label}</span>
                        <span className="text-xs opacity-70">{option.description}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
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
                            w-full flex items-center justify-between px-3 py-2 rounded-lg 
                            ${selectedCategory === category.id
                            ? 'bg-white/10'
                            : 'hover:bg-white/5'
                          }
                          `}
                      >
                        <div className="flex items-center">
                          <Icon className={`w-5 h-5 mr-3 ${category.color}`} />
                          <span className="text-white text-sm">{category.name}</span>
                        </div>
                        <span className={`
                            text-xs px-2 py-0.5 rounded-full
                            ${selectedCategory === category.id
                            ? 'bg-white/20 text-white'
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
                className="w-full bg-white/10 hover:bg-white/15 text-white"
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
                <Plus className="w-4 h-4 mr-2" />
                {user ? 'New Event' : 'Sign in to Create Event'}
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
            text-white/70 hover:text-white
            bg-neutral-900/95 backdrop-blur-sm
            border border-white/10 rounded-lg
            transition-transform duration-300
            ${showDesktopList ? 'rotate-180' : ''}
          `}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className={`
          h-full w-full
          bg-neutral-900/95 backdrop-blur-sm
          border border-white/10 rounded-lg 
          overflow-hidden
          transition-all duration-300
          ${showDesktopList ? 'opacity-100' : 'opacity-0'}
        `}>
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white">
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
          max-h-[80vh] overflow-y-auto
          ${selectedEvent ? 'translate-y-0' : 'translate-y-full'}
        `}>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{selectedEvent.title}</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                onClick={() => setSelectedEvent(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-white/70">
              <MapPin className="w-4 h-4" />
              <span>{selectedEvent.address}</span>
            </div>

            {selectedEvent.distance !== undefined && (
              <div className="text-sm text-white/70">
                {selectedEvent.distance.toFixed(1)} miles away
              </div>
            )}

            {user && (user.id === selectedEvent.created_by || user.role === 'admin') && (
              <div className="pt-4 space-y-2">
                <Button
                  variant="ghost"
                  className="w-full bg-white/5 hover:bg-white/10 text-white"
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
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500"
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
    </div>
  );
};

export default EventMap;