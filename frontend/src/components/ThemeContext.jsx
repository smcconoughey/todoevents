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

  // Update the data-theme attribute on the document element when theme changes
  useEffect(() => {
    console.log('Theme changed to:', theme);
    
    // Apply theme to document element
    document.documentElement.setAttribute('data-theme', theme);
    
    // Apply additional classes to body for more styling options
    document.body.classList.remove('dark-mode', 'light-mode', 'glass-mode');
    document.body.classList.add(`${theme}-mode`);
    
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