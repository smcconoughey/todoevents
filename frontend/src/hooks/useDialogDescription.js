import { useState, useId } from 'react';

/**
 * Custom hook for generating consistent dialog descriptions
 * to fix accessibility warnings in Radix UI components
 */
export function useDialogDescription(providedDescription = '') {
  const generatedId = useId();
  const descriptionId = providedDescription ? undefined : `dialog-desc-${generatedId}`;
  
  return {
    descriptionId,
    descriptionProps: {
      'aria-describedby': providedDescription || descriptionId
    },
    renderDescription: (text = 'Dialog content') => {
      if (providedDescription) return null;
      return <span id={descriptionId} className="sr-only">{text}</span>;
    }
  };
} 