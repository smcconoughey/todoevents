import React, { useContext, useEffect, useState, useRef } from 'react';
import { Sun, Moon, Map, Satellite, Settings, ChevronDown } from 'lucide-react';
import { ThemeContext, THEME_LIGHT, THEME_DARK, MAP_TYPE_ROADMAP, MAP_TYPE_SATELLITE } from '../../components/ThemeContext';
import { Button } from './button';

const ThemeSelector = () => {
  const { theme, mapType, toggleTheme, setMapType } = useContext(ThemeContext);
  const [isOpen, setIsOpen] = useState(false);
  const [isThemeChanging, setIsThemeChanging] = useState(false);
  const [isMapTypeChanging, setIsMapTypeChanging] = useState(false);
  const [pendingTheme, setPendingTheme] = useState(null);
  const [pendingMapType, setPendingMapType] = useState(null);
  const dropdownRef = useRef(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Reset pending states when actual changes complete
  useEffect(() => {
    if (pendingTheme && theme === pendingTheme) {
      setIsThemeChanging(false);
      setPendingTheme(null);
    }
  }, [theme, pendingTheme]);

  useEffect(() => {
    if (pendingMapType && mapType === pendingMapType) {
      setIsMapTypeChanging(false);
      setPendingMapType(null);
    }
  }, [mapType, pendingMapType]);

  const handleThemeToggle = () => {
    const newTheme = theme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
    
    // Immediate visual feedback
    setIsThemeChanging(true);
    setPendingTheme(newTheme);
    
    // Add slight delay to show animation, then call actual toggle
    setTimeout(() => {
      toggleTheme();
    }, 50);
    
    // Fallback to reset loading state if change doesn't happen
    setTimeout(() => {
      setIsThemeChanging(false);
      setPendingTheme(null);
    }, 2000);
  };

  const handleMapTypeChange = (newMapType) => {
    if (newMapType === mapType) return; // Prevent unnecessary changes
    
    // Immediate visual feedback
    setIsMapTypeChanging(true);
    setPendingMapType(newMapType);
    
    // Add slight delay to show animation, then call actual change
    setTimeout(() => {
      setMapType(newMapType);
    }, 50);
    
    // Fallback to reset loading state if change doesn't happen
    setTimeout(() => {
      setIsMapTypeChanging(false);
      setPendingMapType(null);
    }, 2000);
  };

  // Get current theme info for the main button
  const getThemeInfo = () => {
    // Use pending theme for immediate feedback, fallback to actual theme
    const displayTheme = pendingTheme || theme;
    
    switch (displayTheme) {
      case THEME_LIGHT:
        return {
          icon: Sun,
          iconClass: 'text-amber-500',
        };
      case THEME_DARK:
        return {
          icon: Moon,
          iconClass: 'text-indigo-400',
        };
      default:
        return {
          icon: Sun,
          iconClass: 'text-amber-500',
        };
    }
  };

  const themeInfo = getThemeInfo();
  const ThemeIcon = themeInfo.icon;
  
  // Use pending map type for immediate feedback
  const displayMapType = pendingMapType || mapType;
  const MapIcon = displayMapType === MAP_TYPE_SATELLITE ? Satellite : Map;
  
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main Theme Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open theme settings"
        className={`relative overflow-hidden w-10 h-10 rounded-full bg-opacity-20 transition-all duration-300 hover:bg-white/10 ${
          isOpen ? 'bg-white/10 scale-105' : 'scale-100'
        } ${(isThemeChanging || isMapTypeChanging) ? 'animate-pulse' : ''}`}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Main theme icon */}
          <ThemeIcon 
            size={14} 
            className={`${themeInfo.iconClass} transition-all duration-300 absolute ${
              isThemeChanging ? 'animate-spin' : ''
            }`} 
          />
          {/* Small map indicator */}
          <MapIcon 
            size={8} 
            className={`text-white/60 absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 transition-all duration-300 ${
              isMapTypeChanging ? 'animate-bounce' : ''
            }`} 
          />
          {/* Dropdown indicator */}
          <ChevronDown 
            size={6} 
            className={`text-white/40 absolute top-0 right-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`} 
          />
        </div>
      </Button>

      {/* Dropdown Panel - Compact and Better Aligned */}
      {isOpen && (
        <div className="absolute top-12 right-0 z-50 w-56 p-3 bg-neutral-900/95 backdrop-blur-lg rounded-lg border border-white/10 shadow-2xl">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <Settings size={14} className="text-white/70" />
              <h3 className="text-sm font-medium text-white">Display</h3>
            </div>

            {/* Theme Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/90">Theme</span>
                <span className="text-xs text-white/60 flex items-center gap-1">
                  {pendingTheme ? pendingTheme : theme}
                  {isThemeChanging && (
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                  )}
                </span>
              </div>
              
              <div className="relative">
                {/* Slider Track */}
                <div 
                  className={`w-full h-7 bg-white/10 rounded-full p-0.5 cursor-pointer transition-all duration-200 ${
                    isThemeChanging ? 'bg-white/20 scale-105' : 'hover:bg-white/15'
                  }`} 
                  onClick={handleThemeToggle}
                >
                  {/* Slider Background Icons */}
                  <div className="flex items-center justify-between h-full px-2">
                    <Sun size={12} className={`transition-all duration-300 ${
                      (pendingTheme || theme) === THEME_LIGHT ? 'text-amber-500 scale-110' : 'text-white/30'
                    } ${isThemeChanging && (pendingTheme || theme) === THEME_LIGHT ? 'animate-pulse' : ''}`} />
                    <Moon size={12} className={`transition-all duration-300 ${
                      (pendingTheme || theme) === THEME_DARK ? 'text-indigo-400 scale-110' : 'text-white/30'
                    } ${isThemeChanging && (pendingTheme || theme) === THEME_DARK ? 'animate-pulse' : ''}`} />
                  </div>
                  
                  {/* Slider Thumb */}
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 ease-out ${
                    (pendingTheme || theme) === THEME_LIGHT ? 'left-0.5' : 'left-[calc(100%-26px)]'
                  } ${isThemeChanging ? 'scale-110 shadow-xl' : ''}`}>
                    <div className="w-full h-full flex items-center justify-center">
                      <ThemeIcon size={10} className={`text-neutral-800 transition-all duration-300 ${
                        isThemeChanging ? 'animate-spin' : ''
                      }`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Type Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/90">Map</span>
                <span className="text-xs text-white/60 flex items-center gap-1">
                  {(pendingMapType || mapType) === MAP_TYPE_SATELLITE ? 'Satellite' : 'Standard'}
                  {isMapTypeChanging && (
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                  )}
                </span>
              </div>
              
              <div className="relative">
                {/* Slider Track */}
                <div 
                  className={`w-full h-7 bg-white/10 rounded-full p-0.5 cursor-pointer transition-all duration-200 ${
                    isMapTypeChanging ? 'bg-white/20 scale-105' : 'hover:bg-white/15'
                  }`} 
                  onClick={() => handleMapTypeChange(mapType === MAP_TYPE_ROADMAP ? MAP_TYPE_SATELLITE : MAP_TYPE_ROADMAP)}
                >
                  {/* Slider Background Icons */}
                  <div className="flex items-center justify-between h-full px-2">
                    <Map size={12} className={`transition-all duration-300 ${
                      (pendingMapType || mapType) === MAP_TYPE_ROADMAP ? 'text-green-400 scale-110' : 'text-white/30'
                    } ${isMapTypeChanging && (pendingMapType || mapType) === MAP_TYPE_ROADMAP ? 'animate-pulse' : ''}`} />
                    <Satellite size={12} className={`transition-all duration-300 ${
                      (pendingMapType || mapType) === MAP_TYPE_SATELLITE ? 'text-blue-400 scale-110' : 'text-white/30'
                    } ${isMapTypeChanging && (pendingMapType || mapType) === MAP_TYPE_SATELLITE ? 'animate-pulse' : ''}`} />
                  </div>
                  
                  {/* Slider Thumb */}
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 ease-out ${
                    (pendingMapType || mapType) === MAP_TYPE_ROADMAP ? 'left-0.5' : 'left-[calc(100%-26px)]'
                  } ${isMapTypeChanging ? 'scale-110 shadow-xl' : ''}`}>
                    <div className="w-full h-full flex items-center justify-center">
                      {(pendingMapType || mapType) === MAP_TYPE_ROADMAP ? (
                        <Map size={10} className={`text-neutral-800 transition-all duration-300 ${
                          isMapTypeChanging ? 'animate-bounce' : ''
                        }`} />
                      ) : (
                        <Satellite size={10} className={`text-neutral-800 transition-all duration-300 ${
                          isMapTypeChanging ? 'animate-bounce' : ''
                        }`} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector; 