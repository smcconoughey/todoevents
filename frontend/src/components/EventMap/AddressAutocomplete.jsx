import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

const MIN_CHARS = 5;

const AddressAutocomplete = ({ onSelect, value, onChange }) => {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  // Initialize Google Maps autocomplete when the component mounts
  useEffect(() => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.error("Google Maps Places API not loaded");
      setError("Google Maps Places API not loaded");
      return;
    }

    try {
      // If already initialized, do nothing
      if (autocompleteRef.current) return;
      
      const input = inputRef.current;
      if (!input) return;
      
      console.log("Initializing Google Maps Places Autocomplete");
      
      // Create the autocomplete object
      const autocomplete = new window.google.maps.places.Autocomplete(input, {
        types: ['address'],
        componentRestrictions: { country: "us" }
      });
      
      // Store the reference
      autocompleteRef.current = autocomplete;
      
      // Add listener for place selection
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place.geometry) {
          console.warn("Place selected has no geometry data");
          return;
        }
        
        const location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        
        const address = place.formatted_address || '';
        
        // Update the input value
        onChange(address);
        
        // Call the onSelect callback with the selection
        onSelect({
          address,
          location
        });
      });
      
      setInitialized(true);
      console.log("Google Maps Places Autocomplete initialized successfully");
      
    } catch (err) {
      console.error("Error initializing Places Autocomplete:", err);
      setError("Failed to initialize address search");
    }
    
    // Cleanup function
    return () => {
      if (autocompleteRef.current) {
        // The Google Maps JS API doesn't provide a direct way to destroy an Autocomplete instance
        // but we can try to clean up event listeners
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [onSelect, onChange]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-md bg-white/10 border-0 text-white placeholder:text-white/50 focus:ring-2 focus:ring-white/20 transition-all"
          placeholder="Enter address (min. 5 characters)"
          autoComplete="off"
        />
      </div>
      
      {error && (
        <div className="mt-1 text-red-400 text-xs">{error}</div>
      )}

      <style jsx global>{`
        .pac-container {
          background-color: #262626;
          border: 1px solid #404040;
          border-radius: 0.375rem;
          margin-top: 0.25rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          z-index: 9999;
          overflow-y: auto;
        }
        .pac-item {
          padding: 0.5rem 1rem;
          color: #ffffff;
          cursor: pointer !important;
          font-family: inherit;
          border-top: 1px solid #404040;
        }
        .pac-item:first-child {
          border-top: none;
        }
        .pac-item:hover {
          background-color: #404040;
        }
        .pac-item-query {
          color: #ffffff;
          font-size: 0.875rem;
        }
        .pac-matched {
          color: #60A5FA;
        }
        .pac-icon {
          filter: invert(1);
        }
      `}</style>
    </div>
  );
};

export default AddressAutocomplete;