import React, { createContext, useState, useEffect, useContext } from 'react';

// Theme options
export const THEME_DARK = 'dark';
export const THEME_LIGHT = 'light';

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
    
    if (savedTheme) {
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
    if (theme === THEME_DARK) {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    }
    
    // Store in localStorage for persistence
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    console.log('Toggle theme called, current theme:', theme);
    setTheme(prevTheme => {
      const newTheme = prevTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
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