import React, { useContext } from 'react';
import { Sun, Moon } from 'lucide-react';
import { ThemeContext, THEME_LIGHT, THEME_DARK } from '../../components/ThemeContext';
import { Button } from './button';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const isDark = theme === THEME_DARK;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="relative overflow-hidden w-10 h-10 rounded-full bg-opacity-20 transition-colors"
    >
      <span className="absolute inset-0 flex items-center justify-center transition-opacity duration-300" 
        style={{ opacity: isDark ? 1 : 0 }}>
        <Sun size={18} className={`text-yellow-300 ${isDark ? 'animate-pulse' : ''}`} />
      </span>
      <span className="absolute inset-0 flex items-center justify-center transition-opacity duration-300" 
        style={{ opacity: isDark ? 0 : 1 }}>
        <Moon size={18} className={`text-indigo-400 ${!isDark ? 'animate-pulse' : ''}`} />
      </span>
    </Button>
  );
};

export default ThemeToggle; 