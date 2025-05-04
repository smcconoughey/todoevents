// src/config.js
const isDevelopment = import.meta.env.DEV;

// Use environment variable or fall back to appropriate URLs
export const API_URL = import.meta.env.VITE_API_URL || 
  (isDevelopment ? 'http://localhost:8000' : 'https://eventfinder-api.onrender.com');

export const fetchConfig = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
};

export default {
  API_URL,
  fetchConfig,
};