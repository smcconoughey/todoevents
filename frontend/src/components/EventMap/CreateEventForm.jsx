import React, { useState, useEffect, useContext } from 'react';
import { X, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    category: '',
    address: '',
    location: null,
    recurring: false,
    frequency: 'none',
    endDate: ''
  });

  // Reset form when initialEvent changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: initialEvent?.title || '',
        description: initialEvent?.description || '',
        date: initialEvent?.date || '',
        time: initialEvent?.time || '',
        category: initialEvent?.category || '',
        address: initialEvent?.address || '',
        location: initialEvent ? {
          lat: initialEvent.lat,
          lng: initialEvent.lng,
          address: initialEvent.address
        } : null,
        recurring: initialEvent?.recurring || false,
        frequency: initialEvent?.frequency || 'none',
        endDate: initialEvent?.end_date || ''
      });
      setError(null);
      setConnectionError(false);
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
        const response = await fetch('http://127.0.0.1:8000/health');
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
    if (!data?.location) return;
    
    setFormData(prev => ({
      ...prev,
      address: data.address,
      location: data.location
    }));
    
    onLocationSelect?.(data.location);
    setError(null);
  };

  const handleClearLocation = () => {
    setFormData(prev => ({
      ...prev,
      location: null,
      address: ''
    }));
    onLocationSelect?.(null);
  };

  const validateForm = () => {
    const now = new Date();
    const selectedDate = new Date(formData.date + 'T' + formData.time);

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
    if (!formData.time) {
      setError('Please select an event time');
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
    if (formData.recurring && !formData.endDate) {
      setError('Please select an end date for recurring event');
      return false;
    }
    if (formData.recurring && new Date(formData.endDate) <= selectedDate) {
      setError('End date must be after the event start date');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isSubmitting) return;
    if (!user) {
      setError('You must be logged in to create events');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (connectionError) {
        throw new Error('Unable to connect to server. Please try again later.');
      }

      const eventData = {
        title: formData.title,
        description: formData.description,
        date: formData.date,
        time: formData.time,
        category: formData.category,
        address: formData.address,
        lat: formData.location.lat,
        lng: formData.location.lng,
        recurring: formData.recurring,
        frequency: formData.recurring ? formData.frequency : null,
        end_date: formData.recurring ? formData.endDate : null
      };

      const url = initialEvent
        ? `http://127.0.0.1:8000/events/${initialEvent.id}`
        : 'http://127.0.0.1:8000/events';
      const method = initialEvent ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save event');
      }

      const savedEvent = await response.json();
      await onSubmit(savedEvent);
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      setError(error.message || 'Failed to save event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {(error || connectionError) && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-md text-red-200 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{connectionError ? 'Unable to connect to server. Please try again later.' : error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm text-white/70">Event Title</label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter event title"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/70">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter event description"
              className="w-full px-4 py-2 rounded-md bg-white/10 border-0 text-white placeholder:text-white/50 focus:ring-2 focus:ring-white/20 transition-all h-24 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70">Date</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Time</label>
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/70">Category</label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.filter(cat => cat.id !== 'all').map(category => (
                  <SelectItem
                    key={category.id}
                    value={category.id}
                  >
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

          <div className="space-y-2">
            <label className="text-sm text-white/70">Location</label>
            <div className="space-y-2">
              <AddressAutocomplete
                value={formData.address}
                onChange={(value) => setFormData(prev => ({ ...prev, address: value }))}
                onSelect={handleAddressSelect}
              />
              {formData.location && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-md bg-white/5">
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

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="recurring"
                checked={formData.recurring}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  recurring: e.target.checked,
                  frequency: e.target.checked ? 'weekly' : 'none'
                }))}
                className="rounded border-white/20 bg-white/10 text-white"
              />
              <label htmlFor="recurring" className="text-sm text-white/70">
                Recurring Event
              </label>
            </div>

            {formData.recurring && (
              <div className="space-y-4 pl-6">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">Frequency</label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      frequency: value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-white/70">End Date</label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      endDate: e.target.value
                    }))}
                    min={formData.date}
                  />
                </div>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className={`w-full px-4 py-2 rounded-md font-medium transition-colors
              ${isSubmitting || !formData.location || connectionError || !user
                ? 'bg-white/30 cursor-not-allowed'
                : 'bg-white text-black hover:bg-white/90'
              }`}
            disabled={isSubmitting || !formData.location || connectionError || !user}
          >
            {initialEvent ? 'Update Event' : 'Create Event'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateEventForm;