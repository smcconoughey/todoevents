import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

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

  // Fetch event data (includes both interest and view counts)
  const fetchEventData = useCallback(async () => {
    if (!eventId) return null;
    
    try {
      const data = await fetchWithTimeout(`${API_URL}/events/${eventId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          } : {})
        }
      }, 5000);

      // Update both interest and view data from event data
      setInterestData(prev => ({
        ...prev,
        interest_count: data.interest_count || 0
      }));

      setViewData(prev => ({
        ...prev,
        view_count: data.view_count || 0
      }));

      return data;
    } catch (error) {
      console.error('Error fetching event data:', error);
      return null;
    }
  }, [eventId]);

  // Fetch current interest status
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
      }, 5000); // 5 second timeout

      return data;
    } catch (error) {
      console.error('Error fetching interest status:', error);
      return null;
    }
  }, [eventId]);

  // Toggle interest with optimistic updates
  const toggleInterest = useCallback(async () => {
    if (interestData.loading || !isInitialized) return;

    // Optimistic update
    const newInterested = !interestData.interested;
    const newCount = newInterested 
      ? interestData.interest_count + 1 
      : Math.max(0, interestData.interest_count - 1);

    setInterestData(prev => ({ 
      ...prev, 
      loading: true,
      interested: newInterested,
      interest_count: newCount
    }));

    try {
      const data = await fetchWithTimeout(`${API_URL}/events/${eventId}/interest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          } : {})
        }
      }, 5000);

      // Update with actual server response
      setInterestData(prev => ({
        ...prev,
        interested: data.interested,
        interest_count: data.interest_count,
        loading: false
      }));

      return data;
    } catch (error) {
      console.error('Error toggling interest:', error);
      // Revert optimistic update on error
      setInterestData(prev => ({
        ...prev,
        interested: interestData.interested,
        interest_count: interestData.interest_count,
        loading: false
      }));
      return null;
    }
  }, [eventId, interestData.loading, interestData.interested, interestData.interest_count, isInitialized]);

  // Track view (only once per session)
  const trackView = useCallback(async () => {
    if (!eventId || viewTrackedRef.current) return;
    
    viewTrackedRef.current = true;

    try {
      const data = await fetchWithTimeout(`${API_URL}/events/${eventId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          } : {})
        }
      }, 5000);

      // Update view data with response
      setViewData({
        view_count: data.view_count,
        view_tracked: data.view_tracked
      });

      return data;
    } catch (error) {
      console.error('Error tracking view:', error);
      viewTrackedRef.current = false; // Reset on error so it can retry
      return null;
    }
  }, [eventId]);

  // Refresh all data (for manual refresh)
  const refreshData = useCallback(async () => {
    if (!eventId) return;
    
    try {
      // Fetch both interest status and event data for complete picture
      const [interestStatusData, eventData] = await Promise.all([
        fetchInterestStatus(),
        fetchEventData()
      ]);
      
      if (interestStatusData) {
        setInterestData(prev => ({
          ...prev,
          interested: interestStatusData.interested,
          interest_count: interestStatusData.interest_count
        }));
      }

      // Event data has the most accurate view and interest counts
      if (eventData) {
        setViewData(prev => ({
          ...prev,
          view_count: eventData.view_count || 0
        }));
        
        setInterestData(prev => ({
          ...prev,
          interest_count: eventData.interest_count || prev.interest_count
        }));
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }, [eventId, fetchInterestStatus, fetchEventData]);

  // Initialize data once on mount
  useEffect(() => {
    if (!eventId || initializationRef.current) return;
    
    initializationRef.current = true;

    const initializeData = async () => {
      try {
        // Fetch both interest status and event data
        const [interestStatusData, eventData] = await Promise.all([
          fetchInterestStatus(),
          fetchEventData()
        ]);
        
        if (interestStatusData) {
          setInterestData(prev => ({
            ...prev,
            interested: interestStatusData.interested,
            interest_count: interestStatusData.interest_count
          }));
        }

        // Event data provides accurate view counts
        if (eventData) {
          setViewData({
            view_count: eventData.view_count || 0,
            view_tracked: false
          });
          
          // Also update interest count from event data if available
          setInterestData(prev => ({
            ...prev,
            interest_count: eventData.interest_count || prev.interest_count
          }));
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing event interaction data:', error);
        setIsInitialized(true); // Still mark as initialized to allow user interaction
      }
    };

    initializeData();
  }, [eventId, fetchInterestStatus, fetchEventData]);

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