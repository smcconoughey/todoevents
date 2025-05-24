/**
 * Fetch with timeout and improved error handling
 * 
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds (default: 15000)
 * @returns {Promise<any>} - Parsed response data
 */
export const fetchWithTimeout = async (url, options = {}, timeout = 15000) => {
  console.log(`Making request to ${url} (attempt 1/2) with timeout ${timeout}ms`);

  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timed out')), timeout);
  });

  try {
    // Race between fetch and timeout
    const response = await Promise.race([
      fetch(url, options),
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
    // For timeout errors, try one more time
    if (error.message === 'Request timed out' && options._retryCount !== 1) {
      console.log(`Request to ${url} timed out, retrying...`);
      
      // Create new options with retry count
      const retryOptions = {
        ...options,
        _retryCount: 1
      };
      
      // Try once more with a longer timeout
      return fetchWithTimeout(url, retryOptions, timeout * 1.5);
    }
    
    // Throw the error for other cases
    console.error(`Fetch error for ${url}:`, error.message);
    throw error;
  }
}; 