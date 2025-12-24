// src/config.js
const isDevelopment = import.meta.env.DEV;

// Primary API URL - use environment variable or current service name
const PRIMARY_API_URL = import.meta.env.VITE_API_URL || 
  (isDevelopment ? 'http://localhost:8000' : 'https://todoevents-backend.onrender.com');

// Fallback API URLs to try if primary fails
const FALLBACK_API_URLS = [
  'https://todoevents-backend.onrender.com'
];

export const API_URL = PRIMARY_API_URL;
export const FALLBACK_URLS = FALLBACK_API_URLS;

export const fetchConfig = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
};

// Helper function to test if an API URL is working
export const testApiUrl = async (url) => {
  try {
    const response = await fetch(`${url}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    return response.ok;
  } catch (error) {
    console.log(`API test failed for ${url}:`, error.message);
    return false;
  }
};

// Function to find a working API URL
export const findWorkingApiUrl = async () => {
  console.log('Testing primary API URL:', PRIMARY_API_URL);
  
  // Test primary URL first
  if (await testApiUrl(PRIMARY_API_URL)) {
    console.log('Primary API URL is working');
    return PRIMARY_API_URL;
  }
  
  console.log('Primary API failed, testing fallbacks...');
  
  // Test fallback URLs
  for (const url of FALLBACK_API_URLS) {
    console.log('Testing fallback:', url);
    if (await testApiUrl(url)) {
      console.log('Found working fallback API:', url);
      return url;
    }
  }
  
  console.error('No working API URLs found');
  return null;
};

export default {
  API_URL,
  FALLBACK_URLS,
  fetchConfig,
  testApiUrl,
  findWorkingApiUrl,
};