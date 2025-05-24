import React, { createContext, useState, useEffect } from 'react';
import { API_URL } from '@/config';

export const AuthContext = createContext({
  user: null,
  token: null,
  loading: false,
  error: null,
  statusMessage: null,
  login: () => {},
  logout: () => {},
  registerUser: () => {},
  clearError: () => {},
  clearStatus: () => {}
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      console.log("Auth error set:", error);
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Clear status message after 3 seconds
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        console.log("Validating token...");
        const response = await fetch(`${API_URL}/users/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser({
            ...userData,
            role: userData.role || 'user'
          });
          localStorage.setItem('token', token);
          setStatusMessage('Authentication successful');
          console.log("Token validation successful");
        } else {
          console.error("Token validation failed:", response.status);
          throw new Error('Session expired. Please login again.');
        }
      } catch (error) {
        console.error('Token validation error:', error);
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleResponse = async (response) => {
    let responseText;
    try {
      responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};
      
      if (!response.ok) {
        console.error("API error response:", response.status, data);
        
        // Handle specific status codes
        switch (response.status) {
          case 400:
            throw new Error(data.detail || 'Invalid request');
          case 401:
            throw new Error('Invalid credentials');
          case 403:
            throw new Error('Permission denied');
          case 408:
            throw new Error('Request timeout. The server is busy, please try again later.');
          case 429:
            throw new Error('Too many requests. Please try again later.');
          case 500:
            throw new Error('Internal server error. Please try again later.');
          case 503:
            throw new Error('Service temporarily unavailable. Please try again later.');
          default:
            throw new Error(data.detail || 'An error occurred');
        }
      }
      return data;
    } catch (e) {
      console.error("Error parsing response:", e, "Response text:", responseText);
      if (e.message.includes('JSON')) {
        throw new Error("Failed to process server response");
      }
      throw e;
    }
  };

  // Helper to handle API requests with timeout and retry
  const fetchWithTimeout = async (url, options, timeoutMs = 15000, maxRetries = 1) => {
    // Create a timeout promise that rejects after specified time
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Request timeout. The server might be busy, please try again later.'));
      }, timeoutMs);
    });

    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Making request to ${url} (attempt ${attempt + 1}/${maxRetries + 1}) with timeout ${timeoutMs}ms`);
        
        // Use Promise.race to compete between the fetch and timeout
        const response = await Promise.race([
          fetch(url, options),
          timeoutPromise
        ]);
        
        return response;
      } catch (error) {
        lastError = error;
        
        if (error.message.includes('timeout')) {
          console.error(`Request to ${url} timed out after ${timeoutMs}ms`);
          if (attempt < maxRetries) {
            console.log(`Retrying after timeout (attempt ${attempt + 1}/${maxRetries})...`);
            // Wait briefly before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        
        if (attempt < maxRetries) {
          console.log(`Retrying after error: ${error.message} (attempt ${attempt + 1}/${maxRetries})...`);
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  };

  // Check server health before important operations
  const checkServerHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (!response.ok) {
        console.error("Server health check failed", response.status);
        return false;
      }
      
      const data = await response.json();
      console.log("Server health:", data);
      
      if (data.status !== "healthy") {
        console.warn("Server health degraded:", data);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error checking server health:", error);
      return false;
    }
  };

  const login = async (email, password) => {
    setError(null);
    setStatusMessage(null);
    setLoading(true);

    try {
      console.log(`Attempting login for ${email}...`);
      
      // Check server health first
      const isHealthy = await checkServerHealth();
      if (!isHealthy) {
        console.warn("Server health check failed before login");
      }
      
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetchWithTimeout(
        `${API_URL}/token`, 
        {
          method: 'POST',
          body: formData
        },
        15000,  // 15 second timeout
        1       // 1 retry
      );

      const data = await handleResponse(response);
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      setStatusMessage('Login successful');
      console.log("Login successful");
      return true;
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage = error.message === 'Failed to fetch' 
        ? 'Unable to connect to server. Please check your internet connection.' 
        : error.message;
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async (email, password) => {
    setError(null);
    setStatusMessage(null);
    setLoading(true);

    try {
      console.log(`Attempting registration for ${email}...`);
      
      // Check server health first
      const isHealthy = await checkServerHealth();
      if (!isHealthy) {
        console.warn("Server health check failed before registration");
      }
      
      // Use the fetchWithTimeout helper with a 30 second timeout for registration
      const response = await fetchWithTimeout(
        `${API_URL}/users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            role: 'user'
          })
        },
        30000, // Increased to 30 second timeout for registration which might take longer
        2      // 2 retries for registration
      );

      await handleResponse(response);
      setStatusMessage('Registration successful');
      console.log("Registration successful");
      
      // Auto login after successful registration
      return await login(email, password);
    } catch (error) {
      console.error("Registration error:", error);
      let errorMessage;
      
      if (error.message === 'Failed to fetch') {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Registration is taking longer than expected. The server might be busy, please try again later.';
      } else {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    setStatusMessage('Logged out successfully');
  };

  const clearError = () => setError(null);
  const clearStatus = () => setStatusMessage(null);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      error,
      statusMessage,
      login,
      logout,
      registerUser,
      clearError,
      clearStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
};