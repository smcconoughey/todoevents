import React, { createContext, useState, useEffect, useContext } from 'react';

// Theme options
export const THEME_DARK = 'dark';
export const THEME_LIGHT = 'light';

// Map type options
export const MAP_TYPE_ROADMAP = 'roadmap';
export const MAP_TYPE_SATELLITE = 'satellite';

// Create the Theme Context
export const ThemeContext = createContext({
  theme: THEME_DARK,
  mapType: MAP_TYPE_ROADMAP,
  toggleTheme: () => {},
  setMapType: () => {},
});

// Custom hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Initialize theme from localStorage or use system preference
  const [theme, setTheme] = useState(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem('theme');
    console.log('Initial theme from localStorage:', savedTheme);
    
    if (savedTheme && [THEME_DARK, THEME_LIGHT].includes(savedTheme)) {
      return savedTheme;
    }
    
    // Check system preference as fallback
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    console.log('System prefers dark mode:', isDarkMode);
    return isDarkMode ? THEME_DARK : THEME_LIGHT;
  });

  // Initialize map type from localStorage
  const [mapType, setMapTypeState] = useState(() => {
    const savedMapType = localStorage.getItem('mapType');
    console.log('Initial map type from localStorage:', savedMapType);
    
    if (savedMapType && [MAP_TYPE_ROADMAP, MAP_TYPE_SATELLITE].includes(savedMapType)) {
      return savedMapType;
    }
    
    return MAP_TYPE_ROADMAP; // Default to roadmap
  });

  // Update the data-theme attribute and mobile meta tags when theme changes
  useEffect(() => {
    console.log('Theme changed to:', theme);
    
    // Apply theme to document element
    document.documentElement.setAttribute('data-theme', theme);
    
    // Apply additional classes to body for more styling options
    document.body.classList.remove('dark-mode', 'light-mode');
    document.body.classList.add(`${theme}-mode`);
    
    // Update mobile theme meta tags
    const updateMobileThemeColor = () => {
      const themeColors = {
        [THEME_LIGHT]: {
          themeColor: '#3C92FF',    // Pin blue for light theme
          background: '#FAFBFC',     // Light background
          statusBar: 'default'       // Dark text on light background
        },
        [THEME_DARK]: {
          themeColor: '#2684FF',     // Pin blue for dark theme
          background: '#0f0f0f',     // Dark background
          statusBar: 'light-content' // Light text on dark background
        },

      };

      const currentTheme = themeColors[theme] || themeColors[THEME_LIGHT];

      // Update theme-color meta tag
      let themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', currentTheme.themeColor);
      } else {
        themeColorMeta = document.createElement('meta');
        themeColorMeta.setAttribute('name', 'theme-color');
        themeColorMeta.setAttribute('content', currentTheme.themeColor);
        document.head.appendChild(themeColorMeta);
      }

      // Update iOS status bar style
      let statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (statusBarMeta) {
        statusBarMeta.setAttribute('content', currentTheme.statusBar);
      } else {
        statusBarMeta = document.createElement('meta');
        statusBarMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
        statusBarMeta.setAttribute('content', currentTheme.statusBar);
        document.head.appendChild(statusBarMeta);
      }

      console.log(`Updated mobile theme: ${currentTheme.themeColor} (${theme})`);
    };

    updateMobileThemeColor();
    
    // Store in localStorage for persistence
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Update map type in localStorage when it changes
  useEffect(() => {
    console.log('Map type changed to:', mapType);
    localStorage.setItem('mapType', mapType);
  }, [mapType]);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    console.log('Toggle theme called, current theme:', theme);
    setTheme(prevTheme => {
      const newTheme = prevTheme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
      console.log('Setting new theme to:', newTheme);
      return newTheme;
    });
  };

  // Set map type
  const setMapType = (newMapType) => {
    console.log('Setting map type to:', newMapType);
    if ([MAP_TYPE_ROADMAP, MAP_TYPE_SATELLITE].includes(newMapType)) {
      setMapTypeState(newMapType);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, mapType, toggleTheme, setMapType }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider; 