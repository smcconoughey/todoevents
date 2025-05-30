import React, { useEffect } from 'react';
import { useEventInteraction } from '../../hooks/useEventInteraction';
import { InterestButton } from './InterestButton';
import { ViewCounter } from './ViewCounter';

const EventInteractionComponents = ({ eventId }) => {
  const {
    interested,
    interestCount,
    viewCount,
    isLoading,
    handleToggleInterest,
    refreshData
  } = useEventInteraction(eventId);

  useEffect(() => {
    if (eventId) {
      // Track view and refresh data when component mounts
      const trackViewAndRefresh = async () => {
        try {
          // Track the view
          const viewResponse = await fetch(`${import.meta.env.VITE_API_URL}/events/${eventId}/view`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          // Then refresh the data regardless of view tracking success
          await refreshData();
        } catch (error) {
          console.error('Error tracking view:', error);
          // Still refresh data even if view tracking fails
          await refreshData();
        }
      };

      trackViewAndRefresh();
    }
  }, [eventId, refreshData]);

  return (
    <div className="border-t border-white/10 pt-3">
      <div className="text-xs text-themed-muted font-medium">Engagement</div>
      <div className="flex items-center gap-4 mt-2">
        <InterestButton
          interested={interested}
          interestCount={interestCount}
          loading={isLoading}
          onToggle={handleToggleInterest}
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