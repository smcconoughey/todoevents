import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

const FirstTimeSignInPopup = ({ isOpen, onClose, onCreateEvent }) => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const handleLearnMore = () => {
    onClose();
    navigate('/hosts');
  };

  const handleCreateEvent = () => {
    onClose();
    if (onCreateEvent) {
      onCreateEvent();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-themed-surface border border-themed">
        {/* Header with gradient */}
        <div className="relative p-6 pb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-spark-yellow/10 via-pin-blue/10 to-vibrant-magenta/10"></div>
          <div className="relative">
            <DialogHeader className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto mb-2 bg-spark-yellow/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-spark-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <DialogTitle className="text-xl font-semibold text-themed-primary">
                Welcome to Todo Events!
              </DialogTitle>
              <DialogDescription className="text-themed-secondary">
                You're now signed in and ready to start hosting events. What would you like to do first?
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-4">
          {/* Learn More Option */}
          <button
            onClick={handleLearnMore}
            className="w-full p-4 text-left bg-themed-surface border border-themed rounded-lg hover:bg-themed-surface-hover transition-all duration-200 group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-pin-blue/20 rounded-lg flex items-center justify-center group-hover:bg-pin-blue/30 transition-colors">
                <svg className="w-5 h-5 text-pin-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-themed-primary mb-1">Learn How to Host Successfully</h3>
                <p className="text-sm text-themed-secondary">
                  Get tips, best practices, and learn about upcoming premium features
                </p>
              </div>
              <svg className="w-5 h-5 text-themed-tertiary group-hover:text-themed-secondary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Create Event Option */}
          <button
            onClick={handleCreateEvent}
            className="w-full p-4 text-left bg-spark-yellow/10 border border-spark-yellow/30 rounded-lg hover:bg-spark-yellow/20 transition-all duration-200 group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-spark-yellow/20 rounded-lg flex items-center justify-center group-hover:bg-spark-yellow/30 transition-colors">
                <svg className="w-5 h-5 text-spark-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-themed-primary mb-1">Create My First Event</h3>
                <p className="text-sm text-themed-secondary">
                  Jump right in and start creating your event now
                </p>
              </div>
              <svg className="w-5 h-5 text-themed-tertiary group-hover:text-themed-secondary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Skip for now */}
          <div className="text-center pt-2">
            <button
              onClick={onClose}
              className="text-sm text-themed-tertiary hover:text-themed-secondary transition-colors"
            >
              I'll decide later
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FirstTimeSignInPopup; 