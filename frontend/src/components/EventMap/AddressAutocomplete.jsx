import React, { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

const DEBOUNCE_TIME = 2000;
const MIN_CHARS = 5;

const AddressAutocomplete = ({ onSelect, value, onChange }) => {
  const inputRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const timeoutRef = useRef(null);
  const autocompleteRef = useRef(null);
  const serviceRef = useRef(null);
  const lastQueryTimeRef = useRef(0);
  const lastQueryRef = useRef('');

  useEffect(() => {
    if (!window.google || !inputRef.current) return;

    sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    serviceRef.current = new window.google.maps.places.AutocompleteService();

    // Create throttled version of getPlacePredictions
    const originalGetPredictions = serviceRef.current.getPlacePredictions.bind(serviceRef.current);
    serviceRef.current.getPlacePredictions = (request, callback) => {
      const now = Date.now();
      const timeSinceLastQuery = now - lastQueryTimeRef.current;
      
      if (!request.input || request.input.length < MIN_CHARS) {
        callback([], window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS);
        return;
      }

      if (timeSinceLastQuery < DEBOUNCE_TIME) {
        callback([], window.google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT);
        return;
      }

      if (lastQueryRef.current && 
          request.input.toLowerCase().includes(lastQueryRef.current.toLowerCase())) {
        return;
      }

      lastQueryTimeRef.current = now;
      lastQueryRef.current = request.input;

      originalGetPredictions({
        ...request,
        types: ['geocode', 'address'],
      }, (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          callback(predictions.slice(0, 2), status);
        } else {
          callback(predictions, status);
        }
      });
    };

    // Initialize Autocomplete
    const autocomplete = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry.location'],
        types: ['geocode'],
        sessionToken: sessionTokenRef.current
      }
    );

    autocompleteRef.current = autocomplete;

    // Place changed handler
    const placeChangedListener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) return;

      // Force immediate update without rate limiting
      onChange(place.formatted_address);
      onSelect({
        address: place.formatted_address,
        location: {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        },
      });

      // Reset rate limiting state
      lastQueryRef.current = '';
      lastQueryTimeRef.current = 0;
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    });

    // Add observer for styling
    const observer = new MutationObserver((mutations) => {
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
      if (placeChangedListener) placeChangedListener.remove();
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      observer.disconnect();
    };
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

    // Schedule showing predictions after debounce time
    timeoutRef.current = setTimeout(() => {
      const pacContainer = document.querySelector('.pac-container');
      if (pacContainer) {
        pacContainer.style.display = '';
      }
    }, DEBOUNCE_TIME);
  };

  return (
    <div className="relative">
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