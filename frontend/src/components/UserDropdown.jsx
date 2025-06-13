import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './EventMap/AuthContext';
import { Button } from './ui/button';
import { 
  User, 
  Settings, 
  LogOut, 
  Crown, 
  ChevronDown,
  CreditCard
} from 'lucide-react';

const UserDropdown = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAccountClick = () => {
    setIsOpen(false);
    navigate('/account');
  };

  const handleSubscriptionClick = () => {
    setIsOpen(false);
    navigate('/subscription');
  };

  const handleLogoutClick = () => {
    setIsOpen(false);
    logout();
  };

  const isPremium = user?.role === 'premium' || user?.role === 'admin';

  if (!user) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 flex items-center gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-6 h-6 bg-pin-blue rounded-full flex items-center justify-center">
          <User className="w-3 h-3 text-white" />
        </div>
        <span className="hidden sm:inline text-sm">{user.email?.split('@')[0]}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-themed-surface border border-themed rounded-lg shadow-xl z-50 overflow-hidden">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-themed bg-themed-surface-hover">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-pin-blue rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-themed-primary truncate">
                  {user.email}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {isPremium ? (
                    <div className="flex items-center gap-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                      <Crown className="w-3 h-3 text-amber-500" />
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Premium</span>
                    </div>
                  ) : (
                    <span className="text-xs text-themed-secondary bg-themed-surface px-2 py-0.5 rounded-full border border-themed">
                      Free Account
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={handleAccountClick}
              className="w-full flex items-center gap-3 px-4 py-2 text-left text-themed-primary hover:bg-themed-surface-hover transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">Account & Events</span>
            </button>

            {isPremium ? (
              <button
                onClick={handleSubscriptionClick}
                className="w-full flex items-center gap-3 px-4 py-2 text-left text-themed-primary hover:bg-themed-surface-hover transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-sm">Manage Subscription</span>
              </button>
            ) : (
              <button
                onClick={handleAccountClick}
                className="w-full flex items-center gap-3 px-4 py-2 text-left text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              >
                <Crown className="w-4 h-4" />
                <span className="text-sm">Upgrade to Premium</span>
              </button>
            )}

            <div className="border-t border-themed my-1"></div>

            <button
              onClick={handleLogoutClick}
              className="w-full flex items-center gap-3 px-4 py-2 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDropdown;