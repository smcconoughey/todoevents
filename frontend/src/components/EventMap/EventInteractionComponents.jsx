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
    <div className="space-y-2 pt-3 border-t border-white/10">
      <div className="text-xs text-white/50 font-medium">Engagement</div>
      <div className="flex items-center gap-3">
        <InterestButton
          interested={interested}
          interestCount={interestCount}
          loading={loading}
          onToggle={toggleInterest}
          size="md"
          showCount={true}
          className="text-white"
        />
        <ViewCounter 
          viewCount={viewCount} 
          size="md" 
          className="text-white/70"
          alwaysShow={true}
        />
      </div>
    </div>
  );
};

export default EventInteractionComponents; 