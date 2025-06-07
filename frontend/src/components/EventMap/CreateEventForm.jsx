import React, { useState, useEffect, useContext } from 'react';
import { X, Plus, Clock, Calendar, AlertCircle, MapPin } from 'lucide-react';
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
          host_name: initialEvent.host_name || ''
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
          host_name: ''
        });
        setError(null);
        setConnectionError(false);
        setIsSameDay(true);
      }
    }
  }, [isOpen, initialEvent]);

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
      setFormData(prev => ({
        ...prev,
        end_date: ''
      }));
    }
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
        recurring: false,
        frequency: null,
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
        className="dialog-themed max-w-6xl max-h-[95vh] overflow-y-auto w-[98vw] md:w-full"
        aria-describedby="create-event-dialog-description"
      >
        <DialogHeader className="relative pb-6">
          <DialogTitle className="text-2xl font-display font-bold dialog-title-themed">
            {initialEvent ? 'Edit Event' : 'Create New Event'}
          </DialogTitle>
          <DialogDescription id="create-event-dialog-description" className="dialog-description-themed text-base">
            {initialEvent ? 'Edit an existing event with details' : 'Create a new event with details'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8 px-8 pb-8">
          {(error || connectionError) && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-md text-red-200 text-base flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>{connectionError ? 'Unable to connect to server. Please try again later.' : error}</span>
            </div>
          )}

          {/* Event Info - More generous spacing with responsive grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* First Column - Title & Category */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-base font-medium text-themed-secondary">Event Title</label>
                <Input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter event title"
                  className="input-themed h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <label className="text-base font-medium text-themed-secondary">Primary Category</label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger className="input-themed h-12 text-base">
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
            </div>

            {/* Second Column - Secondary Category */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-base font-medium text-themed-secondary">
                  Secondary Category 
                  <span className="text-sm text-themed-muted ml-2">(Optional)</span>
                </label>
                <Select 
                  value={formData.secondary_category || "none"} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, secondary_category: value === "none" ? "" : value }))}
                >
                  <SelectTrigger className="input-themed h-12 text-base">
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
                <p className="text-sm text-themed-muted leading-relaxed">
                  Add a second category to better describe your event
                </p>
              </div>
            </div>

            {/* Third Column - Description */}
            <div className="space-y-2">
              <label className="text-base font-medium text-themed-secondary">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter event description"
                className="w-full px-4 py-3 rounded-md input-themed resize-none text-base leading-relaxed"
                rows="8"
              />
            </div>
          </div>

          {/* Schedule - More generous spacing */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-themed-primary border-b border-themed pb-2 flex items-center gap-3">
              <Calendar className="w-5 h-5" />
              Schedule
            </h3>
            
            {/* Date & Time Grid - 4 columns on large screens, 2 on mobile */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-base font-medium text-themed-secondary">Start Date</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="input-themed h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <label className="text-base font-medium text-themed-secondary">Start Time</label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  className="input-themed h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <label className="text-base font-medium text-themed-secondary">
                  End Date {isSameDay && <span className="text-themed-muted">(disabled)</span>}
                </label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  min={formData.date}
                  disabled={isSameDay}
                  className="input-themed h-12 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-base font-medium text-themed-secondary">
                  End Time
                </label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  className="input-themed h-12 text-base"
                  required
                />
              </div>
            </div>

            {/* Same Day Checkbox */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="sameDay"
                checked={isSameDay}
                onChange={(e) => handleSameDayChange(e.target.checked)}
                className="w-4 h-4 rounded border-themed bg-themed-surface text-spark-yellow focus:ring-spark-yellow/50"
              />
              <label htmlFor="sameDay" className="text-base font-medium text-themed-secondary">
                Single day event
              </label>
            </div>
          </div>

          {/* Additional Event Details - UX Enhancement - More generous spacing */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-themed-primary border-b border-themed pb-2 flex items-center gap-3">
              <Plus className="w-5 h-5" />
              Additional Details <span className="text-base text-themed-muted">(Optional)</span>
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Host Name */}
              <div className="space-y-2">
                <label className="text-base font-medium text-themed-secondary">
                  Host/Organization Name
                </label>
                <Input
                  type="text"
                  value={formData.host_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, host_name: e.target.value }))}
                  placeholder="e.g., Local Restaurant, Community Center"
                  className="input-themed h-12 text-base"
                />
                <p className="text-sm text-themed-muted leading-relaxed">
                  Let attendees know who's organizing this event
                </p>
              </div>

              {/* Fee Information */}
              <div className="space-y-2">
                <label className="text-base font-medium text-themed-secondary">
                  Tickets/Fees Required
                </label>
                <Input
                  type="text"
                  value={formData.fee_required}
                  onChange={(e) => setFormData(prev => ({ ...prev, fee_required: e.target.value }))}
                  placeholder="e.g., Free, $10 entry, Tickets required"
                  className="input-themed h-12 text-base"
                />
                <p className="text-sm text-themed-muted leading-relaxed">
                  Inform attendees about entry requirements or costs
                </p>
              </div>

              {/* Event URL */}
              <div className="space-y-2">
                <label className="text-base font-medium text-themed-secondary">
                  Event Website/Link
                </label>
                <Input
                  type="url"
                  value={formData.event_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, event_url: e.target.value }))}
                  placeholder="https://example.com/event-details"
                  className="input-themed h-12 text-base"
                />
                <p className="text-sm text-themed-muted leading-relaxed">
                  Link to registration, tickets, or more information
                </p>
              </div>
            </div>
          </div>

          {/* Location - More generous spacing */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-themed-primary border-b border-themed pb-2 flex items-center gap-3">
              <MapPin className="w-5 h-5" />
              Location
            </h3>
            
            <div className="space-y-4">
              <div className="relative">
                <AddressAutocomplete
                  value={formData.address}
                  onChange={(value) => setFormData(prev => ({ ...prev, address: value }))}
                  onSelect={handleAddressSelect}
                />
                {formData.address && (
                  <div className="mt-2 flex items-center gap-2">
                    {isStreetLevelAddress(formData.address) ? (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm">Street address detected</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                        <span className="text-sm">Please add street number and name</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm text-themed-muted leading-relaxed">
                <strong>Required:</strong> Please provide a specific street address (e.g., "123 Main Street") rather than just a city name.
              </p>
              {formData.location && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-4 py-3 rounded-md bg-themed-surface border border-themed">
                    <span className="text-sm text-themed-secondary truncate">
                      {formData.address || `${formData.location.lat.toFixed(6)}, ${formData.location.lng.toFixed(6)}`}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover"
                    onClick={handleClearLocation}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <button 
            type="submit" 
            className={`w-full px-6 py-4 rounded-md font-medium text-lg transition-all duration-200 flex items-center justify-center gap-3
              ${isSubmitting || !formData.location || connectionError || !user
                ? 'bg-themed-surface text-themed-muted cursor-not-allowed'
                : 'btn-yellow-themed hover:scale-[1.02]'
              }`}
            disabled={isSubmitting || !formData.location || connectionError || !user}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                {initialEvent ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                {initialEvent ? 'Update Event' : 'Create Event'}
              </>
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateEventForm;