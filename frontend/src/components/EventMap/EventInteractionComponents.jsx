import React, { useEffect, useState } from 'react';
import { useEventInteraction } from '../../hooks/useEventInteraction';
import { InterestButton } from './InterestButton';
import { ViewCounter } from './ViewCounter';
import { Button } from '../ui/button';
import { AlertTriangle } from 'lucide-react';

const EventInteractionComponents = ({ eventId, onReport }) => {
  const {
    interested,
    interestCount,
    viewCount,
    loading,
    toggleInterest,
    trackView,
    isInitialized
  } = useEventInteraction(eventId);
  
  const [hasError, setHasError] = useState(false);

  // Track view when component mounts (this will be batched)
  useEffect(() => {
    if (eventId && isInitialized) {
      const trackViewAsync = async () => {
        try {
          await trackView();
          setHasError(false);
        } catch (error) {
          console.error('Error tracking view:', error);
          setHasError(true);
        }
      };

      trackViewAsync();
    }
  }, [eventId, isInitialized, trackView]);

  // Show loading state during initialization
  if (!isInitialized) {
    return (
      <div className="border-t border-white/10 pt-3">
        <div className="text-xs text-themed-muted font-medium">Engagement</div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-2 text-themed-secondary text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-themed-muted border-t-themed-primary animate-spin"></div>
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 pt-3">
      <div className="text-xs text-themed-muted font-medium">
        Engagement
        {hasError && (
          <span className="ml-2 text-yellow-400 text-xs">Offline</span>
        )}
      </div>
      <div className="flex items-center gap-4 mt-2">
        <InterestButton
          interested={interested}
          interestCount={interestCount}
          loading={loading}
          onToggle={toggleInterest}
          showCount={true}
          className="text-themed-primary"
        />
        <ViewCounter 
          viewCount={viewCount} 
          size="sm" 
          alwaysShow={true}
          className="text-themed-secondary"
        />
        {onReport && (
          <Button
            variant="ghost"
            size="sm"
            className="text-white/50 hover:text-white/80 hover:bg-white/5 transition-all duration-200 text-xs px-2 py-1 h-auto"
            onClick={onReport}
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            Report
          </Button>
        )}
      </div>
    </div>
  );
};

export default EventInteractionComponents; 