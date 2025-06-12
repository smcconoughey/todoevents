import React, { useState, useEffect } from 'react';
import { 
  Calendar, Eye, Heart, TrendingUp, Download, BarChart3, 
  PieChart, CheckCircle, MapPin, Filter, Users, Activity,
  DollarSign, Clock, Target, Zap, Globe, Award
} from 'lucide-react';
import { Button } from './ui/button';
import { API_URL } from '@/config';

const AnalyticsDashboard = ({ userEvents, user, onEventSelect }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(30);
  const [selectedMetric, setSelectedMetric] = useState('views');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
              const response = await fetch(`${API_URL}/users/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else {
        console.error('Failed to fetch analytics:', response.status);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async (reportType) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/users/analytics?export_csv=${reportType}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `todoevents_${reportType}_analytics_${periodDays}days.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to download CSV:', response.status);
      }
    } catch (error) {
      console.error('Error downloading CSV:', error);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [periodDays]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-themed-primary">Analytics Dashboard</h2>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pin-blue"></div>
        </div>
      </div>
    );
  }

  const summary = analytics?.summary || {};
  const categoryData = analytics?.category_performance || [];
  const geoData = analytics?.geographic_distribution || {};
  const timeSeriesData = analytics?.time_series || {};
  const topEvents = analytics?.top_performing_events || [];

  // Calculate engagement rate
  const engagementRate = summary.total_views > 0 
    ? ((summary.total_interests / summary.total_views) * 100).toFixed(2) 
    : 0;

  // Process time series for simple charts
  const dates = Object.keys(timeSeriesData).sort();
  const chartData = dates.map(date => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    views: timeSeriesData[date]?.views || 0,
    interests: timeSeriesData[date]?.interests || 0,
    events: timeSeriesData[date]?.events_created || 0
  }));

  // Top categories by performance (categoryData is now an array)
  const topCategories = categoryData
    .sort((a, b) => (b.views + b.interests) - (a.views + a.interests))
    .slice(0, 5);

  // Top locations by performance
  const topLocations = Object.entries(geoData)
    .sort(([,a], [,b]) => (b.views + b.interests) - (a.views + a.interests))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-semibold text-themed-primary">Marketing Analytics Dashboard</h2>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Period Selector */}
          <select 
            value={periodDays} 
            onChange={(e) => setPeriodDays(parseInt(e.target.value))}
            className="px-3 py-2 bg-themed-surface border border-themed rounded-lg text-themed-primary"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 3 months</option>
            <option value={365}>Last year</option>
          </select>
          
          {/* CSV Export Dropdown */}
          <div className="relative group">
            <Button className="bg-pin-blue text-white hover:bg-pin-blue-600 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-themed-surface border border-themed rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <div className="p-2 space-y-1">
                <button 
                  onClick={() => downloadCSV('events')}
                  className="w-full text-left px-3 py-2 text-sm text-themed-primary hover:bg-themed-surface-hover rounded"
                >
                  Events Performance
                </button>
                <button 
                  onClick={() => downloadCSV('categories')}
                  className="w-full text-left px-3 py-2 text-sm text-themed-primary hover:bg-themed-surface-hover rounded"
                >
                  Category Analysis
                </button>
                <button 
                  onClick={() => downloadCSV('geographic')}
                  className="w-full text-left px-3 py-2 text-sm text-themed-primary hover:bg-themed-surface-hover rounded"
                >
                  Geographic Report
                </button>
                <button 
                  onClick={() => downloadCSV('timeseries')}
                  className="w-full text-left px-3 py-2 text-sm text-themed-primary hover:bg-themed-surface-hover rounded"
                >
                  Time Series Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-themed-surface rounded-lg border border-themed p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pin-blue/10 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-pin-blue" />
            </div>
            <div>
              <p className="text-sm text-themed-secondary">Total Events</p>
              <p className="text-2xl font-semibold text-themed-primary">{summary.total_events || 0}</p>
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
              <p className="text-2xl font-semibold text-themed-primary">{summary.total_views || 0}</p>
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
              <p className="text-2xl font-semibold text-themed-primary">{summary.total_interests || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-themed-surface rounded-lg border border-themed p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-themed-secondary">Engagement Rate</p>
              <p className="text-2xl font-semibold text-themed-primary">{engagementRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-themed-surface rounded-lg border border-themed p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-themed-secondary">Avg. Views/Event</p>
              <p className="text-2xl font-semibold text-themed-primary">{summary.avg_views_per_event || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-themed-surface rounded-lg border border-themed p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-themed-secondary">Avg. Interests/Event</p>
              <p className="text-2xl font-semibold text-themed-primary">{summary.avg_interests_per_event || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-themed-surface rounded-lg border border-themed p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-themed-secondary">Active Categories</p>
              <p className="text-2xl font-semibold text-themed-primary">{categoryData.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-themed-surface rounded-lg border border-themed p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm text-themed-secondary">Locations</p>
              <p className="text-2xl font-semibold text-themed-primary">{Object.keys(geoData).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Time Series Chart */}
      <div className="bg-themed-surface rounded-lg border border-themed p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-themed-primary">Performance Over Time</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => setSelectedMetric('views')}
              className={`px-3 py-1 text-sm rounded ${selectedMetric === 'views' ? 'bg-pin-blue text-white' : 'text-themed-secondary'}`}
            >
              Views
            </button>
            <button 
              onClick={() => setSelectedMetric('interests')}
              className={`px-3 py-1 text-sm rounded ${selectedMetric === 'interests' ? 'bg-pin-blue text-white' : 'text-themed-secondary'}`}
            >
              Interests
            </button>
            <button 
              onClick={() => setSelectedMetric('events')}
              className={`px-3 py-1 text-sm rounded ${selectedMetric === 'events' ? 'bg-pin-blue text-white' : 'text-themed-secondary'}`}
            >
              Events Created
            </button>
          </div>
        </div>
        
        {/* Simple Bar Chart */}
        <div className="h-64 flex items-end justify-between gap-1 p-4 bg-themed-surface-hover rounded">
          {chartData.slice(-14).map((point, index) => {
            const value = point[selectedMetric];
            const maxValue = Math.max(...chartData.map(p => p[selectedMetric]));
            const height = maxValue > 0 ? (value / maxValue) * 200 : 0;
            
            return (
              <div key={index} className="flex flex-col items-center">
                <div 
                  className="bg-pin-blue rounded-t w-6 min-h-[2px] transition-all duration-300"
                  style={{ height: `${height}px` }}
                  title={`${point.date}: ${value} ${selectedMetric}`}
                />
                <span className="text-xs text-themed-secondary mt-2 transform -rotate-45 origin-top-left">
                  {point.date}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Categories */}
        <div className="bg-themed-surface rounded-lg border border-themed p-6">
          <h3 className="text-lg font-semibold text-themed-primary mb-4">Top Performing Categories</h3>
          <div className="space-y-3">
            {topCategories.map((categoryObj, index) => {
              const total = categoryObj.views + categoryObj.interests;
              const maxTotal = Math.max(...topCategories.map(c => c.views + c.interests));
              const width = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
              
              return (
                <div key={categoryObj.category} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-themed-primary capitalize">{categoryObj.category}</span>
                    <span className="text-sm text-themed-secondary">{categoryObj.events} events</span>
                  </div>
                  <div className="bg-themed-surface-hover rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-pin-blue to-purple-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-themed-secondary">
                    <span>{categoryObj.views} views • {categoryObj.interests} interests</span>
                    <span>{categoryObj.engagement_rate}% engagement</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Locations */}
        <div className="bg-themed-surface rounded-lg border border-themed p-6">
          <h3 className="text-lg font-semibold text-themed-primary mb-4">Top Performing Locations</h3>
          <div className="space-y-3">
            {topLocations.map(([location, stats], index) => {
              const total = stats.views + stats.interests;
              const maxTotal = Math.max(...topLocations.map(([,s]) => s.views + s.interests));
              const width = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
              
              return (
                <div key={location} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-pin-blue" />
                      <span className="font-medium text-themed-primary">{location}</span>
                    </div>
                    <span className="text-sm text-themed-secondary">{stats.events} events</span>
                  </div>
                  <div className="bg-themed-surface-hover rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-themed-secondary">
                    <span>{stats.views} views • {stats.interests} interests</span>
                    <span>{((stats.interests / Math.max(stats.views, 1)) * 100).toFixed(1)}% engagement</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Performing Events */}
      <div className="bg-themed-surface rounded-lg border border-themed">
        <div className="p-6 border-b border-themed">
          <h3 className="text-lg font-semibold text-themed-primary">Top Performing Events</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-themed-surface-hover">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-themed-secondary">Event</th>
                <th className="text-left p-4 text-sm font-medium text-themed-secondary">Category</th>
                <th className="text-left p-4 text-sm font-medium text-themed-secondary">Date</th>
                <th className="text-left p-4 text-sm font-medium text-themed-secondary">Views</th>
                <th className="text-left p-4 text-sm font-medium text-themed-secondary">Interests</th>
                <th className="text-left p-4 text-sm font-medium text-themed-secondary">Engagement</th>
                <th className="text-left p-4 text-sm font-medium text-themed-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {topEvents.slice(0, 10).map((event) => {
                const engagement = event.view_count > 0 
                  ? ((event.interest_count / event.view_count) * 100).toFixed(1) 
                  : 0;
                
                return (
                  <tr key={event.id} className="border-t border-themed hover:bg-themed-surface-hover">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-themed-primary">{event.title}</span>
                        {event.verified && (
                          <CheckCircle className="w-4 h-4 text-green-500" title="Verified Event" />
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-themed-secondary capitalize">{event.category}</td>
                    <td className="p-4 text-themed-secondary">
                      {new Date(event.date).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-themed-secondary">{event.view_count || 0}</td>
                    <td className="p-4 text-themed-secondary">{event.interest_count || 0}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        engagement >= 10 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                        engagement >= 5 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                        'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {engagement}%
                      </span>
                    </td>
                    <td className="p-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEventSelect(event)}
                        className="text-pin-blue hover:text-pin-blue-600"
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights and Recommendations */}
      <div className="bg-gradient-to-br from-pin-blue/5 to-purple-500/5 rounded-lg border border-themed p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-pin-blue/10 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-pin-blue" />
          </div>
          <h3 className="text-lg font-semibold text-themed-primary">Marketing Insights</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topCategories.length > 0 && (
            <div className="bg-themed-surface/50 rounded-lg p-4">
              <h4 className="font-medium text-themed-primary mb-2">Top Category</h4>
              <p className="text-sm text-themed-secondary">
                <span className="capitalize font-medium">{topCategories[0].category}</span> is your best performing category with{' '}
                {topCategories[0].views} views and{' '}
                {topCategories[0].engagement_rate}% engagement rate.
              </p>
            </div>
          )}
          
          {summary.engagement_rate_percent && (
            <div className="bg-themed-surface/50 rounded-lg p-4">
              <h4 className="font-medium text-themed-primary mb-2">Engagement Rate</h4>
              <p className="text-sm text-themed-secondary">
                Your overall engagement rate is {summary.engagement_rate_percent}%.{' '}
                {summary.engagement_rate_percent > 5 ? 'Great job!' : 'Consider improving event descriptions and visuals.'}
              </p>
            </div>
          )}
          
          {summary.avg_views_per_event && (
            <div className="bg-themed-surface/50 rounded-lg p-4">
              <h4 className="font-medium text-themed-primary mb-2">Performance Trend</h4>
              <p className="text-sm text-themed-secondary">
                Your events average {summary.avg_views_per_event} views each.{' '}
                {summary.avg_views_per_event > 10 ? 'Your content is resonating well!' : 'Try improving event visibility with better keywords.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard; 