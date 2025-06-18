/**
 * Fetch with timeout and improved error handling
 * Mobile-optimized with adaptive timeouts and connection health monitoring
 * 
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds (default: 15000)
 * @returns {Promise<any>} - Parsed response data
 */

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
    const API_URL = import.meta.env.VITE_API_URL;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
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

export const fetchWithTimeout = async (url, options = {}, timeout = 30000) => {
  // Adjust timeout for mobile or slow connections
  let adjustedTimeout = timeout;
  if (isMobileOrSlowConnection()) {
    adjustedTimeout = Math.max(timeout * 1.5, 25000);
  }

  const attempt = options._retryCount || 1;
  const maxAttempts = 3;
  
  // Pre-flight connection health check for critical endpoints
  const isCriticalEndpoint = url.includes('/events') || url.includes('/auth');
  if (isCriticalEndpoint && attempt === 1) {
    const isHealthy = await performHealthCheck();
    if (!isHealthy && connectionHealth.consecutiveFailures > 2) {
      throw new Error('Cannot connect to API server. Please check your connection and try again.');
    }
  }
  
  console.log(`Making request to ${url} (attempt ${attempt}/${maxAttempts}) with timeout ${adjustedTimeout}ms`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), adjustedTimeout);

  try {
    const enhancedOptions = {
      ...options,
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...options.headers
      }
    };

    const response = await fetch(url, enhancedOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status >= 500) {
        connectionHealth.consecutiveFailures++;
        connectionHealth.isHealthy = false;
      }
      
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
      }

      const errorMessage = errorData.detail || errorData.message || `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Update connection health on success
    connectionHealth.isHealthy = true;
    connectionHealth.consecutiveFailures = 0;
    connectionHealth.lastSuccessTime = Date.now();
    
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    const isTimeoutError = error.name === 'AbortError' || error.message.includes('timeout');
    const isNetworkError = error.name === 'TypeError' && error.message.includes('Failed to fetch');
    
    if (isTimeoutError || isNetworkError) {
      connectionHealth.consecutiveFailures++;
      if (connectionHealth.consecutiveFailures > 2) {
        connectionHealth.isHealthy = false;
      }
    }
    
    if ((isTimeoutError || isNetworkError) && attempt < maxAttempts) {
      console.log(`Request to ${url} failed (${error.message}), retrying...`);
      
      const baseWaitTime = isMobileOrSlowConnection() ? 3000 : 2000;
      const waitTime = baseWaitTime * Math.pow(1.5, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      const retryOptions = {
        ...options,
        _retryCount: attempt + 1
      };
      
      const retryTimeout = adjustedTimeout * (1.5 + (attempt * 0.3));
      return fetchWithTimeout(url, retryOptions, retryTimeout);
    }
    
    let finalError = error;
    if (isTimeoutError) {
      finalError = new Error('Request timed out. Please check your connection and try again.');
    } else if (isNetworkError) {
      finalError = new Error('Cannot connect to API server. Please check your internet connection and try again.');
    }
    
    console.error(`Fetch error for ${url} after ${attempt} attempts:`, finalError.message);
    throw finalError;
  }
}; 

export const getConnectionHealth = () => ({ ...connectionHealth }); 