import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './EventMap/AuthContext';
import { Button } from './ui/button';
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
  Sparkles
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

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchUserData();
  }, [user, navigate]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // Fetch user events
      const eventsResponse = await fetch(`${API_URL}/events/manage`, {
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
      {/* Header */}
      <div className="bg-themed-surface border-b border-themed">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="text-themed-secondary hover:text-themed-primary"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Map
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pin-blue rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-themed-primary">My Account</h1>
                  <p className="text-sm text-themed-secondary">{user.email}</p>
                </div>
                {isPremium && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1 rounded-full border border-amber-500/30">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Premium</span>
                  </div>
                )}
              </div>
            </div>
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

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
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
          <div className="lg:col-span-3">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userEvents.map((event) => (
                      <div key={event.id} className="bg-themed-surface rounded-lg border border-themed p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-themed-primary truncate">{event.title}</h3>
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
                          <div className="flex gap-2 ml-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditEvent(event)}
                              className="text-themed-secondary hover:text-themed-primary"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEvent(event.id)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
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
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-themed-primary">Analytics Dashboard</h2>
                
                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-themed-surface rounded-lg border border-themed p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-pin-blue/10 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-pin-blue" />
                      </div>
                      <div>
                        <p className="text-sm text-themed-secondary">Total Events</p>
                        <p className="text-2xl font-semibold text-themed-primary">{userEvents.length}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-themed-surface rounded-lg border border-themed p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                        <Eye className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-themed-secondary">Total Views</p>
                        <p className="text-2xl font-semibold text-themed-primary">
                          {userEvents.reduce((sum, event) => sum + (event.view_count || 0), 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-themed-surface rounded-lg border border-themed p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                        <Heart className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm text-themed-secondary">Total Interests</p>
                        <p className="text-2xl font-semibold text-themed-primary">
                          {userEvents.reduce((sum, event) => sum + (event.interest_count || 0), 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-themed-surface rounded-lg border border-themed p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm text-themed-secondary">Avg. Views</p>
                        <p className="text-2xl font-semibold text-themed-primary">
                          {userEvents.length > 0 
                            ? Math.round(userEvents.reduce((sum, event) => sum + (event.view_count || 0), 0) / userEvents.length)
                            : 0
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Event Performance Table */}
                <div className="bg-themed-surface rounded-lg border border-themed">
                  <div className="p-6 border-b border-themed">
                    <h3 className="text-lg font-semibold text-themed-primary">Event Performance</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-themed-surface-hover">
                        <tr>
                          <th className="text-left p-4 text-sm font-medium text-themed-secondary">Event</th>
                          <th className="text-left p-4 text-sm font-medium text-themed-secondary">Date</th>
                          <th className="text-left p-4 text-sm font-medium text-themed-secondary">Views</th>
                          <th className="text-left p-4 text-sm font-medium text-themed-secondary">Interests</th>
                          <th className="text-left p-4 text-sm font-medium text-themed-secondary">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userEvents.map((event) => (
                          <tr key={event.id} className="border-t border-themed hover:bg-themed-surface-hover">
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-themed-primary">{event.title}</span>
                                {(isPremium || event.verified) && (
                                  <CheckCircle className="w-4 h-4 text-green-500" title="Verified Event" />
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-themed-secondary">
                              {new Date(event.date).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-themed-secondary">{event.view_count || 0}</td>
                            <td className="p-4 text-themed-secondary">{event.interest_count || 0}</td>
                            <td className="p-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedEvent(event)}
                                className="text-pin-blue hover:text-pin-blue-600"
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
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

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border-2 border-gradient-to-r from-amber-200 to-orange-200 dark:border-amber-800/50 p-8">
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
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <span className="font-semibold text-themed-primary">Coming Soon</span>
                    </div>
                    <p className="text-themed-secondary">
                      Premium features are currently in development. We're working hard to bring you the best 
                      event analytics and verification system. Stay tuned for updates!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Analytics Modal for Premium Users */}
      {selectedEvent && isPremium && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
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
                    <p>Detailed analytics charts coming soon</p>
                    <p className="text-sm">Premium analytics dashboard in development</p>
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