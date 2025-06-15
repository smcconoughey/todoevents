import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../EventMap/AuthContext';

const MissionOpsContext = createContext();

export const useMissionOps = () => {
  const context = useContext(MissionOpsContext);
  if (!context) {
    throw new Error('useMissionOps must be used within a MissionOpsProvider');
  }
  return context;
};

export const MissionOpsProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [missions, setMissions] = useState([]);
  const [selectedMissionId, setSelectedMissionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Helper function for API calls
  const apiCall = useCallback(async (endpoint, options = {}) => {
    const url = `${baseUrl}/missionops${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Network error' }));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }, [baseUrl, token]);

  // Load missions
  const loadMissions = useCallback(async () => {
    if (!user || !token) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await apiCall('/missions');
      setMissions(data || []);
    } catch (error) {
      console.error('Failed to load missions:', error);
      setError(error.message);
      setMissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, token, apiCall]);

  // Create mission
  const createMission = useCallback(async (missionData) => {
    try {
      const newMission = await apiCall('/missions', {
        method: 'POST',
        body: JSON.stringify(missionData),
      });

      setMissions(prev => [...prev, newMission]);
      return newMission;
    } catch (error) {
      console.error('Failed to create mission:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  // Update mission
  const updateMission = useCallback(async (missionId, updates) => {
    try {
      const updatedMission = await apiCall(`/missions/${missionId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      setMissions(prev => 
        prev.map(mission => 
          mission.id === missionId ? updatedMission : mission
        )
      );

      return updatedMission;
    } catch (error) {
      console.error('Failed to update mission:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  // Update mission position
  const updateMissionPosition = useCallback(async (missionId, position) => {
    try {
      await apiCall(`/missions/${missionId}/position`, {
        method: 'PUT',
        body: JSON.stringify(position),
      });

      setMissions(prev => 
        prev.map(mission => 
          mission.id === missionId 
            ? { ...mission, grid_x: position.grid_x, grid_y: position.grid_y }
            : mission
        )
      );
    } catch (error) {
      console.error('Failed to update mission position:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  // Delete mission
  const deleteMission = useCallback(async (missionId) => {
    try {
      await apiCall(`/missions/${missionId}`, {
        method: 'DELETE',
      });

      setMissions(prev => prev.filter(mission => mission.id !== missionId));
      
      if (selectedMissionId === missionId) {
        setSelectedMissionId(null);
      }
    } catch (error) {
      console.error('Failed to delete mission:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall, selectedMissionId]);

  // Get mission details
  const getMission = useCallback(async (missionId) => {
    try {
      return await apiCall(`/missions/${missionId}`);
    } catch (error) {
      console.error('Failed to get mission:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  // Task operations
  const getTasks = useCallback(async (missionId) => {
    try {
      return await apiCall(`/missions/${missionId}/tasks`);
    } catch (error) {
      console.error('Failed to get tasks:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  const createTask = useCallback(async (taskData) => {
    try {
      return await apiCall('/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
      });
    } catch (error) {
      console.error('Failed to create task:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  const updateTask = useCallback(async (taskId, updates) => {
    try {
      return await apiCall(`/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error('Failed to update task:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  const deleteTask = useCallback(async (taskId) => {
    try {
      await apiCall(`/tasks/${taskId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to delete task:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  // Risk operations
  const getRisks = useCallback(async (missionId) => {
    try {
      return await apiCall(`/missions/${missionId}/risks`);
    } catch (error) {
      console.error('Failed to get risks:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  const createRisk = useCallback(async (riskData) => {
    try {
      return await apiCall('/risks', {
        method: 'POST',
        body: JSON.stringify(riskData),
      });
    } catch (error) {
      console.error('Failed to create risk:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  // Decision log operations
  const getDecisions = useCallback(async (missionId) => {
    try {
      return await apiCall(`/missions/${missionId}/decisions`);
    } catch (error) {
      console.error('Failed to get decisions:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  const createDecision = useCallback(async (decisionData) => {
    try {
      return await apiCall('/decisions', {
        method: 'POST',
        body: JSON.stringify(decisionData),
      });
    } catch (error) {
      console.error('Failed to create decision:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  // Sharing operations
  const shareMission = useCallback(async (missionId, shareData) => {
    try {
      return await apiCall(`/missions/${missionId}/share`, {
        method: 'POST',
        body: JSON.stringify(shareData),
      });
    } catch (error) {
      console.error('Failed to share mission:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  const unshareMission = useCallback(async (missionId, sharedWithId) => {
    try {
      await apiCall(`/missions/${missionId}/share/${sharedWithId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to unshare mission:', error);
      setError(error.message);
      throw error;
    }
  }, [apiCall]);

  // Load missions when user changes
  useEffect(() => {
    if (user && token) {
      loadMissions();
    } else {
      setMissions([]);
      setSelectedMissionId(null);
      setIsLoading(false);
    }
  }, [user, token, loadMissions]);

  // Clear error after some time
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const value = {
    // State
    missions,
    selectedMissionId,
    isLoading,
    error,

    // Mission operations
    createMission,
    updateMission,
    updateMissionPosition,
    deleteMission,
    getMission,
    loadMissions,

    // Task operations
    getTasks,
    createTask,
    updateTask,
    deleteTask,

    // Risk operations
    getRisks,
    createRisk,

    // Decision operations
    getDecisions,
    createDecision,

    // Sharing operations
    shareMission,
    unshareMission,

    // UI state
    setSelectedMissionId,
    setError,
  };

  return (
    <MissionOpsContext.Provider value={value}>
      {children}
    </MissionOpsContext.Provider>
  );
};

export default MissionOpsProvider;