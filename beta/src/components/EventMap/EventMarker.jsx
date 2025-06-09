import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AddressAutocomplete from './AddressAutocomplete';
import categories from './categoryConfig';

const CreateEventForm = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  selectedLocation,
  onLocationSelect 
}) => {
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

  useEffect(() => {
    if (selectedLocation) {
      setFormData(prev => ({
        ...prev,
        location: selectedLocation,
        address: selectedLocation.address || prev.address
      }));
    }
  }, [selectedLocation]);

  const handleAddressSelect = (data) => {
    setFormData(prev => ({
      ...prev,
      address: data.address,
      location: data.location
    }));
    if (onLocationSelect) {
      onLocationSelect(data.location);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      const data = await response.json();
      if (onSubmit) {
        onSubmit(formData);
      }
      onClose();
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed right-4 top-4 w-[380px] bg-neutral-900/95 backdrop-blur-sm rounded-lg shadow-xl border border-white/10 z-50"
      onClick={e => e.stopPropagation()}
    >
      <div className="p-4 border-b border-white/10 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Create New Event</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
        <div className="space-y-2">
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full p-2 rounded-md bg-white/10 border-0 text-white placeholder:text-white/50 text-lg"
            placeholder="Event Title"
            maxLength="50"
            required
          />
        </div>

        <div className="space-y-2">
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full p-2 rounded-md bg-white/10 border-0 text-white placeholder:text-white/50"
            placeholder="Event Description"
            maxLength="350"
            rows="3"
            required
          />
          <p className="text-xs text-white/50 text-right">
            {350 - formData.description.length} characters remaining
          </p>
        </div>

        <div className="flex space-x-3">
          <div className="flex-1">
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full pl-8 p-2 rounded-md bg-white/10 border-0 text-white text-sm"
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="relative">
              <Clock className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full pl-8 p-2 rounded-md bg-white/10 border-0 text-white text-sm"
                required
              />
            </div>
          </div>
        </div>

        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value })}
        >
          <SelectTrigger className="w-full bg-white/10 border-0 text-white">
            <SelectValue placeholder="Select Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.filter(cat => cat.id !== 'all').map((category) => (
              <SelectItem 
                key={category.id} 
                value={category.id}
              >
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="space-y-2">
          <AddressAutocomplete
            value={formData.address}
            onChange={(value) => setFormData({ ...formData, address: value })}
            onSelect={handleAddressSelect}
          />
          {formData.location && (
            <div className="flex items-center text-sm text-white/70">
              <MapPin className="w-4 h-4 mr-2" />
              <span>{formData.address}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.recurring}
              onChange={(e) => setFormData({
                ...formData,
                recurring: e.target.checked,
                frequency: e.target.checked ? 'weekly' : 'none'
              })}
              className="rounded bg-white/10 border-0"
            />
            <span className="text-sm text-white">Recurring Event</span>
          </label>

          {formData.recurring && (
            <div className="space-y-3 pl-6">
              <Select
                value={formData.frequency}
                onValueChange={(value) => setFormData({ ...formData, frequency: value })}
              >
                <SelectTrigger className="w-full bg-white/10 border-0 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full pl-8 p-2 rounded-md bg-white/10 border-0 text-white text-sm"
                  min={formData.date}
                  required={formData.recurring}
                  placeholder="End Date"
                />
              </div>
            </div>
          )}
        </div>

        <Button 
          type="submit" 
          className="w-full bg-white text-neutral-900 hover:bg-white/90 mt-2"
          disabled={!formData.location}
        >
          Create Event
        </Button>
      </form>
    </div>
  );
};

export default CreateEventForm;