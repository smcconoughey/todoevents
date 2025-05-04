import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

const DEBOUNCE_TIME = 2000;
const MIN_CHARS = 5;

const AddressAutocomplete = ({ onSelect, value, onChange }) => {
  const containerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const timeoutRef = useRef(null);
  const suggestionRef = useRef(null);
  const lastQueryTimeRef = useRef(0);
  const lastQueryRef = useRef('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Clean up on unmount
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (autocompleteRef.current) {
        // Clear any event listeners or references if needed
      }
    };
  }, []);

  useEffect(() => {
    if (!window.google || !containerRef.current) return;

    // Create PlaceAutocompleteElement
    const autocompleteElement = new window.google.maps.places.PlaceAutocompleteElement({
      inputElement: containerRef.current.querySelector('input'),
      types: ['address', 'geocode'],
      componentRestrictions: { country: 'us' },
      bounds: {}, // Optional: Can restrict to specific area
      fields: ['formatted_address', 'geometry.location']
    });

    // Store reference to the autocomplete element
    autocompleteRef.current = autocompleteElement;

    // Add listener for place selection
    autocompleteElement.addListener('place_changed', () => {
      const place = autocompleteElement.getPlace();
      if (!place.geometry) return;

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
    });

    // Initialize AutocompleteSuggestion service
    suggestionRef.current = new window.google.maps.places.AutocompleteSuggestion();

    // Add observer for styling the autocomplete dropdown
    const observer = new MutationObserver((mutations) => {
      // Apply custom styling to the autocomplete dropdown
      // The selectors might need to be adjusted for the new PlaceAutocompleteElement
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

    setIsLoaded(true);

    return () => {
      observer.disconnect();
      if (autocompleteRef.current) {
        autocompleteRef.current.remove();
      }
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
      return;
    }

    // If enough time has passed since last query
    const now = Date.now();
    const timeSinceLastQuery = now - lastQueryTimeRef.current;
    
    if (timeSinceLastQuery < DEBOUNCE_TIME) {
      return;
    }

    // Use AutocompleteSuggestion to get predictions
    if (suggestionRef.current && newValue.length >= MIN_CHARS) {
      timeoutRef.current = setTimeout(() => {
        lastQueryTimeRef.current = now;
        lastQueryRef.current = newValue;
        
        // The new API uses a different method structure
        suggestionRef.current.getQueryPredictions({
          input: newValue,
          types: ['address', 'geocode'],
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address', 'geometry.location']
        });
      }, DEBOUNCE_TIME);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
        <input
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