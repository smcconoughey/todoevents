import React, { useState, useEffect } from 'react';
import { useAuth } from './EventMap/AuthContext';
import { 
  Building2, Users, Calendar, TrendingUp, Download, ArrowLeft,
  BarChart, PieChart, Activity, Globe, Target, Shield 
} from 'lucide-react';

const EnterpriseDashboard = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalUsers: 0,
    activeUsers: 0,
    completionRate: 0
  });
  const [loading, setLoading] = useState(true);

  const API_BASE = import.meta.env.VITE_API_URL || 'https://todoevents-backend.onrender.com';

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/enterprise/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching enterprise stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/enterprise/export`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `enterprise-data-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  if (!user || (user.role !== 'enterprise' && user.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center text-white">
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-300">You need enterprise access to view this dashboard.</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to App
              </button>
              <div className="flex items-center gap-3">
                <Building2 className="w-8 h-8 text-purple-400" />
                <div>
                  <h1 className="text-xl font-bold">Enterprise Dashboard</h1>
                  <p className="text-sm text-gray-400">Welcome, {user.email}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Data
              </button>
              <button
                onClick={logout}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
              <p className="text-gray-300">Loading dashboard...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Total Events</p>
                    <p className="text-2xl font-bold text-white">{stats.totalEvents}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-blue-400" />
                </div>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Total Users</p>
                    <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                  </div>
                  <Users className="w-8 h-8 text-green-400" />
                </div>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Active Users</p>
                    <p className="text-2xl font-bold text-white">{stats.activeUsers}</p>
                  </div>
                  <Activity className="w-8 h-8 text-yellow-400" />
                </div>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Completion Rate</p>
                    <p className="text-2xl font-bold text-white">{stats.completionRate}%</p>
                  </div>
                  <Target className="w-8 h-8 text-purple-400" />
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Analytics Overview */}
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-blue-400" />
                  Analytics Overview
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Event Creation Rate</span>
                    <span className="text-green-400 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      +12%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">User Engagement</span>
                    <span className="text-green-400 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      +8%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Platform Usage</span>
                    <span className="text-blue-400">Stable</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-purple-400" />
                  Enterprise Features
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <span className="text-gray-300">Advanced Analytics</span>
                    <span className="text-green-400 text-sm">Active</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <span className="text-gray-300">Bulk Export</span>
                    <span className="text-green-400 text-sm">Available</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <span className="text-gray-300">Custom Integrations</span>
                    <span className="text-green-400 text-sm">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <span className="text-gray-300">Priority Support</span>
                    <span className="text-green-400 text-sm">Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Enterprise Notice */}
            <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <Building2 className="w-6 h-6 text-purple-400" />
                <h3 className="text-lg font-bold text-white">Enterprise Plan</h3>
              </div>
              <p className="text-gray-300 mb-4">
                You have access to all enterprise features including advanced analytics, bulk operations, 
                and priority support. Contact support for custom integrations or additional features.
              </p>
              <div className="flex gap-4">
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  Contact Support
                </button>
                <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                  View Documentation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnterpriseDashboard; 