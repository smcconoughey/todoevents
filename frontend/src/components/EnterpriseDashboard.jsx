import React, { useState, useEffect } from 'react';
import { useAuth } from './EventMap/AuthContext';
import { useTheme } from './ThemeContext';
import { 
  Calendar, 
  Users, 
  Activity, 
  TrendingUp, 
  RefreshCw, 
  Download, 
  Upload, 
  Edit, 
  Copy, 
  Trash2, 
  Eye, 
  BarChart2, 
  Server, 
  Plus, 
  Search,
  Filter,
  Building2,
  FileText,
  MapPin,
  Clock,
  Star,
  AlertTriangle,
  X,
  LogOut,
  Lightbulb,
  Sun,
  Moon,
  ArrowLeft,
  Shield
} from 'lucide-react';
import { Line, Bar, Pie } from 'react-chartjs-2';
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
  ArcElement
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'https://todoevents-backend.onrender.com';

// Theme icon component
const ThemeIcon = ({ theme, size = 20 }) => {
  switch (theme) {
    case 'light':
      return <Sun size={size} />;
    case 'dark':
      return <Moon size={size} />;
    default:
      return <Sun size={size} />;
  }
};

// Fetch utility
const fetchData = async (endpoint, method = 'GET', body = null) => {
  const token = localStorage.getItem('token');
  
  try {
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      }
    };
    
    if (body) {
      config.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.reload();
        return;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Main Enterprise Dashboard Component
const EnterpriseDashboard = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [overview, setOverview] = useState(null);
  const [clients, setClients] = useState([]);
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Filter states
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (user) {
      fetchDataForTab();
    }
  }, [user, activeTab, clientFilter, statusFilter, searchFilter, currentPage]);

  const fetchDataForTab = async () => {
    try {
      setLoading(true);
      if (activeTab === 'overview') {
        const overviewData = await fetchData('/enterprise/overview');
        setOverview(overviewData);
      } else if (activeTab === 'clients') {
        const clientsData = await fetchData('/enterprise/clients');
        setClients(clientsData.clients || []);
      } else if (activeTab === 'events') {
        const params = new URLSearchParams();
        if (clientFilter) params.append('client_filter', clientFilter);
        if (statusFilter) params.append('status_filter', statusFilter);
        if (searchFilter) params.append('search', searchFilter);
        params.append('page', currentPage);
        // Only fetch events for this specific enterprise user
        params.append('user_id', user.id);
        
        const eventsData = await fetchData(`/enterprise/events?${params}`);
        setEvents(eventsData);
      } else if (activeTab === 'analytics') {
        const analyticsData = await fetchData('/enterprise/analytics/clients');
        setAnalytics(analyticsData);
      }
    } catch (error) {
      setError('Failed to fetch data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Access Control
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

  if (loading && !overview && !clients.length && (!events || !events.events)) {
    return (
      <div className="min-h-screen bg-themed-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-themed-background" data-theme={theme}>
      <div className="flex">
        {/* Themed Sidebar */}
        <div className="w-64 bg-themed-surface border-r border-themed shadow-md p-4">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-blue-600">Enterprise Portal</h1>
            <p className="text-sm text-themed-secondary mt-1">TodoEvents for Business</p>
          </div>
          
          <nav className="space-y-2">
            {[
              { name: 'Overview', icon: <Server className="mr-2" />, tab: 'overview' },
              { name: 'Clients', icon: <Building2 className="mr-2" />, tab: 'clients' },
              { name: 'Events', icon: <Calendar className="mr-2" />, tab: 'events' },
              { name: 'Bulk Import', icon: <Upload className="mr-2" />, tab: 'bulk' },
              { name: 'Analytics', icon: <BarChart2 className="mr-2" />, tab: 'analytics' }
            ].map(item => (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`
                  w-full flex items-center p-3 rounded-lg transition-all duration-200
                  ${activeTab === item.tab
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-themed-secondary hover:bg-themed-surface-hover hover:text-themed-primary'}
                `}
              >
                {item.icon}
                {item.name}
              </button>
            ))}
          </nav>

          {/* Navigation Links */}
          <div className="mt-8 pt-4 border-t border-themed">
            <button
              onClick={() => window.location.href = '/'}
              className="w-full flex items-center p-3 rounded-lg text-themed-secondary hover:bg-themed-surface-hover hover:text-themed-primary transition-all duration-200"
            >
              <ArrowLeft className="mr-2" size={18} />
              Back to App
            </button>
            
            <button
              onClick={toggleTheme}
              className="w-full flex items-center p-3 rounded-lg text-themed-secondary hover:bg-themed-surface-hover hover:text-themed-primary transition-all duration-200 mt-2"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              <ThemeIcon theme={theme} size={18} />
              <span className="ml-2 capitalize">{theme} Theme</span>
            </button>
          </div>

          {/* User Info */}
          {user && (
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-themed bg-themed-surface">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-themed-primary truncate">{user.email}</p>
                  <p className="text-xs text-themed-secondary capitalize flex items-center">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      user.role === 'enterprise' ? 'bg-purple-500' : 'bg-amber-500'
                    }`}></span>
                    {user.role}
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="text-red-500 hover:text-red-700 transition-colors p-1 rounded"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6 flex items-center">
              <AlertTriangle className="w-6 h-6 mr-3" />
              <span className="flex-1">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-4 hover:bg-red-200 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Persistent Search & Filter Bar */}
          {activeTab !== 'overview' && (
            <div className="bg-themed-surface rounded-lg shadow-md border border-themed p-4 mb-6">
              <div className="flex flex-wrap items-center gap-4">
                {/* Global Search */}
                <div className="relative flex-1 min-w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-themed-secondary w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search events, clients, descriptions..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-themed rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-themed-surface text-themed-primary"
                  />
                </div>
                
                {/* Client Filter */}
                {clients.length > 0 && (
                  <div className="min-w-48">
                    <select
                      value={clientFilter}
                      onChange={(e) => setClientFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-themed rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-themed-surface text-themed-primary"
                    >
                      <option value="">All Clients</option>
                      {clients.map(client => (
                        <option key={client.client_name} value={client.client_name}>
                          {client.client_name} ({client.total_events})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Status Filter */}
                {activeTab === 'events' && (
                  <div className="min-w-32">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-themed rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-themed-surface text-themed-primary"
                    >
                      <option value="">All Events</option>
                      <option value="active">Active Events</option>
                      <option value="past">Past Events</option>
                    </select>
                  </div>
                )}
                
                {/* Clear Filters */}
                {(searchFilter || clientFilter || statusFilter) && (
                  <button
                    onClick={() => {
                      setSearchFilter('');
                      setClientFilter('');
                      setStatusFilter('');
                    }}
                    className="px-3 py-2 text-sm text-themed-secondary hover:text-themed-primary border border-themed rounded-lg hover:bg-themed-surface-hover transition-all duration-200"
                  >
                    <Filter className="w-4 h-4 inline mr-1" />
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Content Sections */}
          {activeTab === 'overview' && <Overview overview={overview} />}
          {activeTab === 'clients' && <ClientsManagement clients={clients} />}
          {activeTab === 'events' && <EventsManagement events={events} filters={{clientFilter, statusFilter, searchFilter}} currentPage={currentPage} setCurrentPage={setCurrentPage} />}
          {activeTab === 'bulk' && <BulkOperations userRole={user.role} />}
          {activeTab === 'analytics' && <Analytics analytics={analytics} />}
        </div>
      </div>
    </div>
  );
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-themed-surface rounded-lg shadow-xl ${sizeClasses[size]} w-full mx-4 max-h-screen overflow-y-auto border border-themed`}>
        <div className="flex items-center justify-between p-6 border-b border-themed">
          <h2 className="text-xl font-semibold text-themed-primary">{title}</h2>
          <button onClick={onClose} className="text-themed-secondary hover:text-themed-primary transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Bulk Operations Component (Enhanced for Enterprise)
const BulkOperations = ({ userRole }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [importResults, setImportResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [success, setSuccess] = useState(null);
  const [bulkError, setBulkError] = useState(null);

  // Enhanced template with client_name for enterprise
  const templateJson = {
    "events": [
      {
        "title": "Brand Marketing Event",
        "description": "Marketing showcase event for our client featuring product demonstrations and networking.",
        "date": "2024-07-15",
        "start_time": "14:00",
        "end_time": "22:00",
        "category": "marketing",
        "address": "Convention Center, New York, NY, USA",
        "lat": 40.7829,
        "lng": -73.9654,
        "recurring": false,
        "client_name": "Acme Corporation",
        "fee_required": "Free for invited guests",
        "event_url": "https://www.acmecorp.com/events",
        "host_name": "Acme Marketing Team"
      },
      {
        "title": "Product Launch Event",
        "description": "Exclusive product launch event for premium clients and media.",
        "date": "2024-07-20",
        "start_time": "18:00",
        "end_time": "21:00",
        "category": "business",
        "address": "Tech Hub, San Francisco, CA, USA",
        "lat": 37.7749,
        "lng": -122.4194,
        "recurring": false,
        "client_name": "TechStart Inc",
        "fee_required": "Invitation only",
        "event_url": "https://www.techstart.com/launch",
        "host_name": "TechStart Marketing"
      }
    ]
  };

  const copyTemplate = () => {
    const templateString = JSON.stringify(templateJson, null, 2);
    navigator.clipboard.writeText(templateString).then(() => {
      alert('Template copied to clipboard!');
    }).catch(() => {
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
      
      if (!jsonData.events || !Array.isArray(jsonData.events)) {
        setBulkError('JSON must contain an "events" array.');
        return;
      }

      if (jsonData.events.length === 0) {
        setBulkError('Events array is empty.');
        return;
      }

      if (jsonData.events.length > 100) {
        setBulkError('Too many events. Maximum 100 events per batch.');
        return;
      }

      // Validate required fields
      const requiredFields = ['title', 'description', 'date', 'start_time', 'category', 'address', 'lat', 'lng'];
      const validationErrors = [];

      jsonData.events.forEach((event, index) => {
        const missingFields = requiredFields.filter(field => !event[field]);
        if (missingFields.length > 0) {
          validationErrors.push(`Event ${index + 1}: Missing ${missingFields.join(', ')}`);
        }
      });

      if (validationErrors.length > 0) {
        setBulkError(`Validation errors:\n${validationErrors.slice(0, 5).join('\n')}`);
        return;
      }
      
      const response = await fetchData('/enterprise/events/bulk-import', 'POST', jsonData);
      
      if (response) {
        setImportResults(response);
        if (response.success_count > 0) {
          setSuccess(`Successfully imported ${response.success_count} events!`);
          if (response.error_count === 0) {
            setJsonInput('');
          }
        }
        if (response.error_count > 0 && response.success_count === 0) {
          setBulkError(`All ${response.error_count} events failed to import.`);
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        setBulkError('Invalid JSON format. Please check syntax.');
      } else {
        setBulkError('Failed to import events: ' + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-themed-surface rounded-lg shadow-md p-6 border border-themed">
        <h3 className="text-xl font-semibold text-themed-primary mb-4">Bulk Event Import</h3>
        
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
        
        {/* Enhanced Template for Enterprise */}
        <div className="mb-6 p-4 bg-themed-surface-hover rounded-lg border border-themed">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-medium text-themed-primary">Enterprise JSON Template</h4>
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
            <div className="bg-themed-surface p-3 rounded border border-themed">
              <pre className="text-xs text-themed-secondary overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(templateJson, null, 2)}
              </pre>
            </div>
          )}
          
          <div className="mt-3 text-sm text-themed-secondary">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><strong>Required fields:</strong> title, description, date, start_time, category, address, lat, lng</p>
                <p><strong>Enterprise-specific:</strong></p>
                <ul className="ml-4 list-disc text-xs">
                  <li><strong>client_name:</strong> Client/brand name for organization</li>
                  <li><strong>host_name:</strong> Organization hosting the event</li>
                  <li><strong>event_url:</strong> Event registration/details URL</li>
                </ul>
              </div>
              <div>
                <p><strong>Optional fields:</strong> end_time, recurring, frequency, fee_required, event_url, host_name</p>
                <p><strong>Categories:</strong> marketing, business, technology, networking, community, education, arts, sports, other</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-themed-primary">
                JSON Data (Include client_name for organization)
              </label>
              <div className="text-xs text-themed-secondary">
                {jsonInput.length > 0 && `${jsonInput.length} characters`}
              </div>
            </div>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="w-full h-64 p-3 border border-themed rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-y bg-themed-surface text-themed-primary"
              placeholder="Paste your JSON data here..."
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
          </div>
        </div>

        {/* Import Results */}
        {importResults && (
          <div className="mt-6 p-4 bg-themed-surface-hover rounded-lg border border-themed">
            <h4 className="text-lg font-medium text-themed-primary mb-3">Import Results</h4>
            
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
          </div>
        )}
      </div>
    </div>
  );
};

// Overview Component
const Overview = ({ overview }) => {
  if (!overview) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-lg text-themed-secondary">Loading overview...</span>
      </div>
    );
  }

  const metrics = overview.overview || overview;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-themed-primary">Enterprise Overview</h2>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>
      
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold opacity-90">Total Events</h3>
              <p className="text-3xl font-bold">{metrics.total_events || 0}</p>
              <p className="text-sm opacity-75 mt-1">This month: {metrics.events_this_month || 0}</p>
            </div>
            <Calendar className="w-8 h-8 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold opacity-90">Clients</h3>
              <p className="text-3xl font-bold">{metrics.total_clients || 0}</p>
              <p className="text-sm opacity-75 mt-1">Active clients</p>
            </div>
            <Building2 className="w-8 h-8 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold opacity-90">Total Views</h3>
              <p className="text-3xl font-bold">{(metrics.total_views || 0).toLocaleString()}</p>
              <p className="text-sm opacity-75 mt-1">All events</p>
            </div>
            <Eye className="w-8 h-8 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-md p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold opacity-90">Engagement</h3>
              <p className="text-3xl font-bold">{metrics.engagement_rate || 0}%</p>
              <p className="text-sm opacity-75 mt-1">{metrics.total_interests || 0} interests</p>
            </div>
            <TrendingUp className="w-8 h-8 opacity-80" />
          </div>
        </div>
      </div>

      {/* Recent Events Table */}
      <div className="bg-themed-surface rounded-lg shadow-md border border-themed overflow-hidden">
        <div className="px-6 py-4 border-b border-themed">
          <h3 className="text-xl font-semibold text-themed-primary">Recent Events</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-themed-surface-hover">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase">Event</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase">Views</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase">Interests</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-themed">
              {(overview.recent_events || []).map((event) => (
                <tr key={event.id} className="hover:bg-themed-surface-hover transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-themed-primary">{event.title}</div>
                      <div className="text-sm text-themed-secondary">{event.category || 'Uncategorized'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      event.client_name 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {event.client_name || 'No Client'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-themed-secondary">
                    {event.date} {event.start_time}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-themed-primary">
                    {event.view_count || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-themed-primary">
                    {event.interest_count || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!overview.recent_events || overview.recent_events.length === 0) && (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-themed-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-themed-primary mb-2">No recent events</h3>
            <p className="text-themed-secondary">Start creating events to see them here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Clients Management Component
const ClientsManagement = ({ clients }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-themed-primary">Client Management</h2>
          <p className="text-themed-secondary mt-1">Organize and track performance by client</p>
        </div>
        <div className="text-sm text-themed-secondary bg-themed-surface px-3 py-1 rounded-full border border-themed">
          {clients.length} total clients
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client, index) => (
          <div key={client.client_name} className="bg-themed-surface rounded-lg shadow-md border border-themed p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-themed-primary truncate">{client.client_name}</h3>
              <div className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2"
                  style={{backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'][index % 6]}}
                ></div>
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-themed-secondary">Total Events:</span>
                <span className="font-medium text-themed-primary">{client.total_events}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-themed-secondary">Active:</span>
                <span className="font-medium text-green-600">{client.active_events}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-themed-secondary">Past:</span>
                <span className="font-medium text-themed-secondary">{client.past_events}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-themed-secondary">Total Views:</span>
                <span className="font-medium text-themed-primary">{client.total_views.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-themed-secondary">Engagement:</span>
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{width: `${Math.min(client.engagement_rate, 100)}%`}}
                    ></div>
                  </div>
                  <span className="font-medium text-blue-600 text-sm">{client.engagement_rate}%</span>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-themed">
              <div className="text-xs text-themed-muted">
                Last event: {new Date(client.last_event_created).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {clients.length === 0 && (
        <div className="bg-themed-surface rounded-lg shadow-md border border-themed p-12 text-center">
          <Building2 className="w-12 h-12 text-themed-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-themed-primary mb-2">No clients found</h3>
          <p className="text-themed-secondary">Start creating events with client names to see client analytics here.</p>
        </div>
      )}
    </div>
  );
};

// Events Management Component
const EventsManagement = ({ events, filters, currentPage, setCurrentPage }) => {
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showExportModal, setShowExportModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const handleSelectEvent = (eventId) => {
    setSelectedEvents(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEvents.length === events.events?.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(events.events?.map(e => e.id) || []);
    }
  };

  const handleDuplicate = async (eventId) => {
    setActionLoading(eventId);
    try {
      await fetchData(`/enterprise/events/${eventId}/duplicate`, 'PUT');
      alert('Event duplicated successfully');
      window.location.reload();
    } catch (error) {
      alert('Failed to duplicate event: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    setActionLoading(eventId);
    try {
      await fetchData(`/enterprise/events/${eventId}`, 'DELETE');
      alert('Event deleted successfully');
      window.location.reload();
    } catch (error) {
      alert('Failed to delete event: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const exportEvents = async (format) => {
    try {
      const params = new URLSearchParams();
      if (filters.clientFilter) params.append('client_filter', filters.clientFilter);
      params.append('format', format);
      
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch(`${API_BASE}/enterprise/export?${params}`, {
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.reload();
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `enterprise-events.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setShowExportModal(false);
      alert(`Events exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-themed-primary">Event Management</h2>
          <p className="text-themed-secondary mt-1">Manage hundreds of events efficiently</p>
        </div>
        <div className="flex items-center space-x-4">
          {selectedEvents.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-themed-secondary">{selectedEvents.length} selected</span>
              <button className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm">
                Delete Selected
              </button>
            </div>
          )}
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Events
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-themed-surface rounded-lg shadow-md border border-themed overflow-hidden">
        {events.events && events.events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-themed-surface-hover">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedEvents.length === events.events?.length}
                      onChange={handleSelectAll}
                      className="rounded border-themed focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider cursor-pointer hover:text-themed-primary">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider cursor-pointer hover:text-themed-primary">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider cursor-pointer hover:text-themed-primary">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider cursor-pointer hover:text-themed-primary">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider cursor-pointer hover:text-themed-primary">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider cursor-pointer hover:text-themed-primary">
                    Interests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-themed-surface divide-y divide-themed">
                {events.events.map((event) => (
                  <tr key={event.id} className="hover:bg-themed-surface-hover transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event.id)}
                        onChange={() => handleSelectEvent(event.id)}
                        className="rounded border-themed focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-themed-primary">{event.title}</div>
                        <div className="text-sm text-themed-secondary">{event.category}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        {event.client_name && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {event.client_name}
                          </span>
                        )}
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          event.client_email && event.client_email !== 'None'
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {event.client_email || 'None'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-themed-secondary">
                      <div>
                        <div>{event.date}</div>
                        <div className="text-xs">{event.start_time}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        event.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {event.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-themed-primary">
                      {event.view_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-themed-primary">
                      {event.interest_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleDuplicate(event.id)}
                        disabled={actionLoading === event.id}
                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                        title="Duplicate Event"
                      >
                        {actionLoading === event.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        disabled={actionLoading === event.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        title="Delete Event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-themed-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-themed-primary mb-2">No events found</h3>
            <p className="text-themed-secondary">Try adjusting your filters or create new events.</p>
          </div>
        )}

        {/* Pagination */}
        {events.pagination && events.pagination.total_pages > 1 && (
          <div className="px-6 py-3 border-t border-themed bg-themed-surface">
            <div className="flex items-center justify-between">
              <div className="text-sm text-themed-secondary">
                Showing {((events.pagination.current_page - 1) * events.pagination.per_page) + 1} to {Math.min(events.pagination.current_page * events.pagination.per_page, events.pagination.total_events)} of {events.pagination.total_events} events
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(events.pagination.current_page - 1)}
                  disabled={!events.pagination.has_prev}
                  className="px-3 py-1 border border-themed rounded-md text-sm text-themed-secondary hover:text-themed-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-themed-secondary">
                  Page {events.pagination.current_page} of {events.pagination.total_pages}
                </span>
                <button
                  onClick={() => setCurrentPage(events.pagination.current_page + 1)}
                  disabled={!events.pagination.has_next}
                  className="px-3 py-1 border border-themed rounded-md text-sm text-themed-secondary hover:text-themed-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Events"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-themed-secondary">Choose export format for your events data:</p>
          <div className="space-y-3">
            <button
              onClick={() => exportEvents('csv')}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 flex items-center justify-center"
            >
              <FileText className="w-4 h-4 mr-2" />
              Export as CSV
            </button>
            <button
              onClick={() => exportEvents('json')}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex items-center justify-center"
            >
              <FileText className="w-4 h-4 mr-2" />
              Export as JSON
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Analytics Component
const Analytics = ({ analytics }) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [selectedClient, setSelectedClient] = useState('');

  const chartTheme = {
    colors: {
      primary: '#3B82F6',
      secondary: '#10B981',
      accent: '#F59E0B',
      danger: '#EF4444',
      purple: '#8B5CF6',
      pink: '#EC4899'
    }
  };

  const createClientPerformanceChart = () => {
    if (!analytics?.client_metrics) return null;

    const sortedClients = analytics.client_metrics
      .sort((a, b) => b.total_events - a.total_events)
      .slice(0, 10);

    return {
      data: {
        labels: sortedClients.map(client => client.client_name),
        datasets: [
          {
            label: 'Total Events',
            data: sortedClients.map(client => client.total_events),
            backgroundColor: chartTheme.colors.primary + '80',
            borderColor: chartTheme.colors.primary,
            borderWidth: 2
          },
          {
            label: 'Total Views',
            data: sortedClients.map(client => client.total_views),
            backgroundColor: chartTheme.colors.secondary + '80',
            borderColor: chartTheme.colors.secondary,
            borderWidth: 2,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Client Performance Overview'
          },
          legend: {
            position: 'top',
          },
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Events Count'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Views Count'
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        }
      }
    };
  };

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-lg text-themed-secondary">Loading analytics...</span>
      </div>
    );
  }

  const performanceChart = createClientPerformanceChart();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-themed-primary">Client Analytics</h2>
        <div className="flex space-x-4">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="border border-themed rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-themed-surface text-themed-primary"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="border border-themed rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-themed-surface text-themed-primary"
          >
            <option value="">All Clients</option>
            {analytics.client_metrics?.map(client => (
              <option key={client.client_name} value={client.client_name}>
                {client.client_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Key Metrics Cards */}
      {analytics.client_metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold opacity-90">Total Clients</h3>
                <p className="text-3xl font-bold">{analytics.client_metrics.length}</p>
              </div>
              <Building2 className="w-8 h-8 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold opacity-90">Avg Events/Client</h3>
                <p className="text-3xl font-bold">
                  {Math.round(analytics.client_metrics.reduce((sum, client) => sum + client.total_events, 0) / analytics.client_metrics.length || 0)}
                </p>
              </div>
              <Calendar className="w-8 h-8 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold opacity-90">Avg Engagement</h3>
                <p className="text-3xl font-bold">
                  {Math.round(analytics.client_metrics.reduce((sum, client) => sum + client.engagement_rate, 0) / analytics.client_metrics.length || 0)}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-md p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold opacity-90">Total Views</h3>
                <p className="text-3xl font-bold">
                  {analytics.client_metrics.reduce((sum, client) => sum + client.total_views, 0).toLocaleString()}
                </p>
              </div>
              <Eye className="w-8 h-8 opacity-80" />
            </div>
          </div>
        </div>
      )}

      {/* Client Performance Chart */}
      {performanceChart && (
        <div className="bg-themed-surface rounded-lg shadow-md p-6 border border-themed">
          <div className="h-80">
            <Bar {...performanceChart} />
          </div>
        </div>
      )}

      {/* Client Performance Table */}
      <div className="bg-themed-surface rounded-lg shadow-md overflow-hidden border border-themed">
        <div className="px-6 py-4 border-b border-themed">
          <h3 className="text-lg font-semibold text-themed-primary">Client Performance Details</h3>
        </div>
        
        {analytics.client_metrics && analytics.client_metrics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-themed-surface-hover">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider">Events</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider">Total Views</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider">Total Interests</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider">Avg Views</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider">Engagement Rate</th>
                </tr>
              </thead>
              <tbody className="bg-themed-surface divide-y divide-themed">
                {analytics.client_metrics.map((client, index) => (
                  <tr key={client.client_name} className="hover:bg-themed-surface-hover">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3`} 
                             style={{backgroundColor: Object.values(chartTheme.colors)[index % Object.values(chartTheme.colors).length]}}></div>
                        <div className="text-sm font-medium text-themed-primary">{client.client_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-themed-primary">
                      {client.total_events}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-themed-primary">
                      {client.total_views.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-themed-primary">
                      {client.total_interests.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-themed-primary">
                      {client.avg_views}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{width: `${Math.min(client.engagement_rate, 100)}%`}}
                          ></div>
                        </div>
                        <span className="text-sm text-themed-primary">{client.engagement_rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <BarChart2 className="w-12 h-12 text-themed-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-themed-primary mb-2">No analytics data available</h3>
            <p className="text-themed-secondary">Create events with client names to see analytics here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnterpriseDashboard; 