import React, { createContext, useState, useEffect } from 'react';

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
        const response = await fetch('http://127.0.0.1:8000/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          localStorage.setItem('token', token);
          setStatusMessage('Authentication successful');
        } else {
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
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || 'An error occurred');
    }
    return data;
  };

  const login = async (email, password) => {
    setError(null);
    setStatusMessage(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch('http://127.0.0.1:8000/token', {
        method: 'POST',
        body: formData
      });

      const data = await handleResponse(response);
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      setStatusMessage('Login successful');
      return true;
    } catch (error) {
      setError(error.message === 'Failed to fetch' 
        ? 'Unable to connect to server' 
        : error.message);
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
      const response = await fetch('http://127.0.0.1:8000/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          role: 'user'
        })
      });

      await handleResponse(response);
      setStatusMessage('Registration successful');
      
      // Auto login after successful registration
      return await login(email, password);
    } catch (error) {
      setError(error.message === 'Failed to fetch' 
        ? 'Unable to connect to server' 
        : error.message);
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