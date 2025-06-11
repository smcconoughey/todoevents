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
      console.log('🚨 Starting report submission...');
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

      console.log('📝 Report data:', reportData);
      const apiUrl = import.meta.env.VITE_API_URL || 'https://todoevents-backend.onrender.com';
      const reportUrl = `${apiUrl}/api/report-event`;
      console.log('🌐 Sending to:', reportUrl);

      const response = await fetch(reportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData)
      });

      console.log('📡 Response received:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      // Check if response has content before parsing JSON
      const contentType = response.headers.get('content-type');
      let result;
      
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        console.log('📄 Response text:', text);
        if (text.trim()) {
          result = JSON.parse(text);
        } else {
          // Empty response, assume success
          result = { success: true };
        }
      } else {
        // Non-JSON response, assume success if status is ok
        result = { success: true };
      }
      
      console.log('✅ Parsed result:', result);
      
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
      console.log('Report data sent:', reportData);
      console.log('Response status:', response?.status);
      console.log('Response headers:', response?.headers);
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
        <DialogContent className="dialog-themed max-w-md p-6">
          <DialogHeader className="pb-3">
            <DialogTitle className="flex items-center gap-2 text-white text-base">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Report Submitted
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-center space-y-2">
              <div className="text-white/90 text-sm">
                Thank you for your report. We have received your submission and will review it shortly.
              </div>
              <div className="text-xs text-white/70">
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
      <DialogContent className="dialog-themed max-w-md max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 text-white text-base">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            Report "{event.title}"
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Report Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">
              What's the issue? <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {reportCategories.map((category) => (
                <label key={category.value} className="flex items-center gap-2 p-2 rounded-md border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="category"
                    value={category.value}
                    checked={formData.category === category.value}
                    onChange={handleInputChange}
                    className="w-3.5 h-3.5 text-pin-blue border-white/30 focus:ring-pin-blue focus:ring-offset-0 bg-transparent"
                  />
                  <div className="text-white text-sm">{category.label}</div>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="description" className="text-sm font-medium text-white">
              Details <span className="text-red-400">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Please provide details about the issue..."
              className="input-themed min-h-[80px] resize-y text-sm"
              rows={3}
            />
            <div className="text-xs text-white/50">
              {formData.description.length}/500 characters
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <label htmlFor="userEmail" className="text-sm font-medium text-white">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                id="userEmail"
                name="userEmail"
                value={formData.userEmail}
                onChange={handleInputChange}
                placeholder="your.email@example.com"
                className="input-themed text-sm"
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="userName" className="text-sm font-medium text-white">
                Name (optional)
              </label>
              <input
                type="text"
                id="userName"
                name="userName"
                value={formData.userName}
                onChange={handleInputChange}
                placeholder="Your name"
                className="input-themed text-sm"
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
          <div className="flex gap-2.5 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 text-white/70 hover:text-white hover:bg-white/10 text-sm py-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 btn-primary text-sm py-2"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Submitting...
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Submit
                </div>
              )}
            </Button>
          </div>

          {/* Privacy Notice */}
          <div className="text-xs text-white/40 pt-2 text-center">
            Report will be sent to our moderation team for review.
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog; 