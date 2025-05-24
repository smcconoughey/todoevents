import React, { useContext, useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { ThemeContext, THEME_LIGHT, THEME_DARK } from '../../components/ThemeContext';
import { Button } from './button';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [localTheme, setLocalTheme] = useState(theme);
  const [isToggling, setIsToggling] = useState(false);
  
  // Keep local state in sync with context
  useEffect(() => {
    setLocalTheme(theme);
    console.log('ThemeToggle: theme from context updated to', theme);
  }, [theme]);

  const handleToggle = () => {
    console.log('ThemeToggle: button clicked, current theme:', theme);
    
    // Show visual feedback during toggle
    setIsToggling(true);
    
    // Call context toggle function
    toggleTheme();
    
    // Reset toggling state after animation
    setTimeout(() => {
      setIsToggling(false);
    }, 600);
  };

  const isDark = localTheme === THEME_DARK;
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={`relative overflow-hidden w-10 h-10 rounded-full bg-opacity-20 transition-colors ${
        isToggling ? 'animate-pulse' : ''
      }`}
    >
      <span 
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-300" 
        style={{ opacity: isDark ? 1 : 0 }}
      >
        <Sun size={18} className={`text-yellow-300 ${isDark && isToggling ? 'animate-spin' : ''}`} />
      </span>
      <span 
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-300" 
        style={{ opacity: isDark ? 0 : 1 }}
      >
        <Moon size={18} className={`text-indigo-400 ${!isDark && isToggling ? 'animate-spin' : ''}`} />
      </span>
    </Button>
  );
};

export default ThemeToggle; 