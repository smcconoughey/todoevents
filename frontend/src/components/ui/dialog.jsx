import React, { useEffect, useRef } from 'react';

export const Dialog = ({ open, onOpenChange, children }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={() => onOpenChange(false)}
      />
      <div 
        ref={dialogRef}
        className="relative z-50"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export const DialogContent = ({ children, className = "" }) => (
  <div className={`bg-neutral-900 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto w-[90vw] max-w-[500px] ${className}`}>
    {children}
  </div>
);

export const DialogHeader = ({ children }) => (
  <div className="p-6 border-b border-white/10">
    {children}
  </div>
);

export const DialogTitle = ({ children }) => (
  <h2 className="text-xl font-semibold text-white">
    {children}
  </h2>
);

// Add DialogClose component
export const DialogClose = ({ children, onClick, ...props }) => {
  const handleClick = (e) => {
    onClick?.(e);
    // You might want to add a way to close the dialog here
  };

  return (
    <button 
      {...props}
      onClick={handleClick}
    >
      {children}
    </button>
  );
};