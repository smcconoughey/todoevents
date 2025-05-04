// Enhanced loader with additional checks
let loaderPromise = null;

export function initGoogleMaps(apiKey) {
  // If Google Maps is already loaded, return resolved promise
  if (window.google && window.google.maps) {
    console.log("Google Maps already loaded, using existing instance");
    return Promise.resolve();
  }

  // Remove ALL existing Google Maps script tags before adding our own
  const existingScripts = document.querySelectorAll('script[src*="maps.googleapis.com"]');
  existingScripts.forEach(script => {
    console.warn('Removing existing Google Maps script to prevent duplicate loading');
    script.parentNode.removeChild(script);
  });

  // Only initialize once
  if (!loaderPromise) {
    loaderPromise = new Promise((resolve, reject) => {
      // Create script with async attribute
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.id = 'google-maps-script';
      
      // Setup callbacks
      script.onload = () => {
        console.log("Google Maps loaded with async attribute");
        resolve();
      };
      script.onerror = (error) => reject(error);
      
      // Add to document
      document.head.appendChild(script);
    });
  }
  
  return loaderPromise;
}