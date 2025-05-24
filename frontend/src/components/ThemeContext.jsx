import React, { createContext, useState, useEffect } from 'react';

// Theme options
export const THEME_DARK = 'dark';
export const THEME_LIGHT = 'light';

// Create the Theme Context
export const ThemeContext = createContext({
  theme: THEME_DARK,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  // Initialize theme from localStorage or use system preference
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme;
    }
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? THEME_DARK
      : THEME_LIGHT;
  });

  // Update the data-theme attribute on the document element when theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(prevTheme => 
      prevTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK
    );
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider; 