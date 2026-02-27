import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Users, Calendar, Server, Shield, LogOut, Plus, BarChart2, Database,
  Trash2, Upload, Download, RefreshCw, Search, Filter, Eye, Heart,
  Edit, X, AlertTriangle, CheckCircle, UserPlus, Lock, MessageSquare,
  TrendingUp, TrendingDown, Activity, Globe, MapPin, Clock, List,
  ChevronDown, ChevronUp, Lightbulb, FileText, UserCheck, FileX,
  Clock3, CheckCircle2, XCircle, AlertOctagon, ExternalLink, Image,
  Flag, Monitor, HardDrive, Gavel, FileSearch, Share2, DollarSign,
  Copy, ToggleLeft, ToggleRight, Percent, Building, Crown, Gift, User
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
        await fetchData(`/admin/users/${user.id}/role?role=${editUser.role}`, 'PUT');
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
            <option value="premium">Premium User</option>
            <option value="enterprise">Enterprise User</option>
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
              {isResettingPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
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

// Privacy Request View Modal
const PrivacyRequestModal = ({ request, isOpen, onClose, onUpdate }) => {
  const [status, setStatus] = useState(request?.status || 'pending');
  const [notes, setNotes] = useState(request?.admin_notes || '');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (request) {
      setStatus(request.status);
      setNotes(request.admin_notes || '');
    }
  }, [request]);

  const handleStatusUpdate = async () => {
    if (!request) return;
    
    try {
      setIsProcessing(true);
      await fetchData(`/admin/privacy-requests/${request.id}/status`, 'PUT', {
        status,
        admin_notes: notes
      });
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating privacy request:', error);
      alert('Error updating request: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessRequest = async (action) => {
    if (!request) return;
    
    if (!confirm(`Are you sure you want to ${action} this privacy request? This action may be irreversible.`)) {
      return;
    }

    try {
      setIsProcessing(true);
      const endpoint = action === 'export' 
        ? `/admin/privacy-requests/${request.id}/export`
        : `/admin/privacy-requests/${request.id}/delete-data`;
      
      const response = await fetchData(endpoint, 'POST');
      
      if (action === 'export' && response.export_url) {
        // Open export in new tab
        window.open(response.export_url, '_blank');
      }
      
      // Update status to completed
      await fetchData(`/admin/privacy-requests/${request.id}/status`, 'PUT', {
        status: 'completed',
        admin_notes: notes + `\n${action} completed on ${new Date().toISOString()}`
      });
      
      onUpdate();
      alert(`Privacy request ${action} completed successfully.`);
    } catch (error) {
      console.error(`Error processing ${action}:`, error);
      alert(`Error processing ${action}: ` + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'access': return <Eye className="w-4 h-4" />;
      case 'deletion': return <Trash2 className="w-4 h-4" />;
      case 'portability': return <Download className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  if (!request) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Privacy Request #${request.id}`} size="xl">
      <div className="space-y-6">
        {/* Request Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Request Type</label>
            <div className="flex items-center space-x-2">
              {getTypeIcon(request.request_type)}
              <span className="capitalize font-medium">{request.request_type}</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Status</label>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
              {request.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">User Email</label>
            <p className="text-gray-900">{request.user_email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <p className="text-gray-900">{request.full_name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Submitted</label>
            <p className="text-gray-900">{new Date(request.created_at).toLocaleString()}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Request ID</label>
            <p className="text-gray-900 font-mono">#{request.id}</p>
          </div>
        </div>

        {/* User Details */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional Details</label>
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
              {request.additional_details || 'No additional details provided.'}
            </pre>
          </div>
        </div>

        {/* Verification Info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Verification Information</label>
          <div className="bg-gray-50 rounded-lg p-4">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
              {request.verification_info || 'No verification information provided.'}
            </pre>
          </div>
        </div>

        {/* Status Update Section */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Update Request Status</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add internal notes about this request..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleStatusUpdate}
              disabled={isProcessing}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Update Status
            </button>

            {request.request_type === 'access' && (
              <button
                onClick={() => handleProcessRequest('export')}
                disabled={isProcessing}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Export User Data
              </button>
            )}

            {request.request_type === 'deletion' && (
              <button
                onClick={() => handleProcessRequest('delete')}
                disabled={isProcessing}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete User Data
              </button>
            )}
          </div>
        </div>

        {/* Timeline/History */}
        {request.admin_notes && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Request History</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">{request.admin_notes}</pre>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
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

// ==================== AI IMPORT (defined outside AdminDashboard to prevent remount) ====================
const AIImport = ({ fetchData }) => {
  const [rawInput, setRawInput] = useState('');
  const [parsedEvents, setParsedEvents] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiSuccess, setAiSuccess] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [tokenUsage, setTokenUsage] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({});
  const fileInputRef = useRef(null);

  const validCategories = [
    'food-drink', 'music', 'arts', 'sports', 'automotive', 'airshows',
    'vehicle-sports', 'community', 'religious', 'education', 'veteran',
    'cookout', 'networking', 'fair-festival', 'diving', 'shopping',
    'health', 'outdoors', 'photography', 'family', 'gaming',
    'real-estate', 'adventure', 'seasonal', 'agriculture', 'other'
  ];

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setRawInput(evt.target.result);
      setAiError(null);
      setParsedEvents(null);
      setImportResults(null);
    };
    reader.readAsText(file);
  };

  const handleAIParse = async () => {
    if (!rawInput.trim()) {
      setAiError('Please paste or upload some event data first');
      return;
    }
    setIsProcessing(true);
    setAiError(null);
    setAiSuccess(null);
    setParsedEvents(null);
    setImportResults(null);
    setTokenUsage(null);
    try {
      const result = await fetchData('/admin/ai-parse-events', 'POST', { raw_data: rawInput });
      setParsedEvents(result.events);
      setTokenUsage(result.usage);
      setAiSuccess(`AI parsed ${result.count} event${result.count !== 1 ? 's' : ''} from your data`);
    } catch (err) {
      setAiError(err.message || 'Failed to parse events with AI');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveEvent = (index) => {
    setParsedEvents(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditEvent = (index) => {
    setEditingIndex(index);
    setEditForm({ ...parsedEvents[index] });
  };

  const handleSaveEdit = () => {
    setParsedEvents(prev => prev.map((ev, i) => i === editingIndex ? { ...editForm } : ev));
    setEditingIndex(null);
    setEditForm({});
  };

  const handleImportAll = async () => {
    if (!parsedEvents || parsedEvents.length === 0) return;
    setIsImporting(true);
    setAiError(null);
    setAiSuccess(null);
    let successCount = 0;
    let errorCount = 0;
    const errorDetails = [];
    for (let i = 0; i < parsedEvents.length; i++) {
      try {
        const resp = await fetchData('/events', 'POST', parsedEvents[i]);
        if (resp && resp.id) {
          successCount++;
        } else {
          errorCount++;
          errorDetails.push(`Event ${i + 1} (${parsedEvents[i].title}): Unexpected response`);
        }
      } catch (err) {
        errorCount++;
        errorDetails.push(`Event ${i + 1} (${parsedEvents[i].title}): ${err.message || 'Error'}`);
      }
    }
    setImportResults({ success_count: successCount, error_count: errorCount, errors: errorDetails });
    if (successCount > 0) {
      setAiSuccess(`Successfully imported ${successCount} event${successCount !== 1 ? 's' : ''}!${errorCount > 0 ? ` ${errorCount} failed.` : ''}`);
      if (errorCount === 0) {
        setParsedEvents(null);
        setRawInput('');
      }
    }
    if (errorCount > 0 && successCount === 0) {
      setAiError(`All ${errorCount} events failed to import.`);
    }
    setIsImporting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-md p-6 text-white">
        <h3 className="text-2xl font-bold mb-2 flex items-center">
          <Lightbulb className="mr-3" size={28} />
          AI Event Import
        </h3>
        <p className="text-purple-100">
          Paste any messy data — spreadsheets, emails, lists, website copy — and AI will parse it into structured events ready to import.
        </p>
      </div>

      {/* Messages */}
      {aiSuccess && (
        <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-start">
          <CheckCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">{aiSuccess}</div>
            {tokenUsage && (
              <div className="text-xs mt-1 text-green-600">
                Tokens used: {tokenUsage.input_tokens} input + {tokenUsage.output_tokens} output
              </div>
            )}
          </div>
        </div>
      )}

      {aiError && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-start">
          <AlertTriangle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">Error</div>
            <div className="text-sm mt-1">{aiError}</div>
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-800">Step 1: Provide Raw Data</h4>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.tsv,.txt,.json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm flex items-center"
            >
              <Upload className="w-4 h-4 mr-1" />
              Upload File
            </button>
          </div>
        </div>

        <textarea
          value={rawInput}
          onChange={(e) => { setRawInput(e.target.value); setAiError(null); }}
          className="w-full h-56 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm resize-y"
          placeholder={`Paste any event data here. Examples:\n\n- Spreadsheet rows (copy-paste from Excel/Google Sheets)\n- Email text with event details\n- A list of events from a website\n- CSV data\n- Even messy notes like:\n  "Jazz night at Blue Note, March 15 8pm, $20 cover\n   Farmers market every Saturday 9am-1pm downtown Portland free"`}
          spellCheck="false"
        />

        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-gray-500">
            {rawInput.length > 0 && `${rawInput.length} characters`}
          </div>
          <button
            onClick={handleAIParse}
            disabled={isProcessing || !rawInput.trim()}
            className="bg-purple-600 text-white py-2 px-6 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center font-medium"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                AI Processing...
              </>
            ) : (
              <>
                <Lightbulb className="mr-2" size={16} />
                Parse with AI
              </>
            )}
          </button>
        </div>
      </div>

      {/* Parsed Events Review */}
      {parsedEvents && parsedEvents.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-800">
              Step 2: Review Parsed Events ({parsedEvents.length})
            </h4>
            <button
              onClick={handleImportAll}
              disabled={isImporting}
              className="bg-green-600 text-white py-2 px-6 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center font-medium"
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2" size={16} />
                  Import All {parsedEvents.length} Events
                </>
              )}
            </button>
          </div>

          <div className="space-y-3">
            {parsedEvents.map((event, index) => (
              <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                {editingIndex === index ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500">Title</label>
                        <input value={editForm.title || ''} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Category</label>
                        <select value={editForm.category || 'other'} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="w-full p-2 border rounded text-sm">
                          {validCategories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Date</label>
                        <input type="date" value={editForm.date || ''} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Start Time</label>
                        <input type="time" value={editForm.start_time || ''} onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">End Time</label>
                        <input type="time" value={editForm.end_time || ''} onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Address</label>
                        <input value={editForm.address || ''} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Lat</label>
                        <input type="number" step="any" value={editForm.lat || ''} onChange={(e) => setEditForm({ ...editForm, lat: parseFloat(e.target.value) })} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Lng</label>
                        <input type="number" step="any" value={editForm.lng || ''} onChange={(e) => setEditForm({ ...editForm, lng: parseFloat(e.target.value) })} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Fee Info</label>
                        <input value={editForm.fee_required || ''} onChange={(e) => setEditForm({ ...editForm, fee_required: e.target.value })} className="w-full p-2 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Host Name</label>
                        <input value={editForm.host_name || ''} onChange={(e) => setEditForm({ ...editForm, host_name: e.target.value })} className="w-full p-2 border rounded text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Description</label>
                      <textarea value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full p-2 border rounded text-sm h-20 resize-y" />
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={handleSaveEdit} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">Save</button>
                      <button onClick={() => { setEditingIndex(null); setEditForm({}); }} className="px-3 py-1.5 bg-gray-400 text-white rounded text-sm hover:bg-gray-500">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold text-gray-800">{event.title}</span>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{event.category}</span>
                        {event.secondary_category && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{event.secondary_category}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-0.5">
                        <div className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1.5" />{event.date} at {event.start_time}{event.end_time ? ` - ${event.end_time}` : ''}{event.end_date && ` (through ${event.end_date})`}</div>
                        <div className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1.5" />{event.address}</div>
                        {event.host_name && (<div className="flex items-center"><User className="w-3.5 h-3.5 mr-1.5" />{event.host_name}</div>)}
                        {event.fee_required && (<div className="flex items-center"><DollarSign className="w-3.5 h-3.5 mr-1.5" />{event.fee_required}</div>)}
                        <div className="text-xs text-gray-400 mt-1 line-clamp-2">{event.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-3">
                      <button onClick={() => handleEditEvent(index)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleRemoveEvent(index)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Remove"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Results */}
      {importResults && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Import Results</h4>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-3xl font-bold text-green-600">{importResults.success_count}</div>
              <div className="text-sm text-green-700 font-medium">Imported</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-3xl font-bold text-red-600">{importResults.error_count}</div>
              <div className="text-sm text-red-700 font-medium">Failed</div>
            </div>
          </div>
          {importResults.errors.length > 0 && (
            <div className="mt-3">
              <h5 className="font-medium text-red-600 mb-2">Errors:</h5>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {importResults.errors.map((err, i) => (
                  <div key={i} className="text-sm text-red-600 bg-red-50 p-2 rounded">{err}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h5 className="font-medium text-blue-800 mb-2">Tips for best results:</h5>
        <ul className="text-sm text-blue-700 space-y-1 list-disc ml-4">
          <li>Include dates, times, locations, and event names in your data</li>
          <li>CSV/spreadsheet data with headers works great</li>
          <li>The AI will estimate coordinates from addresses</li>
          <li>Review and edit parsed events before importing</li>
          <li>You can remove events you don't want to import</li>
        </ul>
      </div>
    </div>
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

  // Add sorting state for events table
  const [eventSortField, setEventSortField] = useState('id');
  const [eventSortDirection, setEventSortDirection] = useState('desc');

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
          "title": "Summerfest",
          "description": "The World's Largest Music Festival, spanning multiple weekends in June and July. With hundreds of artists across 12 stages, it offers a diverse lineup from global superstars to emerging acts, alongside delicious food and vibrant lakefront views. A true music marathon for all ages and tastes.",
          "date": "2025-06-19",
          "start_time": "12:00",
          "end_time": "23:00",
          "end_date": "2025-07-05",
          "category": "music",
          "secondary_category": "fair-festival",
          "address": "Henry Maier Festival Park, Milwaukee, WI, USA",
          "lat": 43.0307,
          "lng": -87.8979,
          "recurring": false,
          "frequency": null,
          "fee_required": "Admission tickets required, some headliner shows require separate tickets",
          "event_url": "https://www.summerfest.com/",
          "host_name": "Milwaukee World Festival, Inc.",
          "verified": true
        },
        {
          "title": "Farmers Market",
          "description": "Weekly farmers market featuring local produce, artisanal foods, and handcrafted goods. Support local farmers and businesses while enjoying fresh, seasonal offerings.",
          "date": "2025-05-15",
          "start_time": "08:00",
          "end_time": "13:00",
          "category": "community",
          "secondary_category": "food-drink",
          "address": "Downtown Square, Madison, WI, USA",
          "lat": 43.0731,
          "lng": -89.4012,
          "recurring": true,
          "frequency": "weekly",
          "fee_required": "Free admission",
          "event_url": "https://www.madisonmarket.org/",
          "host_name": "Madison Farmers Association"
        },
        {
          "title": "Sample Music Festival",
          "description": "A wonderful outdoor music festival featuring local and international artists. Bring your friends and family for a day of great music, food, and fun.",
          "date": "2024-07-15",
          "start_time": "14:00",
          "end_time": "22:00",
          "category": "music",
          "address": "Central Park, New York, NY, USA",
          "lat": 40.7829,
          "lng": -73.9654,
          "recurring": false,
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

        // No limit on number of events

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
        
        let successCount = 0;
        let errorCount = 0;
        const errorDetails = [];

        for (let i = 0; i < jsonData.events.length; i++) {
          const eventPayload = jsonData.events[i];
          try {
            const resp = await fetchData('/events', 'POST', eventPayload);
            if (resp && resp.id) {
              successCount++;
            } else {
              errorCount++;
              errorDetails.push(`Event ${i + 1}: Unexpected response`);
            }
          } catch (indivErr) {
            errorCount++;
            errorDetails.push(`Event ${i + 1}: ${(indivErr?.message) || 'Error creating event'}`);
          }
        }

        const resultsSummary = {
          success_count: successCount,
          error_count: errorCount,
          errors: errorDetails,
        };
        setImportResults(resultsSummary);

        if (successCount > 0) {
          setSuccess(`Successfully imported ${successCount} events!${errorCount > 0 ? ` ${errorCount} events had errors.` : ''}`);
          if (errorCount === 0) {
            setJsonInput('');
          }
        }
        if (errorCount > 0 && successCount === 0) {
          setBulkError(`All ${errorCount} events failed to import. Check errors below.`);
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
                  <p><strong>Optional fields:</strong> end_time, end_date, recurring, frequency, fee_required, event_url, host_name, secondary_category</p>
                  <p><strong>UX Enhancement fields:</strong></p>
                  <ul className="ml-4 list-disc text-xs">
                    <li><strong>fee_required:</strong> Ticket/fee information (e.g., "Free admission", "$10 entry")</li>
                    <li><strong>event_url:</strong> External website URL for registration or details</li>
                    <li><strong>host_name:</strong> Organization or host name</li>
                  </ul>
                </div>
                <div>
                  <p><strong>Valid categories:</strong> food-drink, music, arts, sports, automotive, airshows, vehicle-sports, community, religious, education, veteran, cookout, networking, fair-festival, diving, shopping, health, outdoors, photography, family, gaming, real-estate, adventure, seasonal, agriculture, navigation, other</p>
                  <p><strong>Optional secondary category:</strong> Use the same category IDs as above. Adds more descriptive categorization to events.</p>
              <p><strong>Time format:</strong> HH:MM (24-hour format, e.g., "14:30" for 2:30 PM)</p>
              <p><strong>Date format:</strong> YYYY-MM-DD (e.g., "2024-07-15")</p>
              <p><strong>Frequency options:</strong> weekly, monthly (only if recurring is true)</p>
                  <p><strong>Batch size:</strong> No limit on number of events per import</p>
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
              <div className="mt-1 text-xs text-gray-500 flex items-center">
                <Lightbulb className="w-4 h-4 mr-1" />
                Tip: Use the "Copy Template" button above to get started with proper formatting
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

  // Fetch privacy requests
  const fetchPrivacyRequests = async () => {
    try {
      const requests = await fetchData('/admin/privacy-requests');
      setPrivacyRequests(requests);
    } catch (error) {
      console.error('Error fetching privacy requests:', error);
      setError('Failed to fetch privacy requests: ' + error.message);
    }
  };

  // Fetch user details and initial data
  useEffect(() => {
    const fetchUserAndData = async () => {
      if (!isLoggedIn) return;

      try {
        // Fetch current user details and check admin permissions
        const userMe = await fetchData('/users/me');
        setUserDetails(userMe);

        // Check if user is an admin
        if (userMe.role !== 'admin') {
          setAccessDenied(true);
          throw new Error('Insufficient admin permissions');
        }

        setError(null);
        setAccessDenied(false);
      } catch (error) {
        setError(error.message);
        console.error('Error checking user authentication:', error);

        if (error.message === 'Insufficient admin permissions') {
          setAccessDenied(true);
        } else {
          handleLogout();
        }
      }
    };

    // Only check authentication and user details on login state change
    if (isLoggedIn) {
      fetchUserAndData();
    }
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
      // Build query parameters for events with enhanced filtering
      const eventParams = new URLSearchParams();
      if (eventFilterCategory && eventFilterCategory !== 'all') {
        eventParams.set('category', eventFilterCategory);
      }
      if (eventSearch && eventSearch.trim()) {
        eventParams.set('search', eventSearch.trim());
      }
      // Set a high limit to fetch more events for better filtering
      eventParams.set('limit', '5000');

      const eventsEndpoint = eventParams.toString() 
        ? `/events?${eventParams.toString()}`
        : '/events?limit=5000';

      const [usersData, eventsData] = await Promise.all([
        fetchData('/admin/users'),
        fetchData(eventsEndpoint)
      ]);

      setUsers(usersData);
      setEvents(eventsData);

      // Refresh privacy requests
      await fetchPrivacyRequests();

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

  // Debounced search effect to avoid too many API calls
  useEffect(() => {
    // Only refresh if user is authenticated and authorized
    if (isLoggedIn && userDetails && !accessDenied) {
      const timeoutId = setTimeout(() => {
        refreshData();
      }, 500); // 500ms delay

      return () => clearTimeout(timeoutId);
    }
  }, [eventSearch, eventFilterCategory, isLoggedIn, userDetails, accessDenied]);

  // Initial data load
  useEffect(() => {
    // Only load data if user is logged in and has access
    if (isLoggedIn && userDetails && !accessDenied) {
      refreshData();
    }
  }, [isLoggedIn, userDetails, accessDenied]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      (userFilterRole === 'all' || user.role === userFilterRole) &&
      (user.email.toLowerCase().includes(userSearch.toLowerCase()))
    );
  }, [users, userSearch, userFilterRole]);

  // Filtered and Sorted Events
  const filteredEvents = useMemo(() => {
    let filtered = events.filter(event =>
      (eventFilterCategory === 'all' || event.category === eventFilterCategory) &&
      (event.title.toLowerCase().includes(eventSearch.toLowerCase()) ||
       event.description?.toLowerCase().includes(eventSearch.toLowerCase()) ||
       event.address?.toLowerCase().includes(eventSearch.toLowerCase()) ||
       event.host_name?.toLowerCase().includes(eventSearch.toLowerCase()))
    );

    // Sort the filtered events
    filtered.sort((a, b) => {
      let aValue = a[eventSortField];
      let bValue = b[eventSortField];

      // Handle different data types
      if (eventSortField === 'date') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (eventSortField === 'created_at') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (eventSortField === 'verified') {
        // Handle boolean values - convert to numbers for comparison
        aValue = Boolean(aValue) ? 1 : 0;
        bValue = Boolean(bValue) ? 1 : 0;
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue?.toLowerCase() || '';
      } else if (typeof aValue === 'number') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }

      if (eventSortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return filtered;
  }, [events, eventSearch, eventFilterCategory, eventSortField, eventSortDirection]);

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

  // Privacy Management States
  const [privacyRequests, setPrivacyRequests] = useState([]);
  const [privacySearch, setPrivacySearch] = useState('');
  const [privacyFilterStatus, setPrivacyFilterStatus] = useState('all');
  const [privacyFilterType, setPrivacyFilterType] = useState('all');
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [viewingRequest, setViewingRequest] = useState(null);

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
      case 'privacy':
        data = privacyRequests.map(({ id, request_type, user_email, full_name, status, created_at }) => ({
          id,
          request_type,
          user_email,
          full_name,
          status,
          created_at: new Date(created_at).toLocaleDateString(),
          days_since: Math.floor((new Date() - new Date(created_at)) / (1000 * 60 * 60 * 24))
        }));
        headers = ['ID', 'Request_Type', 'User_Email', 'Full_Name', 'Status', 'Created_At', 'Days_Since'];
        filename = 'privacy_requests_export.csv';
        break;
    }

    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header =>
        JSON.stringify(row[header.toLowerCase()] || '')
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
          <div>
            <h2 className="text-2xl font-bold text-blue-600">Event Management</h2>
            <p className="text-sm text-gray-600">
              Showing {filteredEvents.length} of {events.length} events
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => exportData('events')}
              className="flex items-center text-blue-600 hover:text-blue-800"
              title="Export Events"
            >
              <Download className="w-5 h-5 mr-2" /> Export
            </button>
            <button
              onClick={refreshData}
              className="flex items-center text-green-600 hover:text-green-800"
              title="Refresh Events"
            >
              <RefreshCw className="w-5 h-5 mr-2" /> Refresh
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
              placeholder="Search events by title, description, address, or host..."
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              className="w-full px-3 py-2 border rounded-md pl-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoComplete="off"
            />
            <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
          </div>
          <select
            value={eventFilterCategory}
            onChange={(e) => setEventFilterCategory(e.target.value)}
            className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            {[...new Set(events.map(e => e.category))].map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        {/* Event Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-full">
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
                <th 
                  className="p-3 text-left cursor-pointer hover:bg-gray-200 select-none" 
                  onClick={() => {
                    if (eventSortField === 'id') {
                      setEventSortDirection(eventSortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setEventSortField('id');
                      setEventSortDirection('desc');
                    }
                  }}
                >
                  <div className="flex items-center space-x-1">
                    <span>ID</span>
                    {eventSortField === 'id' && (
                      eventSortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-3 text-left cursor-pointer hover:bg-gray-200 select-none" 
                  onClick={() => {
                    if (eventSortField === 'title') {
                      setEventSortDirection(eventSortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setEventSortField('title');
                      setEventSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center space-x-1">
                    <span>Title</span>
                    {eventSortField === 'title' && (
                      eventSortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-3 text-left cursor-pointer hover:bg-gray-200 select-none" 
                  onClick={() => {
                    if (eventSortField === 'date') {
                      setEventSortDirection(eventSortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setEventSortField('date');
                      setEventSortDirection('desc');
                    }
                  }}
                >
                  <div className="flex items-center space-x-1">
                    <span>Date</span>
                    {eventSortField === 'date' && (
                      eventSortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-3 text-left cursor-pointer hover:bg-gray-200 select-none" 
                  onClick={() => {
                    if (eventSortField === 'category') {
                      setEventSortDirection(eventSortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setEventSortField('category');
                      setEventSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center space-x-1">
                    <span>Category</span>
                    {eventSortField === 'category' && (
                      eventSortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-3 text-left cursor-pointer hover:bg-gray-200 select-none" 
                  onClick={() => {
                    if (eventSortField === 'created_by') {
                      setEventSortDirection(eventSortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setEventSortField('created_by');
                      setEventSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center space-x-1">
                    <span>Created By</span>
                    {eventSortField === 'created_by' && (
                      eventSortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-3 text-left cursor-pointer hover:bg-gray-200 select-none" 
                  onClick={() => {
                    if (eventSortField === 'view_count') {
                      setEventSortDirection(eventSortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setEventSortField('view_count');
                      setEventSortDirection('desc');
                    }
                  }}
                >
                  <div className="flex items-center space-x-1">
                    <span>Views</span>
                    {eventSortField === 'view_count' && (
                      eventSortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-3 text-left cursor-pointer hover:bg-gray-200 select-none" 
                  onClick={() => {
                    if (eventSortField === 'interest_count') {
                      setEventSortDirection(eventSortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setEventSortField('interest_count');
                      setEventSortDirection('desc');
                    }
                  }}
                >
                  <div className="flex items-center space-x-1">
                    <span>Interested</span>
                    {eventSortField === 'interest_count' && (
                      eventSortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="p-3 text-left cursor-pointer hover:bg-gray-200 select-none" 
                  onClick={() => {
                    if (eventSortField === 'verified') {
                      setEventSortDirection(eventSortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setEventSortField('verified');
                      setEventSortDirection('desc');
                    }
                  }}
                >
                  <div className="flex items-center space-x-1">
                    <span>Verified</span>
                    {eventSortField === 'verified' && (
                      eventSortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
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
                    <span className="text-sm text-gray-600">
                      {event.view_count || 0}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-sm text-gray-600">
                      {event.interest_count || 0}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center space-x-1">
                      {event.verified ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <X className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-sm text-gray-600">
                        {event.verified ? 'Yes' : 'No'}
                      </span>
                    </div>
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
    
    const [selectedMetrics, setSelectedMetrics] = useState(['events', 'active_hosts', 'page_visits']);
    const [chartPeriod, setChartPeriod] = useState('daily');
    const [cumulativeMode, setCumulativeMode] = useState({
      events: true,      // Default to cumulative for events 
      active_hosts: false, // Default to period-based for active hosts
      page_visits: true   // Default to cumulative for page visits
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
          
          // Use different endpoint for page visits
          const endpoint = metric === 'page_visits' 
            ? `/admin/analytics/page-visits?${tsParams}`
            : `/admin/analytics/time-series?${tsParams}`;
          
          const data = await fetchData(endpoint);
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
              {['events', 'active_hosts', 'page_visits'].map(metric => (
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
                {['events', 'active_hosts', 'page_visits'].map(metric => (
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

  // Privacy Management Component
  const PrivacyManagement = () => {
    // Filtered privacy requests
    const filteredRequests = useMemo(() => {
      return privacyRequests.filter(request => {
        const email = request.email || request.user_email || '';
        const fullName = request.full_name || '';
        const id = request.id ? request.id.toString() : '';
        
        const matchesSearch = 
          email.toLowerCase().includes(privacySearch.toLowerCase()) ||
          fullName.toLowerCase().includes(privacySearch.toLowerCase()) ||
          id.includes(privacySearch);
        
        const matchesStatus = privacyFilterStatus === 'all' || request.status === privacyFilterStatus;
        const matchesType = privacyFilterType === 'all' || request.request_type === privacyFilterType;
        
        return matchesSearch && matchesStatus && matchesType;
      });
    }, [privacyRequests, privacySearch, privacyFilterStatus, privacyFilterType]);

    const getStatusColor = (status) => {
      switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'in_progress': return 'bg-blue-100 text-blue-800';
        case 'completed': return 'bg-green-100 text-green-800';
        case 'rejected': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    const getTypeIcon = (type) => {
      switch (type) {
        case 'access': return <Eye className="w-4 h-4" />;
        case 'delete': return <Trash2 className="w-4 h-4" />;
        case 'opt_out': return <X className="w-4 h-4" />;
        default: return <FileText className="w-4 h-4" />;
      }
    };

    const handleBulkStatusUpdate = async (newStatus) => {
      if (selectedRequests.length === 0) {
        alert('Please select requests to update.');
        return;
      }

      if (!confirm(`Are you sure you want to update ${selectedRequests.length} requests to ${newStatus}?`)) {
        return;
      }

      try {
        await Promise.all(
          selectedRequests.map(requestId =>
            fetchData(`/admin/privacy-requests/${requestId}/status`, 'PUT', {
              status: newStatus,
              admin_notes: `Bulk status update to ${newStatus} on ${new Date().toISOString()}`
            })
          )
        );
        setSelectedRequests([]);
        await fetchPrivacyRequests();
      } catch (error) {
        setError('Error updating requests: ' + error.message);
      }
    };

    return (
      <div className="space-y-6">
        {/* Privacy Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold opacity-90">Total Requests</h3>
                <p className="text-3xl font-bold">{privacyRequests.length}</p>
              </div>
              <FileText className="w-8 h-8 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold opacity-90">Pending</h3>
                <p className="text-3xl font-bold">
                  {privacyRequests.filter(r => r.status === 'pending').length}
                </p>
              </div>
              <Clock3 className="w-8 h-8 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold opacity-90">Completed</h3>
                <p className="text-3xl font-bold">
                  {privacyRequests.filter(r => r.status === 'completed').length}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold opacity-90">Overdue</h3>
                <p className="text-3xl font-bold">
                  {privacyRequests.filter(r => {
                    const daysSince = (new Date() - new Date(r.created_at)) / (1000 * 60 * 60 * 24);
                    return r.status === 'pending' && daysSince > 30; // 30 day SLA
                  }).length}
                </p>
                <p className="text-sm opacity-75">30+ days</p>
              </div>
              <AlertOctagon className="w-8 h-8 opacity-80" />
            </div>
          </div>
        </div>

        {/* Privacy Request Management */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-blue-600">Privacy Request Management</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchPrivacyRequests}
                className="flex items-center text-blue-600 hover:text-blue-800"
                title="Refresh Requests"
              >
                <RefreshCw className="w-5 h-5 mr-2" /> Refresh
              </button>
              {selectedRequests.length > 0 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleBulkStatusUpdate('in_progress')}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                  >
                    Mark In Progress
                  </button>
                  <button
                    onClick={() => handleBulkStatusUpdate('completed')}
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                  >
                    Mark Completed
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Search and Filter */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search requests..."
                value={privacySearch}
                onChange={(e) => setPrivacySearch(e.target.value)}
                className="w-full px-3 py-2 border rounded-md pl-10"
              />
              <Search className="absolute left-3 top-3 text-gray-400" />
            </div>
            
            <select
              value={privacyFilterStatus}
              onChange={(e) => setPrivacyFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={privacyFilterType}
              onChange={(e) => setPrivacyFilterType(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Types</option>
              <option value="access">Data Access</option>
              <option value="delete">Data Deletion</option>
              <option value="opt_out">Opt Out</option>
            </select>

            <button
              onClick={() => {
                setPrivacySearch('');
                setPrivacyFilterStatus('all');
                setPrivacyFilterType('all');
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Clear Filters
            </button>
          </div>

          {/* Privacy Requests Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRequests.length === filteredRequests.length && filteredRequests.length > 0}
                      onChange={(e) =>
                        setSelectedRequests(
                          e.target.checked
                            ? filteredRequests.map(r => r.id)
                            : []
                        )
                      }
                    />
                  </th>
                  <th className="p-3 text-left">ID</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">User</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Submitted</th>
                  <th className="p-3 text-left">SLA Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(request => {
                  const daysSince = (new Date() - new Date(request.created_at)) / (1000 * 60 * 60 * 24);
                  const isOverdue = request.status === 'pending' && daysSince > 30;
                  const isWarning = request.status === 'pending' && daysSince > 20;
                  
                  return (
                    <tr key={request.id} className={`border-b hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : isWarning ? 'bg-yellow-50' : ''}`}>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedRequests.includes(request.id)}
                          onChange={(e) =>
                            setSelectedRequests(prev =>
                              e.target.checked
                                ? [...prev, request.id]
                                : prev.filter(id => id !== request.id)
                            )
                          }
                        />
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-gray-500 font-mono">#{request.id}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          {getTypeIcon(request.request_type)}
                          <span className="capitalize">{request.request_type}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{request.full_name || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{request.email || request.user_email || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}>
                          {request.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="text-sm">
                          {new Date(request.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {Math.floor(daysSince)} days ago
                        </div>
                      </td>
                      <td className="p-3">
                        {isOverdue ? (
                          <span className="text-red-600 font-medium text-sm">Overdue</span>
                        ) : isWarning ? (
                          <span className="text-yellow-600 font-medium text-sm">Due Soon</span>
                        ) : (
                          <span className="text-green-600 font-medium text-sm">On Time</span>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => setViewingRequest(request)}
                          className="text-blue-500 hover:text-blue-700 mr-2"
                          title="View Request"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredRequests.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No privacy requests found matching your criteria.</p>
            </div>
          )}
        </div>

        {/* CCPA Compliance Information */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-blue-600 mb-4">CCPA Compliance Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Response Time Requirements</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Data Access Requests: 45 days maximum</li>
                <li>• Data Deletion Requests: 30 days maximum</li>
                <li>• Data Portability: 45 days maximum</li>
                <li>• Acknowledgment: Within 10 days</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Quick Actions</h4>
              <div className="space-y-2">
                <button
                  onClick={() => window.open('mailto:support@todo-events.com', '_blank')}
                  className="w-full bg-blue-100 text-blue-700 py-2 px-4 rounded hover:bg-blue-200 flex items-center justify-center"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Contact Support Team
                </button>
                <button
                  onClick={() => exportData('privacy')}
                  className="w-full bg-green-100 text-green-700 py-2 px-4 rounded hover:bg-green-200 flex items-center justify-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Privacy Report
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Premium Management Component
  const PremiumManagement = () => {
    const [premiumUsers, setPremiumUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteMonths, setInviteMonths] = useState(1);
    const [inviteMessage, setInviteMessage] = useState('');
    const [inviteType, setInviteType] = useState('premium');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [grantingPremium, setGrantingPremium] = useState(null);
    const [grantMonths, setGrantMonths] = useState(1);
    const [activeTab, setActiveTab] = useState('users');
    const [trialInvites, setTrialInvites] = useState([]);
    const [generatingInvite, setGeneratingInvite] = useState(false);
    const [newTrialInvite, setNewTrialInvite] = useState(null);
    const [useCustomDate, setUseCustomDate] = useState(false);
    const [customExpirationDate, setCustomExpirationDate] = useState('');

    const fetchPremiumUsers = async () => {
      setLoading(true);
      try {
        const data = await fetchData('/admin/premium-users');
        // Include enterprise users in the list
        const allPremiumUsers = data.users || [];
        // Sort by role priority (enterprise > admin > premium > user) then by expiration
        const sortedUsers = allPremiumUsers.sort((a, b) => {
          const roleOrder = { enterprise: 4, admin: 3, premium: 2, user: 1 };
          const aRole = roleOrder[a.role] || 0;
          const bRole = roleOrder[b.role] || 0;
          
          if (aRole !== bRole) return bRole - aRole;
          
          // If same role, sort by expiration date
          if (!a.premium_expires_at && !b.premium_expires_at) return 0;
          if (!a.premium_expires_at) return 1;
          if (!b.premium_expires_at) return -1;
          return new Date(b.premium_expires_at) - new Date(a.premium_expires_at);
        });
        setPremiumUsers(sortedUsers);
      } catch (error) {
        setError(`Failed to fetch premium users: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    const fetchTrialInvites = async () => {
      try {
        const data = await fetchData('/admin/trial-invites');
        setTrialInvites(data.invites || []);
      } catch (error) {
        setError(`Failed to fetch trial invites: ${error.message}`);
      }
    };

    useEffect(() => {
      fetchPremiumUsers();
      if (activeTab === 'invites') {
        fetchTrialInvites();
      }
    }, [activeTab]);

    const handleGrantPremium = async (userId) => {
      try {
        if (useCustomDate && customExpirationDate) {
          // Use custom expiration date endpoint
          await fetchData(`/admin/users/${userId}/set-expiration`, 'POST', {
            expiration_date: customExpirationDate
          });
        } else {
          // Use months-based grant
          await fetchData(`/admin/users/${userId}/grant-premium`, 'POST', {
            months: grantMonths
          });
        }
        setGrantingPremium(null);
        setGrantMonths(1);
        setUseCustomDate(false);
        setCustomExpirationDate('');
        fetchPremiumUsers();
        setError(null);
      } catch (error) {
        setError(`Failed to grant premium: ${error.message}`);
      }
    };

    const handleGrantEnterprise = async (userId) => {
      try {
        if (useCustomDate && customExpirationDate) {
          // Set custom expiration first
          await fetchData(`/admin/users/${userId}/set-expiration`, 'POST', {
            expiration_date: customExpirationDate
          });
          // Then upgrade to enterprise
          await fetchData(`/admin/users/${userId}/role?role=enterprise`, 'PUT');
        } else {
          // First grant premium access, then upgrade to enterprise
          await fetchData(`/admin/users/${userId}/grant-premium`, 'POST', {
            months: grantMonths
          });
          
          // Update role to enterprise
          await fetchData(`/admin/users/${userId}/role?role=enterprise`, 'PUT');
        }
        
        setGrantingPremium(null);
        setGrantMonths(1);
        setUseCustomDate(false);
        setCustomExpirationDate('');
        fetchPremiumUsers();
        setError(null);
      } catch (error) {
        setError(`Failed to grant enterprise: ${error.message}`);
      }
    };

    const handleRemovePremium = async (userId) => {
      if (!confirm('Are you sure you want to remove premium access from this user?')) return;
      
      try {
        await fetchData(`/admin/users/${userId}/remove-premium`, 'DELETE');
        fetchPremiumUsers();
        setError(null);
      } catch (error) {
        setError(`Failed to remove premium: ${error.message}`);
      }
    };

    const handleInviteUser = async () => {
      try {
        const endpoint = inviteType === 'enterprise' ? '/admin/enterprise-invite' : '/admin/premium-invite';
        const response = await fetchData(endpoint, 'POST', {
          email: inviteEmail,
          months: inviteMonths,
          message: inviteMessage
        });
        
        setShowInviteModal(false);
        setInviteEmail('');
        setInviteMonths(1);
        setInviteMessage('');
        setInviteType('premium');
        
        if (response.user_exists) {
          setError(`User ${inviteEmail} already exists with role: ${response.current_role}. They have been upgraded to ${inviteType}.`);
        } else {
          setError(null);
          alert(`${inviteType.charAt(0).toUpperCase() + inviteType.slice(1)} invitation sent to ${inviteEmail}`);
        }
        
        fetchPremiumUsers(); // Refresh the list
      } catch (error) {
        setError(`Failed to send invitation: ${error.message}`);
      }
    };

    const handleNotifyUser = async (userId) => {
      try {
        await fetchData(`/admin/users/${userId}/notify-premium`, 'POST');
        alert('Premium notification sent successfully');
      } catch (error) {
        setError(`Failed to send notification: ${error.message}`);
      }
    };

    const handleGenerateTrialInvite = async () => {
      setGeneratingInvite(true);
      try {
        const response = await fetchData('/generate-premium-trial-invite', 'POST');
        setNewTrialInvite(response);
        setActiveTab('invites');
        fetchTrialInvites();
      } catch (error) {
        setError(`Failed to generate trial invite: ${error.message}`);
      } finally {
        setGeneratingInvite(false);
      }
    };

    const formatDate = (dateString) => {
      if (!dateString) return 'Never';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return 'Invalid Date';
      }
    };

    const isExpired = (dateString) => {
      if (!dateString) return false;
      try {
        return new Date(dateString) < new Date();
      } catch {
        return false;
      }
    };

    const getDaysRemaining = (dateString) => {
      if (!dateString) return null;
      try {
        const days = Math.ceil((new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24));
        return Math.max(0, days);
      } catch {
        return null;
      }
    };

    const getUserTypeIcon = (role) => {
      switch (role) {
        case 'enterprise':
          return <Building className="w-4 h-4" />;
        case 'admin':
          return <Shield className="w-4 h-4" />;
        case 'premium':
          return <Crown className="w-4 h-4" />;
        default:
          return <User className="w-4 h-4" />;
      }
    };

    const copyInviteCode = (code) => {
      navigator.clipboard.writeText(code);
      alert('Invite code copied to clipboard!');
    };

    const handleDeactivateInvite = async (inviteCode) => {
      if (!confirm(`Are you sure you want to deactivate invite code ${inviteCode}?`)) return;
      
      try {
        await fetchData(`/admin/trial-invites/${inviteCode}`, 'DELETE');
        fetchTrialInvites(); // Refresh the list
        setError(null);
      } catch (error) {
        setError(`Failed to deactivate invite code: ${error.message}`);
      }
    };

    return (
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Premium & Enterprise Management</h2>
          <div className="flex space-x-4">
            <button
              onClick={handleGenerateTrialInvite}
              disabled={generatingInvite}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center disabled:opacity-50"
            >
              {generatingInvite ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Gift className="w-4 h-4 mr-2" />
              )}
              Generate Trial Invite
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite User
            </button>
            <button
              onClick={fetchPremiumUsers}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Premium Users ({premiumUsers.length})
            </button>
            <button
              onClick={() => setActiveTab('invites')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'invites'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Trial Invites
            </button>
          </nav>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">
                Premium & Enterprise Users ({premiumUsers.length})
              </h3>
            </div>
            
            {loading ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p>Loading premium users...</p>
              </div>
            ) : premiumUsers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <UserCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No premium or enterprise users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Left</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Granted By</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {premiumUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.email}</div>
                            <div className="text-sm text-gray-500">ID: {user.id}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getUserTypeIcon(user.role)}
                            <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              user.role === 'enterprise' ? 'bg-purple-100 text-purple-800' : 
                              user.role === 'premium' ? 'bg-amber-100 text-amber-800' : 
                              user.role === 'admin' ? 'bg-red-100 text-red-800' : 
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(user.premium_expires_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.premium_expires_at ? (
                            <span className={`font-medium ${
                              isExpired(user.premium_expires_at) ? 'text-red-600' :
                              getDaysRemaining(user.premium_expires_at) <= 7 ? 'text-orange-600' :
                              'text-green-600'
                            }`}>
                              {isExpired(user.premium_expires_at) ? 'Expired' : `${getDaysRemaining(user.premium_expires_at)} days`}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.granted_by_email || 'System'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.is_expired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {user.is_expired ? 'Expired' : 'Active'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => setGrantingPremium(user)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Extend/Modify Access"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleNotifyUser(user.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Send Notification"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          {user.role !== 'admin' && (
                            <button
                              onClick={() => handleRemovePremium(user.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Remove Premium"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Trial Invites Tab */}
        {activeTab === 'invites' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">Trial Invite Codes</h3>
            </div>
            
            {newTrialInvite && (
              <div className="p-6 bg-green-50 border-b border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium text-green-800">New Trial Invite Generated!</h4>
                    <p className="text-sm text-green-600 mt-1">
                      Code: <span className="font-mono bg-white px-2 py-1 rounded">{newTrialInvite.invite_code}</span>
                    </p>
                    <p className="text-sm text-green-600">
                      Expires: {formatDate(newTrialInvite.expires_at)}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyInviteCode(newTrialInvite.invite_code)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    >
                      Copy Code
                    </button>
                    <button
                      onClick={() => setNewTrialInvite(null)}
                      className="text-green-600 hover:text-green-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            
                         {trialInvites.length === 0 ? (
               <div className="p-8 text-center text-gray-500">
                 <Gift className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                 <p>No trial invite codes found</p>
                 <p className="text-sm mt-2">Generate codes using the button above</p>
               </div>
             ) : (
               <div className="overflow-x-auto">
                 <table className="w-full">
                   <thead className="bg-gray-50">
                     <tr>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uses</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {trialInvites.map((invite, index) => (
                       <tr key={index} className="hover:bg-gray-50">
                         <td className="px-6 py-4 whitespace-nowrap">
                           <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                             {invite.code}
                           </span>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                           {invite.trial_type}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                           {invite.trial_duration_days} days
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                           {invite.current_uses || 0} / {invite.max_uses || 1}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                           {formatDate(invite.expires_at)}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                           <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                             !invite.is_active ? 'bg-gray-100 text-gray-800' :
                             invite.is_expired ? 'bg-red-100 text-red-800' : 
                             invite.is_fully_used ? 'bg-orange-100 text-orange-800' :
                             'bg-green-100 text-green-800'
                           }`}>
                             {!invite.is_active ? 'Deactivated' :
                              invite.is_expired ? 'Expired' :
                              invite.is_fully_used ? 'Used Up' :
                              'Active'}
                           </span>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                           <button
                             onClick={() => copyInviteCode(invite.code)}
                             className="text-blue-600 hover:text-blue-900"
                             title="Copy Code"
                           >
                             <Copy className="w-4 h-4" />
                           </button>
                           {invite.is_active && (
                             <button
                               onClick={() => handleDeactivateInvite(invite.code)}
                               className="text-red-600 hover:text-red-900"
                               title="Deactivate"
                             >
                               <XCircle className="w-4 h-4" />
                             </button>
                           )}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
          </div>
        )}

        {/* Invite Modal */}
        <Modal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          title="Invite User"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="user@example.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Type
              </label>
              <select
                value={inviteType}
                onChange={(e) => setInviteType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="premium">Premium (10 events/month)</option>
                <option value="enterprise">Enterprise (250 events/month)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (Months)
              </label>
              <select
                value={inviteMonths}
                onChange={(e) => setInviteMonths(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1 Month</option>
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
                <option value={24}>24 Months</option>
                <option value={36}>36 Months</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Message (Optional)
              </label>
              <textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Welcome to our premium service..."
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteUser}
                disabled={!inviteEmail}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Send Invitation
              </button>
            </div>
          </div>
        </Modal>

        {/* Grant Premium/Enterprise Modal */}
        <Modal
          isOpen={!!grantingPremium}
          onClose={() => setGrantingPremium(null)}
          title={`Manage Access for ${grantingPremium?.email}`}
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Status
              </label>
              <div className="flex items-center space-x-2">
                {grantingPremium && getUserTypeIcon(grantingPremium.role)}
                <span className="capitalize font-medium">{grantingPremium?.role}</span>
                {grantingPremium?.premium_expires_at && (
                  <span className={`text-sm ${
                    isExpired(grantingPremium.premium_expires_at) ? 'text-red-600' : 'text-green-600'
                  }`}>
                    (Expires: {formatDate(grantingPremium.premium_expires_at)})
                  </span>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Access Management
              </label>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="months-option"
                    name="access-type"
                    checked={!useCustomDate}
                    onChange={() => setUseCustomDate(false)}
                    className="mr-2"
                  />
                  <label htmlFor="months-option" className="text-sm">Extend by months</label>
                </div>
                
                {!useCustomDate && (
                  <select
                    value={grantMonths}
                    onChange={(e) => setGrantMonths(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 Month</option>
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>12 Months</option>
                    <option value={24}>24 Months</option>
                    <option value={36}>36 Months</option>
                  </select>
                )}
                
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="custom-date-option"
                    name="access-type"
                    checked={useCustomDate}
                    onChange={() => setUseCustomDate(true)}
                    className="mr-2"
                  />
                  <label htmlFor="custom-date-option" className="text-sm">Set custom expiration date</label>
                </div>
                
                {useCustomDate && (
                  <input
                    type="datetime-local"
                    value={customExpirationDate}
                    onChange={(e) => setCustomExpirationDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setGrantingPremium(null)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleGrantPremium(grantingPremium.id)}
                className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 flex items-center"
              >
                <Crown className="w-4 h-4 mr-2" />
                Grant Premium
              </button>
              <button
                onClick={() => handleGrantEnterprise(grantingPremium.id)}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center"
              >
                <Building className="w-4 h-4 mr-2" />
                Grant Enterprise
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  };

  // Media Moderation Component
  const MediaModeration = () => {
    const [mediaOverview, setMediaOverview] = useState({});
    const [mediaFiles, setMediaFiles] = useState([]);
    const [userForensics, setUserForensics] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [activeMediaTab, setActiveMediaTab] = useState('overview');
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [mediaFilter, setMediaFilter] = useState('all');
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [flaggingMedia, setFlaggingMedia] = useState(false);

    // Fetch media overview
    const fetchMediaOverview = async () => {
      try {
        const data = await fetchData('/admin/media/overview');
        setMediaOverview(data.stats || {});
      } catch (error) {
        setError('Error fetching media overview: ' + error.message);
      }
    };

    // Fetch media files
    const fetchMediaFiles = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: 1,
          limit: 50,
          ...(mediaFilter !== 'all' && { media_type: mediaFilter }),
          ...(searchTerm && { search: searchTerm })
        });
        const data = await fetchData(`/admin/media/files?${params}`);
        setMediaFiles(data.files || []);
      } catch (error) {
        setError('Error fetching media files: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    // Fetch user forensics
    const fetchUserForensics = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: 1,
          limit: 50,
          ...(searchTerm && { search: searchTerm })
        });
        const data = await fetchData(`/admin/forensics/users?${params}`);
        setUserForensics(data.users || []);
      } catch (error) {
        setError('Error fetching user forensics: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    // Fetch audit logs
    const fetchAuditLogs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: 1,
          limit: 100
        });
        const data = await fetchData(`/admin/audit/comprehensive?${params}`);
        setAuditLogs(data.audit_logs || []);
      } catch (error) {
        setError('Error fetching audit logs: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    // Flag media
    const handleFlagMedia = async (eventId, mediaType, action, notes = '') => {
      setFlaggingMedia(true);
      try {
        await fetchData(`/admin/media/flag/${eventId}`, 'PUT', {
          media_type: mediaType,
          action: action,
          notes: notes,
          flagged: action === 'flag'
        });
        fetchMediaFiles();
        setSelectedMedia(null);
      } catch (error) {
        setError('Error flagging media: ' + error.message);
      } finally {
        setFlaggingMedia(false);
      }
    };

    // Initial load
    useEffect(() => {
      if (activeMediaTab === 'overview') {
        fetchMediaOverview();
      } else if (activeMediaTab === 'files') {
        fetchMediaFiles();
      } else if (activeMediaTab === 'users') {
        fetchUserForensics();
      } else if (activeMediaTab === 'audit') {
        fetchAuditLogs();
      }
    }, [activeMediaTab, searchTerm, mediaFilter]);

    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
      return dateString ? new Date(dateString).toLocaleString() : 'N/A';
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <Gavel className="mr-3 text-blue-600" />
              Media Moderation & Law Enforcement Portal
            </h2>
            <div className="text-sm text-gray-600">
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-1 rounded">
                <Flag className="w-4 h-4 inline mr-1" />
                Law Enforcement Compliant Data Retention
              </div>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <nav className="flex space-x-4 border-b">
            {[
              { name: 'Overview', tab: 'overview', icon: <Monitor className="w-4 h-4" /> },
              { name: 'Media Files', tab: 'files', icon: <Image className="w-4 h-4" /> },
              { name: 'User Forensics', tab: 'users', icon: <Users className="w-4 h-4" /> },
              { name: 'Audit Trail', tab: 'audit', icon: <FileSearch className="w-4 h-4" /> }
            ].map((tab) => (
              <button
                key={tab.tab}
                onClick={() => setActiveMediaTab(tab.tab)}
                className={`flex items-center space-x-2 px-4 py-2 border-b-2 font-medium text-sm ${
                  activeMediaTab === tab.tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeMediaTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <HardDrive className="w-8 h-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Media Files</p>
                  <p className="text-2xl font-bold text-gray-900">{mediaOverview.total_media || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <Image className="w-8 h-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Banner Images</p>
                  <p className="text-2xl font-bold text-gray-900">{mediaOverview.by_type?.banner || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <Image className="w-8 h-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Logo Images</p>
                  <p className="text-2xl font-bold text-gray-900">{mediaOverview.by_type?.logo || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <Flag className="w-8 h-8 text-red-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Flagged Content</p>
                  <p className="text-2xl font-bold text-gray-900">{mediaOverview.flagged_count || 0}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Media Files Tab */}
        {activeMediaTab === 'files' && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Uploaded Media Files</h3>
                <div className="flex space-x-3">
                  <select
                    value={mediaFilter}
                    onChange={(e) => setMediaFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">All Types</option>
                    <option value="banner">Banner Images</option>
                    <option value="logo">Logo Images</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {mediaFiles.map((file) => (
                    <tr key={`${file.event_id}-${file.media_type}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {file.filename ? (
                              <img
                                src={`${API_URL}/uploads/${file.media_type === 'banner' ? 'banners' : 'logos'}/${file.filename}`}
                                alt={`${file.media_type} for ${file.event_title}`}
                                className="h-10 w-10 object-cover rounded border border-gray-200"
                                onLoad={() => {
                                  console.log('Image loaded successfully:', `${API_URL}/uploads/${file.media_type === 'banner' ? 'banners' : 'logos'}/${file.filename}`);
                                }}
                                onError={(e) => {
                                  console.error('Image failed to load:', `${API_URL}/uploads/${file.media_type === 'banner' ? 'banners' : 'logos'}/${file.filename}`);
                                  console.error('Error details:', e);
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'block';
                                }}
                              />
                            ) : null}
                            <Image className="h-10 w-10 text-gray-400" style={{ display: file.filename ? 'none' : 'block' }} />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{file.filename}</div>
                            <div className="text-sm text-gray-500 capitalize">{file.media_type}</div>
                            <div className="text-xs text-gray-400">URL: {API_URL}/uploads/{file.media_type === 'banner' ? 'banners' : 'logos'}/{file.filename}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{file.event_title}</div>
                        <div className="text-sm text-gray-500">{file.event_category}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{file.user_email}</div>
                        <div className="text-sm text-gray-500 capitalize">{file.user_role}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(file.upload_timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          file.flagged_content 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {file.flagged_content ? 'Flagged' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleFlagMedia(file.event_id, file.media_type, 'flag', 'Admin review required')}
                          disabled={flaggingMedia}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          <Flag className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleFlagMedia(file.event_id, file.media_type, 'remove', 'Content removed by admin')}
                          disabled={flaggingMedia}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleFlagMedia(file.event_id, file.media_type, 'approve', 'Content approved by admin')}
                          disabled={flaggingMedia}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {mediaFiles.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No media files found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Forensics Tab */}
        {activeMediaTab === 'users' && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">User Forensic Data (Law Enforcement)</h3>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Events</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Media</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userForensics.map((user) => (
                    <tr key={user.user_id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.email}</div>
                        <div className="text-sm text-gray-500 capitalize">Role: {user.role}</div>
                        <div className="text-sm text-gray-500">ID: {user.user_id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.account_created)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.events_created || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          Banners: {user.banner_images || 0}
                        </div>
                        <div className="text-sm text-gray-900">
                          Logos: {user.logo_images || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          Logs: {user.activity_logs || 0}
                        </div>
                        <div className="text-sm text-gray-900">
                          Logins: {user.login_events || 0}
                        </div>
                        <div className="text-sm text-gray-500">
                          Last: {formatDate(user.last_activity)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {userForensics.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No user forensic data found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audit Trail Tab */}
        {activeMediaTab === 'audit' && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-800">Comprehensive Audit Trail</h3>
              <p className="text-sm text-gray-600 mt-1">
                Complete forensic audit trail for law enforcement investigations
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditLogs.map((log) => (
                    <tr key={`${log.log_type}-${log.id}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{log.email || 'System'}</div>
                        <div className="text-sm text-gray-500">ID: {log.user_id || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{log.action}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {log.details || 'No details'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          log.log_type === 'media' 
                            ? 'bg-purple-100 text-purple-800'
                            : log.log_type === 'login'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {log.log_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {auditLogs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No audit logs found.
                </div>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        )}
      </div>
    );
  };

  // Referral Management Component
  const ReferralManagement = () => {
    const [referralLinks, setReferralLinks] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [createForm, setCreateForm] = useState({ code: '', commission_rate: 0.10 });
    const [showCreateForm, setShowCreateForm] = useState(false);

    const fetchReferralLinks = async () => {
      try {
        setLoading(true);
        const data = await fetchData('/admin/referrals');
        setReferralLinks(data.referral_links || []);
      } catch (error) {
        setError(`Error fetching referral links: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    const fetchAnalytics = async () => {
      try {
        const data = await fetchData('/admin/referrals/analytics?days=30');
        setAnalytics(data);
      } catch (error) {
        setError(`Error fetching analytics: ${error.message}`);
      }
    };

    const createReferralLink = async () => {
      try {
        const params = new URLSearchParams({
          commission_rate: createForm.commission_rate.toString(),
          expires_days: '365'
        });
        if (createForm.code) {
          params.append('code', createForm.code);
        }

        await fetchData(`/admin/referrals/create?${params}`, 'POST');
        setCreateForm({ code: '', commission_rate: 0.10 });
        setShowCreateForm(false);
        fetchReferralLinks();
        fetchAnalytics();
      } catch (error) {
        setError(`Error creating referral link: ${error.message}`);
      }
    };

    const toggleReferralLink = async (linkId) => {
      try {
        await fetchData(`/admin/referrals/${linkId}/toggle`, 'POST');
        fetchReferralLinks();
      } catch (error) {
        setError(`Error toggling referral link: ${error.message}`);
      }
    };

    const copyToClipboard = (text) => {
      navigator.clipboard.writeText(text);
      // Simple feedback - you could add a toast notification here
      alert('Copied to clipboard!');
    };

    const createTables = async () => {
      try {
        await fetchData('/admin/create-referral-tables', 'POST');
        alert('Referral tables created successfully!');
        fetchReferralLinks();
      } catch (error) {
        setError(`Error creating tables: ${error.message}`);
      }
    };

    useEffect(() => {
      fetchReferralLinks();
      fetchAnalytics();
    }, []);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Referral Management</h2>
            <p className="text-gray-600">Create and manage referral links to track signups and sales</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={createTables}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 flex items-center"
            >
              <Database className="mr-2 w-4 h-4" />
              Setup Tables
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center"
            >
              <Plus className="mr-2 w-4 h-4" />
              New Referral Link
            </button>
          </div>
        </div>

        {/* Analytics Overview */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Eye className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Clicks</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.overview.total_clicks}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <UserPlus className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Signups</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.overview.total_signups}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Percent className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.overview.conversion_rate}%</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Commission</p>
                  <p className="text-2xl font-bold text-gray-900">${analytics.overview.total_commission.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Create New Referral Link</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Code (optional)
                </label>
                <input
                  type="text"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                  placeholder="Leave empty for auto-generated"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commission Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={createForm.commission_rate}
                  onChange={(e) => setCreateForm({ ...createForm, commission_rate: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Enter as decimal (0.10 = 10%)</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={createReferralLink}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Create Link
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Referral Links Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Referral Links</h3>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code & URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Commission
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {referralLinks.map((link) => (
                    <tr key={link.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{link.code}</div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <span className="truncate max-w-xs">{link.url}</span>
                            <button
                              onClick={() => copyToClipboard(link.url)}
                              className="ml-2 text-blue-600 hover:text-blue-800"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{(link.commission_rate * 100).toFixed(1)}%</div>
                        <div className="text-sm text-gray-500">${link.stats.total_commission.toFixed(2)} earned</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {link.stats.total_clicks} clicks → {link.stats.signups} signups
                        </div>
                        <div className="text-sm text-gray-500">
                          {link.stats.conversion_rate}% conversion rate
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          link.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {link.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => toggleReferralLink(link.id)}
                          className={`mr-2 ${
                            link.is_active 
                              ? 'text-red-600 hover:text-red-900' 
                              : 'text-green-600 hover:text-green-900'
                          }`}
                        >
                          {link.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">How to use referral links:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>1. Create a referral link with a custom code or auto-generated one</li>
            <li>2. Share the link with potential customers</li>
            <li>3. When someone clicks the link, it will be tracked</li>
            <li>4. When they sign up, you can manually link the signup to track conversions</li>
            <li>5. When they make a purchase, manually create a commission record</li>
          </ul>
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
          <div className="flex items-center mb-8">
            <img src="/images/todo.png" alt="TodoEvents" className="w-8 h-8 mr-3" style={{objectFit: 'contain'}} />
            <h1 className="text-2xl font-bold text-blue-600">Admin Portal</h1>
          </div>
          <nav className="space-y-2">
            {[
              { name: 'Dashboard', icon: <Server className="mr-2" />, tab: 'dashboard' },
              { name: 'Users', icon: <Users className="mr-2" />, tab: 'users' },
              { name: 'Events', icon: <Calendar className="mr-2" />, tab: 'events' },
              { name: 'Privacy', icon: <FileText className="mr-2" />, tab: 'privacy' },
              { name: 'Premium', icon: <UserCheck className="mr-2" />, tab: 'premium' },
              { name: 'Referrals', icon: <Share2 className="mr-2" />, tab: 'referrals' },
              { name: 'Media', icon: <Image className="mr-2" />, tab: 'media' },
              { name: 'AI Import', icon: <Lightbulb className="mr-2" />, tab: 'ai-import' },
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
          {activeTab === 'privacy' && <PrivacyManagement />}
          {activeTab === 'premium' && <PremiumManagement />}
          {activeTab === 'referrals' && <ReferralManagement />}
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'media' && <MediaModeration />}
          {activeTab === 'moderation' && <ModerationTools />}
          {activeTab === 'ai-import' && <AIImport fetchData={fetchData} />}
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

      {/* Privacy Request Modal */}
      {viewingRequest && (
        <PrivacyRequestModal
          request={viewingRequest}
          isOpen={!!viewingRequest}
          onClose={() => setViewingRequest(null)}
          onUpdate={() => {
            fetchPrivacyRequests();
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboard;