import { Loader } from '@googlemaps/js-api-loader';

let loaderPromise = null;

export function initGoogleMaps(apiKey) {
  // Only initialize once
  if (!loaderPromise) {
    const loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places'],
      loadingStrategy: 'async'
    });
    
    loaderPromise = loader.load();
  }
  
  return loaderPromise;
}