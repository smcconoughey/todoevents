import React from 'react';
import { Button } from '../ui/button';

const MarkerStyleToggle = ({ useIconOnly, onToggle, className = "" }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-white/70">Marker Style:</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="h-8 px-3 text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all duration-200"
        title={`Switch to ${useIconOnly ? 'pin' : 'icon-only'} markers`}
      >
        {useIconOnly ? '🎯 Icons Only' : '📍 Diamond Pins'}
      </Button>
    </div>
  );
};

export default MarkerStyleToggle; 