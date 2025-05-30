import React from 'react';
import { Eye } from 'lucide-react';

const ViewCounter = ({ viewCount, size = 'sm', className = '' }) => {
  if (!viewCount || viewCount === 0) return null;

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
      inline-flex items-center gap-1 text-white/50 
      ${sizeClasses[size]} 
      ${className}
    `}>
      <Eye className={`${iconSizes[size]} opacity-60`} />
      <span className="font-medium">
        {viewCount.toLocaleString()}
      </span>
    </div>
  );
};

export default ViewCounter; 