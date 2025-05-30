import React from 'react';
import { Heart, Loader2 } from 'lucide-react';

const InterestButton = ({ 
  interested, 
  interestCount, 
  loading, 
  onToggle, 
  size = 'md', 
  showCount = true,
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-7 px-2 text-xs',
    md: 'h-8 px-3 text-sm',
    lg: 'h-10 px-4 text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4', 
    lg: 'w-5 h-5'
  };

  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={`
        inline-flex items-center gap-1.5 rounded-lg font-medium transition-all duration-200
        ${sizeClasses[size]}
        ${interested 
          ? 'bg-vibrant-magenta/20 text-vibrant-magenta border border-vibrant-magenta/30 hover:bg-vibrant-magenta/30' 
          : 'bg-white/5 text-themed-secondary border border-white/20 hover:bg-white/10 hover:text-themed-primary'
        }
        ${loading ? 'opacity-75 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}
        ${className}
      `}
      title={interested ? 'Remove from interested' : 'Mark as interested'}
    >
      {loading ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : (
        <Heart 
          className={`${iconSizes[size]} transition-all duration-200 ${
            interested ? 'fill-current' : ''
          }`} 
        />
      )}
      
      {showCount && (
        <span className="font-medium">
          {interested ? 'Interested' : 'Interest'}
          <span className="ml-1 opacity-75">
            ({interestCount || 0})
          </span>
        </span>
      )}
    </button>
  );
};

export default InterestButton; 