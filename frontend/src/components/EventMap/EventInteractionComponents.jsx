import React from 'react';
import InterestButton from './InterestButton';
import ViewCounter from './ViewCounter';
import { useEventInteraction } from '../../hooks/useEventInteraction';

const EventInteractionComponents = ({ eventId }) => {
  const { 
    interested, 
    interestCount, 
    viewCount, 
    loading, 
    toggleInterest, 
    trackView 
  } = useEventInteraction(eventId);

  // Track view when component mounts
  React.useEffect(() => {
    if (eventId) {
      trackView();
    }
  }, [eventId, trackView]);

  return (
    <div className="flex items-center gap-3 pt-2">
      <InterestButton
        interested={interested}
        interestCount={interestCount}
        loading={loading}
        onToggle={toggleInterest}
        size="md"
        showCount={true}
        className="text-white"
      />
      {viewCount > 0 && (
        <ViewCounter 
          viewCount={viewCount} 
          size="sm" 
          className="text-white/70"
        />
      )}
    </div>
  );
};

export default EventInteractionComponents; 