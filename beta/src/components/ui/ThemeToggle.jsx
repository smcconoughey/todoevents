import React, { useContext, useEffect, useState, useRef } from 'react';
import { Sun, Moon, Map, Satellite, Settings, ChevronDown } from 'lucide-react';
import { ThemeContext, THEME_LIGHT, THEME_DARK, MAP_TYPE_ROADMAP, MAP_TYPE_SATELLITE } from '../../components/ThemeContext';
import { Button } from './button';

const ThemeSelector = () => {
  const { theme, mapType, toggleTheme, setMapType } = useContext(ThemeContext);
  const [isOpen, setIsOpen] = useState(false);
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

  const handleThemeToggle = () => {
    toggleTheme();
  };

  const handleMapTypeChange = (newMapType) => {
    setMapType(newMapType);
  };

  // Get current theme info for the main button
  const getThemeInfo = () => {
    switch (theme) {
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
  const MapIcon = mapType === MAP_TYPE_SATELLITE ? Satellite : Map;
  
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
        }`}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Main theme icon */}
          <ThemeIcon 
            size={14} 
            className={`${themeInfo.iconClass} transition-all duration-300 absolute`} 
          />
          {/* Small map indicator */}
          <MapIcon 
            size={8} 
            className="text-white/60 absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3" 
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

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-12 right-0 z-50 w-72 p-4 bg-neutral-900/95 backdrop-blur-lg rounded-xl border border-white/10 shadow-2xl">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <Settings size={16} className="text-white/70" />
              <h3 className="text-sm font-semibold text-white">Display Settings</h3>
            </div>

            {/* Theme Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/90">Appearance</span>
                <span className="text-xs text-white/60 capitalize">{theme} mode</span>
              </div>
              
              <div className="relative">
                {/* Slider Track */}
                <div className="w-full h-8 bg-white/10 rounded-full p-1 cursor-pointer" onClick={handleThemeToggle}>
                  {/* Slider Background Icons */}
                  <div className="flex items-center justify-between h-full px-2">
                    <Sun size={14} className={`transition-colors duration-300 ${theme === THEME_LIGHT ? 'text-amber-500' : 'text-white/30'}`} />
                    <Moon size={14} className={`transition-colors duration-300 ${theme === THEME_DARK ? 'text-indigo-400' : 'text-white/30'}`} />
                  </div>
                  
                  {/* Slider Thumb */}
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 ease-out ${
                    theme === THEME_LIGHT ? 'left-1' : 'left-[calc(100%-28px)]'
                  }`}>
                    <div className="w-full h-full flex items-center justify-center">
                      <ThemeIcon size={12} className="text-neutral-800" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Type Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/90">Map Style</span>
                <span className="text-xs text-white/60 capitalize">{mapType === MAP_TYPE_SATELLITE ? 'Satellite' : 'Standard'}</span>
              </div>
              
              <div className="relative">
                {/* Slider Track */}
                <div className="w-full h-8 bg-white/10 rounded-full p-1 cursor-pointer" onClick={() => handleMapTypeChange(mapType === MAP_TYPE_ROADMAP ? MAP_TYPE_SATELLITE : MAP_TYPE_ROADMAP)}>
                  {/* Slider Background Icons */}
                  <div className="flex items-center justify-between h-full px-2">
                    <Map size={14} className={`transition-colors duration-300 ${mapType === MAP_TYPE_ROADMAP ? 'text-green-400' : 'text-white/30'}`} />
                    <Satellite size={14} className={`transition-colors duration-300 ${mapType === MAP_TYPE_SATELLITE ? 'text-blue-400' : 'text-white/30'}`} />
                  </div>
                  
                  {/* Slider Thumb */}
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 ease-out ${
                    mapType === MAP_TYPE_ROADMAP ? 'left-1' : 'left-[calc(100%-28px)]'
                  }`}>
                    <div className="w-full h-full flex items-center justify-center">
                      {mapType === MAP_TYPE_ROADMAP ? (
                        <Map size={12} className="text-neutral-800" />
                      ) : (
                        <Satellite size={12} className="text-neutral-800" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Settings Info */}
            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-white/50 leading-relaxed">
                Appearance affects the overall interface. Map style changes how the map is displayed - standard shows roads and landmarks, satellite shows aerial imagery.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector; 