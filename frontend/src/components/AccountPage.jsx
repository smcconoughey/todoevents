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
  CreditCard,
  Loader2,
  AlertTriangle
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
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [loadingPremiumStatus, setLoadingPremiumStatus] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    
    loadUserData();
    loadPremiumStatus();
    
    // Check for payment success/cancel in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setPaymentStatus('success');
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('cancelled') === 'true') {
      setPaymentStatus('cancelled');
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
    
  const loadUserData = async () => {
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
      if (user.role === 'premium' || user.role === 'admin' || user.role === 'enterprise') {
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

  const loadPremiumStatus = async () => {
    if (!token) return;
    
    setLoadingPremiumStatus(true);
    try {
      const response = await fetch(`${API_URL}/users/premium-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Use backend values directly, only add fallbacks for missing fields
        const enhancedData = {
          ...data,
          // Only add fallbacks if the backend didn't provide values
          event_limit: data.event_limit !== undefined ? data.event_limit : (data.is_premium ? 10 : 0),
          current_month_events: data.current_month_events !== undefined ? data.current_month_events : 0,
          events_remaining: data.events_remaining !== undefined ? data.events_remaining : null,
          can_create_events: data.can_create_events !== undefined ? data.can_create_events : true,
          features: data.features || {
            verified_events: data.is_premium || data.is_enterprise,
            analytics: data.is_premium || data.is_enterprise,
            recurring_events: data.is_premium || data.is_enterprise,
            priority_support: data.is_premium || data.is_enterprise,
            enhanced_visibility: data.is_premium || data.is_enterprise
          }
        };
        
        setPremiumStatus(enhancedData);
      }
    } catch (error) {
      console.error('Error loading premium status:', error);
    } finally {
      setLoadingPremiumStatus(false);
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      alert('Please type "DELETE" to confirm account deletion');
      return;
    }

    setDeleteAccountLoading(true);
    try {
      const response = await fetch(`${API_URL}/user/delete-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: Failed to delete account`);
      }

      const result = await response.json();
      
      // Show success message
      alert(`Account deletion completed successfully. You will receive a confirmation email with recovery instructions. Final deletion will occur on ${new Date(result.final_deletion_date).toLocaleDateString()}.`);
      
      // Log the user out
      logout();
      navigate('/');
      
    } catch (error) {
      console.error('Error deleting account:', error);
      alert(`Failed to delete account: ${error.message}`);
    } finally {
      setDeleteAccountLoading(false);
      setShowDeleteAccountModal(false);
      setDeleteConfirmText('');
    }
  };

  const handleUpgradeToPremium = async (pricingTier = 'monthly') => {
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
        },
        body: JSON.stringify({
          pricing_tier: pricingTier
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: Failed to create checkout session`);
      }

      const { checkout_url } = await response.json();
      
      if (!checkout_url) {
        throw new Error('No checkout URL received from server');
      }
      
      console.log(`✅ Stripe ${pricingTier} checkout session created, redirecting...`);
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

  const isPremium = user?.role === 'premium' || user?.role === 'admin' || user?.role === 'enterprise';

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
                  <h2 className="text-3xl font-bold text-themed-primary mb-2">Early Access Pricing</h2>
                  <p className="text-lg text-themed-secondary">50% off to support development of upcoming features</p>
                  <div className="mt-3 px-4 py-2 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg inline-block">
                    <span className="text-green-700 dark:text-green-300 font-medium">🚀 Early Access - Limited Time</span>
                  </div>
                </div>

                {/* Pricing Tiers */}
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Monthly Premium */}
                  <div className="bg-white/10 dark:bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-white/20 p-6 relative">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold text-themed-primary mb-2">Monthly Premium</h3>
                      <div className="mb-2">
                        <span className="text-lg text-themed-secondary line-through">$40/month</span>
                        <div className="text-3xl font-bold text-themed-primary">
                      $20
                      <span className="text-lg font-normal text-themed-secondary">/month</span>
                        </div>
                      </div>
                      <p className="text-themed-secondary">Perfect for regular event creators</p>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary">10 premium events/month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary">Verified event badges</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span className="text-sm text-themed-secondary">Advanced analytics (coming soon)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span className="text-sm text-themed-secondary">AI-assisted event importing (coming soon)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary">Priority support</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleUpgradeToPremium('monthly')}
                      disabled={upgradeLoading}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                    >
                      {upgradeLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </div>
                      ) : (
                        'Get Early Access'
                      )}
                    </Button>
                    <p className="text-xs text-themed-secondary text-center mt-2">
                      Sales tax included where applicable. Pricing guaranteed for the duration of your subscription.
                    </p>
                  </div>

                  {/* Annual Premium */}
                  <div className="bg-white/10 dark:bg-white/10 backdrop-blur-sm rounded-2xl border-2 border-amber-500/50 p-6 relative">
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                        BEST VALUE
                      </span>
                    </div>
                    
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold text-themed-primary mb-2">Annual Premium</h3>
                      <div className="mb-2">
                        <span className="text-lg text-themed-secondary line-through">$400/year</span>
                        <div className="text-3xl font-bold text-themed-primary">
                          $200
                          <span className="text-lg font-normal text-themed-secondary">/year</span>
                        </div>
                      </div>
                      <p className="text-themed-secondary">Save $80 with early access annual billing</p>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary">10 premium events/month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary">Verified event badges</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span className="text-sm text-themed-secondary">Advanced analytics (coming soon)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span className="text-sm text-themed-secondary">AI-assisted event importing (coming soon)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary">Priority support</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary font-medium">2 months free!</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleUpgradeToPremium('annual')}
                      disabled={upgradeLoading}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                    >
                      {upgradeLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </div>
                      ) : (
                        'Get Early Access Annual'
                      )}
                    </Button>
                    <p className="text-xs text-themed-secondary text-center mt-2">
                      Sales tax included where applicable. Pricing guaranteed for the duration of your subscription.
                    </p>
                  </div>

                  {/* Enterprise */}
                  <div className="bg-white/10 dark:bg-white/10 backdrop-blur-sm rounded-2xl border-2 border-purple-500/50 p-6 relative">
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                        ENTERPRISE
                      </span>
                    </div>
                    
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold text-themed-primary mb-2">Enterprise</h3>
                      <div className="mb-2">
                        <span className="text-lg text-themed-secondary line-through">$1000/month</span>
                        <div className="text-3xl font-bold text-themed-primary">
                          $500
                          <span className="text-lg font-normal text-themed-secondary">/month</span>
                        </div>
                      </div>
                      <p className="text-themed-secondary">For high-volume event creators</p>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary font-medium">250 premium events/month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary">Verified event badges</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary font-medium">Enterprise Dashboard</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary">Client organization & analytics</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary">Bulk event import/export</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary">Advanced filtering & search</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span className="text-sm text-themed-secondary">Real-time performance insights</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span className="text-sm text-themed-secondary">AI-assisted event importing (coming soon)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary">Priority support</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-purple-500 flex-shrink-0" />
                        <span className="text-sm text-themed-primary font-medium">25x more events</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleUpgradeToPremium('enterprise')}
                      disabled={upgradeLoading}
                      className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
                    >
                      {upgradeLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </div>
                      ) : (
                        'Get Enterprise Early Access'
                      )}
                    </Button>
                    <p className="text-xs text-themed-secondary text-center mt-2">
                      Sales tax included where applicable. Pricing guaranteed for the duration of your subscription.
                    </p>
                  </div>
                </div>

                {/* Early Access Benefits */}
                <div className="bg-white/10 dark:bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 dark:border-white/20">
                  <h3 className="text-lg font-semibold text-themed-primary mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Why Early Access?
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm text-themed-secondary">
                    <div>
                      <p className="mb-2">
                        <strong className="text-themed-primary">Support Development:</strong> Your early access subscription helps us build the advanced features you want.
                      </p>
                      <p>
                        <strong className="text-themed-primary">Early Access Benefits:</strong> First access to new features as they're released and priority support.
                      </p>
                    </div>
                    <div>
                      <p className="mb-2">
                        <strong className="text-themed-primary">Shape the Future:</strong> Get priority input on upcoming features and improvements.
                      </p>
                      <p>
                        <strong className="text-themed-primary">First Access:</strong> Be the first to try new features as they're released.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Upcoming Features */}
                <div className="bg-white/10 dark:bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 dark:border-white/20">
                  <h3 className="text-lg font-semibold text-themed-primary mb-4">Coming Soon to Premium:</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <span className="text-themed-primary">Detailed event analytics and insights</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <span className="text-themed-primary">View counts and engagement metrics</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <span className="text-themed-primary">Interest tracking and user demographics</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <span className="text-themed-primary">Advanced event performance reports</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <span className="text-themed-primary">AI-assisted event importing</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <span className="text-themed-primary">Enhanced event visibility</span>
                    </div>
                  </div>
                </div>


              </div>
            )}

            {/* Premium Event Counter for Premium Users */}
            {isPremium && premiumStatus && (
              <div className="bg-themed-surface p-6 rounded-lg border border-themed mb-6">
                    <div className="flex items-center gap-3 mb-4">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-semibold text-themed-primary">
                    {user?.role === 'enterprise' ? 'Enterprise' : 'Premium'} Event Usage
                  </h3>
                  {user?.role === 'enterprise' && (
                    <span className="px-2 py-1 bg-purple-500 text-white text-xs font-medium rounded-full">
                      ENTERPRISE
                    </span>
                  )}
                </div>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-themed-background rounded-lg">
                    <div className="text-2xl font-bold text-themed-primary">
                      {premiumStatus.current_month_events || 0}
                    </div>
                    <div className="text-sm text-themed-secondary">Events This Month</div>
                  </div>

                  <div className="text-center p-4 bg-themed-background rounded-lg">
                    <div className="text-2xl font-bold text-amber-500">
                      {premiumStatus.event_limit || 0}
                        </div>
                    <div className="text-sm text-themed-secondary">Monthly Limit</div>
                  </div>

                  <div className="text-center p-4 bg-themed-background rounded-lg">
                    <div className="text-2xl font-bold text-green-500">
                      {premiumStatus.events_remaining || 0}
                    </div>
                    <div className="text-sm text-themed-secondary">Remaining</div>
                  </div>
                </div>
                
                {premiumStatus.events_remaining <= 2 && premiumStatus.events_remaining > 0 && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">You're running low on premium events this month!</span>
                    </div>
                  </div>
                )}
                
                {premiumStatus.events_remaining === 0 && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">You've reached your premium event limit for this month.</span>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Account Deletion Section */}
            <div className="bg-themed-surface p-6 rounded-lg border border-red-200 dark:border-red-800 mb-6">
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Danger Zone
              </h3>
              <div className="text-themed-secondary text-sm mb-4">
                <p className="mb-2">
                  You may close your account at any time from the account dashboard or by contacting support. Upon termination your data will be deleted within 30 days, except where retention is required by law.
                </p>
                <p>
                  <strong>Warning:</strong> This action will permanently delete your account and all associated data including events, analytics, and preferences. You will have 30 days to recover your account before final deletion.
                </p>
              </div>
              <Button
                onClick={() => setShowDeleteAccountModal(true)}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete My Account
              </Button>
            </div>

            {/* User Profile Section */}
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

      {/* Delete Account Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-themed-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-themed-surface rounded-lg border border-themed max-w-md w-full">
            <div className="p-6 border-b border-themed">
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Delete Account
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-700 dark:text-red-300">
                      <p className="font-semibold mb-2">This action cannot be undone!</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>All your events will be permanently deleted</li>
                        <li>Your subscription will be cancelled immediately</li>
                        <li>All analytics and data will be removed</li>
                        <li>You have 30 days to recover your account</li>
                        <li>After 30 days, deletion becomes permanent</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <p className="text-themed-secondary text-sm mb-4">
                  You will receive a confirmation email with recovery instructions. To continue creating events, you can sign up for a new account using the same email address.
                </p>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-themed-primary mb-2">
                    Type "DELETE" to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full px-3 py-2 border border-themed-tertiary rounded-lg bg-themed-background text-themed-primary placeholder-themed-secondary focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Type DELETE"
                    disabled={deleteAccountLoading}
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowDeleteAccountModal(false);
                    setDeleteConfirmText('');
                  }}
                  variant="ghost"
                  disabled={deleteAccountLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteAccount}
                  disabled={deleteAccountLoading || deleteConfirmText !== 'DELETE'}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleteAccountLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </div>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Account
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountPage;