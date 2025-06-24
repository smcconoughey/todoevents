/**
 * Fetch with timeout and improved error handling
 * Mobile-optimized with adaptive timeouts and connection health monitoring
 * 
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds (default: 15000)
 * @returns {Promise<any>} - Parsed response data
 */

// Import API_URL from config to get proper fallback
import { API_URL as CONFIG_API_URL } from '../config';

// Track connection health
let connectionHealth = {
  isHealthy: true,
  consecutiveFailures: 0,
  lastSuccessTime: Date.now(),
  lastHealthCheck: 0
};

// Detect if we're on a mobile device or slow connection
const isMobileOrSlowConnection = () => {
  // Check for mobile user agent
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Check for slow connection (if supported)
  const isSlowConnection = navigator.connection && (
    navigator.connection.effectiveType === '2g' || 
    navigator.connection.effectiveType === 'slow-2g' ||
    navigator.connection.saveData === true
  );

  return isMobile || isSlowConnection;
};

// Simple health check to test API connectivity
const performHealthCheck = async () => {
  const now = Date.now();
  
  // Only check health once every 30 seconds
  if (now - connectionHealth.lastHealthCheck < 30000) {
    return connectionHealth.isHealthy;
  }
  
  try {
    // Import API_URL from config to get proper fallback instead of undefined
    const { API_URL } = await import('../config.js');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Quick 5s timeout for health check
    
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      connectionHealth.isHealthy = true;
      connectionHealth.consecutiveFailures = 0;
      connectionHealth.lastSuccessTime = now;
    } else {
      connectionHealth.isHealthy = false;
      connectionHealth.consecutiveFailures++;
    }
    
    connectionHealth.lastHealthCheck = now;
    return connectionHealth.isHealthy;
  } catch (error) {
    console.debug('Health check failed:', error.message);
    connectionHealth.isHealthy = false;
    connectionHealth.consecutiveFailures++;
    connectionHealth.lastHealthCheck = now;
    return false;
  }
};

// Get connection status message
const getConnectionStatus = () => {
  const timeSinceLastSuccess = Date.now() - connectionHealth.lastSuccessTime;
  
  if (!connectionHealth.isHealthy) {
    if (timeSinceLastSuccess > 300000) { // 5 minutes
      return 'Server appears to be offline. Please try again later.';
    } else if (connectionHealth.consecutiveFailures > 3) {
      return 'Multiple connection failures detected. Please check your internet connection.';
    } else {
      return 'Temporary connection issue. Retrying...';
    }
  }
  
  return null;
};

export const fetchWithTimeout = async (url, options = {}, timeout = 30000) => {
  // Much more aggressive timeout adjustments for mobile
  let adjustedTimeout = timeout;
  if (isMobileOrSlowConnection()) {
    // Minimum 60 seconds for mobile, triple the timeout
    adjustedTimeout = Math.max(timeout * 3, 60000);
  }

  const attempt = options._retryCount || 1;
  const maxAttempts = isMobileOrSlowConnection() ? 7 : 5; // More attempts for mobile
  
  // Pre-flight connection health check for critical endpoints
  // Temporarily disabled to prevent blocking recommendations - health check causing issues
  const isCriticalEndpoint = false; // url.includes('/events') || url.includes('/auth');
  if (isCriticalEndpoint && attempt === 1) {
    const isHealthy = await performHealthCheck();
    if (!isHealthy && connectionHealth.consecutiveFailures > 2) {
      const statusMessage = getConnectionStatus();
      throw new Error(statusMessage || 'Cannot connect to API server. Please check your connection and try again.');
    }
  }
  
  console.log(`Making request to ${url} (attempt ${attempt}/${maxAttempts}) with timeout ${adjustedTimeout}ms`);

  // Create abort controller for proper cancellation
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), adjustedTimeout);

  try {
    // Add mobile-friendly headers and abort signal
    const enhancedOptions = {
      ...options,
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        // Add mobile-specific headers
        ...(isMobileOrSlowConnection() && {
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        }),
        ...options.headers
      }
    };

    const response = await fetch(url, enhancedOptions);
    clearTimeout(timeoutId);

    // Check if the response is ok
    if (!response.ok) {
      // Update connection health on server errors
      if (response.status >= 500) {
        connectionHealth.consecutiveFailures++;
        connectionHealth.isHealthy = false;
      }
      
      // Try to parse error response
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // If parsing fails, use status text
        throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
      }

      // Use detailed error message if available
      const errorMessage = errorData.detail || errorData.message || `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    // Parse response as JSON
    const data = await response.json();
    
    // Update connection health on success
    connectionHealth.isHealthy = true;
    connectionHealth.consecutiveFailures = 0;
    connectionHealth.lastSuccessTime = Date.now();
    
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle different error types
    const isTimeoutError = error.name === 'AbortError' || error.message.includes('timeout');
    const isNetworkError = error.name === 'TypeError' && error.message.includes('Failed to fetch');
    
    // Update connection health
    if (isTimeoutError || isNetworkError) {
      connectionHealth.consecutiveFailures++;
      if (connectionHealth.consecutiveFailures > 2) {
        connectionHealth.isHealthy = false;
      }
    }
    
    // For timeout errors or network errors, try more times with longer waits
    if ((isTimeoutError || isNetworkError) && attempt < maxAttempts) {
      console.log(`Request to ${url} failed (${error.message}), retrying with longer timeout...`);
      
      // Much longer wait times for mobile with exponential backoff
      const baseWaitTime = isMobileOrSlowConnection() ? 6000 : 2000;
      const waitTime = Math.min(baseWaitTime * Math.pow(2, attempt - 1), 30000); // Cap at 30s
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Create new options with retry count
      const retryOptions = {
        ...options,
        _retryCount: attempt + 1
      };
      
      // Much more aggressive timeout increases for mobile
      const multiplier = isMobileOrSlowConnection() ? (2 + (attempt * 0.5)) : (1.5 + (attempt * 0.3));
      const retryTimeout = Math.min(adjustedTimeout * multiplier, 120000); // Cap at 2 minutes
      console.log(`Retrying with timeout: ${retryTimeout}ms (mobile: ${isMobileOrSlowConnection()})`);
      return fetchWithTimeout(url, retryOptions, retryTimeout);
    }
    
    // Provide helpful error messages based on connection health
    let finalError = error;
    if (isTimeoutError) {
      const statusMessage = getConnectionStatus();
      finalError = new Error(statusMessage || 'Request timed out. Please check your connection and try again.');
    } else if (isNetworkError) {
      finalError = new Error('Cannot connect to API server. Please check your internet connection and try again.');
    }
    
    // Throw the error for other cases
    console.error(`Fetch error for ${url} after ${attempt} attempts:`, finalError.message);
    throw finalError;
  }
}; 

// Export connection health status for UI components to use
export const getConnectionHealth = () => ({ ...connectionHealth });

// Simple fetch with timeout - bypass health check issues
export const fetchWithTimeoutSimple = async (url, options = {}, timeout = 30000) => {
  console.log(`Making simple request to ${url} with timeout ${timeout}ms`);

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Simple request to ${url} succeeded`);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`Simple request to ${url} failed:`, error.message);
    throw error;
  }
}; 