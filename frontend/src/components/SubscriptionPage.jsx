import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './EventMap/AuthContext';
import { Button } from './ui/button';
import { API_URL } from '@/config';
import { 
  ArrowLeft, 
  CreditCard, 
  Calendar, 
  AlertTriangle,
  CheckCircle,
  Crown,
  Loader2
} from 'lucide-react';

const SubscriptionPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_URL}/stripe/subscription-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Subscription status error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: Failed to load subscription data`);
      }
      
      const data = await response.json();
      console.log('Subscription data received:', data);
      setSubscriptionData(data);
    } catch (err) {
      setError('Failed to load subscription data');
      console.error('Error loading subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (immediate = false) => {
    if (!confirm(immediate 
      ? 'Are you sure you want to cancel your subscription immediately? You will lose access to premium features right away.'
      : 'Are you sure you want to cancel your subscription? You will keep access until the end of your current billing period.'
    )) {
      return;
    }

    try {
      setCanceling(true);
      setError(null);
      
      const endpoint = immediate 
        ? '/stripe/cancel-subscription-immediately'
        : '/stripe/cancel-subscription';
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to cancel subscription`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Reload subscription data to show updated status
        await loadSubscriptionData();
        
        // Show success message
        alert(immediate 
          ? 'Subscription canceled immediately'
          : `Subscription marked for cancellation. You'll keep access until ${new Date(result.access_until).toLocaleDateString()}`
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to cancel subscription');
      console.error('Error canceling subscription:', err);
    } finally {
      setCanceling(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not available';
    
    try {
      const date = new Date(dateStr);
      // Check if date is valid and not epoch (1970)
      if (isNaN(date.getTime()) || date.getFullYear() < 1990) {
        return 'Not available';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Not available';
    }
  };

  const formatAmount = (amount, currency) => {
    if (!amount || amount === 0) {
      return 'Contact Support'; // For test subscriptions or pricing issues
    }
    
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency?.toUpperCase() || 'USD'
      }).format(amount / 100);
    } catch (error) {
      return `${amount / 100} ${currency?.toUpperCase() || 'USD'}`;
    }
  };

  if (!user || (user.role !== 'premium' && user.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-themed-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-themed-primary mb-4">Access Denied</h1>
          <p className="text-themed-secondary mb-6">You need a premium subscription to access this page.</p>
          <Button onClick={() => navigate('/account')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go to Account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-themed-background">
      {/* Header */}
      <div className="bg-themed-surface border-b border-themed sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-themed-secondary hover:text-themed-primary"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-themed-primary">Subscription Management</h1>
                <p className="text-sm text-themed-secondary">Manage your premium subscription</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-themed-secondary" />
            <span className="ml-2 text-themed-secondary">Loading subscription details...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </div>
            <Button 
              onClick={loadSubscriptionData} 
              variant="outline" 
              className="mt-3"
              size="sm"
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Premium Status Card */}
            <div className="bg-themed-surface border border-themed rounded-lg p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-semibold text-themed-primary">Premium Account Active</h2>
                  <p className="text-xs sm:text-sm text-themed-secondary">You have access to all premium features</p>
                </div>
              </div>
            </div>

            {/* Subscription Details */}
            {subscriptionData?.subscriptions?.map((sub, index) => (
              <div key={sub.id} className="bg-themed-surface border border-themed rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-themed-primary">Subscription Details</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    sub.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    sub.status === 'canceled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 p-3 bg-themed-background rounded-lg">
                    <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-themed-secondary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-themed-secondary">Amount</p>
                      <p className="font-medium text-themed-primary text-sm sm:text-base">
                        {formatAmount(sub.amount, sub.currency)}/month
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-themed-background rounded-lg">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-themed-secondary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-themed-secondary">Next Billing Date</p>
                      <p className="font-medium text-themed-primary text-sm sm:text-base">
                        {formatDate(sub.current_period_start)}
                      </p>
                    </div>
                  </div>
                </div>

                {sub.cancel_at_period_end && (
                  <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      <div>
                        <p className="font-medium text-orange-700 dark:text-orange-400">
                          Subscription Scheduled for Cancellation
                        </p>
                        <p className="text-sm text-orange-600 dark:text-orange-500">
                          Your subscription will end on {formatDate(sub.current_period_end)}. 
                          You'll keep access to premium features until then.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {sub.status === 'active' && !sub.cancel_at_period_end && (
                  <div className="mt-6 pt-4 border-t border-themed space-y-3">
                    <h4 className="font-medium text-themed-primary">Cancellation Options</h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={() => handleCancelSubscription(false)}
                        disabled={canceling}
                        variant="outline"
                        className="flex-1"
                      >
                        {canceling ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Calendar className="w-4 h-4 mr-2" />
                        )}
                        Cancel at Period End
                      </Button>
                      <Button
                        onClick={() => handleCancelSubscription(true)}
                        disabled={canceling}
                        variant="destructive"
                        className="flex-1"
                      >
                        {canceling ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 mr-2" />
                        )}
                        Cancel Immediately
                      </Button>
                    </div>
                    <p className="text-xs text-themed-secondary">
                      <strong>Cancel at Period End:</strong> Keep access until {formatDate(sub.current_period_start)}.<br className="hidden sm:block"/>
                      <strong>Cancel Immediately:</strong> Lose access right away, no refund for current period.
                    </p>
                  </div>
                )}
              </div>
            ))}

            {/* Help Section */}
            <div className="bg-themed-surface border border-themed rounded-lg p-6">
              <h3 className="text-lg font-semibold text-themed-primary mb-3">Need Help?</h3>
              <p className="text-themed-secondary mb-4">
                If you have questions about your subscription or need assistance, please contact our support team.
              </p>
              <Button variant="outline" onClick={() => navigate('/account')}>
                Contact Support
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPage; 