// Using the official Google Maps loading pattern 
// https://developers.google.com/maps/documentation/javascript/load-maps-js-api

import { Loader } from '@googlemaps/js-api-loader';

let loaderPromise = null;

export function initGoogleMaps(apiKey) {
  // If Google Maps is already loaded, return resolved promise
  if (window.google && window.google.maps) {
    console.log("Google Maps already loaded, using existing instance");
    return Promise.resolve();
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
      // Don't request the places library since we're not using it
      libraries: [],
      mapIds: [''], // Add your map IDs if using cloud-based maps
    });

    loaderPromise = loader.load()
      .then(() => {
        console.log("Google Maps loaded successfully");
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