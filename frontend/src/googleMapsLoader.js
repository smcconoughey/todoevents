// Enhanced loader with additional checks
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
      try {
        // Create script element
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.async = true; // Set async explicitly
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap`;
        
        // Define callback in window scope
        window.initMap = () => {
          console.log("Google Maps loaded successfully");
          resolve();
        };
        
        // Handle errors
        script.onerror = (error) => {
          console.error("Error loading Google Maps:", error);
          reject(error);
        };
        
        // Add to document
        document.head.appendChild(script);
      } catch (error) {
        console.error("Error setting up Google Maps loader:", error);
        reject(error);
      }
    });
  }
  
  return loaderPromise;
}