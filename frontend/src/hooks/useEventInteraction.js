import { useState, useEffect, useCallback } from 'react';
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

  // Get stored interaction data from localStorage
  const getStoredInteraction = useCallback(() => {
    try {
      const stored = localStorage.getItem(`event_interaction_${eventId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error reading stored interaction:', error);
      return null;
    }
  }, [eventId]);

  // Store interaction data to localStorage
  const storeInteraction = useCallback((data) => {
    try {
      localStorage.setItem(`event_interaction_${eventId}`, JSON.stringify({
        ...data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error storing interaction:', error);
    }
  }, [eventId]);

  // Fetch current interest status
  const fetchInterestStatus = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(`${API_URL}/events/${eventId}/interest`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          } : {})
        }
      });

      setInterestData(prev => ({
        ...prev,
        interested: data.interested,
        interest_count: data.interest_count
      }));

      // Update stored data
      const stored = getStoredInteraction() || {};
      storeInteraction({
        ...stored,
        interested: data.interested,
        interest_count: data.interest_count
      });

      return data;
    } catch (error) {
      console.error('Error fetching interest status:', error);
      return null;
    }
  }, [eventId, getStoredInteraction, storeInteraction]);

  // Toggle interest
  const toggleInterest = useCallback(async () => {
    if (interestData.loading) return;

    setInterestData(prev => ({ ...prev, loading: true }));

    try {
      const data = await fetchWithTimeout(`${API_URL}/events/${eventId}/interest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          } : {})
        }
      });

      setInterestData(prev => ({
        ...prev,
        interested: data.interested,
        interest_count: data.interest_count,
        loading: false
      }));

      // Update stored data
      const stored = getStoredInteraction() || {};
      storeInteraction({
        ...stored,
        interested: data.interested,
        interest_count: data.interest_count
      });

      return data;
    } catch (error) {
      console.error('Error toggling interest:', error);
      setInterestData(prev => ({ ...prev, loading: false }));
      return null;
    }
  }, [eventId, interestData.loading, getStoredInteraction, storeInteraction]);

  // Track view
  const trackView = useCallback(async () => {
    // Check if view was already tracked recently (within 1 hour)
    const stored = getStoredInteraction();
    const oneHour = 60 * 60 * 1000;
    
    if (stored && stored.view_tracked && stored.timestamp && 
        (Date.now() - stored.timestamp) < oneHour) {
      return; // Don't track again so soon
    }

    try {
      const data = await fetchWithTimeout(`${API_URL}/events/${eventId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          } : {})
        }
      });

      setViewData({
        view_count: data.view_count,
        view_tracked: data.view_tracked
      });

      // Update stored data
      const storedData = getStoredInteraction() || {};
      storeInteraction({
        ...storedData,
        view_tracked: true,
        view_count: data.view_count
      });

      return data;
    } catch (error) {
      console.error('Error tracking view:', error);
      return null;
    }
  }, [eventId, getStoredInteraction, storeInteraction]);

  // Initialize data on mount
  useEffect(() => {
    if (!eventId) return;

    // Load from cache first
    const stored = getStoredInteraction();
    if (stored) {
      setInterestData(prev => ({
        ...prev,
        interested: stored.interested || false,
        interest_count: stored.interest_count || 0
      }));
      
      setViewData({
        view_count: stored.view_count || 0,
        view_tracked: stored.view_tracked || false
      });
    }

    // Then fetch fresh data
    fetchInterestStatus();
  }, [eventId, fetchInterestStatus, getStoredInteraction]);

  return {
    // Interest data
    interested: interestData.interested,
    interestCount: interestData.interest_count,
    interestLoading: interestData.loading,
    
    // View data
    viewCount: viewData.view_count,
    viewTracked: viewData.view_tracked,
    
    // Actions
    toggleInterest,
    trackView,
    fetchInterestStatus
  };
}; 