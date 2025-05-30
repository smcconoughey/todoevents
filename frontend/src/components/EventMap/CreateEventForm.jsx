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
    address: '',
    location: null
  });

  // Reset form when initialEvent changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: initialEvent?.title || '',
        description: initialEvent?.description || '',
        date: initialEvent?.date || '',
        start_time: initialEvent?.start_time || '',
        end_time: initialEvent?.end_time || '',
        end_date: initialEvent?.end_date || '',
        category: initialEvent?.category || 'community',
        address: initialEvent?.address || '',
        location: initialEvent ? {
          lat: initialEvent.lat,
          lng: initialEvent.lng,
          address: initialEvent.address
        } : null
      });
      setError(null);
      setConnectionError(false);
      setIsSameDay(!initialEvent.end_date || initialEvent.end_date === initialEvent.date);
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
    if (formData.end_date && new Date(formData.end_date) <= selectedDate) {
      setError('End date must be after the event start date');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Prevent double submission
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
        title: formData.title,
        description: formData.description,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        end_date: isSameDay ? null : (formData.end_date || null),
        category: formData.category,
        address: formData.address,
        lat: formData.location.lat,
        lng: formData.location.lng,
        recurring: false,
        frequency: null
      };

      const url = initialEvent
        ? `${API_URL}/events/${initialEvent.id}`
        : `${API_URL}/events`;
      const method = initialEvent ? 'PUT' : 'POST';

      console.log('Submitting event data:', eventData);
      console.log('Request URL:', url);
      console.log('Request method:', method);

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
      setError(error.message || 'Failed to save event. Please try again.');
    } finally {
      // Always reset submitting state
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="bg-neutral-900/95 backdrop-blur-sm border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto"
        aria-describedby="create-event-dialog-description"
      >
        <DialogHeader className="relative pb-4">
          <DialogTitle className="text-xl font-display font-bold text-white">
            {initialEvent ? 'Edit Event' : 'Create New Event'}
          </DialogTitle>
          <DialogDescription id="create-event-dialog-description" className="text-white/60">
            {initialEvent ? 'Edit an existing event' : 'Create a new event with details'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 pb-6">
          {(error || connectionError) && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-md text-red-200 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{connectionError ? 'Unable to connect to server. Please try again later.' : error}</span>
            </div>
          )}

          {/* Basic Event Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2">Event Details</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Event Title</label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter event title"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter event description"
                className="w-full px-4 py-2 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:ring-2 focus:ring-white/20 transition-all h-24 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Category</label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select a category" />
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

          {/* Date and Time */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">Start Date</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">Start Time</label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sameDay"
                  checked={isSameDay}
                  onChange={(e) => handleSameDayChange(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/10 text-spark-yellow focus:ring-spark-yellow/50"
                />
                <label htmlFor="sameDay" className="text-sm font-medium text-white/70">
                  Single day event
                </label>
              </div>

              {!isSameDay && (
                <div className="space-y-2 pl-6 border-l-2 border-white/10">
                  <label className="text-sm font-medium text-white/70">End Date</label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    min={formData.date}
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">
                  End Time <span className="text-white/50">(optional)</span>
                </label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Location
            </h3>
            
            <div className="space-y-2">
              <AddressAutocomplete
                value={formData.address}
                onChange={(value) => setFormData(prev => ({ ...prev, address: value }))}
                onSelect={handleAddressSelect}
              />
              {formData.location && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-md bg-white/5 border border-white/10">
                    <span className="text-sm text-white/70 truncate">
                      {formData.address || `${formData.location.lat.toFixed(6)}, ${formData.location.lng.toFixed(6)}`}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-white/70 hover:text-white hover:bg-white/10"
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
            className={`w-full px-4 py-3 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-2
              ${isSubmitting || !formData.location || connectionError || !user
                ? 'bg-white/30 text-white/50 cursor-not-allowed'
                : 'bg-spark-yellow text-neutral-900 hover:bg-spark-yellow/90 hover:scale-[1.02]'
              }`}
            disabled={isSubmitting || !formData.location || connectionError || !user}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-neutral-900/30 border-t-neutral-900 rounded-full animate-spin"></div>
                {initialEvent ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
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