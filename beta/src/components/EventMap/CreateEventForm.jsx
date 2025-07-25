import React, { useState, useEffect, useContext } from 'react';
import { X, Plus, Clock, Calendar, AlertCircle, MapPin, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/radix-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import categories from './categoryConfig';
import { AuthContext } from './AuthContext';
import AddressAutocomplete from './AddressAutocomplete';
import { API_URL } from '@/config';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

const CreateEventForm = ({
  isOpen,
  onClose,
  onSubmit,
  selectedLocation,
  onLocationSelect,
  initialEvent = null
}) => {
  const { user, token } = useContext(AuthContext);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [isSameDay, setIsSameDay] = useState(true);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [premiumFeatures, setPremiumFeatures] = useState({});
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [loadingPremiumStatus, setLoadingPremiumStatus] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    start_time: '',
    end_time: '',
    end_date: '',
    category: 'community',
    secondary_category: '',
    address: '',
    location: null,
    recurring: false,
    frequency: '',
    is_premium_event: false,
    // New UX enhancement fields
    fee_required: '',
    event_url: '',
    host_name: ''
  });

  // Reset form when initialEvent changes
  useEffect(() => {
    if (isOpen) {
      if (initialEvent && typeof initialEvent === 'object') {
        setFormData({
          title: initialEvent.title || '',
          description: initialEvent.description || '',
          date: initialEvent.date || '',
          start_time: initialEvent.start_time || '',
          end_time: initialEvent.end_time || '',
          end_date: initialEvent.end_date || '',
          category: initialEvent.category || '',
          secondary_category: initialEvent.secondary_category || '',
          address: initialEvent.address || '',
          location: initialEvent.lat != null && initialEvent.lng != null ? {
            lat: initialEvent.lat,
            lng: initialEvent.lng,
            address: initialEvent.address
          } : null,
          // New UX enhancement fields
          fee_required: initialEvent.fee_required || '',
          event_url: initialEvent.event_url || '',
          host_name: initialEvent.host_name || '',
          recurring: initialEvent.recurring || false,
          frequency: initialEvent.frequency || '',
          is_premium_event: initialEvent.is_premium_event || false
        });
        setError(null);
        setConnectionError(false);
        setIsSameDay(!initialEvent.end_date || initialEvent.end_date === initialEvent.date);
      } else {
        // Reset to default values when no initialEvent or initialEvent is null
        setFormData({
          title: '',
          description: '',
          date: '',
          start_time: '',
          end_time: '',
          end_date: '',
          category: '',
          secondary_category: '',
          address: '',
          location: null,
          // New UX enhancement fields
          fee_required: '',
          event_url: '',
          host_name: '',
          recurring: false,
          frequency: '',
          is_premium_event: false
        });
        setError(null);
        setConnectionError(false);
        setIsSameDay(true);
      }
    }
  }, [isOpen, initialEvent]);

  // Check premium status when user changes
  useEffect(() => {
    const checkPremiumStatus = async () => {
      if (!user || !token) {
        setIsPremiumUser(false);
        setPremiumFeatures({});
        setPremiumStatus(null);
        setLoadingPremiumStatus(false);
        return;
      }

      try {
        setLoadingPremiumStatus(true);
        const response = await fetchWithTimeout(`${API_URL}/users/premium-status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }, 10000);

        setIsPremiumUser(response.is_premium || response.is_enterprise);
        setPremiumFeatures(response.features || {});
        
        // Use backend values directly, only add fallbacks for missing fields
        const enhancedData = {
          ...response,
          // Only add fallbacks if the backend didn't provide values
          event_limit: response.event_limit !== undefined ? response.event_limit : (response.is_premium ? 10 : 0),
          current_month_events: response.current_month_events !== undefined ? response.current_month_events : 0,
          events_remaining: response.events_remaining !== undefined ? response.events_remaining : null,
          can_create_events: response.can_create_events !== undefined ? response.can_create_events : true,
          features: response.features || {
            verified_events: response.is_premium || response.is_enterprise,
            analytics: response.is_premium || response.is_enterprise,
            recurring_events: response.is_premium || response.is_enterprise,
            priority_support: response.is_premium || response.is_enterprise,
            enhanced_visibility: response.is_premium || response.is_enterprise
          }
        };
        
        setPremiumStatus(enhancedData);
      } catch (error) {
        console.error('Error checking premium status:', error);
        setIsPremiumUser(false);
        setPremiumFeatures({});
        setPremiumStatus(null);
      } finally {
        setLoadingPremiumStatus(false);
      }
    };

    if (isOpen) {
      checkPremiumStatus();
    }
  }, [user, token, isOpen]);

  // Update location when selected
  useEffect(() => {
    if (selectedLocation) {
      setFormData(prev => ({
        ...prev,
        location: selectedLocation,
        address: selectedLocation.address || prev.address
      }));
      setError(null);
    }
  }, [selectedLocation]);

  // Health check with reduced frequency
  useEffect(() => {
    const checkConnection = async () => {
      if (!isOpen) return;

      try {
        const response = await fetch(`${API_URL}/health`);
        if (!response.ok) throw new Error('Server health check failed');
        setConnectionError(false);
      } catch (err) {
        setConnectionError(true);
        console.error('Server connection error:', err);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 60000); // Reduced to once per minute
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleAddressSelect = (data) => {
    console.log('Address selected:', data);
    
    // Handle the updated data structure from AddressAutocomplete
    const location = data.location ? data.location : { lat: data.lat, lng: data.lng };
    
    setFormData(prev => ({
      ...prev,
      address: data.address,
      location: location
    }));
    
    // Also call the parent callback if provided
    onLocationSelect?.(location);
  };

  const handleClearLocation = () => {
    setFormData(prev => ({
      ...prev,
      location: null,
      address: ''
    }));
    onLocationSelect?.(null);
  };

  const handleSameDayChange = (checked) => {
    setIsSameDay(checked);
    if (checked) {
      // When switching to same day, clear end_date and copy start date
      setFormData(prev => ({
        ...prev,
        end_date: ''
      }));
    }
  };

  // Function to calculate end time automatically (2 hours after start time)
  const calculateEndTime = (startTime) => {
    if (!startTime) return '';
    
    try {
      const [hours, minutes] = startTime.split(':').map(Number);
      const endHours = (hours + 2) % 24; // Handle day rollover
      return `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } catch (error) {
      console.error('Error calculating end time:', error);
      return '';
    }
  };

  const handleStartTimeChange = (newStartTime) => {
    setFormData(prev => {
      const newEndTime = calculateEndTime(newStartTime);
      return {
        ...prev,
        start_time: newStartTime,
        // Only auto-set end time if it's currently empty or if we're updating from an empty start time
        end_time: !prev.end_time || !prev.start_time ? newEndTime : prev.end_time
      };
    });
  };

  // Function to validate if address has street-level detail
  const isStreetLevelAddress = (address) => {
    if (!address || typeof address !== 'string') return false;
    
    const trimmedAddress = address.trim().toLowerCase();
    
    // Check for common street indicators (numbers followed by street names)
    const streetPatterns = [
      /^\d+\s+.*(street|st|avenue|ave|boulevard|blvd|road|rd|drive|dr|lane|ln|way|court|ct|circle|cir|place|pl|parkway|pkwy|terrace|ter)/i,
      /^\d+\s+\w+.*\w+/i, // At least number + 2 words (like "123 Main Street")
    ];
    
    // Check for any of the street patterns
    const hasStreetPattern = streetPatterns.some(pattern => pattern.test(trimmedAddress));
    
    // Check that it's not just a city/state (common patterns to avoid)
    const cityOnlyPatterns = [
      /^[a-z\s]+,\s*[a-z]{2}$/i, // "City, ST" format
      /^[a-z\s]+,\s*[a-z\s]+,\s*usa?$/i, // "City, State, US" format
      /^[a-z\s]+\s+county/i, // County names
      /^[a-z\s]+,\s*united states$/i, // "City, United States"
    ];
    
    const isCityOnly = cityOnlyPatterns.some(pattern => pattern.test(trimmedAddress));
    
    // Must have street patterns and not be city-only
    return hasStreetPattern && !isCityOnly;
  };

  const validateForm = () => {
    const now = new Date();
    const selectedDate = new Date(formData.date + 'T' + formData.start_time);

    if (!formData.title.trim()) {
      setError('Please enter an event title');
      return false;
    }
    if (!formData.description.trim()) {
      setError('Please enter an event description');
      return false;
    }
    if (!formData.date) {
      setError('Please select an event date');
      return false;
    }
    if (!formData.start_time) {
      setError('Please select an event start time');
      return false;
    }
    if (!formData.end_time) {
      setError('Please select an event end time');
      return false;
    }
    // Validate end_time is after start_time (if same day)
    if (isSameDay && formData.start_time && formData.end_time) {
      const startTime = new Date(`2000-01-01T${formData.start_time}`);
      const endTime = new Date(`2000-01-01T${formData.end_time}`);
      if (endTime <= startTime) {
        setError('End time must be after start time');
        return false;
      }
    }
    if (selectedDate < now) {
      setError('Event cannot be scheduled in the past');
      return false;
    }
    if (!formData.category) {
      setError('Please select a category');
      return false;
    }
    if (!formData.location) {
      setError('Please select a location for the event');
      return false;
    }
    // Validate address has street-level detail
    if (!isStreetLevelAddress(formData.address)) {
      setError('Please provide a specific street address (e.g., "123 Main Street, City, State") rather than just a city name. This helps attendees find the exact location.');
      return false;
    }
    if (formData.end_date && new Date(formData.end_date) <= selectedDate) {
      setError('End date must be after the event start date');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Prevent double submission with multiple checks
    if (isSubmitting) {
      console.log('Form already submitting, ignoring duplicate submission');
      return;
    }

    if (!user) {
      setError('You must be logged in to create events');
      return;
    }

    if (!validateForm()) {
      return;
    }

    // Set submitting state immediately to prevent double clicks
    setIsSubmitting(true);

    try {
      if (connectionError) {
        throw new Error('Unable to connect to server. Please try again later.');
      }

      const eventData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        end_date: isSameDay ? null : (formData.end_date || null),
        category: formData.category,
        address: formData.address.trim(),
        lat: formData.location.lat,
        lng: formData.location.lng,
        recurring: formData.recurring,
        frequency: formData.frequency,
        is_premium_event: formData.is_premium_event,
        // New UX enhancement fields
        fee_required: formData.fee_required.trim() || null,
        event_url: formData.event_url.trim() || null,
        host_name: formData.host_name.trim() || null
      };

      const url = initialEvent
        ? `${API_URL}/events/${initialEvent.id}`
        : `${API_URL}/events`;
      const method = initialEvent ? 'PUT' : 'POST';

      console.log('Submitting event data:', eventData);
      console.log('Request URL:', url);
      console.log('Request method:', method);
      console.log('Form data before submission:', formData);
      console.log('UX Enhancement fields:', {
        fee_required: formData.fee_required,
        event_url: formData.event_url,
        host_name: formData.host_name
      });

      // Use our fetchWithTimeout utility with improved error handling
      const savedEvent = await fetchWithTimeout(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(eventData)
      }, 20000); // 20 second timeout for event creation

      console.log('Event saved successfully:', savedEvent);

      // Pass the saved event back to parent for any additional processing
      // BUT DON'T make another API call - this was causing the duplication
      if (onSubmit) {
        onSubmit(savedEvent, true); // true = skip API call, form already made it
      }
      
      // Close the form only after successful submission
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      
      // Check for specific duplicate error
      if (error.message && error.message.includes('409')) {
        setError('This event already exists. Please check for duplicates or modify the details.');
      } else if (error.message && error.message.includes('already exists')) {
        setError('An event with these details already exists at this location and time.');
      } else {
        setError(error.message || 'Failed to save event. Please try again.');
      }
    } finally {
      // Always reset submitting state
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="dialog-themed max-w-[95vw] sm:max-w-[90vw] lg:max-w-[1200px] w-full max-h-[95vh] overflow-y-auto bg-gradient-to-br from-themed-surface via-themed-surface to-themed-surface-hover border-2 border-themed shadow-2xl"
        aria-describedby="create-event-dialog-description"
      >
        <DialogHeader className="relative pb-6 border-b border-themed/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-spark-yellow to-pin-blue rounded-full flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-display font-bold dialog-title-themed">
                {initialEvent ? 'Edit Event' : 'Create New Event'}
              </DialogTitle>
              <DialogDescription id="create-event-dialog-description" className="dialog-description-themed text-sm mt-1">
                {initialEvent ? 'Edit an existing event with details' : 'Create a new event with details'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8 px-1 py-2">
          {(error || connectionError) && (
            <div className="p-4 bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/50 rounded-xl text-red-200 flex items-start gap-3 shadow-lg">
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Error</h4>
                <span className="text-sm">{connectionError ? 'Unable to connect to server. Please try again later.' : error}</span>
              </div>
            </div>
          )}

          {/* Event Info Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-themed/30">
              <div className="w-8 h-8 bg-gradient-to-br from-pin-blue/20 to-pin-blue/10 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-pin-blue" />
              </div>
              <h3 className="text-lg font-semibold text-themed-primary">Event Information</h3>
            </div>

            {/* Event Info - Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* First Column - Title */}
              <div className="sm:col-span-2 lg:col-span-1 space-y-2">
                <label className="text-sm font-medium text-themed-secondary">Event Title</label>
                <Input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter event title"
                  className="input-themed h-10"
                />
              </div>

              {/* Second Column - Primary Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-themed-secondary">Primary Category</label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger className="input-themed h-10">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(cat => cat.id !== 'all').map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          {React.createElement(category.icon, {
                            className: `w-4 h-4 ${category.color}`
                          })}
                          <span>{category.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Third Column - Secondary Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-themed-secondary">Secondary Category</label>
                <div className="relative">
                  <Select 
                    value={formData.secondary_category || "none"} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, secondary_category: value === "none" ? "" : value }))}
                  >
                    <SelectTrigger className="input-themed h-10">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-themed-muted">None</span>
                      </SelectItem>
                      {categories.filter(cat => cat.id !== 'all' && cat.id !== formData.category).map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center gap-2">
                            {React.createElement(category.icon, {
                              className: `w-4 h-4 ${category.color}`
                            })}
                            <span>{category.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="absolute -top-1 right-2 text-xs text-themed-muted bg-themed-surface px-1 rounded">
                    Optional
                  </span>
                </div>
              </div>
            </div>

            {/* Description - Full width row */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-themed-secondary">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter event description"
                className="w-full px-3 py-2 rounded-md input-themed resize-none"
                rows="3"
              />
            </div>
          </div>

          {/* Schedule - Responsive grid: 1-2 cols mobile, 4 cols desktop */}
          <div className="space-y-3">
            <h3 className="text-base font-medium text-themed-primary border-b border-themed pb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Schedule
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-themed-secondary">Start Date</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="input-themed h-10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-themed-secondary">Start Time</label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="input-themed h-10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-themed-secondary">End Date</label>
                <div className="relative">
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    min={formData.date}
                    disabled={isSameDay}
                    className="input-themed h-10 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {isSameDay && (
                    <span className="absolute -top-1 right-2 text-xs text-themed-muted bg-themed-surface px-1 rounded">
                      Auto
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-themed-secondary">End Time</label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  className="input-themed h-10"
                  required
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="sameDay"
                checked={isSameDay}
                onChange={(e) => handleSameDayChange(e.target.checked)}
                className="w-4 h-4 rounded border-themed bg-themed-surface text-spark-yellow focus:ring-spark-yellow/50"
              />
              <label htmlFor="sameDay" className="text-sm font-medium text-themed-secondary">
                Single day event (end date same as start date)
              </label>
            </div>
          </div>

          {/* Additional Details - Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop */}
          <div className="space-y-3">
            <h3 className="text-base font-medium text-themed-primary border-b border-themed pb-2 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Additional Details
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-themed-secondary">Host/Organization</label>
                <div className="relative">
                  <Input
                    type="text"
                    value={formData.host_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, host_name: e.target.value }))}
                    placeholder="e.g., Local Restaurant"
                    className="input-themed h-10"
                  />
                  <span className="absolute -top-1 right-2 text-xs text-themed-muted bg-themed-surface px-1 rounded">
                    Optional
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-themed-secondary">Ticket Price/Entry Fee</label>
                <div className="relative">
                  <Input
                    type="text"
                    value={formData.fee_required}
                    onChange={(e) => setFormData(prev => ({ ...prev, fee_required: e.target.value }))}
                    placeholder="e.g., $10, $25, $5-$15"
                    className="input-themed h-10"
                  />
                  <span className="absolute -top-1 right-2 text-xs text-themed-muted bg-themed-surface px-1 rounded">
                    Optional
                  </span>
                </div>
                <p className="text-xs text-themed-muted">Leave empty for free events. Only enter price if tickets are required.</p>
              </div>

              <div className="sm:col-span-2 lg:col-span-1 space-y-2">
                <label className="text-sm font-medium text-themed-secondary">Event Website</label>
                <div className="relative">
                  <Input
                    type="url"
                    value={formData.event_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, event_url: e.target.value }))}
                    placeholder="https://example.com"
                    className="input-themed h-10"
                  />
                  <span className="absolute -top-1 right-2 text-xs text-themed-muted bg-themed-surface px-1 rounded">
                    Optional
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Location - Single column section */}
          <div className="space-y-3">
            <h3 className="text-base font-medium text-themed-primary border-b border-themed pb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Location
            </h3>
            
            <div className="space-y-3">
              <div className="relative">
                <AddressAutocomplete
                  value={formData.address}
                  onChange={(value) => setFormData(prev => ({ ...prev, address: value }))}
                  onSelect={handleAddressSelect}
                />
                {formData.address && (
                  <div className="mt-2 flex items-center gap-2">
                    {isStreetLevelAddress(formData.address) ? (
                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs">Street address detected</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        <span className="text-xs">Please add street number and name</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {formData.location && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-md bg-themed-surface border border-themed">
                    <span className="text-sm text-themed-secondary truncate">
                      {formData.address || `${formData.location.lat.toFixed(6)}, ${formData.location.lng.toFixed(6)}`}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover"
                    onClick={handleClearLocation}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-themed">
            <button 
              type="submit" 
              className={`w-full px-6 py-3 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-2
                ${isSubmitting || !formData.location || connectionError || !user
                  ? 'bg-themed-surface text-themed-muted cursor-not-allowed'
                  : 'btn-yellow-themed hover:scale-[1.02]'
                }`}
              disabled={isSubmitting || !formData.location || connectionError || !user}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                  {initialEvent ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {initialEvent ? 'Update Event' : 'Create Event'}
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateEventForm;