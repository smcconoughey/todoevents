import React, { useEffect, useState } from 'react';
import { AuthProvider } from './components/EventMap/AuthContext';
import EventMap from './components/EventMap';
import { initGoogleMaps } from './googleMapsLoader';

function App() {
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState(null);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    // Get the API key and do some basic validation
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    // Set a timeout to proceed with the app even if Maps doesn't load
    const timeoutId = setTimeout(() => {
      if (!mapsLoaded && !mapsError) {
        console.warn("Google Maps loading timed out, proceeding with limited functionality");
        setLoadingTimedOut(true);
      }
    }, 5000); // 5 second timeout
    
    if (!apiKey) {
      console.error('Google Maps API key is missing from environment variables');
      setMapsError('Missing API key');
      clearTimeout(timeoutId);
      return;
    }
    
    if (apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      console.error('Google Maps API key has not been changed from the default placeholder');
      setMapsError('Invalid API key');
      clearTimeout(timeoutId);
      return;
    }
    
    console.log(`API key loaded (length: ${apiKey.length})`);
    
    // Initialize Google Maps
    initGoogleMaps(apiKey)
      .then(() => {
        setMapsLoaded(true);
        clearTimeout(timeoutId);
      })
      .catch(error => {
        console.error('Failed to load Google Maps API:', error);
        setMapsError('Failed to load Google Maps');
        clearTimeout(timeoutId);
      });
      
    return () => clearTimeout(timeoutId);
  }, [mapsLoaded]);

  // We'll proceed even with Maps errors, but show a warning
  const shouldShowApp = mapsLoaded || loadingTimedOut;
  
  return (
    <AuthProvider>
      <div className="h-screen w-screen">
        {mapsError && (
          <div className={`bg-red-900/70 text-white p-3 text-sm ${shouldShowApp ? '' : 'h-full flex items-center justify-center'}`}>
            <div className={`p-4 bg-red-900/20 border border-red-500/30 rounded-lg ${shouldShowApp ? 'max-w-md mx-auto' : ''}`}>
              <h2 className="text-lg font-bold mb-2">Google Maps Warning</h2>
              <p className="mb-2">
                {mapsError === 'Missing API key' ? 
                  'Google Maps API key is missing. Map functionality will be limited.' :
                mapsError === 'Invalid API key' ?
                  'Google Maps API key is invalid. Map functionality will be limited.' :
                  'Failed to load Google Maps. Map functionality will be limited.'}
              </p>
              {!shouldShowApp && (
                <button 
                  onClick={() => setLoadingTimedOut(true)}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-md"
                >
                  Continue Anyway
                </button>
              )}
            </div>
          </div>
        )}
        
        {!shouldShowApp && !mapsError ? (
          <div className="flex items-center justify-center h-full bg-neutral-900 text-white">
            <div className="p-6 bg-neutral-800/50 border border-white/10 rounded-lg">
              <h2 className="text-xl font-bold mb-2">Loading Maps...</h2>
              <p className="mb-4">Initializing Google Maps API</p>
              <button 
                onClick={() => setLoadingTimedOut(true)}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-md"
              >
                Skip Map Loading
              </button>
            </div>
          </div>
        ) : (
          <EventMap mapsLoaded={mapsLoaded} />
        )}
      </div>
    </AuthProvider>
  );
}

export default App;