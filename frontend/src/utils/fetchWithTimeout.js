/**
 * Fetch with timeout and improved error handling
 * Mobile-optimized with adaptive timeouts
 * 
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds (default: 15000)
 * @returns {Promise<any>} - Parsed response data
 */

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

export const fetchWithTimeout = async (url, options = {}, timeout = 15000) => {
  // Adjust timeout for mobile or slow connections
  let adjustedTimeout = timeout;
  if (isMobileOrSlowConnection()) {
    adjustedTimeout = Math.max(timeout * 1.5, 10000); // At least 10 seconds for mobile
  }

  const attempt = options._retryCount || 1;
  const maxAttempts = 2;
  
  console.log(`Making request to ${url} (attempt ${attempt}/${maxAttempts}) with timeout ${adjustedTimeout}ms`);

  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timed out')), adjustedTimeout);
  });

  try {
    // Add mobile-friendly headers
    const enhancedOptions = {
      ...options,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...options.headers
      }
    };

    // Race between fetch and timeout
    const response = await Promise.race([
      fetch(url, enhancedOptions),
      timeoutPromise
    ]);

    // Check if the response is ok
    if (!response.ok) {
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
    return data;
  } catch (error) {
    // For timeout errors or network errors, try one more time
    if ((error.message === 'Request timed out' || error.name === 'TypeError') && attempt < maxAttempts) {
      console.log(`Request to ${url} failed (${error.message}), retrying...`);
      
      // Wait a bit before retrying (longer for mobile)
      const waitTime = isMobileOrSlowConnection() ? 2000 : 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Create new options with retry count
      const retryOptions = {
        ...options,
        _retryCount: attempt + 1
      };
      
      // Try once more with an even longer timeout
      return fetchWithTimeout(url, retryOptions, adjustedTimeout * 1.2);
    }
    
    // Throw the error for other cases
    console.error(`Fetch error for ${url}:`, error.message);
    throw error;
  }
}; 