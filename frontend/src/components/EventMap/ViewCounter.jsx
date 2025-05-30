import React from 'react';
import { Eye } from 'lucide-react';

const ViewCounter = ({ viewCount, size = 'sm', className = '', alwaysShow = false }) => {
  // Only hide if viewCount is 0 and alwaysShow is false
  if (!alwaysShow && (!viewCount || viewCount === 0)) return null;
  
  // Default to 0 if viewCount is undefined/null
  const displayCount = viewCount || 0;

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div className={`
      inline-flex items-center gap-1.5 px-2 py-1 rounded-md
      bg-white/5 border border-white/10 text-themed-secondary
      ${sizeClasses[size]} 
      ${className}
    `}>
      <Eye className={`${iconSizes[size]} opacity-60`} />
      <span className="font-medium">
        {displayCount.toLocaleString()} {displayCount === 1 ? 'view' : 'views'}
      </span>
    </div>
  );
};

export default ViewCounter; 