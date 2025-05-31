// Using the official Google Maps loading pattern 
// https://developers.google.com/maps/documentation/javascript/load-maps-js-api

import { Loader } from '@googlemaps/js-api-loader';

let loaderPromise = null;
let mapsInitialized = false;

export function initGoogleMaps(apiKey) {
  // If Google Maps is already fully loaded and initialized, return resolved promise
  if (mapsInitialized && window.google && window.google.maps && window.google.maps.places) {
    console.log("Google Maps already loaded and initialized, using existing instance");
    return Promise.resolve();
  }
  
  // If Google Maps is loaded but places library is missing, log a warning
  if (window.google && window.google.maps && !window.google.maps.places) {
    console.warn("Google Maps loaded but Places API is missing");
  }

  // Only initialize once
  if (!loaderPromise) {
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      console.error("Invalid Google Maps API key");
      return Promise.reject(new Error("Invalid Google Maps API key"));
    }
    
    console.log(`Initializing Google Maps with key ${apiKey.substring(0, 5)}...`);
    
    const loader = new Loader({
      apiKey: apiKey,
      version: 'weekly', // Use 'weekly' for latest stable version
      // Include the places library specifically for address search
      libraries: ['places'],
      // Optimization options
      authReferrerPolicy: 'origin',
      channel: 'eventapp', // For analytics tracking
      // Add cache busting only for development
      ...(process.env.NODE_ENV === 'development' ? {} : { 
        mapIds: [''],
        language: 'en',
        region: 'US'
      })
    });

    loaderPromise = loader.load()
      .then(() => {
        // Verify places library was loaded
        if (window.google?.maps?.places) {
          // Pre-warm the Places service with a session token to optimize billing
          try {
            // Create a session token for optimized billing
            const sessionToken = new window.google.maps.places.AutocompleteSessionToken();
            console.log("Session token created for Places API optimization");
            
            // Pre-create service instances for faster first-use
            // This helps with initial latency when the user first interacts
            const tempDiv = document.createElement('div');
            const autocompleteService = new window.google.maps.places.AutocompleteService();
            const placesService = new window.google.maps.places.PlacesService(tempDiv);
            
            // Store references for potential reuse
            if (!window.mapsServices) {
              window.mapsServices = {
                autocompleteService,
                placesService,
                tempDiv
              };
            }
            
            mapsInitialized = true;
            console.log("✅ Google Maps loaded successfully with Places library and services pre-warmed");
          } catch (e) {
            console.warn("Places API initialized with limitations:", e);
            mapsInitialized = true; // Still mark as initialized
          }
        } else {
          console.warn("Places library not fully loaded");
          mapsInitialized = true; // Mark as initialized even with limitations
        }
        return Promise.resolve();
      })
      .catch(error => {
        console.error("Error loading Google Maps:", error);
        loaderPromise = null; // Allow retrying if loading fails
        mapsInitialized = false;
        throw error;
      });
  }
  
  return loaderPromise;
}

// Utility function to check if Maps is ready
export function isMapsReady() {
  return mapsInitialized && window.google && window.google.maps && window.google.maps.places;
}

// Utility function to get pre-warmed services
export function getMapsServices() {
  if (isMapsReady() && window.mapsServices) {
    return window.mapsServices;
  }
  return null;
}

// Function to reset initialization (useful for testing or forced refresh)
export function resetMapsInitialization() {
  loaderPromise = null;
  mapsInitialized = false;
  if (window.mapsServices) {
    delete window.mapsServices;
  }
  console.log("🔄 Google Maps initialization reset");
}