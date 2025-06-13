import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './EventMap/AuthContext';
import { Button } from './ui/button';
import AnalyticsDashboard from './AnalyticsDashboard';
import { 
  User, 
  Calendar, 
  Edit, 
  Trash2, 
  Eye, 
  Heart, 
  Crown, 
  Star, 
  ArrowLeft, 
  TrendingUp, 
  BarChart3, 
  Users, 
  MapPin,
  Clock,
  CheckCircle,
  Sparkles,
  CreditCard
} from 'lucide-react';
import { API_URL } from '@/config';

const AccountPage = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [userEvents, setUserEvents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('events');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    
    // Handle Stripe success/cancel redirects
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setPaymentStatus('success');
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      // Refresh user data after a short delay
      setTimeout(() => {
        fetchUserData();
      }, 1000);
    } else if (urlParams.get('cancelled') === 'true') {
      setPaymentStatus('cancelled');
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
    
    fetchUserData();
  }, [user, navigate]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // Fetch user events
      const eventsResponse = await fetch(`${API_URL}/user/events`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (eventsResponse.ok) {
        const events = await eventsResponse.json();
        setUserEvents(events);
      }

      // Fetch analytics for premium users
      if (user.role === 'premium' || user.role === 'admin') {
        try {
          const analyticsResponse = await fetch(`${API_URL}/users/analytics`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (analyticsResponse.ok) {
            const analyticsData = await analyticsResponse.json();
            setAnalytics(analyticsData);
          }
        } catch (error) {
          console.log('Analytics endpoint not available yet');
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
      const response = await fetch(`${API_URL}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setUserEvents(prev => prev.filter(event => event.id !== eventId));
      }
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleEditEvent = (event) => {
    // Navigate to edit mode - you'll need to implement this in your EventMap component
    navigate(`/?edit=${event.id}`);
  };

  const handleUpgradeToPremium = async () => {
    setUpgradeLoading(true);
    try {
      // First, test if Stripe config is available
      const configResponse = await fetch(`${API_URL}/stripe/config`);
      if (!configResponse.ok) {
        throw new Error('Stripe configuration not available');
      }
      
      const response = await fetch(`${API_URL}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: Failed to create checkout session`);
      }

      const { checkout_url } = await response.json();
      
      if (!checkout_url) {
        throw new Error('No checkout URL received from server');
      }
      
      console.log('✅ Stripe checkout session created, redirecting...');
      // Redirect to Stripe checkout
      window.location.href = checkout_url;
      
    } catch (error) {
      console.error('Error upgrading to premium:', error);
      
      let errorMessage = 'Sorry, there was an error processing your upgrade. Please try again.';
      
      if (error.message.includes('configuration not available')) {
        errorMessage = 'Payment system is not configured yet. Please contact support.';
      } else if (error.message.includes('Failed to create checkout session')) {
        errorMessage = 'Unable to create payment session. Please check your connection and try again.';
      }
      
      alert(errorMessage);
    } finally {
      setUpgradeLoading(false);
    }
  };

  const isPremium = user?.role === 'premium' || user?.role === 'admin';

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-themed-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-pin-blue/20 border-t-pin-blue rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-themed-secondary">Loading your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-themed-background">
      {/* Payment Status Messages */}
      {paymentStatus === 'success' && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 p-4 mb-4 mx-4 mt-4 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Payment Successful!</span>
          </div>
          <p className="text-sm mt-1">Welcome to TodoEvents Premium! Your account has been upgraded and you now have access to all premium features.</p>
          <button 
            onClick={() => setPaymentStatus(null)}
            className="text-sm underline mt-2 hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {paymentStatus === 'cancelled' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400 p-4 mb-4 mx-4 mt-4 rounded-lg">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">Payment Cancelled</span>
          </div>
          <p className="text-sm mt-1">No worries! You can upgrade to premium anytime. Your current account and data remain unchanged.</p>
          <button 
            onClick={() => setPaymentStatus(null)}
            className="text-sm underline mt-2 hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-themed-surface border-b border-themed">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="text-themed-secondary hover:text-themed-primary flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Back to Map</span>
              </Button>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-pin-blue rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-semibold text-themed-primary">My Account</h1>
                  <p className="text-sm text-themed-secondary truncate">{user.email}</p>
                </div>
                {isPremium && (
                  <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1 rounded-full border border-amber-500/30 flex-shrink-0">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Premium</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isPremium && (
                <div className="flex sm:hidden items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1 rounded-full border border-amber-500/30">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Premium</span>
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={logout}
                className="text-themed-secondary hover:text-themed-primary"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 overflow-hidden">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-themed-surface rounded-lg border border-themed p-4 space-y-2">
              <button
                onClick={() => setActiveTab('events')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                  activeTab === 'events' 
                    ? 'bg-pin-blue/10 text-pin-blue border border-pin-blue/20' 
                    : 'text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover'
                }`}
              >
                <Calendar className="w-4 h-4" />
                My Events
              </button>
              
              {isPremium && (
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                    activeTab === 'analytics' 
                      ? 'bg-pin-blue/10 text-pin-blue border border-pin-blue/20' 
                      : 'text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </button>
              )}
              
              {!isPremium && (
                <button
                  onClick={() => setActiveTab('premium')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                    activeTab === 'premium' 
                      ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' 
                      : 'text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover'
                  }`}
                >
                  <Crown className="w-4 h-4" />
                  Upgrade to Premium
                </button>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 min-w-0 overflow-hidden">
            {activeTab === 'events' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-themed-primary">My Events</h2>
                  <Button 
                    onClick={() => navigate('/?create=true')}
                    className="bg-pin-blue hover:bg-pin-blue-600 text-white"
                  >
                    Create New Event
                  </Button>
                </div>

                {userEvents.length === 0 ? (
                  <div className="bg-themed-surface rounded-lg border border-themed p-12 text-center">
                    <Calendar className="w-16 h-16 text-themed-tertiary mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-themed-primary mb-2">No events yet</h3>
                    <p className="text-themed-secondary mb-6">Create your first event to get started</p>
                    <Button 
                      onClick={() => navigate('/?create=true')}
                      className="bg-pin-blue hover:bg-pin-blue-600 text-white"
                    >
                      Create Your First Event
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {userEvents.map((event) => (
                      <div key={event.id} className="bg-themed-surface rounded-lg border border-themed p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-themed-primary truncate max-w-[200px] sm:max-w-none">{event.title}</h3>
                              {(isPremium || event.verified) && (
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" title="Verified Event" />
                              )}
                            </div>
                            <div className="space-y-1 text-sm text-themed-secondary">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                {new Date(event.date).toLocaleDateString()}
                              </div>
                              {event.start_time && (
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3 h-3" />
                                  {event.start_time}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3 h-3" />
                                {event.city}, {event.state}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditEvent(event)}
                              className="text-themed-secondary hover:text-themed-primary h-8 w-8 p-0"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEvent(event.id)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {isPremium && (
                          <div className="flex items-center gap-4 pt-4 border-t border-themed">
                            <div className="flex items-center gap-1 text-sm text-themed-secondary">
                              <Eye className="w-4 h-4" />
                              {event.view_count || 0} views
                            </div>
                            <div className="flex items-center gap-1 text-sm text-themed-secondary">
                              <Heart className="w-4 h-4" />
                              {event.interest_count || 0} interests
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedEvent(event)}
                              className="text-pin-blue hover:text-pin-blue-600 ml-auto"
                            >
                              View Analytics
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'analytics' && isPremium && (
              <AnalyticsDashboard 
                userEvents={userEvents} 
                user={user}
                onEventSelect={setSelectedEvent}
              />
            )}

            {activeTab === 'premium' && !isPremium && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Crown className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-themed-primary mb-2">Upgrade to Premium</h2>
                  <p className="text-lg text-themed-secondary">Unlock powerful analytics and verified event badges</p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border-2 border-gradient-to-r from-amber-200 to-orange-200 dark:border-amber-800/50 p-4 sm:p-8">
                  <div className="text-center mb-8">
                    <div className="text-4xl font-bold text-themed-primary mb-2">
                      $20
                      <span className="text-lg font-normal text-themed-secondary">/month</span>
                    </div>
                    <p className="text-themed-secondary">Everything you need to grow your events</p>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-themed-primary">Verified event badges for credibility</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-themed-primary">Detailed event analytics and insights</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-themed-primary">View counts and engagement metrics</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-themed-primary">Interest tracking and user demographics</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-themed-primary">Advanced event performance reports</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-themed-primary">Priority customer support</span>
                    </div>
                  </div>

                  <div className="bg-white/50 dark:bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/20">
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-semibold text-themed-primary">Analytics Now Available!</span>
                    </div>
                    <p className="text-themed-secondary">
                      Comprehensive marketing analytics with detailed insights, performance charts, and downloadable CSV reports 
                      are now live for premium users. Get engagement metrics, category analysis, geographic data, and more!
                    </p>
                  </div>

                  <div className="text-center">
                    <Button
                      onClick={handleUpgradeToPremium}
                      disabled={upgradeLoading}
                      className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-8 py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {upgradeLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Processing...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-5 h-5" />
                          Upgrade to Premium - $20/month
                        </div>
                      )}
                    </Button>
                    <p className="text-sm text-themed-secondary mt-3">
                      Secure payment powered by Stripe • Cancel anytime
                    </p>
                  </div>

                  {/* Testing Section */}
                  <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-3">🧪 Testing Mode</h3>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                      <p><strong>Test Card:</strong> 4242 4242 4242 4242</p>
                      <p><strong>Expiry:</strong> Any future date (e.g., 12/34)</p>
                      <p><strong>CVC:</strong> Any 3 digits (e.g., 123)</p>
                      <p><strong>ZIP:</strong> Any valid ZIP code</p>
                    </div>
                    <div className="mt-4 p-3 bg-white/50 dark:bg-white/10 rounded border">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        💡 This is running in Stripe test mode. No real charges will be made. 
                        Use the test card above to simulate a successful payment.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Analytics Modal for Premium Users */}
      {selectedEvent && isPremium && (
        <div className="fixed inset-0 bg-themed-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-themed-surface rounded-lg border border-themed max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-themed flex items-center justify-between">
              <h3 className="text-lg font-semibold text-themed-primary">{selectedEvent.title} - Analytics</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEvent(null)}
                className="text-themed-secondary hover:text-themed-primary"
              >
                ×
              </Button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-themed-surface-hover rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Eye className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-themed-primary">Views</span>
                  </div>
                  <div className="text-2xl font-bold text-themed-primary">{selectedEvent.view_count || 0}</div>
                  <div className="text-sm text-themed-secondary">Total event views</div>
                </div>
                <div className="bg-themed-surface-hover rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Heart className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-themed-primary">Interests</span>
                  </div>
                  <div className="text-2xl font-bold text-themed-primary">{selectedEvent.interest_count || 0}</div>
                  <div className="text-sm text-themed-secondary">People interested</div>
                </div>
              </div>
              
              <div className="bg-themed-surface-hover rounded-lg p-6">
                <h4 className="font-medium text-themed-primary mb-4">Event Performance Chart</h4>
                <div className="h-64 flex items-center justify-center border border-themed-tertiary rounded-lg bg-themed-surface">
                  <div className="text-center text-themed-secondary">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Event-specific analytics views coming soon</p>
                    <p className="text-sm">Visit the Analytics tab for comprehensive dashboard</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountPage;