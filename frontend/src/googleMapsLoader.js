// Simple async loader for Google Maps API
let loaderPromise = null;

export function initGoogleMaps(apiKey) {
  // If Google Maps is already loaded, return resolved promise
  if (window.google && window.google.maps) {
    console.log("Google Maps already loaded, using existing instance");
    return Promise.resolve();
  }

  // Only initialize once
  if (!loaderPromise) {
    loaderPromise = new Promise((resolve, reject) => {
      // Create script with async attribute
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      
      // Setup callbacks
      script.onload = () => resolve();
      script.onerror = (error) => reject(error);
      
      // Add to document
      document.head.appendChild(script);
    });
  }
  
  return loaderPromise;
}