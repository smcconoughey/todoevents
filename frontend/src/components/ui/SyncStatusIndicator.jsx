import React, { useState, useEffect } from 'react';
import { batchedSync } from '../../utils/batchedSync';

const SyncStatusIndicator = ({ className = '' }) => {
  const [status, setStatus] = useState({
    online: true,
    pendingViews: 0,
    pendingInterests: 0,
    hasPendingChanges: false
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      const newStatus = batchedSync.getStatus();
      setStatus(newStatus);
      
      // Show indicator when there are pending changes or offline
      setIsVisible(!newStatus.online || newStatus.hasPendingChanges);
    };

    // Initial status
    updateStatus();

    // Update status periodically
    const interval = setInterval(updateStatus, 2000);

    // Listen for online/offline events
    const handleOnline = () => updateStatus();
    const handleOffline = () => updateStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isVisible) return null;

  const getPendingText = () => {
    const parts = [];
    if (status.pendingInterests > 0) {
      parts.push(`${status.pendingInterests} interest${status.pendingInterests > 1 ? 's' : ''}`);
    }
    if (status.pendingViews > 0) {
      parts.push(`${status.pendingViews} view${status.pendingViews > 1 ? 's' : ''}`);
    }
    return parts.join(', ');
  };

  const getStatusColor = () => {
    if (!status.online) return 'bg-red-500/20 border-red-500/50 text-red-200';
    if (status.hasPendingChanges) return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200';
    return 'bg-green-500/20 border-green-500/50 text-green-200';
  };

  const getStatusIcon = () => {
    if (!status.online) return '📴';
    if (status.hasPendingChanges) return '⏳';
    return '✅';
  };

  const getStatusText = () => {
    if (!status.online) {
      return 'Offline - changes will sync when connected';
    }
    if (status.hasPendingChanges) {
      return `Syncing ${getPendingText()}...`;
    }
    return 'All changes synced';
  };

  return (
    <div className={`
      fixed bottom-4 right-4 z-50 
      px-3 py-2 rounded-lg border
      text-xs font-medium
      backdrop-blur-sm
      transition-all duration-300
      ${getStatusColor()}
      ${className}
    `}>
      <div className="flex items-center gap-2">
        <span className="text-sm">{getStatusIcon()}</span>
        <span>{getStatusText()}</span>
        {status.hasPendingChanges && (
          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
        )}
      </div>
    </div>
  );
};

export default SyncStatusIndicator; 