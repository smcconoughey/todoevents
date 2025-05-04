import React, { useEffect } from 'react';
import { AuthProvider } from './components/EventMap/AuthContext';
import EventMap from './components/EventMap';
import { initGoogleMaps } from './googleMapsLoader';

function App() {
  useEffect(() => {
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