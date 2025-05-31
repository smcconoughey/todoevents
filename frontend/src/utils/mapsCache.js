/**
 * Google Maps API Caching System
 * Reduces API calls by caching results locally with configurable TTL
 */

class MapsCache {
  constructor() {
    this.cache = new Map();
    this.MAX_CACHE_SIZE = 1000;
    this.DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.STATIC_MAP_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days for static maps
    this.PLACES_TTL = 24 * 60 * 60 * 1000; // 24 hours for places
    this.GEOCODING_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days for geocoding
    
    this.loadFromStorage();
    this.setupPeriodicCleanup();
  }

  /**
   * Generate a cache key from parameters
   */
  generateKey(type, params) {
    const sortedParams = Object.keys(params).sort().reduce((result, key) => {
      result[key] = params[key];
      return result;
    }, {});
    return `${type}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Get TTL based on cache type
   */
  getTTL(type) {
    switch (type) {
      case 'static_map': return this.STATIC_MAP_TTL;
      case 'places': return this.PLACES_TTL;
      case 'geocoding': return this.GEOCODING_TTL;
      default: return this.DEFAULT_TTL;
    }
  }

  /**
   * Set cache entry with TTL
   */
  set(type, params, data) {
    const key = this.generateKey(type, params);
    const ttl = this.getTTL(type);
    
    const entry = {
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttl,
      type,
      params
    };

    this.cache.set(key, entry);
    
    // Cleanup if cache is too large
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      this.cleanup();
    }
    
    this.saveToStorage();
    console.log(`📦 Cached ${type} result for key: ${key.substring(0, 50)}...`);
  }

  /**
   * Get cache entry if valid
   */
  get(type, params) {
    const key = this.generateKey(type, params);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.saveToStorage();
      return null;
    }
    
    console.log(`🎯 Cache hit for ${type}: ${key.substring(0, 50)}...`);
    return entry.data;
  }

  /**
   * Cache Google Places API results
   */
  cachePlacesResult(input, predictions) {
    this.set('places', { input }, predictions);
  }

  /**
   * Get cached Places API results
   */
  getCachedPlaces(input) {
    return this.get('places', { input });
  }

  /**
   * Cache place details
   */
  cachePlaceDetails(placeId, details) {
    this.set('place_details', { placeId }, details);
  }

  /**
   * Get cached place details
   */
  getCachedPlaceDetails(placeId) {
    return this.get('place_details', { placeId });
  }

  /**
   * Cache static map URLs
   */
  cacheStaticMap(params, url) {
    // Only cache the URL, not the actual image
    this.set('static_map', params, url);
  }

  /**
   * Get cached static map URL
   */
  getCachedStaticMap(params) {
    return this.get('static_map', params);
  }

  /**
   * Cache geocoding results
   */
  cacheGeocoding(address, result) {
    this.set('geocoding', { address: address.toLowerCase() }, result);
  }

  /**
   * Get cached geocoding result
   */
  getCachedGeocoding(address) {
    return this.get('geocoding', { address: address.toLowerCase() });
  }

  /**
   * Cache reverse geocoding results
   */
  cacheReverseGeocoding(lat, lng, result) {
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    this.set('reverse_geocoding', { coordinates: key }, result);
  }

  /**
   * Get cached reverse geocoding result
   */
  getCachedReverseGeocoding(lat, lng) {
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    return this.get('reverse_geocoding', { coordinates: key });
  }

  /**
   * Remove expired entries
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    // If still too large, remove oldest entries
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = this.cache.size - Math.floor(this.MAX_CACHE_SIZE * 0.8);
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} expired cache entries`);
      this.saveToStorage();
    }
  }

  /**
   * Save cache to localStorage
   */
  saveToStorage() {
    try {
      const cacheData = {
        version: '1.0',
        timestamp: Date.now(),
        entries: Array.from(this.cache.entries())
      };
      
      localStorage.setItem('mapsCache', JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save maps cache to localStorage:', error);
    }
  }

  /**
   * Load cache from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('mapsCache');
      if (!stored) return;
      
      const cacheData = JSON.parse(stored);
      
      // Validate version and age
      if (cacheData.version !== '1.0') {
        console.log('Maps cache version mismatch, clearing cache');
        localStorage.removeItem('mapsCache');
        return;
      }
      
      // Don't load cache older than 7 days
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - cacheData.timestamp > maxAge) {
        console.log('Maps cache too old, clearing cache');
        localStorage.removeItem('mapsCache');
        return;
      }
      
      // Restore entries
      this.cache = new Map(cacheData.entries);
      
      // Clean up expired entries
      this.cleanup();
      
      console.log(`📂 Loaded ${this.cache.size} maps cache entries from storage`);
    } catch (error) {
      console.warn('Failed to load maps cache from localStorage:', error);
      localStorage.removeItem('mapsCache');
    }
  }

  /**
   * Setup periodic cleanup
   */
  setupPeriodicCleanup() {
    // Clean up every hour
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    localStorage.removeItem('mapsCache');
    console.log('🗑️ Cleared all maps cache');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const stats = {
      total: this.cache.size,
      byType: {},
      oldestEntry: null,
      newestEntry: null
    };
    
    let oldest = Date.now();
    let newest = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      const type = entry.type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      
      if (entry.timestamp < oldest) {
        oldest = entry.timestamp;
        stats.oldestEntry = new Date(entry.timestamp);
      }
      
      if (entry.timestamp > newest) {
        newest = entry.timestamp;
        stats.newestEntry = new Date(entry.timestamp);
      }
    }
    
    return stats;
  }
}

// Create global instance
export const mapsCache = new MapsCache();

// Export cache types for easier usage
export const CACHE_TYPES = {
  PLACES: 'places',
  PLACE_DETAILS: 'place_details',
  STATIC_MAP: 'static_map',
  GEOCODING: 'geocoding',
  REVERSE_GEOCODING: 'reverse_geocoding'
};

export default mapsCache; 