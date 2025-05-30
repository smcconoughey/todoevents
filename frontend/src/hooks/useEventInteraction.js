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

  // Initialize with cached data from batched sync service
  useEffect(() => {
    if (!eventId || initializationRef.current) return;
    
    initializationRef.current = true;

    const initializeData = async () => {
      try {
        // 1. Start with optimistic/cached data for instant UI
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
        }

        // 2. Fetch fresh data from server in background (less frequently)
        // Only fetch if we don't have recent cached data
        const lastSync = cachedState?.lastSync || 0;
        const shouldFetchFresh = Date.now() - lastSync > 60000; // 1 minute threshold
        
        if (shouldFetchFresh) {
          console.log(`🔄 Fetching fresh data for event ${eventId} (last sync: ${new Date(lastSync).toLocaleTimeString()})`);
          
          const [interestStatusData, eventData] = await Promise.allSettled([
            fetchInterestStatus(),
            fetchEventData()
          ]);
          
          // Update with server data if successful
          if (interestStatusData.status === 'fulfilled' && interestStatusData.value) {
            const serverData = interestStatusData.value;
            
            // Update batched sync cache
            batchedSync.updateCache(eventId, {
              interested: serverData.interested,
              interest_count: serverData.interest_count,
              lastSync: Date.now()
            });
            
            // Update UI only if not currently showing optimistic data
            if (!cachedState?.isOptimistic) {
              setInterestData(prev => ({
                ...prev,
                interested: serverData.interested,
                interest_count: serverData.interest_count
              }));
            }
          }

          if (eventData.status === 'fulfilled' && eventData.value) {
            const serverEventData = eventData.value;
            
            // Update view count from server
            setViewData(prev => ({
              ...prev,
              view_count: serverEventData.view_count || prev.view_count
            }));
            
            // Update cache with accurate interest count from event data
            batchedSync.updateCache(eventId, {
              interest_count: serverEventData.interest_count || cachedState?.interest_count || 0,
              view_count: serverEventData.view_count || 0,
              lastSync: Date.now()
            });
          }
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

  // Fetch interest status (used for periodic refresh)
  const fetchInterestStatus = useCallback(async () => {
    if (!eventId) return null;

    try {
      const data = await fetchWithTimeout(`${API_URL}/events/${eventId}/interest`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          } : {})
        }
      }, 8000); // Shorter timeout for background requests

      return data;
    } catch (error) {
      console.error('Error fetching interest status:', error);
      return null;
    }
  }, [eventId]);

  // Fetch event data (used for periodic refresh)
  const fetchEventData = useCallback(async () => {
    if (!eventId) return null;

    try {
      const data = await fetchWithTimeout(`${API_URL}/events/${eventId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }, 8000); // Shorter timeout for background requests

      return data;
    } catch (error) {
      console.error('Error fetching event data:', error);
      return null;
    }
  }, [eventId]);

  // Manual refresh (less frequent, more deliberate)
  const refreshData = useCallback(async () => {
    if (!eventId) return;
    
    console.log(`🔄 Manual refresh requested for event ${eventId}`);
    
    try {
      const [interestStatusData, eventData] = await Promise.all([
        fetchInterestStatus(),
        fetchEventData()
      ]);
      
      if (interestStatusData) {
        // Update cache and UI
        batchedSync.updateCache(eventId, {
          interested: interestStatusData.interested,
          interest_count: interestStatusData.interest_count,
          lastSync: Date.now()
        });
        
        setInterestData(prev => ({
          ...prev,
          interested: interestStatusData.interested,
          interest_count: interestStatusData.interest_count
        }));
      }

      if (eventData) {
        setViewData(prev => ({
          ...prev,
          view_count: eventData.view_count || 0
        }));
        
        // Update cache with accurate counts
        batchedSync.updateCache(eventId, {
          interest_count: eventData.interest_count || interestData.interest_count,
          view_count: eventData.view_count || 0,
          lastSync: Date.now()
        });
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }, [eventId, fetchInterestStatus, fetchEventData, interestData.interest_count]);

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
    trackView,
    fetchInterestStatus,
    refreshData
  };
}; 