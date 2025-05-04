import React, { useEffect } from 'react';
import { AuthProvider } from './components/EventMap/AuthContext';
import EventMap from './components/EventMap';
import { initGoogleMaps } from './googleMapsLoader';

function App() {
  useEffect(() => {
    // Get the API key and do some basic validation
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    // Log a non-sensitive message about the key
    if (!apiKey) {
      console.error('Google Maps API key is missing from environment variables');
    } else {
      console.log(`API key loaded (length: ${apiKey.length})`);
      
      // Initialize Google Maps
      initGoogleMaps(apiKey).catch(error => {
        console.error('Failed to load Google Maps API:', error);
      });
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