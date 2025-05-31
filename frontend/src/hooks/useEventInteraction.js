import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { batchedSync } from '../utils/batchedSync';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useEventInteraction = (eventId) => {
  const [interestData, setInterestData] = useState({
    interested: false,
    interest_count: 0,
    loading: false
  });
  
  const [viewData, setViewData] = useState({
    view_count: 0,
    view_tracked: false
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const initializationRef = useRef(false);
  const viewTrackedRef = useRef(false);

  // Initialize with cached data from batched sync service (now pre-populated from events fetch)
  useEffect(() => {
    if (!eventId || initializationRef.current) return;
    
    initializationRef.current = true;

    const initializeData = async () => {
      try {
        // Get cached data that was populated during the main events fetch
        const cachedState = batchedSync.getEventState(eventId);
        
        if (cachedState) {
          setInterestData(prev => ({
            ...prev,
            interested: cachedState.interested,
            interest_count: cachedState.interest_count
          }));
          
          setViewData({
            view_count: cachedState.view_count,
            view_tracked: cachedState.viewTracked
          });
          
          console.log(`📊 Loaded cached interaction data for event ${eventId}:`, {
            interest_count: cachedState.interest_count,
            view_count: cachedState.view_count
          });

          // Check user's interest status if we haven't already and user is logged in
          if (!cachedState.interestStatusChecked && localStorage.getItem('token')) {
            const isInterested = await batchedSync.checkUserInterestStatus(eventId);
            setInterestData(prev => ({
              ...prev,
              interested: isInterested
            }));
          }
        } else {
          // Fallback for events not in cache (shouldn't happen with new system)
          console.warn(`⚠️ No cached data found for event ${eventId}, using defaults`);
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing event interaction data:', error);
        setIsInitialized(true); // Still mark as initialized to allow user interaction
      }
    };

    initializeData();
  }, [eventId]);

  // Optimistic interest toggle with batched sync
  const toggleInterest = useCallback(async () => {
    if (interestData.loading || !isInitialized) return;

    // Show loading state briefly for user feedback
    setInterestData(prev => ({ ...prev, loading: true }));

    try {
      // Use batched sync for optimistic update
      const result = batchedSync.toggleInterest(eventId, interestData.interested);
      
      // Update UI immediately with optimistic result
      setInterestData({
        interested: result.interested,
        interest_count: result.interest_count,
        loading: false
      });

      console.log(`💖 Interest toggled optimistically for event ${eventId}:`, result);
      return result;
      
    } catch (error) {
      console.error('Error toggling interest:', error);
      
      // Reset loading state on error
      setInterestData(prev => ({ ...prev, loading: false }));
      return null;
    }
  }, [eventId, interestData.interested, interestData.loading, isInitialized]);

  // Optimistic view tracking with batched sync
  const trackView = useCallback(async () => {
    if (!eventId || viewTrackedRef.current) return;
    
    viewTrackedRef.current = true;

    try {
      // Use batched sync for optimistic view tracking
      const result = batchedSync.trackView(eventId);
      
      if (result) {
        setViewData({
          view_count: result.view_count,
          view_tracked: result.viewTracked
        });
        
        console.log(`👁️ View tracked optimistically for event ${eventId}:`, result);
      }
      
      return result;
      
    } catch (error) {
      console.error('Error tracking view:', error);
      viewTrackedRef.current = false; // Reset on error so it can retry
      return null;
    }
  }, [eventId]);

  return {
    // Interest data
    interested: interestData.interested,
    interestCount: interestData.interest_count,
    loading: interestData.loading,
    
    // View data
    viewCount: viewData.view_count,
    viewTracked: viewData.view_tracked,
    
    // State
    isInitialized,
    
    // Actions
    toggleInterest,
    trackView
  };
}; 