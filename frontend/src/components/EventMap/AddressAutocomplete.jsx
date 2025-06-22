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

// Helper function to validate coordinates
const isValidCoordinate = (lat, lng) => {
  return (
    typeof lat === 'number' && 
    typeof lng === 'number' && 
    isFinite(lat) && 
    isFinite(lng) && 
    !isNaN(lat) && 
    !isNaN(lng) &&
    lat >= -90 && 
    lat <= 90 && 
    lng >= -180 && 
    lng <= 180
  );
};

const AddressAutocomplete = ({ onSelect, value, onChange, theme = 'light' }) => {
  const [predictions, setPredictions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [manualLocation, setManualLocation] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const sessionTokenRef = useRef(null);
  
  // Initialize a new session token for billing optimization
  useEffect(() => {
    // Check if Google Maps API is available
    if (window.google && window.google.maps && window.google.maps.places) {
      try {
        // Use the modern recommended approach if available
        if (window.google.maps.places.Place) {
          console.log("Using modern Google Places API (Place)");
        } else if (window.google.maps.places.AutocompleteSessionToken) {
          console.log("Using legacy Google Places API (AutocompleteSessionToken)");
          sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        } else {
          console.warn("Google Places API not properly initialized");
        }
      } catch (error) {
        console.error("Error initializing Places API:", error);
      }
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
      if (!input || input.length < 2 || !window.google?.maps?.places) {
        setPredictions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      try {
        // Try to use the modern Place API first, if available
        if (window.google.maps.places.AutocompleteService) {
          const autocompleteService = new window.google.maps.places.AutocompleteService();
          
          const requestOptions = {
            input,
            // Remove specific types restriction to allow all location types
            // This will allow cities, regions, addresses, etc.
            componentRestrictions: { country: 'us' },
            fields: ['formatted_address', 'geometry.location'],
          };
          
          // Add session token if available for billing optimization
          if (sessionTokenRef.current) {
            requestOptions.sessionToken = sessionTokenRef.current;
          }
          
          autocompleteService.getPlacePredictions(requestOptions, (results, status) => {
            setIsLoading(false);
            
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
              // Limit to max 5 results to reduce API usage
              const limitedResults = results.slice(0, 5);
              
              setPredictions(limitedResults);
              setShowPredictions(true);
            } else {
              console.warn("Place predictions error:", status);
              setPredictions([]);
            }
          });
        } else {
          console.error("Google Places AutocompleteService not available");
          setIsLoading(false);
          setPredictions([]);
        }
      } catch (error) {
        console.error("Error getting place predictions:", error);
        setIsLoading(false);
        setPredictions([]);
      }
    }, 500) // 500ms debounce
  ).current;

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSelectedIndex(-1); // Reset selection when typing
    
    if (newValue && newValue.length >= 2) {
      getPlacePredictions(newValue);
    } else {
      setPredictions([]);
      setShowPredictions(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission
      
      if (predictions.length > 0) {
        // Use selected index if available, otherwise first prediction
        const predictionToSelect = selectedIndex >= 0 ? predictions[selectedIndex] : predictions[0];
        console.log('Auto-selecting prediction on Enter:', predictionToSelect.description);
        handlePredictionSelect(predictionToSelect);
      } else if (value && value.length >= 2) {
        // Show message if user typed something but no predictions available
        alert('No address suggestions found. Please try a different search term or select from the dropdown when available.');
      } else {
        // Show message if input is too short
        alert('Please enter at least 2 characters to search for an address.');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (predictions.length > 0) {
        setSelectedIndex(prev => (prev + 1) % predictions.length);
        setShowPredictions(true);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (predictions.length > 0) {
        setSelectedIndex(prev => prev <= 0 ? predictions.length - 1 : prev - 1);
        setShowPredictions(true);
      }
    } else if (e.key === 'Escape') {
      setShowPredictions(false);
      setSelectedIndex(-1);
    }
  };

  const handlePredictionSelect = (prediction) => {
    try {
      // Create a PlacesService to get place details
      if (!window.google?.maps?.places) {
        console.warn('Places API not available for getting details');
        return;
      }
      
      // We need a div to bind the PlacesService to
      const placesDiv = document.createElement('div');
      
      // Use the Places service to get details
      const placesService = new window.google.maps.places.PlacesService(placesDiv);
      
      const requestOptions = {
        placeId: prediction.place_id,
        fields: ['formatted_address', 'geometry.location'],
      };
      
      // Add session token if available for billing optimization
      if (sessionTokenRef.current) {
        requestOptions.sessionToken = sessionTokenRef.current;
      }
      
      placesService.getDetails(requestOptions, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          processPlaceDetails(place, prediction);
        } else {
          console.warn("Error getting place details:", status);
          // Fallback with just the prediction description
          const locationData = {
            address: prediction.description,
            lat: 39.8283,
            lng: -98.5795
          };
          onChange(prediction.description);
          onSelect(locationData);
        }
      });
      
      setShowPredictions(false);
      setSelectedIndex(-1);
    } catch (error) {
      console.error("Error handling place selection:", error);
      // Final fallback
      const locationData = {
        address: prediction.description,
        lat: 39.8283,
        lng: -98.5795
      };
      onChange(prediction.description);
      onSelect(locationData);
      setShowPredictions(false);
      setSelectedIndex(-1);
    }
  };

  // Helper function to process place details
  const processPlaceDetails = (place, prediction) => {
    try {
      // Extract coordinates safely
      let lat, lng;
      
      if (place.geometry && place.geometry.location) {
        // Handle both function calls and direct properties
        if (typeof place.geometry.location.lat === 'function') {
          lat = place.geometry.location.lat();
          lng = place.geometry.location.lng();
        } else {
          lat = place.geometry.location.lat;
          lng = place.geometry.location.lng;
        }
        
        // Validate coordinates before proceeding
        if (isValidCoordinate(lat, lng)) {
          const locationData = {
            address: place.formatted_address,
            lat: lat,
            lng: lng
          };
          
          console.log('Valid location data:', locationData);
          onChange(place.formatted_address);
          onSelect(locationData);
        } else {
          console.error('Invalid coordinates received:', { lat, lng });
          // Fallback to center of US
          const locationData = {
            address: place.formatted_address,
            lat: 39.8283,
            lng: -98.5795
          };
          onChange(place.formatted_address);
          onSelect(locationData);
        }
      } else {
        console.error('No geometry data available for this place');
        // Fallback to center of US
        const locationData = {
          address: place.formatted_address || prediction.description,
          lat: 39.8283,
          lng: -98.5795
        };
        onChange(place.formatted_address || prediction.description);
        onSelect(locationData);
      }
      
      // Generate a new session token after getting place details
      if (window.google?.maps?.places?.AutocompleteSessionToken) {
        try {
          sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        } catch (error) {
          console.warn("Error creating new session token:", error);
        }
      }
    } catch (coordError) {
      console.error("Error processing coordinates:", coordError);
      // Fallback to center of US
      const locationData = {
        address: place.formatted_address || prediction.description,
        lat: 39.8283,
        lng: -98.5795
      };
      onChange(place.formatted_address || prediction.description);
      onSelect(locationData);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    
    if (!value || !value.trim()) return;
    
    // Only allow manual submission if we have custom coordinates set
    // Otherwise, encourage users to select from predictions
    if (!manualLocation) {
      if (predictions.length > 0) {
        // Auto-select the first prediction
        handlePredictionSelect(predictions[0]);
      } else {
        alert('Please select an address from the dropdown suggestions or set custom coordinates first.');
      }
      return;
    }
    
    // Use manual location for custom coordinate submissions
    const locationData = {
      address: value,
      lat: manualLocation.lat,
      lng: manualLocation.lng
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
      
      if (!isValidCoordinate(lat, lng)) {
        alert("Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.");
        return;
      }
      
      setManualLocation({ lat, lng });
      
      // If we already have an address, update the location right away
      if (value && value.trim()) {
        onSelect({
          address: value,
          lat: lat,
          lng: lng
        });
      }
    } catch (err) {
      alert("Invalid coordinates format. Use format: latitude,longitude");
    }
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <form onSubmit={handleManualSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => value && value.length >= 2 && predictions.length > 0 && setShowPredictions(true)}
          className="w-full pl-10 pr-4 py-2 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-all"
          placeholder="Type address and select from dropdown (or press Enter for first option)"
          autoComplete="off"
        />
        <button 
          type="submit"
          className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md px-2 py-1 text-xs text-gray-700 dark:text-gray-300"
          title={manualLocation ? "Submit with custom coordinates" : "Select from dropdown or set custom coordinates first"}
        >
          {manualLocation ? "Set" : "↓"}
        </button>
      </form>
      
      {showPredictions && predictions.length > 0 && (
        <div className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg mt-1 max-h-[200px] overflow-y-auto">
          {predictions.map((prediction, index) => (
            <div
              key={prediction.place_id}
              className={`p-3 cursor-pointer border-t border-gray-200 dark:border-gray-700 first:border-t-0 ${
                index === selectedIndex 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
              }`}
              onClick={() => handlePredictionSelect(prediction)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="text-sm">{prediction.description}</div>
            </div>
          ))}
        </div>
      )}
      
      {isLoading && (
        <div className="text-xs text-blue-500 dark:text-blue-400">Searching addresses...</div>
      )}
      
      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleSetCustomCoordinates}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
        >
          <MapPin className="h-3 w-3" />
          {manualLocation ? "Change Coordinates" : "Set Custom Coordinates"}
        </button>
        
        {manualLocation && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {manualLocation.lat.toFixed(4)}, {manualLocation.lng.toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
};

export default AddressAutocomplete;