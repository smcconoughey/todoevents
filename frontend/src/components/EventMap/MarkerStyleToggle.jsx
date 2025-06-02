import React from 'react';
import { Button } from '../ui/button';

const MarkerStyleToggle = ({ useIconOnly, onToggle, className = "" }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onToggle(!useIconOnly)}
      className={`h-8 w-8 p-0 bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all duration-200 ${className}`}
      title={`Switch to ${useIconOnly ? 'pin' : 'icon-only'} markers`}
    >
      {useIconOnly ? '🎯' : '📍'}
    </Button>
  );
};

export default MarkerStyleToggle; 