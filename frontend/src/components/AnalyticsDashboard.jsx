import React, { useState, useEffect } from 'react';
import { 
  Calendar, Eye, Heart, TrendingUp, Download, BarChart3, 
  PieChart, CheckCircle, MapPin, Filter, Users, Activity,
  DollarSign, Clock, Target, Zap, Globe, Award, ArrowRight,
  MousePointer, Share2, Wifi
} from 'lucide-react';
import { Button } from './ui/button';
import { API_URL } from '@/config';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AnalyticsDashboard = ({ userEvents, user, onEventSelect }) => {
  const [analytics, setAnalytics] = useState(null);
  const [eventAnalytics, setEventAnalytics] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eventLoading, setEventLoading] = useState(false);
  const [periodDays, setPeriodDays] = useState(30);
  const [selectedMetric, setSelectedMetric] = useState('views');

  // Chart theme - beautiful non-cumulative styling
  const chartTheme = {
    colors: {
      primary: '#3B82F6',
      secondary: '#10B981', 
      accent: '#F59E0B',
      danger: '#EF4444',
      purple: '#8B5CF6',
      pink: '#EC4899',
      teal: '#14B8A6',
      orange: '#F97316'
    }
  };

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

  const fetchEventAnalytics = async (eventId) => {
    setEventLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/events/${eventId}/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEventAnalytics(data);
        setSelectedEventId(eventId);
      } else {
        console.error('Failed to fetch event analytics:', response.status);
      }
    } catch (error) {
      console.error('Error fetching event analytics:', error);
    } finally {
      setEventLoading(false);
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

  // Chart configurations - beautiful and interactive
  const createLineChartConfig = (data, label, color, isSmooth = true) => ({
    data: {
      labels: Object.keys(data).map(date => 
        new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ),
      datasets: [{
        label: label,
        data: Object.values(data).map(d => d[selectedMetric] || 0),
        borderColor: color,
        backgroundColor: color + '20',
        fill: true,
        tension: isSmooth ? 0.4 : 0,
        borderWidth: 3,
        pointBackgroundColor: color,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          position: 'top',
          labels: {
            usePointStyle: true,
            font: { size: 12, weight: 'bold' }
          }
        },
        title: { 
          display: true, 
          text: `${label} Over Time (Non-Cumulative)`,
          font: { size: 16, weight: 'bold' }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          cornerRadius: 8,
          displayColors: true
        }
      },
      scales: {
        y: { 
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.1)' },
          ticks: { font: { size: 11 } }
        },
        x: {
          grid: { color: 'rgba(0, 0, 0, 0.1)' },
          ticks: { font: { size: 11 } }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    }
  });

  const createBarChartConfig = (data, title, color) => ({
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: title,
        data: Object.values(data),
        backgroundColor: color + '80',
        borderColor: color,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { 
          display: true, 
          text: title,
          font: { size: 16, weight: 'bold' }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          cornerRadius: 8
        }
      },
      scales: {
        y: { 
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.1)' },
          ticks: { font: { size: 11 } }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } }
        }
      }
    }
  });

  const createPieChartConfig = (data, title) => ({
    data: {
      labels: Object.keys(data),
      datasets: [{
        data: Object.values(data),
        backgroundColor: [
          chartTheme.colors.primary,
          chartTheme.colors.secondary,
          chartTheme.colors.accent,
          chartTheme.colors.purple,
          chartTheme.colors.pink,
          chartTheme.colors.teal,
          chartTheme.colors.orange,
          chartTheme.colors.danger
        ],
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverBorderWidth: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          position: 'right',
          labels: {
            usePointStyle: true,
            font: { size: 12 },
            padding: 20
          }
        },
        title: { 
          display: true, 
          text: title,
          font: { size: 16, weight: 'bold' }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          cornerRadius: 8
        }
      }
    }
  });

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

      {/* Beautiful Time Series Chart */}
      <div className="bg-themed-surface rounded-lg border border-themed p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-themed-primary">Performance Over Time (Non-Cumulative)</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => setSelectedMetric('views')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedMetric === 'views' ? 'bg-pin-blue text-white' : 'bg-themed text-themed-secondary hover:bg-themed-surface-hover'
              }`}
            >
              Views
            </button>
            <button 
              onClick={() => setSelectedMetric('interests')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedMetric === 'interests' ? 'bg-pin-blue text-white' : 'bg-themed text-themed-secondary hover:bg-themed-surface-hover'
              }`}
            >
              Interests
            </button>
            <button 
              onClick={() => setSelectedMetric('events_created')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedMetric === 'events_created' ? 'bg-pin-blue text-white' : 'bg-themed text-themed-secondary hover:bg-themed-surface-hover'
              }`}
            >
              Events Created
            </button>
          </div>
        </div>
        
        {/* Beautiful Interactive Line Chart */}
        <div className="h-80">
          {timeSeriesData && Object.keys(timeSeriesData).length > 0 ? (
            <Line {...createLineChartConfig(
              timeSeriesData, 
              selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1).replace('_', ' '), 
              chartTheme.colors.primary
            )} />
          ) : (
            <div className="h-full flex items-center justify-center text-themed-secondary">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No time series data available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Beautiful Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Performance Chart */}
        <div className="bg-themed-surface rounded-lg border border-themed p-6">
          <h3 className="text-lg font-semibold text-themed-primary mb-4">Category Performance</h3>
          <div className="h-80">
            {categoryData.length > 0 ? (
              <Doughnut {...createPieChartConfig(
                Object.fromEntries(categoryData.map(cat => [cat.category, cat.views + cat.interests])),
                'Performance by Category'
              )} />
            ) : (
              <div className="h-full flex items-center justify-center text-themed-secondary">
                <div className="text-center">
                  <PieChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No category data available</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Geographic Performance Chart */}
        <div className="bg-themed-surface rounded-lg border border-themed p-6">
          <h3 className="text-lg font-semibold text-themed-primary mb-4">Geographic Performance</h3>
          <div className="h-80">
            {Object.keys(geoData).length > 0 ? (
              <Bar {...createBarChartConfig(
                Object.fromEntries(
                  Object.entries(geoData).map(([location, stats]) => [
                    location.length > 15 ? location.substring(0, 15) + '...' : location,
                    stats.views + stats.interests
                  ])
                ),
                'Views + Interests by Location',
                chartTheme.colors.teal
              )} />
            ) : (
              <div className="h-full flex items-center justify-center text-themed-secondary">
                <div className="text-center">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No geographic data available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event-Specific Analytics Section */}
      {topEvents.length > 0 && (
        <div className="bg-themed-surface rounded-lg border border-themed p-6">
          <h3 className="text-lg font-semibold text-themed-primary mb-4">Event-Specific Analytics</h3>
          <p className="text-themed-secondary mb-4">Click on any event to view detailed analytics with beautiful charts</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {topEvents.slice(0, 6).map((event) => (
              <div 
                key={event.id}
                onClick={() => fetchEventAnalytics(event.id)}
                className="p-4 border border-themed rounded-lg hover:bg-themed-surface-hover cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-themed-primary truncate">{event.title}</h4>
                  <ArrowRight className="w-4 h-4 text-pin-blue" />
                </div>
                <div className="text-sm text-themed-secondary">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-3 h-3" />
                    <span>{event.view_count || 0} views</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="w-3 h-3" />
                    <span>{event.interest_count || 0} interests</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Event Analytics Display */}
          {eventLoading && (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pin-blue"></div>
            </div>
          )}

          {eventAnalytics && !eventLoading && (
            <div className="border-t border-themed pt-6">
              <div className="flex items-center gap-3 mb-6">
                <h4 className="text-xl font-semibold text-themed-primary">{eventAnalytics.event.title}</h4>
                <span className="px-2 py-1 bg-pin-blue/10 text-pin-blue rounded text-sm">
                  {eventAnalytics.summary.engagement_rate}% engagement
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Event Time Series */}
                <div>
                  <h5 className="font-medium text-themed-primary mb-3">Views Over Time</h5>
                  <div className="h-60">
                    <Line {...createLineChartConfig(
                      eventAnalytics.time_series,
                      'Daily Views',
                      chartTheme.colors.secondary
                    )} />
                  </div>
                </div>

                {/* Traffic Sources */}
                <div>
                  <h5 className="font-medium text-themed-primary mb-3">Traffic Sources</h5>
                  <div className="h-60">
                    <Pie {...createPieChartConfig(
                      eventAnalytics.traffic_sources,
                      'Where Viewers Come From'
                    )} />
                  </div>
                </div>

                {/* Peak Hours */}
                <div>
                  <h5 className="font-medium text-themed-primary mb-3">Peak Viewing Hours</h5>
                  <div className="h-60">
                    <Bar {...createBarChartConfig(
                      eventAnalytics.peak_viewing_hours,
                      'Views by Time of Day',
                      chartTheme.colors.accent
                    )} />
                  </div>
                </div>

                {/* Performance Metrics */}
                <div>
                  <h5 className="font-medium text-themed-primary mb-3">Performance Metrics</h5>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                        <Zap className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm text-themed-secondary">View Velocity</p>
                        <p className="text-lg font-semibold text-themed-primary">
                          {eventAnalytics.performance_metrics.view_velocity} views/day
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center">
                        <Target className="w-5 h-5 text-teal-500" />
                      </div>
                      <div>
                        <p className="text-sm text-themed-secondary">Days Active</p>
                        <p className="text-lg font-semibold text-themed-primary">
                          {eventAnalytics.performance_metrics.days_active} days
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                        <Activity className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm text-themed-secondary">Total Engagement</p>
                        <p className="text-lg font-semibold text-themed-primary">
                          {eventAnalytics.summary.total_views + eventAnalytics.summary.total_interests} interactions
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchEventAnalytics(event.id)}
                          className="text-pin-blue hover:text-pin-blue-600"
                        >
                          <BarChart3 className="w-4 h-4 mr-1" />
                          Analytics
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEventSelect(event)}
                          className="text-themed-secondary hover:text-themed-primary"
                        >
                          View Details
                        </Button>
                      </div>
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
          {categoryData.length > 0 && (
            <div className="bg-themed-surface/50 rounded-lg p-4">
              <h4 className="font-medium text-themed-primary mb-2">Top Category</h4>
              <p className="text-sm text-themed-secondary">
                <span className="capitalize font-medium">{categoryData[0].category}</span> is your best performing category with{' '}
                {categoryData[0].views} views and{' '}
                {categoryData[0].engagement_rate}% engagement rate.
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