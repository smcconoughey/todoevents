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
  ChevronDown
} from 'lucide-react';

const AdminDashboard = () => {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');

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

  // If user is not an admin, show access denied screen
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="max-w-md p-8 bg-gray-800 rounded-lg">
          <div className="flex items-center justify-center mb-6">
            <AlertTriangle className="text-amber-500 h-12 w-12" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-4">Access Denied</h1>
          <p className="text-gray-300 mb-6 text-center">
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
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
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
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // Simple admin dashboard with navigation tabs
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 py-4 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-blue-500 mr-3" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">Logged in as: {user?.email}</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/')}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
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
        <div className="w-64 bg-gray-800 border-r border-gray-700 p-4">
          <nav className="space-y-1">
            <Button
              variant="ghost"
              className={`w-full justify-start ${activeTab === 'users' ? 'bg-gray-700' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <Users className="h-5 w-5 mr-3" />
              Users
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start ${activeTab === 'events' ? 'bg-gray-700' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              <Calendar className="h-5 w-5 mr-3" />
              Events
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start ${activeTab === 'analytics' ? 'bg-gray-700' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart2 className="h-5 w-5 mr-3" />
              Analytics
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start ${activeTab === 'system' ? 'bg-gray-700' : ''}`}
              onClick={() => setActiveTab('system')}
            >
              <Server className="h-5 w-5 mr-3" />
              System
            </Button>
          </nav>
        </div>

        {/* Content area */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              {activeTab === 'users' && 'User Management'}
              {activeTab === 'events' && 'Event Management'}
              {activeTab === 'analytics' && 'Analytics Dashboard'}
              {activeTab === 'system' && 'System Settings'}
            </h2>
            
            <p className="text-gray-400 mb-4">
              This is a placeholder admin dashboard UI. The complete functionality would be implemented in a production environment.
            </p>
            
            {activeTab === 'users' && (
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-700">
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
                      <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 py-1 rounded-full bg-gray-700 text-gray-300 text-xs">User</span></td>
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
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search events..."
                      className="pl-10 w-full py-2 bg-gray-700 border border-gray-600 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
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
                <div className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center">
                    <Database className="h-5 w-5 mr-3 text-green-500" />
                    <div>
                      <h3 className="font-medium">Database Status</h3>
                      <p className="text-sm text-gray-400">Connection established</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-green-900 text-green-200 text-xs">Online</span>
                </div>
                
                <div className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-3 text-blue-500" />
                    <div>
                      <h3 className="font-medium">API Status</h3>
                      <p className="text-sm text-gray-400">All endpoints available</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-green-900 text-green-200 text-xs">Online</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 