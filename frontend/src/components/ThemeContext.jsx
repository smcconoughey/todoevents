import React, { createContext, useState, useEffect, useContext } from 'react';

// Theme options
export const THEME_DARK = 'dark';
export const THEME_LIGHT = 'light';
export const THEME_GLASS = 'glass';

// Create the Theme Context
export const ThemeContext = createContext({
  theme: THEME_DARK,
  toggleTheme: () => {},
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
    
    if (savedTheme && [THEME_DARK, THEME_LIGHT, THEME_GLASS].includes(savedTheme)) {
      return savedTheme;
    }
    
    // Check system preference as fallback
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    console.log('System prefers dark mode:', isDarkMode);
    return isDarkMode ? THEME_DARK : THEME_LIGHT;
  });

  // Update the data-theme attribute and mobile meta tags when theme changes
  useEffect(() => {
    console.log('Theme changed to:', theme);
    
    // Apply theme to document element
    document.documentElement.setAttribute('data-theme', theme);
    
    // Apply additional classes to body for more styling options
    document.body.classList.remove('dark-mode', 'light-mode', 'glass-mode');
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
        [THEME_GLASS]: {
          themeColor: '#60A5FA',     // Softer blue for frost theme
          background: '#D6F3FF',     // Light blue background
          statusBar: 'default'       // Dark text on light background
        }
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

  // Cycle through light, dark, and glass themes
  const toggleTheme = () => {
    console.log('Toggle theme called, current theme:', theme);
    setTheme(prevTheme => {
      let newTheme;
      switch (prevTheme) {
        case THEME_LIGHT:
          newTheme = THEME_DARK;
          break;
        case THEME_DARK:
          newTheme = THEME_GLASS;
          break;
        case THEME_GLASS:
          newTheme = THEME_LIGHT;
          break;
        default:
          newTheme = THEME_LIGHT;
      }
      console.log('Setting new theme to:', newTheme);
      return newTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider; 