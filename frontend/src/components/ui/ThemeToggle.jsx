import React, { useContext, useEffect, useState } from 'react';
import { Sun, Moon, Snowflake } from 'lucide-react';
import { ThemeContext, THEME_LIGHT, THEME_DARK, THEME_GLASS } from '../../components/ThemeContext';
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
    
    // Determine the new theme
    let newTheme;
    switch (theme) {
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
    
    console.log('ThemeToggle: switching to new theme:', newTheme);
    
    // Directly manipulate DOM in addition to context update for immediate visual feedback
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Add/remove the theme classes
    document.documentElement.classList.remove('light-mode', 'dark-mode', 'glass-mode');
    document.documentElement.classList.add(`${newTheme}-mode`);
    document.body.classList.remove('light-mode', 'dark-mode', 'glass-mode');
    document.body.classList.add(`${newTheme}-mode`);
    
    // Persist the setting in localStorage for a more consistent experience
    localStorage.setItem('theme', newTheme);
    
    // Call context toggle function
    toggleTheme();
    
    // Reset toggling state after animation
    setTimeout(() => {
      setIsToggling(false);
    }, 600);
  };

  // Get theme-specific styling and labels
  const getThemeInfo = () => {
    switch (localTheme) {
      case THEME_LIGHT:
        return {
          icon: Sun,
          label: 'Switch to dark mode',
          iconClass: 'text-amber-500',
          bgClass: 'hover:bg-amber-50 dark:hover:bg-amber-950'
        };
      case THEME_DARK:
        return {
          icon: Moon,
          label: 'Switch to glass mode',
          iconClass: 'text-indigo-400',
          bgClass: 'hover:bg-indigo-50 dark:hover:bg-indigo-950'
        };
      case THEME_GLASS:
        return {
          icon: Snowflake,
          label: 'Switch to light mode',
          iconClass: 'text-cyan-400',
          bgClass: 'hover:bg-cyan-50 dark:hover:bg-cyan-950'
        };
      default:
        return {
          icon: Sun,
          label: 'Switch theme',
          iconClass: 'text-amber-500',
          bgClass: 'hover:bg-amber-50'
        };
    }
  };

  const themeInfo = getThemeInfo();
  const IconComponent = themeInfo.icon;
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      aria-label={themeInfo.label}
      className={`relative overflow-hidden w-10 h-10 rounded-full bg-opacity-20 transition-all duration-300 ${
        themeInfo.bgClass
      } ${isToggling ? 'animate-pulse scale-105' : 'scale-100'}`}
    >
      <IconComponent 
        size={18} 
        className={`${themeInfo.iconClass} transition-all duration-300 ${
          isToggling ? 'animate-spin' : ''
        }`} 
      />
    </Button>
  );
};

export default ThemeToggle; 