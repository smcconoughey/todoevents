// This file should ONLY contain the loader logic, no React components
let loaderPromise = null;

export function initGoogleMaps(apiKey) {
  // If Google Maps is already loaded globally, don't load again
  if (window.google && window.google.maps) {
    console.log("Google Maps already loaded, using existing instance");
    return Promise.resolve();
  }

  // Check for existing script tag
  const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
  if (existingScript) {
    console.warn("Found existing Google Maps script tag. Avoiding duplicate load.");
    return new Promise((resolve) => {
      if (window.google && window.google.maps) {
        resolve();
      } else {
        // Wait for existing script to load
        const checkLoaded = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(checkLoaded);
            resolve();
          }
        }, 100);
      }
    });
  }

  // Only initialize once
  if (!loaderPromise) {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    
    loaderPromise = new Promise((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = (error) => reject(error);
      document.head.appendChild(script);
    });
  }
  
  return loaderPromise;
}