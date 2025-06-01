import React, { useEffect, useState } from 'react';
import { useEventInteraction } from '../../hooks/useEventInteraction';
import { InterestButton } from './InterestButton';
import { ViewCounter } from './ViewCounter';

const EventInteractionComponents = ({ eventId }) => {
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

  // Temporary debugging
  useEffect(() => {
    console.log(`🔍 EventInteractionComponents - eventId: ${eventId}`, {
      interested,
      interestCount, 
      viewCount,
      loading,
      isInitialized
    });
  }, [eventId, interested, interestCount, viewCount, loading, isInitialized]);

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
          <span className="ml-2 text-yellow-400 text-xs">⚠️ Offline</span>
        )}
        {/* Temporary debug display */}
        <span className="ml-2 text-blue-400 text-xs">
          Debug: V:{viewCount} I:{interestCount}
        </span>
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
      </div>
    </div>
  );
};

export default EventInteractionComponents; 