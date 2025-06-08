import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Users, Calendar, Server, Shield, LogOut, Plus, BarChart2, Database,
  Trash2, Upload, Download, RefreshCw, Search, Filter, Eye, Heart,
  Edit, X, AlertTriangle, CheckCircle, UserPlus, Lock, MessageSquare,
  TrendingUp, TrendingDown, Activity, Globe, MapPin, Clock, List
} from 'lucide-react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale,
  Filler,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut, Bubble } from 'react-chartjs-2';
import { format, subDays, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';

// Register Chart.js components including Filler for area charts
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale,
  Filler
);

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://todoevents.onrender.com';

// Get API URL from environment variable or fallback to production backend
const API_URL = import.meta.env.VITE_API_URL || 'https://todoevents-backend.onrender.com';
console.log('Admin Dashboard API URL:', API_URL);

// Utility functions for API calls
const fetchData = async (endpoint, method = 'GET', body = null) => {
  try {
    const token = localStorage.getItem('token');

    if (!token) {
      console.error('No authentication token found in localStorage');
      throw new Error('No authentication token found');
    }

    console.log('Using token:', token.substring(0, 20) + '...'); // Log partial token for debugging

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
        console.error('Authentication failed, removing token and reloading');
        localStorage.removeItem('token');
        // Instead of reloading immediately, let the component handle this
        throw new Error('Authentication failed - please log in again');
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
            <input
              type="time"
              value={editEvent.start_time || ''}
              onChange={(e) => setEditEvent({ ...editEvent, start_time: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Time (Optional)</label>
            <input
              type="time"
              value={editEvent.end_time || ''}
              onChange={(e) => setEditEvent({ ...editEvent, end_time: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date (Optional)</label>
            <input
              type="date"
              value={editEvent.end_date || ''}
              onChange={(e) => setEditEvent({ ...editEvent, end_date: e.target.value })}
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

        {/* UX Enhancement Fields */}
        <div className="border-t pt-4 mt-6">
          <h4 className="text-lg font-medium text-gray-700 mb-4">Additional Event Information</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fee Information (Optional)</label>
              <input
                type="text"
                value={editEvent.fee_required || ''}
                onChange={(e) => setEditEvent({ ...editEvent, fee_required: e.target.value })}
                placeholder="e.g., Free admission, $10 entry fee, $5-15 per item"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Describe ticket prices, fees, or if the event is free</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Website (Optional)</label>
              <input
                type="url"
                value={editEvent.event_url || ''}
                onChange={(e) => setEditEvent({ ...editEvent, event_url: e.target.value })}
                placeholder="https://example.com/event"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Link to event registration, tickets, or more information</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Host/Organization (Optional)</label>
              <input
                type="text"
                value={editEvent.host_name || ''}
                onChange={(e) => setEditEvent({ ...editEvent, host_name: e.target.value })}
                placeholder="e.g., Downtown Business Association, City Recreation Department"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Name of the organization or host running this event</p>
            </div>
          </div>
        </div>

        {/* Recurring Event Fields */}
        <div className="border-t pt-4 mt-6">
          <h4 className="text-lg font-medium text-gray-700 mb-4">Recurring Event Settings</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={editEvent.recurring || false}
                  onChange={(e) => setEditEvent({ ...editEvent, recurring: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">This is a recurring event</span>
              </label>
            </div>

            {editEvent.recurring && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                <select
                  value={editEvent.frequency || ''}
                  onChange={(e) => setEditEvent({ ...editEvent, frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select frequency</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
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

// Event Categories Definition
const EVENT_CATEGORIES = [
  { id: 'all', name: 'All Events', description: 'Show all event types' },
  { id: 'food-drink', name: 'Food & Drink', description: 'Restaurants, bars, food festivals, culinary events' },
  { id: 'music', name: 'Music', description: 'Concerts, music festivals, live performances' },
  { id: 'arts', name: 'Arts', description: 'Art galleries, theater, creative workshops' },
  { id: 'sports', name: 'Sports', description: 'Athletic events, tournaments, recreational sports' },
  { id: 'automotive', name: 'Automotive', description: 'Car shows, auto racing, vehicle exhibitions' },
  { id: 'airshows', name: 'Airshows', description: 'Aviation displays, aircraft exhibitions' },
  { id: 'vehicle-sports', name: 'Vehicle Sports', description: 'Boat races, motorcycle events, motorsports' },
  { id: 'community', name: 'Community', description: 'Local gatherings, neighborhood events, social meetups' },
  { id: 'religious', name: 'Religious', description: 'Religious services, spiritual gatherings' },
  { id: 'education', name: 'Tech & Education', description: 'Workshops, conferences, learning events' },
  { id: 'networking', name: 'Networking', description: 'Professional networking, business meetups' },
  { id: 'veteran', name: 'Veteran', description: 'Military commemorative events, veteran services' },
  { id: 'cookout', name: 'Cookout', description: 'BBQ events, outdoor cooking, grilling competitions' },
  { id: 'fair-festival', name: 'Fair/Festival', description: 'County fairs, cultural festivals, carnival events' },
  { id: 'diving', name: 'Diving', description: 'Scuba diving, snorkeling, underwater exploration events' },
  { id: 'shopping', name: 'Shopping', description: 'Market events, shopping festivals, retail gatherings' },
  { id: 'health', name: 'Health & Wellness', description: 'Fitness events, wellness workshops, health screenings, medical conferences' },
  { id: 'outdoors', name: 'Outdoors & Nature', description: 'Hiking, camping, nature walks, outdoor activities' },
  { id: 'photography', name: 'Photography', description: 'Photo walks, exhibitions, workshops for photographers' },
  { id: 'family', name: 'Family & Kids', description: 'Family-friendly events, children\'s activities, parenting workshops' },
  { id: 'gaming', name: 'Gaming', description: 'Video game tournaments, board game nights, gaming conventions' },
  { id: 'real-estate', name: 'Real Estate', description: 'Open houses, property tours, real estate seminars' },
  { id: 'adventure', name: 'Adventure & Extreme', description: 'Rock climbing, extreme sports, adventure challenges' },
  { id: 'seasonal', name: 'Seasonal', description: 'Holiday events, seasonal celebrations, festive occasions' },
  { id: 'agriculture', name: 'Agriculture', description: 'Farm events, agricultural fairs, farming workshops, livestock shows' },
  { id: 'other', name: 'Other', description: 'Events that don\'t fit into other categories' }
];

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

  // Bulk Operations Component
  const BulkOperations = () => {
    const [jsonInput, setJsonInput] = useState('');
    const [importResults, setImportResults] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showTemplate, setShowTemplate] = useState(false);
    const [success, setSuccess] = useState(null);
    const [bulkError, setBulkError] = useState(null);

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
          "frequency": null,
          "fee_required": "$25 general admission, $15 students/seniors",
          "event_url": "https://www.samplefestival.com",
          "host_name": "NYC Parks & Recreation"
        },
        {
          "title": "Food Truck Rally",
          "description": "Join us for an amazing food truck rally featuring the best local cuisine. Over 20 food trucks will be serving delicious meals.",
          "date": "2024-07-20",
          "start_time": "11:00",
          "end_time": "20:00",
          "category": "food-drink",
          "secondary_category": "community",
          "address": "Downtown Plaza, Los Angeles, CA, USA",
          "lat": 34.0522,
          "lng": -118.2437,
          "recurring": false,
          "fee_required": "Free admission, food sold separately ($5-15 per item)",
          "event_url": "https://www.lafoodtrucks.com/rally",
          "host_name": "Downtown LA Business Association"
        },
        {
          "title": "Art Gallery Opening",
          "description": "Contemporary art exhibition featuring works by emerging local artists. Wine and cheese reception included.",
          "date": "2024-07-22",
          "start_time": "18:00",
          "end_time": "21:00",
          "category": "arts",
          "address": "Metropolitan Art Gallery, Chicago, IL, USA",
          "lat": 41.8781,
          "lng": -87.6298,
          "recurring": false,
          "fee_required": "Free admission, donations welcome",
          "event_url": "",
          "host_name": "Metropolitan Art Gallery"
        },
        {
          "title": "Weekly Basketball League",
          "description": "Competitive basketball league for adults. Registration required. All skill levels welcome.",
          "date": "2024-07-18",
          "start_time": "19:00",
          "end_time": "21:00",
          "category": "sports",
          "address": "Community Sports Center, Austin, TX, USA",
          "lat": 30.2672,
          "lng": -97.7431,
          "recurring": true,
          "frequency": "weekly",
          "fee_required": "$50 season registration fee",
          "event_url": "https://www.austinsports.com/basketball",
          "host_name": "Austin Community Sports League"
        },
        {
          "title": "Community Garden Volunteer Day",
          "description": "Help maintain our community garden! Tools provided. Great for families and individuals looking to give back.",
          "date": "2024-07-17",
          "start_time": "08:00",
          "end_time": "12:00",
          "category": "community",
          "secondary_category": "agriculture",
          "address": "Riverside Park, Portland, OR, USA",
          "lat": 45.5152,
          "lng": -122.6784,
          "recurring": false,
          "fee_required": "Free event",
          "event_url": "",
          "host_name": "Portland Community Gardens"
        },
        {
          "title": "Tech Professionals Networking Mixer",
          "description": "Connect with fellow tech professionals in the area. Refreshments provided. Perfect for career development and collaboration opportunities.",
          "date": "2024-07-25",
          "start_time": "17:30",
          "end_time": "20:00",
          "category": "networking",
          "address": "Innovation Hub, San Francisco, CA, USA",
          "lat": 37.7749,
          "lng": -122.4194,
          "recurring": false,
          "fee_required": "$20 admission includes drinks and appetizers",
          "event_url": "https://www.sftech.org/networking",
          "host_name": "SF Tech Professionals Association"
        },
        {
          "title": "Financial Literacy Workshop",
          "description": "Learn essential money management skills, budgeting, and investment basics. Free workshop with certified financial advisors.",
          "date": "2024-07-28",
          "start_time": "10:00",
          "end_time": "14:00",
          "category": "education",
          "address": "Public Library Main Branch, Seattle, WA, USA",
          "lat": 47.6062,
          "lng": -122.3321,
          "recurring": false,
          "fee_required": "Free workshop",
          "event_url": "https://www.seattlelibrary.org/workshops",
          "host_name": "Seattle Public Library"
        },
        {
          "title": "Pet Adoption Drive",
          "description": "Find your perfect furry companion! Local animal shelter hosting adoption event with over 50 pets looking for homes.",
          "date": "2024-07-30",
          "start_time": "10:00",
          "end_time": "16:00",
          "category": "community",
          "address": "Central Mall Parking Lot, Denver, CO, USA",
          "lat": 39.7392,
          "lng": -104.9903,
          "recurring": false,
          "fee_required": "Free adoption event, $50-150 adoption fees",
          "event_url": "https://www.denverpetrescue.org/adoption-events",
          "host_name": "Denver Pet Rescue"
        },
        {
          "title": "Veterans Day Ceremony",
          "description": "Honor our local veterans with a commemorative ceremony featuring guest speakers, flag presentation, and community recognition.",
          "date": "2024-11-11",
          "start_time": "10:00",
          "end_time": "12:00",
          "category": "veteran",
          "address": "Veterans Memorial Park, Phoenix, AZ, USA",
          "lat": 33.4484,
          "lng": -112.0740,
          "recurring": false,
          "fee_required": "Free public ceremony",
          "event_url": "",
          "host_name": "Phoenix Veterans Association"
        },
        {
          "title": "Annual Car Show",
          "description": "Classic and exotic car showcase featuring over 200 vehicles, awards ceremony, and vendor booths. All makes and models welcome.",
          "date": "2024-08-15",
          "start_time": "08:00",
          "end_time": "16:00",
          "category": "automotive",
          "address": "Fairgrounds Expo Center, Miami, FL, USA",
          "lat": 25.7617,
          "lng": -80.1918,
          "recurring": false,
          "fee_required": "$15 entry, $25 vehicle registration",
          "event_url": "https://www.miamicarshow.org",
          "host_name": "Miami Classic Car Club"
        },
        {
          "title": "County Farm & Agriculture Fair",
          "description": "Annual agricultural fair featuring livestock shows, farming equipment exhibits, local produce vendors, and traditional farm activities. Family-friendly event with educational demonstrations.",
          "date": "2024-09-05",
          "start_time": "09:00",
          "end_time": "18:00",
          "category": "agriculture",
          "secondary_category": "fair-festival",
          "address": "County Fairgrounds, Iowa City, IA, USA",
          "lat": 41.6611,
          "lng": -91.5302,
          "recurring": false,
          "fee_required": "$8 adults, $5 children, free parking",
          "event_url": "https://www.iowacountyfair.org",
          "host_name": "Iowa County Agricultural Society"
        },
        {
          "title": "Thunderbirds Air Show",
          "description": "Watch the spectacular U.S. Air Force Thunderbirds perform aerial demonstrations and see static aircraft displays.",
          "date": "2024-09-20",
          "start_time": "09:00",
          "end_time": "17:00",
          "category": "airshows",
          "address": "Luke Air Force Base, Glendale, AZ, USA",
          "lat": 33.5347,
          "lng": -112.3831,
          "recurring": false,
          "fee_required": "Free admission, parking $10",
          "event_url": "https://www.luke.af.mil/airshow",
          "host_name": "Luke Air Force Base"
        },
        {
          "title": "Summer Fair & Festival",
          "description": "Annual community fair featuring carnival rides, local vendors, live entertainment, and family-friendly activities.",
          "date": "2024-06-15",
          "start_time": "15:00",
          "end_time": "20:00",
          "category": "fair-festival",
          "secondary_category": "food-drink",
          "address": "City Park Pavilion, Boulder, CO, USA",
          "lat": 40.0150,
          "lng": -105.2705,
          "recurring": false,
          "fee_required": "Free admission, ride tickets $2-5 each",
          "event_url": "https://www.boulderfair.com",
          "host_name": "Boulder Community Events"
        },
        {
          "title": "Scuba Diving Course",
          "description": "Open water scuba diving certification course for beginners. All equipment provided, includes pool and open water training.",
          "date": "2024-07-10",
          "start_time": "08:00",
          "end_time": "17:00",
          "category": "diving",
          "address": "Aquatic Center, San Diego, CA, USA",
          "lat": 32.7157,
          "lng": -117.1611,
          "recurring": false,
          "fee_required": "$450 includes equipment and certification",
          "event_url": "https://www.sandiegodiving.com",
          "host_name": "San Diego Dive Center"
        },
        {
          "title": "Holiday Market & Shopping Festival",
          "description": "Browse unique holiday gifts from local artisans and vendors. Hot cocoa, holiday music, and special promotions all day.",
          "date": "2024-12-15",
          "start_time": "10:00",
          "end_time": "18:00",
          "category": "shopping",
          "address": "Downtown Square, Portland, OR, USA",
          "lat": 45.5152,
          "lng": -122.6784,
          "recurring": false,
          "fee_required": "Free admission",
          "event_url": "https://www.portlandholidaymarket.com",
          "host_name": "Portland Downtown Association"
        },
        {
          "title": "Wellness Workshop: Mindfulness & Meditation",
          "description": "Learn mindfulness techniques and meditation practices to reduce stress and improve mental health. All experience levels welcome.",
          "date": "2024-08-05",
          "start_time": "14:00",
          "end_time": "16:00",
          "category": "health",
          "secondary_category": "education",
          "address": "Community Wellness Center, Austin, TX, USA",
          "lat": 30.2672,
          "lng": -97.7431,
          "recurring": false,
          "fee_required": "$25 per person, mats provided",
          "event_url": "https://www.austinwellness.org",
          "host_name": "Austin Wellness Community"
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
        setBulkError('Please enter JSON data to import');
        return;
      }

      setIsLoading(true);
      setBulkError(null);
      setSuccess(null);

      try {
        const jsonData = JSON.parse(jsonInput);
        
        // Validate JSON structure
        if (!jsonData.events || !Array.isArray(jsonData.events)) {
          setBulkError('JSON must contain an "events" array. Please check the template format.');
          return;
        }

        if (jsonData.events.length === 0) {
          setBulkError('Events array is empty. Please add at least one event to import.');
          return;
        }

        if (jsonData.events.length > 100) {
          setBulkError('Too many events. Please limit to 100 events per batch for optimal performance.');
          return;
        }

        // Validate required fields for each event
        const requiredFields = ['title', 'description', 'date', 'start_time', 'category', 'address', 'lat', 'lng'];
        const validationErrors = [];

        jsonData.events.forEach((event, index) => {
          const missingFields = requiredFields.filter(field => !event[field]);
          if (missingFields.length > 0) {
            validationErrors.push(`Event ${index + 1}: Missing required fields: ${missingFields.join(', ')}`);
          }
        });

        if (validationErrors.length > 0) {
          setBulkError(`Validation errors found:\n${validationErrors.slice(0, 5).join('\n')}${validationErrors.length > 5 ? '\n...and more' : ''}`);
          return;
        }
        
        const response = await fetchData('/admin/events/bulk-simple', 'POST', jsonData);
        
        if (response) {
          setImportResults(response);
          if (response.success_count > 0) {
            setSuccess(`Successfully imported ${response.success_count} events!${response.error_count > 0 ? ` ${response.error_count} events had errors.` : ''}`);
            if (response.error_count === 0) {
              setJsonInput(''); // Clear input only on complete success
            }
          }
          if (response.error_count > 0 && response.success_count === 0) {
            setBulkError(`All ${response.error_count} events failed to import. Check errors below.`);
          }
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          setBulkError('Invalid JSON format. Please check your JSON syntax and ensure all quotes and brackets are properly closed.');
        } else {
          setBulkError('Failed to import events: ' + (error.message || 'Unknown error occurred. Please try again.'));
        }
      } finally {
        setIsLoading(false);
      }
    };

    const clearResults = () => {
      setImportResults(null);
      setBulkError(null);
      setSuccess(null);
    };

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-blue-600 mb-4">Bulk Event Import</h3>
          
          {/* Success/Error Messages */}
          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              <div className="font-medium mb-1">✅ Import Completed</div>
              <div>{success}</div>
            </div>
          )}
          
          {bulkError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              <div className="font-medium mb-1">❌ Import Error</div>
              <pre className="whitespace-pre-wrap text-sm">{bulkError}</pre>
            </div>
          )}
          
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p><strong>Required fields:</strong> title, description, date, start_time, category, address, lat, lng</p>
                  <p><strong>Optional fields:</strong> end_time, end_date, recurring, frequency, fee_required, event_url, host_name</p>
                  <p><strong>UX Enhancement fields:</strong></p>
                  <ul className="ml-4 list-disc text-xs">
                    <li><strong>fee_required:</strong> Ticket/fee information (e.g., "Free admission", "$10 entry")</li>
                    <li><strong>event_url:</strong> External website URL for registration or details</li>
                    <li><strong>host_name:</strong> Organization or host name</li>
                  </ul>
                </div>
                <div>
                  <p><strong>Valid categories:</strong> food-drink, music, arts, sports, automotive, airshows, vehicle-sports, community, religious, education, veteran, cookout, networking, fair-festival, diving, shopping, health, outdoors, photography, family, gaming, real-estate, adventure, seasonal, agriculture, other</p>
                  <p><strong>Optional secondary category:</strong> Use the same category IDs as above. Adds more descriptive categorization to events.</p>
                  <p><strong>Time format:</strong> HH:MM (24-hour format, e.g., "14:30" for 2:30 PM)</p>
                  <p><strong>Date format:</strong> YYYY-MM-DD (e.g., "2024-07-15")</p>
                  <p><strong>Frequency options:</strong> weekly, monthly (only if recurring is true)</p>
                  <p><strong>Batch size:</strong> Maximum 100 events per import for optimal performance</p>
                </div>
              </div>
            </div>
          </div>

          {/* JSON Input */}
                      <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  JSON Data (Paste your event data here)
                </label>
                <div className="text-xs text-gray-500">
                  {jsonInput.length > 0 && `${jsonInput.length} characters`}
                </div>
              </div>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full h-64 p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-y"
                placeholder="Paste your JSON data here or use the template above..."
                spellCheck="false"
              />
              <div className="mt-1 text-xs text-gray-500">
                💡 Tip: Use the "Copy Template" button above to get started with proper formatting
              </div>
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

        {/* Event Categories Reference */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-blue-600 flex items-center">
              <List className="mr-2" />
              Available Event Categories
            </h3>
            <div className="text-sm text-gray-500">
              {EVENT_CATEGORIES.length - 1} categories (excluding "All Events")
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {EVENT_CATEGORIES.filter(cat => cat.id !== 'all').map((category) => (
              <div key={category.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-800">{category.name}</h4>
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                    {category.id}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{category.description}</p>
                <div className="mt-3 text-xs text-gray-500">
                  Current events: {analytics.eventCategoryDistribution[category.id] || 0}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Note:</strong> These categories help organize events and make them easier to find. 
              When creating or editing events, users can select from these predefined categories to ensure consistency.
            </p>
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

  // Enhanced AnalyticsDashboard Component with Grafana-style functionality
  const AnalyticsDashboard = () => {
    const [analyticsData, setAnalyticsData] = useState(null);
    const [timeSeriesData, setTimeSeriesData] = useState({});
    const [topHosts, setTopHosts] = useState([]);
    const [geographicData, setGeographicData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Filter states
    const [filters, setFilters] = useState({
      startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      excludeUsers: '',
      category: '',
      timeFrame: '30d'
    });
    
    const [selectedMetrics, setSelectedMetrics] = useState(['events', 'active_hosts']);
    const [chartPeriod, setChartPeriod] = useState('daily');
    const [cumulativeMode, setCumulativeMode] = useState({
      events: true,      // Default to cumulative for events 
      active_hosts: false // Default to period-based for active hosts
    });
    const [categoryCloudData, setCategoryCloudData] = useState(null);
    const [refreshInterval, setRefreshInterval] = useState(null);

    // Chart theme
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

    // Fetch analytics data
    const fetchAnalyticsData = async () => {
      setLoading(true);
      try {
        // Build query parameters
        const params = new URLSearchParams();
        if (filters.startDate) params.append('start_date', filters.startDate);
        if (filters.endDate) params.append('end_date', filters.endDate);
        if (filters.excludeUsers) params.append('exclude_users', filters.excludeUsers);
        if (filters.category) params.append('category', filters.category);

        // Fetch main metrics using the shared fetchData function
        const metrics = await fetchData(`/admin/analytics/metrics?${params}`);
        setAnalyticsData(metrics);

        // Fetch time series data for selected metrics
        const timeSeriesPromises = selectedMetrics.map(async (metric) => {
          const tsParams = new URLSearchParams(params);
          tsParams.append('metric', metric);
          tsParams.append('period', chartPeriod);
          // Add cumulative parameter based on the mode for this metric
          if (cumulativeMode[metric] !== undefined) {
            tsParams.append('cumulative', cumulativeMode[metric]);
          }
          
          const data = await fetchData(`/admin/analytics/time-series?${tsParams}`);
          return [metric, data];
        });

        const timeSeriesResults = await Promise.all(timeSeriesPromises);
        const timeSeriesObj = Object.fromEntries(timeSeriesResults);
        setTimeSeriesData(timeSeriesObj);

        // Fetch top hosts
        const hostsData = await fetchData(`/admin/analytics/top-hosts?${params}`);
        setTopHosts(hostsData.hosts || []);

        // Fetch geographic data
        const geoData = await fetchData(`/admin/analytics/geographic?${params}`);
        setGeographicData(geoData);

        // Fetch category cloud data
        const categoryData = await fetchData(`/admin/analytics/category-cloud?${params}`);
        setCategoryCloudData(categoryData);

      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        if (error.message.includes('Authentication failed')) {
          // Redirect back to login
          window.location.reload();
        }
        setError('Failed to fetch analytics data: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    // Handle time frame presets
    const handleTimeFrameChange = (timeFrame) => {
      const now = new Date();
      let startDate, endDate = format(now, 'yyyy-MM-dd');

      switch (timeFrame) {
        case '7d':
          startDate = format(subDays(now, 7), 'yyyy-MM-dd');
          break;
        case '30d':
          startDate = format(subDays(now, 30), 'yyyy-MM-dd');
          break;
        case '90d':
          startDate = format(subDays(now, 90), 'yyyy-MM-dd');
          break;
        case 'thisWeek':
          startDate = format(startOfWeek(now), 'yyyy-MM-dd');
          endDate = format(endOfWeek(now), 'yyyy-MM-dd');
          break;
        case 'thisMonth':
          startDate = format(startOfMonth(now), 'yyyy-MM-dd');
          endDate = format(endOfMonth(now), 'yyyy-MM-dd');
          break;
        default:
          return;
      }

      setFilters(prev => ({ ...prev, startDate, endDate, timeFrame }));
    };

    // Auto-refresh functionality
    const toggleAutoRefresh = (enabled) => {
      if (enabled) {
        const interval = setInterval(fetchAnalyticsData, 60000); // Refresh every minute
        setRefreshInterval(interval);
      } else {
        if (refreshInterval) {
          clearInterval(refreshInterval);
          setRefreshInterval(null);
        }
      }
    };

    useEffect(() => {
      fetchAnalyticsData();
      return () => {
        if (refreshInterval) clearInterval(refreshInterval);
      };
    }, [filters, selectedMetrics, chartPeriod, cumulativeMode]);

    // Chart configurations
    const createLineChartConfig = (data, label, color) => ({
      data: {
        labels: data.data?.map(d => d.period) || [],
        datasets: [{
          label: label,
          data: data.data?.map(d => d.count) || [],
          borderColor: color,
          backgroundColor: color + '20',
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: `${label} Over Time` }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });

    const createBarChartConfig = (data, title, color) => ({
      data: {
        labels: Object.keys(data || {}),
        datasets: [{
          label: title,
          data: Object.values(data || {}),
          backgroundColor: color,
          borderColor: color.replace('20', ''),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: title }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });

    const createPieChartConfig = (data, title) => ({
      data: {
        labels: Object.keys(data || {}),
        datasets: [{
          data: Object.values(data || {}),
          backgroundColor: [
            chartTheme.colors.primary,
            chartTheme.colors.secondary,
            chartTheme.colors.accent,
            chartTheme.colors.purple,
            chartTheme.colors.pink,
            chartTheme.colors.teal,
            chartTheme.colors.orange
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          title: { display: true, text: title }
        }
      }
    });

    // Create bubble chart config for categories
    const createBubbleChartConfig = (categories) => {
      const maxCount = Math.max(...categories.map(c => c.count));
      const bubbleData = categories.map((cat, index) => ({
        x: index + 1,
        y: cat.avg_interest + cat.avg_views, // Combined engagement score
        r: Math.max(5, (cat.count / maxCount) * 50), // Bubble size based on event count
        label: cat.name,
        count: cat.count,
        hosts: cat.unique_hosts,
        engagement: (cat.avg_interest + cat.avg_views).toFixed(1)
      }));

      return {
        data: {
          datasets: [{
            label: 'Categories',
            data: bubbleData,
            backgroundColor: categories.map((_, i) => 
              Object.values(chartTheme.colors)[i % Object.values(chartTheme.colors).length] + '60'
            ),
            borderColor: categories.map((_, i) => 
              Object.values(chartTheme.colors)[i % Object.values(chartTheme.colors).length]
            ),
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { 
              display: true, 
              text: 'Category Popularity (Size = Event Count, Y = Engagement)',
              font: { size: 14 }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const point = context.raw;
                  return [
                    `Category: ${point.label}`,
                    `Events: ${point.count}`,
                    `Hosts: ${point.hosts}`,
                    `Avg Engagement: ${point.engagement}`
                  ];
                }
              }
            }
          },
          scales: {
            x: { 
              display: false,
              grid: { display: false }
            },
            y: {
              title: {
                display: true,
                text: 'Engagement Score (Interest + Views)'
              },
              beginAtZero: true
            }
          }
        }
      };
    };

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-lg">Loading analytics...</span>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Filters and Controls */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchAnalyticsData}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  onChange={(e) => toggleAutoRefresh(e.target.checked)}
                  className="mr-2"
                />
                Auto-refresh
              </label>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Time Frame Presets */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Frame</label>
              <select
                value={filters.timeFrame}
                onChange={(e) => handleTimeFrameChange(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="thisWeek">This week</option>
                <option value="thisMonth">This month</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">All Categories</option>
                <option value="community">Community</option>
                <option value="food">Food & Drink</option>
                <option value="music">Music</option>
                <option value="arts">Arts & Culture</option>
                <option value="sports">Sports & Fitness</option>
              </select>
            </div>

            {/* Exclude Users */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exclude Users (IDs)</label>
              <input
                type="text"
                value={filters.excludeUsers}
                onChange={(e) => setFilters(prev => ({ ...prev, excludeUsers: e.target.value }))}
                placeholder="1,2,3"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            {/* Chart Period */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chart Period</label>
              <select
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        {analyticsData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold opacity-90">Total Events</h3>
                  <p className="text-3xl font-bold">{analyticsData.total_events}</p>
                </div>
                <Calendar className="w-8 h-8 opacity-80" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-md p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold opacity-90">Total Users</h3>
                  <p className="text-3xl font-bold">{analyticsData.total_users}</p>
                </div>
                <Users className="w-8 h-8 opacity-80" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold opacity-90">Active Hosts</h3>
                  <p className="text-3xl font-bold">{analyticsData.active_hosts}</p>
                  <p className="text-sm opacity-75">Last 30 days</p>
                </div>
                <Activity className="w-8 h-8 opacity-80" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-md p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold opacity-90">Host Rate</h3>
                  <p className="text-3xl font-bold">
                    {analyticsData.total_users > 0 
                      ? Math.round((analyticsData.active_hosts / analyticsData.total_users) * 100)
                      : 0}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 opacity-80" />
              </div>
            </div>
          </div>
        )}

        {/* Time Series Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {selectedMetrics.map(metric => (
            timeSeriesData[metric] && (
              <div key={metric} className="bg-white rounded-lg shadow-md p-6">
                <div className="h-80">
                  <Line 
                    {...createLineChartConfig(
                      timeSeriesData[metric], 
                      metric.charAt(0).toUpperCase() + metric.slice(1).replace('_', ' '),
                      chartTheme.colors[metric === 'events' ? 'primary' : metric === 'active_hosts' ? 'secondary' : 'accent']
                    )}
                  />
                </div>
              </div>
            )
          ))}
        </div>

        {/* Category Bubble Chart */}
        {categoryCloudData?.categories && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="h-80">
              <Bubble {...createBubbleChartConfig(categoryCloudData.categories)} />
            </div>
          </div>
        )}

        {/* Geographic Distribution */}
        {geographicData && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="h-80">
              <Bar {...createBarChartConfig(geographicData.by_state, 'Events by State', chartTheme.colors.teal + '80')} />
            </div>
          </div>
        )}

        {/* Top Hosts Table */}
        {topHosts.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-4">Top Event Hosts</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Host</th>
                    <th className="text-left py-2">Events Created</th>
                    <th className="text-left py-2">First Event</th>
                    <th className="text-left py-2">Latest Event</th>
                  </tr>
                </thead>
                <tbody>
                  {topHosts.map((host, index) => (
                    <tr key={host.user_id} className="border-b hover:bg-gray-50">
                      <td className="py-2">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-sm font-semibold text-blue-600">#{index + 1}</span>
                          </div>
                          {host.email}
                        </div>
                      </td>
                      <td className="py-2 font-semibold">{host.event_count}</td>
                      <td className="py-2">{format(new Date(host.first_event_date), 'MMM dd, yyyy')}</td>
                      <td className="py-2">{format(new Date(host.last_event_date), 'MMM dd, yyyy')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Chart Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Metric Selection */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-4">Chart Metrics</h3>
            <div className="space-y-2">
              {['events', 'active_hosts'].map(metric => (
                <label key={metric} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedMetrics.includes(metric)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMetrics(prev => [...prev, metric]);
                      } else {
                        setSelectedMetrics(prev => prev.filter(m => m !== metric));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="capitalize">{metric.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Chart Display Options */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-4">Display Options</h3>
            
            {/* Period Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Chart Period</label>
              <select
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Cumulative Mode Toggles */}
            <div>
              <label className="block text-sm font-medium mb-2">Cumulative Mode</label>
              <div className="space-y-2">
                {['events', 'active_hosts'].map(metric => (
                  <label key={metric} className="flex items-center justify-between">
                    <span className="capitalize text-sm">{metric.replace('_', ' ')}</span>
                    <div className="flex items-center">
                      <span className="text-xs mr-2 text-gray-500">
                        {cumulativeMode[metric] ? 'Cumulative' : 'Period-based'}
                      </span>
                      <button
                        onClick={() => setCumulativeMode(prev => ({ 
                          ...prev, 
                          [metric]: !prev[metric] 
                        }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          cumulativeMode[metric] ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          cumulativeMode[metric] ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Cumulative shows running totals, period-based shows activity per time period.
              </p>
            </div>
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