import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Calendar,
  Server,
  Trash2,
  Lock,
  Unlock,
  AlertTriangle,
  LogOut,
  X,
  Filter,
  Search,
  BarChart2,
  PieChart,
  Database,
  MessageSquare,
  Shield,
  Download,
  ChevronDown,
  Edit,
  Key,
  Save,
  Plus,
  Eye,
  RefreshCw,
  Upload
} from 'lucide-react';

// Get API URL from environment variable or fallback to production backend
const API_URL = import.meta.env.VITE_API_URL || 'https://todoevents-backend.onrender.com';
console.log('Admin Dashboard API URL:', API_URL);

// Utility functions for API calls
const fetchData = async (endpoint, method = 'GET', body = null) => {
  try {
    const token = localStorage.getItem('token');

    if (!token) {
      throw new Error('No authentication token found');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    const config = {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) })
    };

    const url = `${API_URL}${endpoint}`;
    console.log(`Making ${method} request to:`, url);

    const response = await fetch(url, config);

    if (!response.ok) {
      if (response.status === 401) {
        console.error('Authentication failed, removing token');
        localStorage.removeItem('token');
        window.location.reload();
        throw new Error('Unauthorized');
      }

      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Modal Component
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Login Component
const LoginForm = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      const url = `${API_URL}/token`;
      console.log('Attempting login to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: email,
          password: password
        })
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          throw new Error(`Login failed: HTTP ${response.status}`);
        }
        throw new Error(errorData.detail || errorData.message || 'Login failed');
      }

      const data = await response.json();
      console.log('Login successful');
      localStorage.setItem('token', data.access_token);
      onLogin();
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded-lg px-10 pt-8 pb-10 mb-4 w-full max-w-md"
      >
        <h2 className="text-3xl font-bold mb-8 text-blue-600 text-center">
          Admin Portal
        </h2>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
          </div>
        )}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-semibold mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your email"
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-semibold mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your password"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition duration-300"
        >
          Sign In
        </button>
      </form>
    </div>
  );
};

