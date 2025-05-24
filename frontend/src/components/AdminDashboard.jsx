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

// Import the admin dashboard from the original component
import AdminDashboardOriginal from '../../admin/src/AdminDashboard';

const AdminDashboard = () => {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  // If admin, render the dashboard but with our API base URL
  // Instead of directly using the AdminDashboardOriginal component, we would ideally
  // customize it for our specific application needs, but to keep things simple,
  // we'll use it directly
  return (
    <div className="admin-dashboard-wrapper">
      {/* Pass the API URL and token to the original dashboard */}
      <AdminDashboardOriginal />
    </div>
  );
};

export default AdminDashboard; 