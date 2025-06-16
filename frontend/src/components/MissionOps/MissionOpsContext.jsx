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
      let errorMessage = `HTTP ${response.status}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } else {
          // If it's not JSON, get the text response
          const errorText = await response.text();
          console.error('Non-JSON error response:', errorText);
          errorMessage = `Server error: ${response.status}`;
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
        errorMessage = `Network error: ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    // For successful responses, check content type before parsing
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        const responseText = await response.text();
        console.error('Non-JSON successful response:', responseText);
        throw new Error('Expected JSON response from server');
      }
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      throw new Error('Invalid response from server');
    }
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

  // Task management functions
  const getTasks = useCallback(async (missionId) => {
    try {
      const response = await apiCall(`/missions/${missionId}/tasks`);
      return response;
    } catch (error) {
      console.error('Failed to get tasks:', error);
      throw new Error('Failed to get tasks');
    }
  }, [apiCall]);

  const createTask = useCallback(async (taskData) => {
    try {
      const response = await apiCall('/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
      });
      
      // Refresh missions to update task counts
      await loadMissions();
      
      return response;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw new Error('Failed to create task');
    }
  }, [apiCall, loadMissions]);

  const updateTask = useCallback(async (taskId, updates) => {
    try {
      const response = await apiCall(`/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      
      // Refresh missions to update task counts
      await loadMissions();
      
      return response;
    } catch (error) {
      console.error('Failed to update task:', error);
      throw new Error('Failed to update task');
    }
  }, [apiCall, loadMissions]);

  const deleteTask = useCallback(async (taskId) => {
    try {
      const response = await apiCall(`/tasks/${taskId}`, {
        method: 'DELETE',
      });
      
      // Refresh missions to update task counts
      await loadMissions();
      
      return response;
    } catch (error) {
      console.error('Failed to delete task:', error);
      throw new Error('Failed to delete task');
    }
  }, [apiCall, loadMissions]);

  // Risk management functions (placeholder for future implementation)
  const getRisks = useCallback(async (missionId) => {
    // TODO: Implement risk management
    return [];
  }, []);

  // Decision log functions (placeholder for future implementation)
  const getDecisions = useCallback(async (missionId) => {
    // TODO: Implement decision logs
    return [];
  }, []);

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

    // Decision operations
    getDecisions,

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