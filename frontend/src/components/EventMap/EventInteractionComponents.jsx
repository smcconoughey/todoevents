import React, { useEffect, useState } from 'react';
import { useEventInteraction } from '../../hooks/useEventInteraction';
import { InterestButton } from './InterestButton';
import { ViewCounter } from './ViewCounter';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

const EventInteractionComponents = ({ eventId }) => {
  const {
    interested,
    interestCount,
    viewCount,
    loading,
    toggleInterest,
    refreshData
  } = useEventInteraction(eventId);
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (eventId) {
      // Track view and refresh data when component mounts
      const trackViewAndRefresh = async () => {
        setIsInitializing(true);
        setHasError(false);
        
        try {
          // Track the view using mobile-optimized fetch
          await fetchWithTimeout(`${import.meta.env.VITE_API_URL}/events/${eventId}/view`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(localStorage.getItem('token') ? {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              } : {})
            },
          }, 12000); // 12 second timeout for mobile

          // Then refresh the data regardless of view tracking success
          await refreshData();
        } catch (error) {
          console.error('Error tracking view or refreshing data:', error);
          setHasError(true);
          
          // Still try to refresh data even if view tracking fails
          try {
            await refreshData();
          } catch (refreshError) {
            console.error('Error refreshing data after view tracking failure:', refreshError);
          }
        } finally {
          setIsInitializing(false);
        }
      };

      trackViewAndRefresh();
    }
  }, [eventId, refreshData]);

  // Show loading state during initialization on mobile
  if (isInitializing) {
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

  // Show retry option if there's an error
  const handleRetry = async () => {
    setHasError(false);
    setIsInitializing(true);
    
    try {
      await refreshData();
    } catch (error) {
      console.error('Error retrying data refresh:', error);
      setHasError(true);
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="border-t border-white/10 pt-3">
      <div className="text-xs text-themed-muted font-medium">Engagement</div>
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
        
        {/* Show retry button on mobile if there's an error */}
        {hasError && (
          <button
            onClick={handleRetry}
            className="text-xs text-themed-muted hover:text-themed-secondary px-2 py-1 rounded border border-themed-muted hover:border-themed-secondary transition-colors"
            aria-label="Retry loading engagement data"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export default EventInteractionComponents; 