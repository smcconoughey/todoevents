import React from 'react';
import { useAuth } from '../EventMap/AuthContext';
import { MissionOpsProvider } from './MissionOpsContext';
import MissionOpsGrid from './MissionOpsGrid';
import { Target, Shield, User } from 'lucide-react';

const MissionOpsAuthGuard = () => {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white">Initializing MissionOps...</p>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return (
      <div className="h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-blue-600/20 rounded-full">
              <Shield className="w-12 h-12 text-blue-400" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              MissionOps Access Required
            </h1>
            <p className="text-neutral-400">
              You need to be logged in to access the MissionOps planning interface.
            </p>
          </div>

          <div className="p-4 bg-neutral-900/50 border border-neutral-700 rounded-lg">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-left space-y-2">
                <h3 className="font-medium text-white">What is MissionOps?</h3>
                <p className="text-sm text-neutral-300">
                  A deep planning and risk management tool for complex projects with 
                  ambiguous timelines. Organize missions on an infinite grid with 
                  timeline-based positioning.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/'}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <User className="w-4 h-4" />
              Go to Login
            </button>
            
            <p className="text-xs text-neutral-500">
              Return to the main application to sign in or create an account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MissionOpsProvider>
      <MissionOpsGrid />
    </MissionOpsProvider>
  );
};

const MissionOps = () => {
  return <MissionOpsAuthGuard />;
};

export default MissionOps;