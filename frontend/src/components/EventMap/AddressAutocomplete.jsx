import React, { useState } from 'react';
import { Search, MapPin } from 'lucide-react';

const AddressAutocomplete = ({ onSelect, value, onChange }) => {
  const [manualLocation, setManualLocation] = useState(null);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    
    if (!value.trim()) return;
    
    // Create a simple mock location with a placeholder lat/lng
    // These coordinates are for the center of the US
    const defaultLocation = {
      lat: 39.8283,
      lng: -98.5795
    };
    
    // You can customize this with different default coordinates if needed
    const locationData = {
      address: value,
      location: manualLocation || defaultLocation
    };
    
    // Call the onSelect callback with our location data
    if (onSelect) {
      onSelect(locationData);
    }
  };

  // Allow setting custom coordinates if needed
  const handleSetCustomCoordinates = () => {
    // Ask for coordinates in a simple prompt
    const latLngString = prompt("Enter latitude and longitude (format: lat,lng)", 
      manualLocation ? `${manualLocation.lat},${manualLocation.lng}` : "39.8283,-98.5795");
    
    if (!latLngString) return;
    
    try {
      const [lat, lng] = latLngString.split(',').map(coord => parseFloat(coord.trim()));
      
      if (isNaN(lat) || isNaN(lng)) {
        alert("Invalid coordinates format. Use format: latitude,longitude");
        return;
      }
      
      setManualLocation({ lat, lng });
      
      // If we already have an address, update the location right away
      if (value.trim()) {
        onSelect({
          address: value,
          location: { lat, lng }
        });
      }
    } catch (err) {
      alert("Invalid coordinates format. Use format: latitude,longitude");
    }
  };

  return (
    <div className="space-y-2">
      <form onSubmit={handleManualSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-md bg-white/10 border-0 text-white placeholder:text-white/50 focus:ring-2 focus:ring-white/20 transition-all"
          placeholder="Enter address manually"
          autoComplete="off"
        />
        <button 
          type="submit"
          className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-md px-2 py-1 text-xs text-white/70"
        >
          Set
        </button>
      </form>
      
      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleSetCustomCoordinates}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <MapPin className="h-3 w-3" />
          {manualLocation ? "Change Coordinates" : "Set Custom Coordinates"}
        </button>
        
        {manualLocation && (
          <span className="text-xs text-white/50">
            {manualLocation.lat.toFixed(4)}, {manualLocation.lng.toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
};

export default AddressAutocomplete;