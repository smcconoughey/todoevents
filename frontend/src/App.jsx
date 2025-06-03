import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './components/EventMap/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
import EventMap from './components/EventMap';
import HostsPage from './components/HostsPage';
import EventCreatorPage from './components/EventCreatorPage';
import WelcomePopup from './components/WelcomePopup';
import { initGoogleMaps } from './googleMapsLoader';
import { testApiUrl } from './config';
import './index.css';

function App() {
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [shouldShowApp, setShouldShowApp] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);

  // Test API connectivity first
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsConnecting(true);
        
        // Test API connectivity
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        console.log('Testing API connectivity:', baseUrl);
        
        const isConnected = await testApiUrl(baseUrl);
        
        if (!isConnected) {
          throw new Error('Failed to connect to API server');
        }

        console.log('✅ API connection successful');
        
        // Initialize Google Maps
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (apiKey && apiKey !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
          try {
            await initGoogleMaps(apiKey);
            setMapsLoaded(true);
            console.log('✅ Google Maps initialized successfully');
          } catch (error) {
            console.error('❌ Google Maps initialization failed:', error);
          }
        } else {
          console.warn('⚠️ Google Maps API key not configured');
        }
        
        // Small delay for better UX
        setTimeout(() => {
          setShouldShowApp(true);
          setIsConnecting(false);
        }, 800);
        
      } catch (error) {
        console.error('❌ API connection failed:', error);
        setConnectionError(error.message);
        setIsConnecting(false);
      }
    };

    initializeApp();
  }, []);

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-spark-yellow/20 border-t-spark-yellow animate-spin mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-spark-yellow rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-themed-primary">todo-events</h2>
            <p className="text-themed-secondary">Connecting to server...</p>
          </div>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className={`bg-vibrant-magenta/10 border-b border-vibrant-magenta/20 text-themed-primary p-3 text-sm ${shouldShowApp ? '' : 'h-full flex items-center justify-center'}`}>
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-vibrant-magenta rounded-full animate-pulse"></div>
            <span className="font-medium">Connection Error</span>
          </div>
          <p className="text-themed-secondary">
            Cannot connect to the API server. Please check your connection or try again later.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-pin-blue hover:bg-pin-blue-600 text-themed-primary px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!shouldShowApp) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-950 text-themed-primary">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-4 border-spark-yellow/20 border-t-spark-yellow animate-spin mx-auto"></div>
          <h2 className="text-2xl font-display font-bold text-themed-primary">todo-events</h2>
          <p className="text-lg font-body text-themed-secondary">Find local events wherever you are.</p>
          <div className="space-y-2">
            <div className="w-48 mx-auto bg-neutral-800 rounded-full h-2">
              <div className="bg-spark-yellow h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
            <p className="font-body text-themed-secondary">Initializing Google Maps API</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<EventMap mapsLoaded={mapsLoaded} />} />
          <Route path="/hosts" element={<HostsPage />} />
          <Route path="/creators" element={<EventCreatorPage />} />
        </Routes>
        <WelcomePopup />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;