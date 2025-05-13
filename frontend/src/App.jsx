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
    
    if (apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      console.error('Google Maps API key has not been changed from the default placeholder');
      setMapsError('Invalid API key');
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
                mapsError === 'Invalid API key' ?
                  'Google Maps API key is invalid. Please replace the placeholder in your .env file with a valid API key.' :
                  'Failed to load Google Maps. Please check your API key and try again.'}
              </p>
              <p className="text-sm opacity-70">
                See the README.md file for instructions on setting up your environment.
              </p>
            </div>
          </div>
        ) : !mapsLoaded ? (
          <div className="flex items-center justify-center h-full bg-neutral-900 text-white">
            <div className="p-6 bg-neutral-800/50 border border-white/10 rounded-lg">
              <h2 className="text-xl font-bold mb-2">Loading Maps...</h2>
              <p>Initializing Google Maps API</p>
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