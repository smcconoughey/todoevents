import React, { useEffect } from 'react';
import { AuthProvider } from './components/EventMap/AuthContext';
import EventMap from './components/EventMap';
import { initGoogleMaps } from './googleMapsLoader';

function App() {
  useEffect(() => {
    // Remove any direct script tags that might have been added manually
    const existingScripts = document.querySelectorAll('script[src*="maps.googleapis.com"]:not([data-loader])');
    existingScripts.forEach(script => {
      if (!script.async) {
        console.warn('Removing non-async Google Maps script');
        script.parentNode.removeChild(script);
      }
    });

    // Initialize Google Maps once at the app level
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    initGoogleMaps(apiKey).catch(error => {
      console.error('Failed to load Google Maps API:', error);
    });
  }, []);

  return (
    <AuthProvider>
      <div className="h-screen w-screen">
        <EventMap />
      </div>
    </AuthProvider>
  );
}

export default App;