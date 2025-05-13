import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin } from 'lucide-react';

// Debounce helper function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

const AddressAutocomplete = ({ onSelect, value, onChange }) => {
  const [predictions, setPredictions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [manualLocation, setManualLocation] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const sessionTokenRef = useRef(null);
  
  // Initialize a new session token for billing optimization
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
    
    // Cleanup function
    return () => {
      sessionTokenRef.current = null;
    };
  }, []);
  
  // Handle clicks outside to close predictions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowPredictions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Search for predictions using Places Autocomplete service
  const getPlacePredictions = useRef(
    debounce((input) => {
      if (!input || input.length < 3 || !window.google?.maps?.places) {
        setPredictions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      const autocompleteService = new window.google.maps.places.AutocompleteService();
      
      autocompleteService.getPlacePredictions({
        input,
        types: ['address'],
        componentRestrictions: { country: 'us' },
        sessionToken: sessionTokenRef.current,
        fields: ['formatted_address', 'geometry.location'],
      }, (results, status) => {
        setIsLoading(false);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          // Limit to max 5 results to reduce API usage
          setPredictions(results.slice(0, 5));
          setShowPredictions(true);
        } else {
          setPredictions([]);
        }
      });
    }, 500) // 500ms debounce
  ).current;

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    if (newValue.length >= 3) {
      getPlacePredictions(newValue);
    } else {
      setPredictions([]);
      setShowPredictions(false);
    }
  };

  const handlePredictionSelect = (prediction) => {
    // Create a PlacesService to get place details
    if (!window.google?.maps?.places) {
      console.warn('Places API not available for getting details');
      return;
    }
    
    // We need a div to bind the PlacesService to
    const placesService = new window.google.maps.places.PlacesService(
      document.createElement('div')
    );
    
    placesService.getDetails({
      placeId: prediction.place_id,
      fields: ['formatted_address', 'geometry.location'],
      sessionToken: sessionTokenRef.current
    }, (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
        const locationData = {
          address: place.formatted_address,
          location: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          }
        };
        
        onChange(place.formatted_address);
        onSelect(locationData);
        
        // Generate a new session token after getting place details
        if (window.google?.maps?.places) {
          sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        }
      }
    });
    
    setShowPredictions(false);
  };

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
    
    setShowPredictions(false);
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
    <div className="space-y-2" ref={containerRef}>
      <form onSubmit={handleManualSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => value.length >= 3 && setPredictions.length > 0 && setShowPredictions(true)}
          className="w-full pl-10 pr-4 py-2 rounded-md bg-white/10 border-0 text-white placeholder:text-white/50 focus:ring-2 focus:ring-white/20 transition-all"
          placeholder="Enter address (min. 3 characters for search)"
          autoComplete="off"
        />
        <button 
          type="submit"
          className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-white/10 hover:bg-white/20 rounded-md px-2 py-1 text-xs text-white/70"
        >
          Set
        </button>
      </form>
      
      {showPredictions && predictions.length > 0 && (
        <div className="absolute z-50 w-full bg-neutral-800 border border-neutral-700 rounded-md shadow-lg mt-1 max-h-[200px] overflow-y-auto">
          {predictions.map((prediction) => (
            <div
              key={prediction.place_id}
              className="p-3 hover:bg-neutral-700 cursor-pointer border-t border-neutral-700 first:border-t-0"
              onClick={() => handlePredictionSelect(prediction)}
            >
              <div className="text-white text-sm">{prediction.description}</div>
            </div>
          ))}
        </div>
      )}
      
      {isLoading && (
        <div className="text-xs text-blue-400">Searching addresses...</div>
      )}
      
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