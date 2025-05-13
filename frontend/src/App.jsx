import React, { useEffect, useState } from 'react';
import { AuthProvider } from './components/EventMap/AuthContext';
import EventMap from './components/EventMap';
import { initGoogleMaps } from './googleMapsLoader';

function App() {
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState(null);

  useEffect(() => {
    // Get the API key and do some basic validation
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('Google Maps API key is missing from environment variables');
      setMapsError('Missing API key');
      return;
    }
    
    console.log(`API key loaded (length: ${apiKey.length})`);
    
    // Initialize Google Maps
    initGoogleMaps(apiKey)
      .then(() => {
        setMapsLoaded(true);
      })
      .catch(error => {
        console.error('Failed to load Google Maps API:', error);
        setMapsError('Failed to load Google Maps');
      });
  }, []);

  return (
    <AuthProvider>
      <div className="h-screen w-screen">
        {mapsError ? (
          <div className="flex items-center justify-center h-full bg-neutral-900 text-white">
            <div className="p-6 bg-red-900/20 border border-red-500/30 rounded-lg max-w-md">
              <h2 className="text-xl font-bold mb-2">Google Maps Error</h2>
              <p className="mb-4">
                {mapsError === 'Missing API key' ? 
                  'Google Maps API key is missing. Please add VITE_GOOGLE_MAPS_API_KEY to your environment variables.' :
                  'Failed to load Google Maps. Please check your API key and try again.'}
              </p>
              <p className="text-sm opacity-70">
                See the README.md file for instructions on setting up your environment.
              </p>
            </div>
          </div>
        ) : (
          <EventMap />
        )}
      </div>
    </AuthProvider>
  );
}

export default App;