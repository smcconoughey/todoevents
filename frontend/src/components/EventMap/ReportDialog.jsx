import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { WebIcon } from './WebIcons';
import { AlertTriangle, Send, CheckCircle, X } from 'lucide-react';

const ReportDialog = ({ isOpen, onClose, event, user }) => {
  const [formData, setFormData] = useState({
    reason: '',
    category: '',
    description: '',
    userEmail: user?.email || '',
    userName: user?.name || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const reportCategories = [
    { value: 'inappropriate', label: 'Inappropriate Content', description: 'Offensive, spam, or inappropriate content' },
    { value: 'incorrect', label: 'Incorrect Information', description: 'Wrong date, time, location, or details' },
    { value: 'spam', label: 'Spam or Promotional', description: 'Unwanted promotional content' },
    { value: 'duplicate', label: 'Duplicate Event', description: 'This event already exists' },
    { value: 'safety', label: 'Safety Concerns', description: 'Potentially unsafe or harmful event' },
    { value: 'copyright', label: 'Copyright Violation', description: 'Unauthorized use of copyrighted material' },
    { value: 'other', label: 'Other', description: 'Other concerns not listed above' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.category) {
      setError('Please select a reason for reporting');
      return false;
    }
    if (!formData.description.trim()) {
      setError('Please provide a description of the issue');
      return false;
    }
    if (formData.description.trim().length < 10) {
      setError('Please provide a more detailed description (at least 10 characters)');
      return false;
    }
    if (!formData.userEmail.trim()) {
      setError('Please provide your email address');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const reportData = {
        eventId: event.id,
        eventTitle: event.title,
        eventAddress: event.address,
        eventDate: event.date,
        category: formData.category,
        reason: reportCategories.find(cat => cat.value === formData.category)?.label || formData.category,
        description: formData.description.trim(),
        reporterEmail: formData.userEmail.trim(),
        reporterName: formData.userName.trim(),
        reportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        currentUrl: window.location.href
      };

      const response = await fetch('/api/report-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setIsSubmitted(true);
        // Auto-close after 3 seconds
        setTimeout(() => {
          handleClose();
        }, 3000);
      } else {
        throw new Error(result.message || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      setError('Failed to submit report. Please try again or contact support directly at support@todo-events.com');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      reason: '',
      category: '',
      description: '',
      userEmail: user?.email || '',
      userName: user?.name || ''
    });
    setIsSubmitting(false);
    setIsSubmitted(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  if (isSubmitted) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="dialog-themed max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <CheckCircle className="w-6 h-6 text-green-400" />
              Report Submitted
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center space-y-3">
              <div className="text-white/90">
                Thank you for your report. We have received your submission and will review it shortly.
              </div>
              <div className="text-sm text-white/70">
                If this is an urgent matter, please contact us directly at{' '}
                <a href="mailto:support@todo-events.com" className="text-pin-blue hover:underline">
                  support@todo-events.com
                </a>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="dialog-themed max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            Report Event
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Event Info */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-sm text-white/70 mb-1">Reporting:</div>
            <div className="text-white font-medium">{event.title}</div>
            <div className="text-xs text-white/60">ID: {event.id}</div>
          </div>

          {/* Report Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">
              Reason for reporting <span className="text-red-400">*</span>
            </label>
            <div className="space-y-2">
              {reportCategories.map((category) => (
                <label key={category.value} className="flex items-start gap-3 p-3 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="category"
                    value={category.value}
                    checked={formData.category === category.value}
                    onChange={handleInputChange}
                    className="mt-1 w-4 h-4 text-pin-blue border-white/30 focus:ring-pin-blue focus:ring-offset-0 bg-transparent"
                  />
                  <div>
                    <div className="text-white font-medium text-sm">{category.label}</div>
                    <div className="text-white/60 text-xs">{category.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-white">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Please provide details about the issue..."
              className="input-themed min-h-[100px] resize-y"
              rows={4}
            />
            <div className="text-xs text-white/50">
              {formData.description.length}/500 characters
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="userEmail" className="text-sm font-medium text-white">
                Your Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                id="userEmail"
                name="userEmail"
                value={formData.userEmail}
                onChange={handleInputChange}
                placeholder="your.email@example.com"
                className="input-themed"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="userName" className="text-sm font-medium text-white">
                Your Name (optional)
              </label>
              <input
                type="text"
                id="userName"
                name="userName"
                value={formData.userName}
                onChange={handleInputChange}
                placeholder="Your name"
                className="input-themed"
              />
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 btn-primary"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Submitting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Submit Report
                </div>
              )}
            </Button>
          </div>

          {/* Privacy Notice */}
          <div className="text-xs text-white/50 pt-2 border-t border-white/10">
            Your report will be sent to our moderation team. We may contact you for additional information.
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog; 