import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import PrivacyNotice from '../PrivacyNotice';

const ReportDialog = ({ isOpen, onClose, event }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const reportReasons = [
    { id: 'inappropriate', label: 'Inappropriate Content' },
    { id: 'incorrect', label: 'Incorrect Information' },
    { id: 'spam', label: 'Spam or Promotional' },
    { id: 'duplicate', label: 'Duplicate Event' },
    { id: 'safety', label: 'Safety Concerns' },
    { id: 'copyright', label: 'Copyright Violation' },
    { id: 'other', label: 'Other' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedReason) {
      alert('Please select a reason for reporting');
      return;
    }

    setIsLoading(true);

    try {
      const reportData = {
        event_id: event.id,
        reason: selectedReason,
        details: details.trim(),
        reporter_email: email.trim(),
        reporter_name: name.trim()
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/report-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        let errorMessage;
        try {
          const parsed = JSON.parse(errorData);
          errorMessage = parsed.error || 'Failed to submit report';
        } catch {
          errorMessage = 'Failed to submit report';
        }
        throw new Error(errorMessage);
      }

      setShowSuccess(true);
      
      // Reset form after success
      setSelectedReason('');
      setDetails('');
      setEmail('');
      setName('');
      
    } catch (error) {
      console.error('Report submission error:', error);
      alert(`Failed to submit report: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (showSuccess) {
      setShowSuccess(false);
    }
    onClose();
  };

  if (showSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="dialog-themed max-w-md">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-themed-primary">Report Submitted</h3>
              <p className="text-sm text-themed-secondary">
                Thank you for your report. Our moderation team will review it within 24 hours.
              </p>
            </div>
            
            <button
              onClick={handleClose}
              className="btn-secondary w-full py-2 text-sm"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="dialog-themed max-w-md">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <DialogTitle className="text-lg font-semibold dialog-title-themed">
              Report "{event?.title}"
            </DialogTitle>
          </div>
          <DialogDescription className="dialog-description-themed text-sm">
            Help us maintain a safe and accurate platform
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Issue Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-themed-secondary">
              What's the issue? <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {reportReasons.map((reason) => (
                <label key={reason.id} className="flex items-center gap-3 p-3 rounded-lg border border-themed hover:bg-themed-surface-hover cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="reason"
                    value={reason.id}
                    checked={selectedReason === reason.id}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-4 h-4 text-spark-yellow border-themed bg-themed-surface focus:ring-spark-yellow/50 focus:ring-2"
                  />
                  <span className="text-sm text-themed-primary">{reason.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-themed-secondary">
              Additional Details <span className="text-red-500">*</span>
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Please provide details about the issue..."
              className="w-full h-20 px-3 py-2 rounded-md input-themed resize-none text-sm"
              maxLength={500}
              required
            />
            <div className="text-xs text-themed-muted text-right">
              {details.length}/500 characters
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-themed-secondary">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full input-themed text-sm h-9"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-themed-secondary">
                Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full input-themed text-sm h-9"
              />
            </div>
          </div>

          {/* Privacy Notice */}
          <PrivacyNotice context="report" compact={true} />

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-themed">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 btn-secondary text-sm"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedReason || !details.trim() || !email.trim()}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center justify-center gap-2 ${
                isLoading || !selectedReason || !details.trim() || !email.trim()
                  ? 'bg-themed-surface text-themed-muted cursor-not-allowed'
                  : 'btn-yellow-themed'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Submit Report
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-themed-muted text-center pt-2">
            Report will be sent to our moderation team for review.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog; 