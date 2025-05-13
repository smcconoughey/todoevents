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
          setUser(userData);
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
        throw new Error(data.detail || 'An error occurred');
      }
      return data;
    } catch (e) {
      console.error("Error parsing response:", e, "Response text:", responseText);
      throw new Error("Failed to process server response");
    }
  };

  // Helper to handle API requests with timeout
  const fetchWithTimeout = async (url, options, timeoutMs = 15000) => {
    const controller = new AbortController();
    const { signal } = controller;
    
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    
    try {
      console.log(`Making request to ${url} with timeout ${timeoutMs}ms`);
      const response = await fetch(url, {
        ...options,
        signal
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        console.error(`Request to ${url} timed out after ${timeoutMs}ms`);
        throw new Error('Request timeout. The server might be busy, please try again later.');
      }
      throw error;
    }
  };

  const login = async (email, password) => {
    setError(null);
    setStatusMessage(null);
    setLoading(true);

    try {
      console.log(`Attempting login for ${email}...`);
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetchWithTimeout(
        `${API_URL}/token`, 
        {
          method: 'POST',
          body: formData
        }
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
        30000 // Increased to 30 second timeout for registration which might take longer
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
        errorMessage = 'Registration is taking longer than expected. Please try again or use a different email.';
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