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
      <div className="h-screen w-screen bg-neutral-950">
        {mapsError && (
          <div className={`bg-vibrant-magenta/10 border-b border-vibrant-magenta/20 text-white p-3 text-sm ${shouldShowApp ? '' : 'h-full flex items-center justify-center'}`}>
            <div className={`p-6 bg-vibrant-magenta/20 border border-vibrant-magenta/30 rounded-xl backdrop-blur-sm ${shouldShowApp ? 'max-w-md mx-auto' : ''}`}>
              <h2 className="text-lg font-display font-bold mb-2 text-vibrant-magenta">Google Maps Warning</h2>
              <p className="mb-4 font-body leading-relaxed">
                {mapsError === 'Missing API key' ? 
                  'Google Maps API key is missing. Map functionality will be limited.' :
                mapsError === 'Invalid API key' ?
                  'Google Maps API key is invalid. Map functionality will be limited.' :
                  'Failed to load Google Maps. Map functionality will be limited.'}
              </p>
              {!shouldShowApp && (
                <button 
                  onClick={() => setLoadingTimedOut(true)}
                  className="bg-pin-blue hover:bg-pin-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg"
                >
                  Continue Anyway
                </button>
              )}
            </div>
          </div>
        )}
        
        {!shouldShowApp && !mapsError ? (
          <div className="flex items-center justify-center h-full bg-neutral-950 text-white">
            <div className="p-8 bg-neutral-900/95 border border-white/10 rounded-xl backdrop-blur-sm shadow-2xl max-w-md mx-auto text-center">
              <div className="mb-6">
                <h1 className="text-3xl font-display font-bold text-spark-yellow mb-2">todo-events</h1>
                <p className="text-lg font-body text-white/80">Find local events wherever you are.</p>
              </div>
              
              <div className="mb-6">
                <div className="w-12 h-12 border-4 border-spark-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-xl font-display font-semibold mb-2">Loading Maps...</h2>
                <p className="font-body text-white/70">Initializing Google Maps API</p>
              </div>
              
              <button 
                onClick={() => setLoadingTimedOut(true)}
                className="bg-pin-blue/20 hover:bg-pin-blue/30 text-pin-blue border border-pin-blue/40 hover:border-pin-blue/60 px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105"
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