// User Edit Modal
const UserEditModal = ({ user, isOpen, onClose, onSave }) => {
  const [editUser, setEditUser] = useState(user || {});
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setEditUser(user);
    }
  }, [user]);

  const handleSave = async () => {
    try {
      // Update user role if changed
      if (editUser.role !== user.role) {
        await fetchData(`/admin/users/${user.id}/role`, 'PUT', { role: editUser.role });
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error updating user: ' + error.message);
    }
  };

  const handlePasswordReset = async () => {
    if (!newPassword) {
      alert('Please enter a new password');
      return;
    }

    try {
      setIsResettingPassword(true);
      await fetchData(`/admin/users/${user.id}/password`, 'PUT', { new_password: newPassword });
      alert('Password reset successfully');
      setNewPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Error resetting password: ' + error.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit User: ${user.email}`} size="lg">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            value={editUser.email || ''}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
          <select
            value={editUser.role || 'user'}
            onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Reset Password</h3>
          <div className="flex space-x-2">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handlePasswordReset}
              disabled={isResettingPassword}
              className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
            >
              {isResettingPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Password must be at least 6 characters with at least 3 different character types (uppercase, lowercase, number, special character).
          </p>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Event Edit Modal
const EventEditModal = ({ event, isOpen, onClose, onSave }) => {
  const [editEvent, setEditEvent] = useState(event || {});

  useEffect(() => {
    if (event) {
      setEditEvent(event);
    }
  }, [event]);

  const handleSave = async () => {
    try {
      await fetchData(`/events/${event.id}`, 'PUT', editEvent);
      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating event:', error);
      alert('Error updating event: ' + error.message);
    }
  };

  if (!event) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Event: ${event.title}`} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input
              type="text"
              value={editEvent.title || ''}
              onChange={(e) => setEditEvent({ ...editEvent, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <input
              type="text"
              value={editEvent.category || ''}
              onChange={(e) => setEditEvent({ ...editEvent, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={editEvent.date || ''}
              onChange={(e) => setEditEvent({ ...editEvent, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
            <input
              type="time"
              value={editEvent.time || ''}
              onChange={(e) => setEditEvent({ ...editEvent, time: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={editEvent.description || ''}
            onChange={(e) => setEditEvent({ ...editEvent, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
          <input
            type="text"
            value={editEvent.address || ''}
            onChange={(e) => setEditEvent({ ...editEvent, address: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Latitude</label>
            <input
              type="number"
              step="any"
              value={editEvent.lat || ''}
              onChange={(e) => setEditEvent({ ...editEvent, lat: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Longitude</label>
            <input
              type="number"
              step="any"
              value={editEvent.lng || ''}
              onChange={(e) => setEditEvent({ ...editEvent, lng: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Main Admin Dashboard Component
const AdminDashboard = () => {
  // State Management
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [userDetails, setUserDetails] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Modal States
  const [editingUser, setEditingUser] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  // Search and Filter States
  const [userSearch, setUserSearch] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [userFilterRole, setUserFilterRole] = useState('all');
  const [eventFilterCategory, setEventFilterCategory] = useState('all');

  // Bulk Action States
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);

  // Analytics States
  const [analytics, setAnalytics] = useState({
    userRoleDistribution: {},
    eventCategoryDistribution: {},
    totalUsers: 0,
    totalEvents: 0,
    recentActivity: []
  });

  // Fetch user details and initial data
  useEffect(() => {
    const fetchUserAndData = async () => {
      if (!isLoggedIn) return;

      try {
        // Fetch current user details
        const userMe = await fetchData('/users/me');
        setUserDetails(userMe);

        // Check if user is an admin
        if (userMe.role !== 'admin') {
          setAccessDenied(true);
          throw new Error('Insufficient admin permissions');
        }

        // Fetch admin data
        const [usersData, eventsData] = await Promise.all([
          fetchData('/admin/users'),
          fetchData('/events')
        ]);

        setUsers(usersData);
        setEvents(eventsData);

        // Compute Analytics
        const userRoleDistribution = usersData.reduce((acc, user) => {
          acc[user.role] = (acc[user.role] || 0) + 1;
          return acc;
        }, {});

        const eventCategoryDistribution = eventsData.reduce((acc, event) => {
          acc[event.category] = (acc[event.category] || 0) + 1;
          return acc;
        }, {});

        setAnalytics({
          userRoleDistribution,
          eventCategoryDistribution,
          totalUsers: usersData.length,
          totalEvents: eventsData.length,
          recentActivity: [] // Placeholder for activity logs
        });

        setError(null);
        setAccessDenied(false);
      } catch (error) {
        setError(error.message);
        console.error('Error fetching data:', error);

        if (error.message === 'Insufficient admin permissions') {
          setAccessDenied(true);
        } else {
          handleLogout();
        }
      }
    };

    fetchUserAndData();
  }, [isLoggedIn]);

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setUserDetails(null);
  };

  // Refresh data function
  const refreshData = async () => {
    try {
      const [usersData, eventsData] = await Promise.all([
        fetchData('/admin/users'),
        fetchData('/events')
      ]);

      setUsers(usersData);
      setEvents(eventsData);

      // Recompute analytics
      const userRoleDistribution = usersData.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});

      const eventCategoryDistribution = eventsData.reduce((acc, event) => {
        acc[event.category] = (acc[event.category] || 0) + 1;
        return acc;
      }, {});

      setAnalytics({
        userRoleDistribution,
        eventCategoryDistribution,
        totalUsers: usersData.length,
        totalEvents: eventsData.length,
        recentActivity: []
      });
    } catch (error) {
      setError(error.message);
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      (userFilterRole === 'all' || user.role === userFilterRole) &&
      (user.email.toLowerCase().includes(userSearch.toLowerCase()))
    );
  }, [users, userSearch, userFilterRole]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter(event =>
      (eventFilterCategory === 'all' || event.category === eventFilterCategory) &&
      (event.title.toLowerCase().includes(eventSearch.toLowerCase()))
    );
  }, [events, eventSearch, eventFilterCategory]);

  // Delete user function
  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await fetchData(`/admin/users/${userId}`, 'DELETE');
      await refreshData();
    } catch (error) {
      setError(error.message);
    }
  };

  // Delete event function
  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return;
    }

    try {
      await fetchData(`/events/${eventId}`, 'DELETE');
      await refreshData();
    } catch (error) {
      setError(error.message);
    }
  };

  // Bulk User Actions
  const handleBulkUserAction = async (action) => {
    try {
      switch (action) {
        case 'delete':
          if (!confirm(`Are you sure you want to delete ${selectedUsers.length} users? This action cannot be undone.`)) {
            return;
          }
          await Promise.all(
            selectedUsers.map(userId =>
              fetchData(`/admin/users/${userId}`, 'DELETE')
            )
          );
          setSelectedUsers([]);
          await refreshData();
          break;
      }
    } catch (error) {
      setError(error.message);
    }
  };

  // Bulk Event Actions
  const handleBulkEventAction = async (action) => {
    try {
      switch (action) {
        case 'delete':
          if (!confirm(`Are you sure you want to delete ${selectedEvents.length} events? This action cannot be undone.`)) {
            return;
          }
          await Promise.all(
            selectedEvents.map(eventId =>
              fetchData(`/events/${eventId}`, 'DELETE')
            )
          );
          setSelectedEvents([]);
          await refreshData();
          break;
      }
    } catch (error) {
      setError(error.message);
    }
  };

  // Export Data
  const exportData = (dataType) => {
    let data, headers, filename;

    switch (dataType) {
      case 'users':
        data = filteredUsers.map(({ id, email, role }) => ({ id, email, role }));
        headers = ['ID', 'Email', 'Role'];
        filename = 'users_export.csv';
        break;
      case 'events':
        data = filteredEvents.map(({ id, title, date, category }) =>
          ({ id, title, date, category })
        );
        headers = ['ID', 'Title', 'Date', 'Category'];
        filename = 'events_export.csv';
        break;
    }

    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header =>
        row[header.toLowerCase()]
      ).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // If not logged in, show login form
  if (!isLoggedIn) {
    return <LoginForm onLogin={() => setIsLoggedIn(true)} />;
  }

  // Access Denied Component
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white shadow-md rounded-lg p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 mx-auto text-orange-500 mb-4" />
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You do not have administrator permissions to access this dashboard.
          </p>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  // Dashboard Component
  const Dashboard = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4 flex items-center">
            <Users className="text-blue-600 mr-4" />
            <div>
              <h3 className="text-xl font-bold text-blue-600">{users.length}</h3>
              <p className="text-gray-500">Total Users</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 flex items-center">
            <Calendar className="text-green-600 mr-4" />
            <div>
              <h3 className="text-xl font-bold text-green-600">{events.length}</h3>
              <p className="text-gray-500">Total Events</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 flex items-center">
            <BarChart2 className="text-purple-600 mr-4" />
            <div>
              <h3 className="text-xl font-bold text-purple-600">
                {Object.keys(analytics.userRoleDistribution).length}
              </h3>
              <p className="text-gray-500">User Roles</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 flex items-center">
            <Shield className="text-orange-600 mr-4" />
            <div>
              <h3 className="text-xl font-bold text-orange-600">
                {Object.keys(analytics.eventCategoryDistribution).length}
              </h3>
              <p className="text-gray-500">Event Categories</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-blue-600 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                className="bg-blue-500 text-white py-2 rounded hover:bg-blue-600 flex items-center justify-center"
                onClick={() => setActiveTab('users')}
              >
                <Users className="mr-2" /> Manage Users
              </button>
              <button
                className="bg-green-500 text-white py-2 rounded hover:bg-green-600 flex items-center justify-center"
                onClick={() => setActiveTab('events')}
              >
                <Calendar className="mr-2" /> Manage Events
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-blue-600 mb-4">System Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Users</span>
                <span className="font-semibold">{users.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Events</span>
                <span className="font-semibold">{events.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Admin Users</span>
                <span className="font-semibold">
                  {users.filter(user => user.role === 'admin').length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-blue-600 mb-4">User Role Distribution</h3>
            <div>
              {Object.entries(analytics.userRoleDistribution).map(([role, count]) => (
                <div key={role} className="flex justify-between items-center mb-2">
                  <span className="capitalize">{role} Users</span>
                  <span className="font-semibold text-blue-600">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-blue-600 mb-4">Event Category Distribution</h3>
            <div>
              {Object.entries(analytics.eventCategoryDistribution).map(([category, count]) => (
                <div key={category} className="flex justify-between items-center mb-2">
                  <span className="capitalize">{category} Events</span>
                  <span className="font-semibold text-green-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // User Management Component
  const UserManagement = () => {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-blue-600">User Management</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => exportData('users')}
              className="flex items-center text-blue-600 hover:text-blue-800"
              title="Export Users"
            >
              <Download className="w-5 h-5 mr-2" /> Export
            </button>
            {selectedUsers.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleBulkUserAction('delete')}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Delete Selected
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex space-x-2 mb-4">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full px-3 py-2 border rounded-md pl-10"
            />
            <Search className="absolute left-3 top-3 text-gray-400" />
          </div>
          <select
            value={userFilterRole}
            onChange={(e) => setUserFilterRole(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admins</option>
            <option value="user">Users</option>
          </select>
        </div>

        {/* User Table */}
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === filteredUsers.length}
                  onChange={(e) =>
                    setSelectedUsers(
                      e.target.checked
                        ? filteredUsers.map(u => u.id)
                        : []
                    )
                  }
                />
              </th>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) =>
                      setSelectedUsers(prev =>
                        e.target.checked
                          ? [...prev, user.id]
                          : prev.filter(id => id !== user.id)
                      )
                    }
                  />
                </td>
                <td className="p-3">{user.id}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">
                  <span className={`
                  px-2 py-1 rounded text-xs font-semibold
                  ${user.role === 'admin'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'}
                `}>
                    {user.role}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingUser(user);
                      }}
                      className="text-blue-500 hover:text-blue-700"
                      title="Edit User"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete User"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Event Management Component
  const EventManagement = () => {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-blue-600">Event Management</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => exportData('events')}
              className="flex items-center text-blue-600 hover:text-blue-800"
              title="Export Events"
            >
              <Download className="w-5 h-5 mr-2" /> Export
            </button>
            {selectedEvents.length > 0 && (
              <button
                onClick={() => handleBulkEventAction('delete')}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Delete Selected
              </button>
            )}
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex space-x-2 mb-4">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search events..."
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              className="w-full px-3 py-2 border rounded-md pl-10"
            />
            <Search className="absolute left-3 top-3 text-gray-400" />
          </div>
          <select
            value={eventFilterCategory}
            onChange={(e) => setEventFilterCategory(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Categories</option>
            {[...new Set(events.map(e => e.category))].map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        {/* Event Table */}
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedEvents.length === filteredEvents.length && filteredEvents.length > 0}
                  onChange={(e) =>
                    setSelectedEvents(
                      e.target.checked
                        ? filteredEvents.map(event => event.id)
                        : []
                    )
                  }
                />
              </th>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Created By</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map(event => (
              <tr key={event.id} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event.id)}
                    onChange={(e) =>
                      setSelectedEvents(prev =>
                        e.target.checked
                          ? [...prev, event.id]
                          : prev.filter(id => id !== event.id)
                      )
                    }
                  />
                </td>
                <td className="p-3">
                  <span className="text-xs text-gray-500 font-mono">#{event.id}</span>
                </td>
                <td className="p-3">
                  <div>
                    <div className="font-medium">{event.title}</div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">{event.description}</div>
                  </div>
                </td>
                <td className="p-3">{event.date}</td>
                <td className="p-3">
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                    {event.category}
                  </span>
                </td>
                <td className="p-3">
                  <span className="text-sm text-gray-600">
                    User #{event.created_by}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingEvent(event);
                      }}
                      className="text-blue-500 hover:text-blue-700"
                      title="Edit Event"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete Event"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Analytics Component
  const AnalyticsDashboard = () => {
    const renderPieChart = (data, title) => {
      const total = Object.values(data).reduce((a, b) => a + b, 0);
      return (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-blue-600 mb-4">{title}</h3>
          <div className="flex flex-wrap items-center justify-center">
            {Object.entries(data).map(([key, value]) => (
              <div key={key} className="flex items-center m-2">
                <div
                  className="w-4 h-4 mr-2 rounded-full"
                  style={{
                    backgroundColor: `hsl(${Math.random() * 360}, 70%, 50%)`
                  }}
                />
                <span>{key}: {value} ({((value / total) * 100).toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Overall Statistics */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-blue-600 mb-4">System Overview</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-sm text-blue-600">Total Users</h4>
                <p className="text-2xl font-bold text-blue-800">{analytics.totalUsers}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="text-sm text-green-600">Total Events</h4>
                <p className="text-2xl font-bold text-green-800">{analytics.totalEvents}</p>
              </div>
            </div>
          </div>

          {/* User Role Distribution */}
          {renderPieChart(
            analytics.userRoleDistribution,
            'User Role Distribution'
          )}
        </div>

        {/* Event Category Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderPieChart(
            analytics.eventCategoryDistribution,
            'Event Category Distribution'
          )}

          {/* Recent Activity Placeholder */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-blue-600 mb-4">Recent Activity</h3>
            <p className="text-gray-500 text-center">
              No recent activity logs available
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Moderation Tools Component
  const ModerationTools = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* User Moderation Quick Actions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-blue-600 mb-4">User Moderation</h3>
            <div className="space-y-4">
              <button
                className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 flex items-center justify-center"
                onClick={() => setError('Mass user suspension not implemented')}
              >
                <Lock className="mr-2" /> Suspend Users
              </button>
              <button
                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 flex items-center justify-center"
                onClick={() => setError('User account review not implemented')}
              >
                <Shield className="mr-2" /> Review Accounts
              </button>
            </div>
          </div>

          {/* Event Moderation Quick Actions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-blue-600 mb-4">Event Moderation</h3>
            <div className="space-y-4">
              <button
                className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 flex items-center justify-center"
                onClick={() => setError('Mass event deletion not implemented')}
              >
                <Trash2 className="mr-2" /> Delete Inappropriate Events
              </button>
              <button
                className="w-full bg-orange-500 text-white py-2 rounded hover:bg-orange-600 flex items-center justify-center"
                onClick={() => setError('Event review queue not implemented')}
              >
                <MessageSquare className="mr-2" /> Review Event Reports
              </button>
            </div>
          </div>

          {/* System Maintenance */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-blue-600 mb-4">System Maintenance</h3>
            <div className="space-y-4">
              <button
                className="w-full bg-gray-500 text-white py-2 rounded hover:bg-gray-600 flex items-center justify-center"
                onClick={() => setError('Database backup not implemented')}
              >
                <Database className="mr-2" /> Backup Database
              </button>
              <button
                className="w-full bg-orange-500 text-white py-2 rounded hover:bg-orange-600 flex items-center justify-center"
                onClick={() => setError('System logs review not implemented')}
              >
                <BarChart2 className="mr-2" /> System Logs
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Bulk Operations Component
  const BulkOperations = () => {
    const [jsonInput, setJsonInput] = useState('');
    const [importResults, setImportResults] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showTemplate, setShowTemplate] = useState(false);

    // Template JSON for bulk import
    const templateJson = {
      "events": [
        {
          "title": "Sample Music Festival",
          "description": "A wonderful outdoor music festival featuring local and international artists. Bring your friends and family for a day of great music, food, and fun.",
          "date": "2024-07-15",
          "start_time": "14:00",
          "end_time": "22:00",
          "end_date": "2024-07-15",
          "category": "music",
          "address": "Central Park, New York, NY, USA",
          "lat": 40.7829,
          "lng": -73.9654,
          "recurring": false,
          "frequency": null
        },
        {
          "title": "Food Truck Rally",
          "description": "Join us for an amazing food truck rally featuring the best local cuisine. Over 20 food trucks will be serving delicious meals.",
          "date": "2024-07-20",
          "start_time": "11:00",
          "end_time": "20:00",
          "category": "food",
          "address": "Downtown Plaza, Los Angeles, CA, USA",
          "lat": 34.0522,
          "lng": -118.2437,
          "recurring": false
        },
        {
          "title": "Weekly Community Yoga",
          "description": "Free yoga classes for the community. All skill levels welcome. Bring your own mat.",
          "date": "2024-07-17",
          "start_time": "08:00",
          "end_time": "09:30",
          "category": "community",
          "address": "Riverside Park, Portland, OR, USA",
          "lat": 45.5152,
          "lng": -122.6784,
          "recurring": true,
          "frequency": "weekly"
        }
      ]
    };

    const copyTemplate = () => {
      const templateString = JSON.stringify(templateJson, null, 2);
      navigator.clipboard.writeText(templateString).then(() => {
        alert('Template copied to clipboard!');
      }).catch(() => {
        // Fallback for older browsers
        setJsonInput(templateString);
        alert('Template loaded into the text area!');
      });
    };

    const handleBulkImport = async () => {
      if (!jsonInput.trim()) {
        setError('Please enter JSON data to import');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const jsonData = JSON.parse(jsonInput);
        
        const response = await fetchData('/admin/events/bulk', 'POST', jsonData);
        
        if (response) {
          setImportResults(response);
          if (response.success_count > 0) {
            setSuccess(`Successfully imported ${response.success_count} events!`);
            setJsonInput(''); // Clear input on success
          }
          if (response.error_count > 0) {
            setError(`${response.error_count} events failed to import. Check results below.`);
          }
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          setError('Invalid JSON format. Please check your JSON syntax.');
        } else {
          setError('Failed to import events: ' + (error.message || 'Unknown error'));
        }
      } finally {
        setIsLoading(false);
      }
    };

    const clearResults = () => {
      setImportResults(null);
      setError(null);
    };

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-blue-600 mb-4">Bulk Event Import</h3>
          
          {/* Template Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-medium text-gray-700">JSON Template</h4>
              <div className="space-x-2">
                <button
                  onClick={() => setShowTemplate(!showTemplate)}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                >
                  {showTemplate ? 'Hide' : 'Show'} Template
                </button>
                <button
                  onClick={copyTemplate}
                  className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                >
                  Copy Template
                </button>
              </div>
            </div>
            
            {showTemplate && (
              <div className="bg-white p-3 rounded border">
                <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(templateJson, null, 2)}
                </pre>
              </div>
            )}
            
            <div className="mt-3 text-sm text-gray-600">
              <p><strong>Required fields:</strong> title, description, date, start_time, category, address, lat, lng</p>
              <p><strong>Optional fields:</strong> end_time, end_date, recurring, frequency</p>
              <p><strong>Categories:</strong> music, food, arts, sports, community, networking, education, other</p>
              <p><strong>Time format:</strong> HH:MM (24-hour format, e.g., "14:30" for 2:30 PM)</p>
              <p><strong>Date format:</strong> YYYY-MM-DD (e.g., "2024-07-15")</p>
              <p><strong>Frequency options:</strong> weekly, monthly (only if recurring is true)</p>
            </div>
          </div>

          {/* JSON Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                JSON Data (Paste your event data here)
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full h-64 p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="Paste your JSON data here or use the template above..."
              />
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleBulkImport}
                disabled={isLoading || !jsonInput.trim()}
                className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2" size={16} />
                    Import Events
                  </>
                )}
              </button>
              
              {importResults && (
                <button
                  onClick={clearResults}
                  className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
                >
                  Clear Results
                </button>
              )}
            </div>
          </div>

          {/* Import Results */}
          {importResults && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-lg font-medium text-gray-700 mb-3">Import Results</h4>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-green-100 rounded">
                  <div className="text-2xl font-bold text-green-600">{importResults.success_count}</div>
                  <div className="text-sm text-green-700">Successful</div>
                </div>
                <div className="text-center p-3 bg-red-100 rounded">
                  <div className="text-2xl font-bold text-red-600">{importResults.error_count}</div>
                  <div className="text-sm text-red-700">Failed</div>
                </div>
              </div>

              {importResults.errors && importResults.errors.length > 0 && (
                <div className="mt-4">
                  <h5 className="font-medium text-red-600 mb-2">Errors:</h5>
                  <div className="max-h-32 overflow-y-auto">
                    {importResults.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded mb-1">
                        <strong>Event {error.index + 1}:</strong> {error.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResults.created_events && importResults.created_events.length > 0 && (
                <div className="mt-4">
                  <h5 className="font-medium text-green-600 mb-2">
                    Successfully Created Events ({importResults.created_events.length}):
                  </h5>
                  <div className="max-h-32 overflow-y-auto">
                    {importResults.created_events.map((event, index) => (
                      <div key={index} className="text-sm text-green-600 bg-green-50 p-2 rounded mb-1">
                        <strong>{event.title}</strong> - {event.date} at {event.start_time}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // The rest of the AdminDashboard component continues...
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r shadow-md p-4">
          <h1 className="text-2xl font-bold mb-8 text-blue-600">Admin Portal</h1>
          <nav className="space-y-2">
            {[
              { name: 'Dashboard', icon: <Server className="mr-2" />, tab: 'dashboard' },
              { name: 'Users', icon: <Users className="mr-2" />, tab: 'users' },
              { name: 'Events', icon: <Calendar className="mr-2" />, tab: 'events' },
              { name: 'Bulk Import', icon: <Plus className="mr-2" />, tab: 'bulk' },
              { name: 'Analytics', icon: <BarChart2 className="mr-2" />, tab: 'analytics' },
              { name: 'Moderation', icon: <Shield className="mr-2" />, tab: 'moderation' }
            ].map(item => (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`
                  w-full flex items-center p-2 rounded 
                  ${activeTab === item.tab
                    ? 'bg-blue-600/10 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-600'}
                `}
              >
                {item.icon}
                {item.name}
              </button>
            ))}
          </nav>

          {/* User Info and Logout */}
          {userDetails && (
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{userDetails.email}</p>
                  <p className="text-xs text-gray-500 capitalize">{userDetails.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-red-500 hover:text-red-700"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 flex items-center">
              <AlertTriangle className="w-6 h-6 mr-3" />
              <span className="flex-1">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-4 hover:bg-red-200 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Content Sections */}
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'events' && <EventManagement />}
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'moderation' && <ModerationTools />}
          {activeTab === 'bulk' && <BulkOperations />}
        </div>
      </div>

      {/* User Edit Modal */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          onSave={() => {
            refreshData();
          }}
        />
      )}

      {/* Event Edit Modal */}
      {editingEvent && (
        <EventEditModal
          event={editingEvent}
          isOpen={!!editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={() => {
            refreshData();
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboard;