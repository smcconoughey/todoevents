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

  // Initialize with cached data from batched sync service (now pre-populated from events fetch)
  useEffect(() => {
    if (!eventId) {
      // Reset state when no eventId
      setInterestData({
        interested: false,
        interest_count: 0,
        loading: false
      });
      setViewData({
        view_count: 0,
        view_tracked: false
      });
      setIsInitialized(false);
      return;
    }

    const initializeData = async () => {
      try {
        console.log(`🔄 useEventInteraction initializing for eventId: ${eventId} (type: ${typeof eventId})`);
        
        // Get cached data that was populated during the main events fetch
        const cachedState = batchedSync.getEventState(eventId);
        
        console.log(`📦 Cached state for event ${eventId}:`, cachedState);
        console.log(`📦 Cache keys available:`, Array.from(batchedSync.localCache.keys()));
        
        if (cachedState) {
          console.log(`✅ Found cached data for event ${eventId}, updating state...`);
          setInterestData(prev => ({
            ...prev,
            interested: cachedState.interested,
            interest_count: cachedState.interest_count
          }));
          
          setViewData({
            view_count: cachedState.view_count,
            view_tracked: cachedState.viewTracked
          });
        } else {
          console.warn(`❌ No cached state found for event ${eventId}`);
          console.log(`🔍 Trying to find cache entry manually...`);
          // Try to find the entry manually to debug
          for (const [key, value] of batchedSync.localCache.entries()) {
            if (key == eventId || String(key) == String(eventId)) {
              console.log(`🎯 Found potential match: key=${key} (type: ${typeof key}), value:`, value);
            }
          }
        }

        // Check user's interest status if user is logged in and we haven't checked yet
        const token = localStorage.getItem('token');
        if (token && !cachedState?.interestStatusChecked) {
          const userInterestStatus = await batchedSync.checkUserInterestStatus(eventId);
          if (userInterestStatus !== null) {
            setInterestData(prev => ({
              ...prev,
              interested: userInterestStatus
            }));
          }
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing event interaction data:', error);
        setIsInitialized(true); // Still mark as initialized to prevent infinite loops
      }
    };

    // Reset initialization state and reload data for new eventId
    setIsInitialized(false);
    initializeData();
    
  }, [eventId]); // Dependency on eventId so it runs when eventId changes

  const toggleInterest = useCallback(() => {
    if (!eventId) return;
    
    setInterestData(prev => ({ ...prev, loading: true }));
    
    try {
      const result = batchedSync.toggleInterest(eventId, interestData.interested);
      
      // Update local state immediately (optimistic update)
      setInterestData({
        interested: result.interested,
        interest_count: result.interest_count,
        loading: false
      });
    } catch (error) {
      console.error('Error toggling interest:', error);
      setInterestData(prev => ({ ...prev, loading: false }));
    }
  }, [eventId, interestData.interested]);

  const trackView = useCallback(() => {
    if (!eventId || viewData.view_tracked) return;
    
    try {
      const result = batchedSync.trackView(eventId);
      
      // Ensure result is valid before using it
      if (result && typeof result === 'object') {
        setViewData({
          view_count: result.view_count || 0,
          view_tracked: result.viewTracked || true
        });
      } else {
        console.warn('Invalid result from trackView:', result);
        // Fallback to just marking as tracked
        setViewData(prev => ({
          ...prev,
          view_tracked: true
        }));
      }
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }, [eventId, viewData.view_tracked]);

  return {
    interested: interestData.interested,
    interest_count: interestData.interest_count,
    view_count: viewData.view_count,
    loading: interestData.loading,
    toggleInterest,
    trackView,
    isInitialized
  };
}; 