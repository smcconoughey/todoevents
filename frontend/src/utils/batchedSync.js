/**
 * Batched Sync Service
 * Handles optimistic UI updates and batches API calls for better performance
 */

import { fetchWithTimeout } from './fetchWithTimeout';

class BatchedSyncService {
  constructor() {
    this.pendingChanges = new Map(); // eventId -> changes
    this.viewQueue = new Set(); // Set of event IDs to track views
    this.interestQueue = new Map(); // eventId -> { action: 'add'|'remove', timestamp }
    this.localCache = new Map(); // eventId -> cached data
    this.syncInterval = null;
    this.isOnline = navigator.onLine;
    
    // Sync every 15 seconds, or when page unloads
    this.SYNC_INTERVAL = 15000; // 15 seconds
    this.MAX_RETRY_ATTEMPTS = 3;
    this.RETRY_DELAY = 2000; // 2 seconds
    
    this.initializeService();
  }

  initializeService() {
    // Load persisted data from localStorage
    this.loadPersistedData();
    
    // Set up periodic sync
    this.startPeriodicSync();
    
    // Handle online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🟢 Back online - triggering sync');
      this.syncNow();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('🔴 Gone offline - will queue changes');
    });
    
    // Sync on page unload
    window.addEventListener('beforeunload', () => {
      this.syncNow(true); // Force immediate sync
    });
    
    // Sync when page becomes visible (user switches back to tab)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.syncNow();
      }
    });
  }

  /**
   * Optimistically toggle interest and queue for sync
   */
  toggleInterest(eventId, currentState) {
    const newState = !currentState;
    const timestamp = Date.now();
    
    // 1. Immediate UI update (optimistic)
    const cachedData = this.getCachedEventData(eventId);
    if (cachedData) {
      cachedData.interested = newState;
      cachedData.interest_count += newState ? 1 : -1;
      cachedData.interest_count = Math.max(0, cachedData.interest_count);
      cachedData.lastOptimisticUpdate = timestamp;
    }
    
    // 2. Queue for server sync
    this.interestQueue.set(eventId, {
      action: newState ? 'add' : 'remove',
      timestamp,
      retryCount: 0
    });
    
    // 3. Persist to localStorage
    this.persistData();
    
    // 4. Return optimistic result immediately
    return {
      interested: newState,
      interest_count: cachedData?.interest_count || (newState ? 1 : 0),
      isOptimistic: true
    };
  }

  /**
   * Track view optimistically and queue for sync
   */
  trackView(eventId) {
    // Avoid duplicate view tracking
    if (this.viewQueue.has(eventId)) {
      return;
    }
    
    const timestamp = Date.now();
    
    // 1. Immediate UI update
    const cachedData = this.getCachedEventData(eventId);
    if (cachedData && !cachedData.viewTracked) {
      cachedData.view_count = (cachedData.view_count || 0) + 1;
      cachedData.viewTracked = true;
      cachedData.lastOptimisticUpdate = timestamp;
    }
    
    // 2. Queue for server sync
    this.viewQueue.add(eventId);
    
    // 3. Persist to localStorage
    this.persistData();
    
    return {
      view_count: cachedData?.view_count || 1,
      viewTracked: true,
      isOptimistic: true
    };
  }

  /**
   * Get cached event data with fallback
   */
  getCachedEventData(eventId) {
    if (!this.localCache.has(eventId)) {
      this.localCache.set(eventId, {
        interested: false,
        interest_count: 0,
        view_count: 0,
        viewTracked: false,
        lastSync: 0,
        lastOptimisticUpdate: 0
      });
    }
    return this.localCache.get(eventId);
  }

  /**
   * Update cache with server data
   */
  updateCache(eventId, serverData) {
    const cached = this.getCachedEventData(eventId);
    
    // Only update if server data is newer than our optimistic updates
    if (serverData.lastSync && serverData.lastSync > cached.lastOptimisticUpdate) {
      Object.assign(cached, {
        ...serverData,
        lastSync: Date.now(),
        isOptimistic: false
      });
    }
    
    return cached;
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      if (this.isOnline && this.hasPendingChanges()) {
        console.log('⏰ Periodic sync triggered');
        this.syncNow();
      }
    }, this.SYNC_INTERVAL);
  }

  /**
   * Check if there are pending changes
   */
  hasPendingChanges() {
    return this.viewQueue.size > 0 || this.interestQueue.size > 0;
  }

  /**
   * Sync now (force immediate sync)
   */
  async syncNow(isBeforeUnload = false) {
    if (!this.isOnline && !isBeforeUnload) {
      console.log('📴 Offline - skipping sync');
      return;
    }

    console.log('🔄 Starting batch sync...', {
      views: this.viewQueue.size,
      interests: this.interestQueue.size
    });

    const promises = [];

    // Sync view tracking
    if (this.viewQueue.size > 0) {
      promises.push(this.syncViewTracking());
    }

    // Sync interest changes
    if (this.interestQueue.size > 0) {
      promises.push(this.syncInterestChanges());
    }

    try {
      await Promise.allSettled(promises);
      console.log('✅ Batch sync completed');
    } catch (error) {
      console.error('❌ Batch sync failed:', error);
    }
  }

  /**
   * Sync view tracking
   */
  async syncViewTracking() {
    const viewsToSync = Array.from(this.viewQueue);
    const API_URL = import.meta.env.VITE_API_URL;
    
    for (const eventId of viewsToSync) {
      try {
        await fetchWithTimeout(`${API_URL}/events/${eventId}/view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') ? {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            } : {})
          }
        }, 10000); // 10 second timeout for batch operations

        // Remove from queue on success
        this.viewQueue.delete(eventId);
        console.log(`✅ View synced for event ${eventId}`);
        
      } catch (error) {
        console.error(`❌ Failed to sync view for event ${eventId}:`, error);
        // Keep in queue for retry, but don't spam logs
      }
    }
  }

  /**
   * Sync interest changes
   */
  async syncInterestChanges() {
    const API_URL = import.meta.env.VITE_API_URL;
    
    for (const [eventId, change] of this.interestQueue.entries()) {
      // Skip if too many retries
      if (change.retryCount >= this.MAX_RETRY_ATTEMPTS) {
        console.warn(`⚠️ Giving up on interest sync for event ${eventId} after ${this.MAX_RETRY_ATTEMPTS} attempts`);
        this.interestQueue.delete(eventId);
        continue;
      }

      try {
        const response = await fetchWithTimeout(`${API_URL}/events/${eventId}/interest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') ? {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            } : {})
          }
        }, 10000);

        // Update cache with server response
        this.updateCache(eventId, {
          interested: response.interested,
          interest_count: response.interest_count,
          lastSync: Date.now()
        });

        // Remove from queue on success
        this.interestQueue.delete(eventId);
        console.log(`✅ Interest synced for event ${eventId}:`, response);
        
      } catch (error) {
        console.error(`❌ Failed to sync interest for event ${eventId}:`, error);
        
        // Increment retry count
        change.retryCount = (change.retryCount || 0) + 1;
        
        // Exponential backoff for retries
        if (change.retryCount < this.MAX_RETRY_ATTEMPTS) {
          console.log(`🔄 Will retry interest sync for event ${eventId} (attempt ${change.retryCount + 1})`);
        }
      }
    }
  }

  /**
   * Load persisted data from localStorage
   */
  loadPersistedData() {
    try {
      const stored = localStorage.getItem('batchedSync_data');
      if (stored) {
        const data = JSON.parse(stored);
        
        // Restore queues
        if (data.viewQueue) {
          this.viewQueue = new Set(data.viewQueue);
        }
        if (data.interestQueue) {
          this.interestQueue = new Map(Object.entries(data.interestQueue));
        }
        if (data.localCache) {
          this.localCache = new Map(Object.entries(data.localCache));
        }
        
        console.log('📂 Restored batched sync data from localStorage');
      }
    } catch (error) {
      console.error('❌ Failed to load persisted sync data:', error);
    }
  }

  /**
   * Persist data to localStorage
   */
  persistData() {
    try {
      const data = {
        viewQueue: Array.from(this.viewQueue),
        interestQueue: Object.fromEntries(this.interestQueue),
        localCache: Object.fromEntries(this.localCache),
        timestamp: Date.now()
      };
      
      localStorage.setItem('batchedSync_data', JSON.stringify(data));
    } catch (error) {
      console.error('❌ Failed to persist sync data:', error);
    }
  }

  /**
   * Get current state for an event (optimistic or cached)
   */
  getEventState(eventId) {
    return this.getCachedEventData(eventId);
  }

  /**
   * Clear cache and queues (useful for logout)
   */
  clearAll() {
    this.viewQueue.clear();
    this.interestQueue.clear();
    this.localCache.clear();
    localStorage.removeItem('batchedSync_data');
    console.log('🧹 Cleared all batched sync data');
  }

  /**
   * Get sync status for debugging
   */
  getStatus() {
    return {
      online: this.isOnline,
      pendingViews: this.viewQueue.size,
      pendingInterests: this.interestQueue.size,
      cachedEvents: this.localCache.size,
      hasPendingChanges: this.hasPendingChanges()
    };
  }
}

// Create singleton instance
export const batchedSync = new BatchedSyncService();

// Export for debugging
window.batchedSync = batchedSync; 