import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from './EventMap/AuthContext';
import { Button } from '@/components/ui/button';
import { API_URL } from '@/config';
import { useNavigate } from 'react-router-dom';
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
  Bot
} from 'lucide-react';

const AdminDashboard = () => {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [automationStatus, setAutomationStatus] = useState(null);
  const [automationLoading, setAutomationLoading] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      setIsLoading(true);

      // Check if user is logged in
      if (!user || !token) {
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }

      try {
        // Verify current user role
        if (user.role === 'admin') {
          setIsAdmin(true);
          // Load automation status when admin dashboard loads
          await fetchAutomationStatus();
        } else {
          setAccessDenied(true);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setAccessDenied(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, token]);

  // Fetch automation status
  const fetchAutomationStatus = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/automation/status`);
      if (response.ok) {
        const data = await response.json();
        setAutomationStatus(data);
      }
    } catch (error) {
      console.error('Error fetching automation status:', error);
    }
  };

  // Trigger automation task
  const triggerAutomationTask = async (taskName) => {
    setAutomationLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/automation/trigger/${taskName}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log(`Task ${taskName} triggered:`, result);
        // Refresh automation status after triggering
        setTimeout(() => fetchAutomationStatus(), 2000);
      } else {
        console.error(`Failed to trigger task ${taskName}`);
      }
    } catch (error) {
      console.error(`Error triggering task ${taskName}:`, error);
    } finally {
      setAutomationLoading(false);
    }
  };

  // If user is not an admin, show access denied screen
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-themed-main text-themed-primary flex items-center justify-center">
        <div className="max-w-md p-8 bg-themed-surface border border-themed rounded-lg">
          <div className="flex items-center justify-center mb-6">
            <AlertTriangle className="text-amber-500 h-12 w-12" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-4">Access Denied</h1>
          <p className="text-themed-secondary mb-6 text-center">
            You don't have permission to access the admin dashboard. This area is restricted to administrators only.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => navigate('/')}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Return to Main App
            </Button>
            <Button
              variant="outline"
              onClick={logout}
              className="w-full border-themed text-themed-secondary hover:bg-themed-surface-hover"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If still loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-themed-main text-themed-primary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pin-blue mx-auto mb-4"></div>
          <p className="text-lg">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // Simple admin dashboard with navigation tabs
  return (
    <div className="min-h-screen bg-themed-main text-themed-primary">
      {/* Header */}
      <header className="bg-themed-surface border-b border-themed py-4 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-blue-500 mr-3" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-themed-secondary">Logged in as: {user?.email}</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/')}
              className="border-themed text-themed-secondary hover:bg-themed-surface-hover"
            >
              Return to App
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={logout}
              className="border-red-800 text-red-400 hover:bg-red-900/30"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <div className="w-64 bg-themed-surface border-r border-themed p-4">
          <nav className="space-y-1">
            <Button
              variant="ghost"
              className={`w-full justify-start ${activeTab === 'users' ? 'bg-themed-surface-hover' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <Users className="h-5 w-5 mr-3" />
              Users
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start ${activeTab === 'events' ? 'bg-themed-surface-hover' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              <Calendar className="h-5 w-5 mr-3" />
              Events
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start ${activeTab === 'analytics' ? 'bg-themed-surface-hover' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart2 className="h-5 w-5 mr-3" />
              Analytics
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start ${activeTab === 'system' ? 'bg-themed-surface-hover' : ''}`}
              onClick={() => setActiveTab('system')}
            >
              <Server className="h-5 w-5 mr-3" />
              System
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start ${activeTab === 'automation' ? 'bg-themed-surface-hover' : ''}`}
              onClick={() => setActiveTab('automation')}
            >
              <Bot className="h-5 w-5 mr-3" />
              AI Automation
            </Button>
          </nav>
        </div>

        {/* Content area */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="bg-themed-surface border border-themed rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              {activeTab === 'users' && 'User Management'}
              {activeTab === 'events' && 'Event Management'}
              {activeTab === 'analytics' && 'Analytics Dashboard'}
              {activeTab === 'system' && 'System Settings'}
              {activeTab === 'automation' && 'AI Automation Status'}
            </h2>
            
            <p className="text-themed-secondary mb-4">
              This is a placeholder admin dashboard UI. The complete functionality would be implemented in a production environment.
            </p>
            
            {activeTab === 'users' && (
              <div className="border border-themed rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-themed">
                  <thead className="bg-themed-surface-hover">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-themed-secondary uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-themed-surface divide-y divide-themed">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">admin@todoevents.com</td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 rounded-full bg-blue-900 text-blue-200 text-xs">Admin</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 rounded-full bg-green-900 text-green-200 text-xs">Active</span></td>
                      <td className="px-6 py-4 whitespace-nowrap space-x-2">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <Lock className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">user@example.com</td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 rounded-full bg-themed-surface-hover text-themed-secondary text-xs">User</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 rounded-full bg-green-900 text-green-200 text-xs">Active</span></td>
                      <td className="px-6 py-4 whitespace-nowrap space-x-2">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <Lock className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            
            {activeTab === 'events' && (
              <div className="space-y-4">
                <div className="flex justify-between">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-themed-secondary" />
                    <input
                      type="text"
                      placeholder="Search events..."
                      className="pl-10 w-full py-2 bg-themed-surface border border-themed rounded-md text-sm text-themed-primary focus:ring-pin-blue focus:border-pin-blue"
                    />
                  </div>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-gray-700 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-medium">Sample Event {i}</h3>
                        <span className="px-2 py-1 rounded-full bg-blue-900 text-blue-200 text-xs">Music</span>
                      </div>
                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">This is a sample event description that would show the first couple of lines.</p>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>2023-06-{10 + i}</span>
                        <div className="flex space-x-2">
                          <button className="text-blue-400 hover:text-blue-300">Edit</button>
                          <button className="text-red-400 hover:text-red-300">Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'analytics' && (
              <div className="text-center py-10">
                <PieChart className="h-20 w-20 mx-auto mb-4 text-blue-500" />
                <p className="text-gray-400">Analytics dashboard is under development.</p>
              </div>
            )}
            
            {activeTab === 'system' && (
              <div className="space-y-4">
                <div className="bg-themed-surface-hover border border-themed p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center">
                    <Database className="h-5 w-5 mr-3 text-green-500" />
                    <div>
                      <h3 className="font-medium">Database Status</h3>
                      <p className="text-sm text-themed-secondary">Connection established</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-green-900 text-green-200 text-xs">Online</span>
                </div>
                
                <div className="bg-themed-surface-hover border border-themed p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-3 text-blue-500" />
                    <div>
                      <h3 className="font-medium">API Status</h3>
                      <p className="text-sm text-themed-secondary">All endpoints available</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-green-900 text-green-200 text-xs">Online</span>
                </div>
              </div>
            )}

            {activeTab === 'automation' && (
              <div className="space-y-6">
                {/* Automation Overview */}
                <div className="bg-themed-surface-hover border border-themed p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium flex items-center">
                      <Bot className="h-5 w-5 mr-2 text-blue-500" />
                      AI Search Automation
                    </h3>
                    <Button 
                      onClick={fetchAutomationStatus}
                      variant="outline"
                      size="sm"
                      className="border-themed text-themed-secondary hover:bg-themed-surface-hover"
                    >
                      Refresh Status
                    </Button>
                  </div>
                  
                  {automationStatus ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-themed-secondary">Environment:</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            automationStatus.system.environment === 'production' 
                              ? 'bg-green-900 text-green-200' 
                              : 'bg-yellow-900 text-yellow-200'
                          }`}>
                            {automationStatus.system.environment}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-themed-secondary">Automation:</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            automationStatus.automation.enabled 
                              ? 'bg-green-900 text-green-200' 
                              : 'bg-red-900 text-red-200'
                          }`}>
                            {automationStatus.automation.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-themed-secondary">Scheduler:</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            automationStatus.automation.scheduler_running 
                              ? 'bg-green-900 text-green-200' 
                              : 'bg-red-900 text-red-200'
                          }`}>
                            {automationStatus.automation.scheduler_running ? 'Running' : 'Stopped'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="text-themed-secondary">Last Sitemap Update:</span>
                          <div className="text-xs text-themed-secondary mt-1">
                            {automationStatus.automation.last_sitemap_update 
                              ? new Date(automationStatus.automation.last_sitemap_update).toLocaleString()
                              : 'Never'
                            }
                          </div>
                        </div>
                        <div className="text-sm">
                          <span className="text-themed-secondary">Last Event Refresh:</span>
                          <div className="text-xs text-themed-secondary mt-1">
                            {automationStatus.automation.last_event_refresh 
                              ? new Date(automationStatus.automation.last_event_refresh).toLocaleString()
                              : 'Never'
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
                      <p className="text-themed-secondary text-sm">Loading automation status...</p>
                    </div>
                  )}
                </div>

                {/* Task Status */}
                {automationStatus?.automation.task_status && (
                  <div className="bg-themed-surface-hover border border-themed p-4 rounded-lg">
                    <h3 className="text-lg font-medium mb-4">Task Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Object.entries(automationStatus.automation.task_status).map(([taskName, status]) => (
                        <div key={taskName} className="bg-themed-surface border border-themed p-3 rounded">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium capitalize">
                              {taskName.replace(/_/g, ' ')}
                            </h4>
                            <span className={`px-2 py-1 rounded text-xs ${
                              status.status === 'completed' 
                                ? 'bg-green-900 text-green-200'
                                : status.status === 'failed'
                                ? 'bg-red-900 text-red-200'
                                : 'bg-yellow-900 text-yellow-200'
                            }`}>
                              {status.status}
                            </span>
                          </div>
                          {status.last_run && (
                            <p className="text-xs text-themed-secondary">
                              Last run: {new Date(status.last_run).toLocaleString()}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual Triggers */}
                {automationStatus?.automation.enabled && (
                  <div className="bg-themed-surface-hover border border-themed p-4 rounded-lg">
                    <h3 className="text-lg font-medium mb-4">Manual Triggers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button
                        onClick={() => triggerAutomationTask('sitemap')}
                        disabled={automationLoading}
                        className="bg-blue-600 hover:bg-blue-700 w-full"
                      >
                        {automationLoading ? 'Triggering...' : 'Update Sitemap'}
                      </Button>
                      <Button
                        onClick={() => triggerAutomationTask('events')}
                        disabled={automationLoading}
                        className="bg-green-600 hover:bg-green-700 w-full"
                      >
                        {automationLoading ? 'Triggering...' : 'Refresh Events'}
                      </Button>
                      <Button
                        onClick={() => triggerAutomationTask('ai_sync')}
                        disabled={automationLoading}
                        className="bg-purple-600 hover:bg-purple-700 w-full"
                      >
                        {automationLoading ? 'Triggering...' : 'AI Sync'}
                      </Button>
                    </div>
                    <p className="text-xs text-themed-secondary mt-3">
                      Manual triggers are useful for testing or immediate updates. 
                      Automated tasks run every 6 hours in production.
                    </p>
                  </div>
                )}

                {/* Next Scheduled Runs */}
                {automationStatus?.automation.next_runs && Object.keys(automationStatus.automation.next_runs).length > 0 && (
                  <div className="bg-themed-surface-hover border border-themed p-4 rounded-lg">
                    <h3 className="text-lg font-medium mb-4">Next Scheduled Runs</h3>
                    <div className="space-y-2">
                      {Object.entries(automationStatus.automation.next_runs).map(([jobId, nextRun]) => (
                        <div key={jobId} className="flex justify-between items-center">
                          <span className="text-sm capitalize">{jobId.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-themed-secondary">
                            {nextRun ? new Date(nextRun).toLocaleString() : 'Not scheduled'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 