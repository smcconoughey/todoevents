// Using the official Google Maps loading pattern 
// https://developers.google.com/maps/documentation/javascript/load-maps-js-api

import { Loader } from '@googlemaps/js-api-loader';

let loaderPromise = null;

export function initGoogleMaps(apiKey) {
  // If Google Maps is already loaded with places library, return resolved promise
  if (window.google && window.google.maps && window.google.maps.places) {
    console.log("Google Maps already loaded, using existing instance");
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
      version: 'weekly',
      // Include the places library specifically for address search
      libraries: ['places'],
      // Optimization options
      mapIds: [''], 
      authReferrerPolicy: 'origin',
      channel: 'eventapp',
    });

    loaderPromise = loader.load()
      .then(() => {
        // Verify places library was loaded
        if (window.google?.maps?.places) {
          // Pre-warm the Places service with a session token to optimize billing
          try {
            // Create a session token for optimized billing
            new window.google.maps.places.AutocompleteSessionToken();
            
            // Pre-create an instance of the service we'll use
            // This helps with initial latency when the user first interacts
            const tempDiv = document.createElement('div');
            new window.google.maps.places.AutocompleteService();
            new window.google.maps.places.PlacesService(tempDiv);
            
            console.log("Google Maps loaded successfully with Places library");
          } catch (e) {
            console.warn("Places API initialized with limitations:", e);
          }
        } else {
          console.warn("Places library not fully loaded");
        }
        return Promise.resolve();
      })
      .catch(error => {
        console.error("Error loading Google Maps:", error);
        loaderPromise = null; // Allow retrying if loading fails
        throw error;
      });
  }
  
  return loaderPromise;
}