// Privacy-friendly page visit tracking utility
import { fetchWithTimeout } from './fetchWithTimeout.js';

class PageTracker {
  constructor() {
    this.hasTrackedThisSession = new Set();
    this.apiUrl = import.meta.env.VITE_API_URL || 'https://backend-todoevents-latest.onrender.com';
  }

  async trackPageVisit(pageType, pagePath = window.location.pathname) {
    // Don't track the same page type multiple times in one session
    if (this.hasTrackedThisSession.has(pageType)) {
      return;
    }

    try {
      // Mark as tracked for this session
      this.hasTrackedThisSession.add(pageType);

      // Send tracking request
      await fetchWithTimeout(`${this.apiUrl}/api/track-visit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Include auth token if available
          ...(localStorage.getItem('token') && {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          })
        },
        body: new URLSearchParams({
          page_type: pageType,
          page_path: pagePath
        }).toString()
      }, 5000); // 5 second timeout

      console.log(`Tracked page visit: ${pageType}`);
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.debug('Page tracking failed:', error);
    }
  }

  // Convenience methods for common page types
  trackHomepage() {
    this.trackPageVisit('homepage', '/');
  }

  trackEventsList() {
    this.trackPageVisit('events_list', '/events');
  }

  trackEventDetail(eventId) {
    this.trackPageVisit('event_detail', `/events/${eventId}`);
  }

  trackAdminDashboard() {
    this.trackPageVisit('admin', '/admin');
  }

  trackEventCreation() {
    this.trackPageVisit('event_creation', '/create');
  }

  trackUserProfile() {
    this.trackPageVisit('user_profile', '/profile');
  }
}

// Create a singleton instance
const pageTracker = new PageTracker();

export default pageTracker; 