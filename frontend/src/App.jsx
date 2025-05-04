import React, { useEffect } from 'react';
import { AuthProvider } from './components/EventMap/AuthContext';
import EventMap from './components/EventMap';
import { initGoogleMaps } from './googleMapsLoader';

function App() {
  useEffect(() => {
    // Initialize Google Maps once at the app level
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    initGoogleMaps(apiKey);
    
    // Check if the script is already in the document
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript && !existingScript.async) {
      console.warn('Google Maps script detected without async attribute. This may impact performance.');
    }
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