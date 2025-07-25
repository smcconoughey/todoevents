import React, { useState } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { InterestHeartLoader } from '../ui/loading-animations';

const InterestButton = ({ 
  interested, 
  interestCount, 
  loading, 
  onToggle, 
  size = 'md', 
  showCount = true,
  className = '' 
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  
  const handleClick = () => {
    if (loading) return;
    setIsAnimating(true);
    onToggle();
    // Reset animation after completion
    setTimeout(() => setIsAnimating(false), 600);
  };
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
      onClick={handleClick}
      disabled={loading}
      className={`
        inline-flex items-center gap-1.5 rounded-lg font-medium transition-all duration-300
        ${sizeClasses[size]}
        ${interested 
          ? 'bg-vibrant-magenta/20 text-vibrant-magenta border border-vibrant-magenta/30 hover:bg-vibrant-magenta/30' 
          : 'bg-white/5 text-themed-secondary border border-white/20 hover:bg-white/10 hover:text-themed-primary'
        }
        ${loading ? 'opacity-75 cursor-not-allowed' : 'hover:scale-[1.05] active:scale-[0.95]'}
        ${isAnimating ? 'animate-heart-pulse' : ''}
        ${className}
      `}
      title={interested ? 'Remove from interested' : 'Mark as interested'}
    >
      {loading ? (
        <InterestHeartLoader size={size} />
      ) : (
        <Heart 
          className={`${iconSizes[size]} transition-all duration-300 ${
            interested ? 'fill-current animate-pulse' : ''
          } ${isAnimating ? 'animate-bounce' : ''}`} 
        />
      )}
      
      {showCount && (
        <span className="font-medium">
          {interested ? 'Interested' : 'Interest'}
          <span className={`ml-1 opacity-75 transition-all duration-300 ${
            isAnimating ? 'animate-pulse' : ''
          }`}>
            ({interestCount || 0})
          </span>
        </span>
      )}
    </button>
  );
};

export { InterestButton }; 