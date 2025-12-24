import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './components/EventMap/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
import EventMapGlass from './components/EventMap/EventMapGlass';
import HostsPage from './components/HostsPage';
import EventCreatorPage from './components/EventCreatorPage';
import FlyerPage from './components/FlyerPage';
import WelcomePopup from './components/WelcomePopup';
import RegistrationPage from './components/RegistrationPage';
import GlassSplashScreen from './components/GlassSplashScreen';
import { initGoogleMaps } from './googleMapsLoader';
import { testApiUrl } from './config';
import './index.css';

function App() {
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [shouldShowApp, setShouldShowApp] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

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
        setShowSplash(false); // Hide splash on error
      }
    };

    initializeApp();
  }, []);

  // Show splash screen first
  if (showSplash) {
    return <GlassSplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="glass-panel p-8 rounded-2xl">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full border-4 border-blue-400/20 border-t-blue-400 animate-spin mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold glass-text-primary">TodoEvents Glass</h2>
              <p className="glass-text-secondary">Connecting to server...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <div className="glass-modal p-8 max-w-md mx-4 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400 text-2xl">⚠️</span>
          </div>
            <h2 className="text-xl font-bold glass-text-primary mb-2">Connection Error</h2>
            <p className="glass-text-secondary">
            Cannot connect to the API server. Please check your connection or try again later.
          </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="glass-button-primary w-full"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!shouldShowApp) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="glass-panel p-8 rounded-2xl">
            <div className="w-16 h-16 rounded-full border-4 border-blue-400/20 border-t-blue-400 animate-spin mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold glass-text-primary mb-2">TodoEvents Glass</h2>
            <p className="text-lg glass-text-secondary mb-4">Initializing premium experience</p>
          <div className="space-y-2">
              <div className="w-48 mx-auto glass-panel-tertiary rounded-full h-2">
                <div className="bg-blue-400 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
              <p className="glass-text-tertiary text-sm">Loading Google Maps API</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HelmetProvider>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <div className="App">
          <Routes>
                <Route 
                  path="/" 
                  element={<EventMapGlass mapsLoaded={mapsLoaded} />} 
                />
                <Route 
                  path="/register" 
                  element={<RegistrationPage />} 
                />
                <Route 
                  path="/signup" 
                  element={<RegistrationPage />} 
                />
                <Route 
                  path="/events/:eventSlug" 
                  element={<EventMapGlass mapsLoaded={mapsLoaded} eventSlug={true} />} 
                />
                <Route 
                  path="/category/:category" 
                  element={<EventMapGlass mapsLoaded={mapsLoaded} presetCategory={true} />} 
                />
                <Route 
                  path="/hosts" 
                  element={<HostsPage />} 
                />
                <Route 
                  path="/create" 
                  element={<EventCreatorPage />} 
                />
                <Route 
                  path="/flyer" 
                  element={<FlyerPage />} 
                />
          </Routes>
            </div>
          </Router>
          <WelcomePopup />
        </AuthProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;