import React, { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

const DEBOUNCE_TIME = 2000;
const MIN_CHARS = 5;

const AddressAutocomplete = ({ onSelect, value, onChange }) => {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const timeoutRef = useRef(null);
  const autocompleteRef = useRef(null);
  const lastQueryTimeRef = useRef(0);
  const lastQueryRef = useRef('');
  const initializationAttemptedRef = useRef(false);

  useEffect(() => {
    // Only attempt initialization once
    if (initializationAttemptedRef.current) return;
    initializationAttemptedRef.current = true;

    // Don't proceed if Google Maps isn't loaded or the container doesn't exist
    if (!window.google || !window.google.maps || !containerRef.current) return;
    
    const input = containerRef.current.querySelector('input');
    if (!input) return;
    
    try {
      console.log("Attempting to use PlaceAutocompleteElement API");
      
      // Create the element
      const autocompleteElement = new window.google.maps.places.PlaceAutocompleteElement({
        inputElement: input,
        types: ['address', 'geocode'],
        componentRestrictions: { country: 'us' }
      });
      
      // Store a reference
      autocompleteRef.current = autocompleteElement;
      
      // Add event listener
      const handlePlaceChanged = () => {
        const place = autocompleteElement.getPlace();
        if (!place || !place.geometry) return;
        
        onChange(place.formatted_address || '');
        onSelect({
          address: place.formatted_address || '',
          location: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          },
        });
      };

      input.addEventListener('place_changed', handlePlaceChanged);
      
      console.log("Successfully initialized PlaceAutocompleteElement");

      // Add observer for styling the autocomplete dropdown
      const observer = new MutationObserver(() => {
        const pacContainer = document.querySelector('.pac-container');
        if (pacContainer) {
          pacContainer.classList.add(
            'bg-neutral-800',
            'border',
            'border-neutral-700',
            'rounded-md',
            'mt-1',
            'shadow-lg'
          );
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (autocompleteRef.current) {
          input.removeEventListener('place_changed', handlePlaceChanged);
          if (typeof autocompleteRef.current.remove === 'function') {
            autocompleteRef.current.remove();
          }
          autocompleteRef.current = null;
        }
        observer.disconnect();
        initializationAttemptedRef.current = false;
      };
    } catch (error) {
      console.error("Autocomplete initialization failed:", error);
      console.warn("Using basic input as fallback. Google Maps Places API couldn't be initialized.");
    }
  }, [onSelect, onChange]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // If input is too short, don't schedule showing predictions
    if (newValue.length < MIN_CHARS) {
      const pacContainer = document.querySelector('.pac-container');
      if (pacContainer) {
        pacContainer.style.display = 'none';
      }
      return;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          className="w-full pl-10 pr-4 py-2 rounded-md bg-white/10 border-0 text-white placeholder:text-white/50 focus:ring-2 focus:ring-white/20 transition-all"
          placeholder="Enter address (min. 5 characters)"
          autoComplete="off"
        />
      </div>

      <style jsx global>{`
        .pac-container {
          background-color: #262626;
          border: 1px solid #404040;
          border-radius: 0.375rem;
          margin-top: 0.25rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          z-index: 9999;
          max-height: 120px !important;
          overflow-y: auto;
        }
        .pac-container:empty {
          display: none;
        }
        .pac-item:nth-child(n+3) {
          display: none !important;
        }
        .pac-item {
          padding: 0.5rem 1rem;
          color: #ffffff;
          cursor: pointer !important;
          font-family: inherit;
          border-top: 1px solid #404040;
          pointer-events: auto !important;
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