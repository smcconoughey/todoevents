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
    const loader = new Loader({
      apiKey: apiKey,
      version: 'weekly',
      libraries: ['places'],
      mapIds: [''], // Add your map IDs if using cloud-based maps
    });

    loaderPromise = loader.load();
    
    loaderPromise.then(() => {
      console.log("Google Maps loaded successfully");
    }).catch(error => {
      console.error("Error loading Google Maps:", error);
    });
  }
  
  return loaderPromise;
}