import React, { useState, useEffect } from 'react';
import { Database, Trash2, Info, RefreshCw } from 'lucide-react';
import { mapsCache } from '@/utils/mapsCache';

const CacheManager = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = () => {
    const cacheStats = mapsCache.getStats();
    setStats(cacheStats);
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      mapsCache.clear();
      setTimeout(() => {
        loadStats();
        setIsClearing(false);
      }, 500);
    } catch (error) {
      console.error('Error clearing cache:', error);
      setIsClearing(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const estimateCacheSize = () => {
    try {
      const cacheData = localStorage.getItem('mapsCache');
      if (cacheData) {
        return new Blob([cacheData]).size;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-themed-surface border border-themed rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="p-4 border-b border-themed">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-pin-blue" />
              <h3 className="text-lg font-medium text-themed-primary">Maps Cache Manager</h3>
            </div>
            <button
              onClick={onClose}
              className="text-themed-secondary hover:text-themed-primary p-1"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Cache Overview */}
          <div className="bg-themed-surface-hover rounded-lg p-3">
            <h4 className="text-sm font-medium text-themed-primary mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Cache Overview
            </h4>
            
            {stats ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-themed-secondary">Total Entries:</span>
                  <span className="text-themed-primary font-medium">{stats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-themed-secondary">Storage Used:</span>
                  <span className="text-themed-primary font-medium">{formatBytes(estimateCacheSize())}</span>
                </div>
                {stats.oldestEntry && (
                  <div className="flex justify-between">
                    <span className="text-themed-secondary">Oldest Entry:</span>
                    <span className="text-themed-primary font-medium text-xs">
                      {stats.oldestEntry.toLocaleDateString()}
                    </span>
                  </div>
                )}
                {stats.newestEntry && (
                  <div className="flex justify-between">
                    <span className="text-themed-secondary">Latest Entry:</span>
                    <span className="text-themed-primary font-medium text-xs">
                      {stats.newestEntry.toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-themed-secondary text-sm">Loading cache statistics...</div>
            )}
          </div>

          {/* Cache Breakdown */}
          {stats && stats.byType && Object.keys(stats.byType).length > 0 && (
            <div className="bg-themed-surface-hover rounded-lg p-3">
              <h4 className="text-sm font-medium text-themed-primary mb-3">Cache Breakdown</h4>
              <div className="space-y-2">
                {Object.entries(stats.byType).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="text-themed-secondary capitalize">
                      {type.replace('_', ' ')}:
                    </span>
                    <span className="text-themed-primary font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cache Benefits */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
              API Call Savings
            </h4>
            <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
              <div>• Places searches cached for 24 hours</div>
              <div>• Static maps cached for 30 days</div>
              <div>• Geocoding results cached for 30 days</div>
              <div>• Estimated savings: {stats ? Math.max(0, stats.total - 50) : 0} API calls</div>
            </div>
          </div>

          {/* Cache Actions */}
          <div className="space-y-3">
            <button
              onClick={loadStats}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-themed-surface border border-themed rounded-md text-themed-primary hover:bg-themed-surface-hover transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Stats
            </button>

            <button
              onClick={handleClearCache}
              disabled={isClearing || !stats || stats.total === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-md text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {isClearing ? 'Clearing...' : 'Clear All Cache'}
            </button>
          </div>

          {/* Information */}
          <div className="text-xs text-themed-muted bg-themed-surface-hover rounded-lg p-3">
            <p className="mb-2">
              <strong>About Maps Cache:</strong>
            </p>
            <p>
              This cache stores Google Maps API responses locally to reduce API calls and improve performance. 
              Data is automatically cleaned up based on age and usage patterns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CacheManager; 