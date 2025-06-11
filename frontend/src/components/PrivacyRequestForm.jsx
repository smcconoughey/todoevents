import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Shield, User, Mail, FileText, CheckCircle, Clock } from 'lucide-react';

const PrivacyRequestForm = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    request_type: 'access',
    email: '',
    full_name: '',
    verification_info: '',
    details: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestId, setRequestId] = useState(null);

  const requestTypes = [
    { 
      id: 'access', 
      label: 'Data Access Request', 
      description: 'Get a copy of all personal data we have collected about you'
    },
    { 
      id: 'delete', 
      label: 'Data Deletion Request', 
      description: 'Permanently delete all personal data associated with your account'
    },
    { 
      id: 'opt_out', 
      label: 'Opt-Out Request', 
      description: 'Restrict the use of your personal data for marketing and analytics'
    }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/privacy/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to submit privacy request');
      }

      const result = await response.json();
      setRequestId(result.request_id);
      setSubmitted(true);
    } catch (error) {
      console.error('Privacy request error:', error);
      alert('Failed to submit privacy request. Please try again or contact privacy@todo-events.com directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    setFormData({
      request_type: 'access',
      email: '',
      full_name: '',
      verification_info: '',
      details: ''
    });
    setSubmitted(false);
    setRequestId(null);
    onClose();
  };

  if (submitted) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="dialog-themed max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-themed-primary flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              Request Submitted
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-800 mb-2">✅ Privacy Request Confirmed</h3>
              <p className="text-green-700 text-sm mb-2">
                Your privacy request has been submitted successfully.
              </p>
              <div className="bg-green-100 border border-green-300 rounded p-2 text-center">
                <span className="font-mono text-green-800">Request ID: #{requestId}</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h4 className="font-medium text-blue-800">What happens next?</h4>
              </div>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• We will respond within 45 days as required by law</li>
                <li>• You'll receive email updates on your request status</li>
                <li>• We may contact you to verify your identity</li>
                <li>• For questions, contact privacy@todo-events.com</li>
              </ul>
            </div>

            <button
              onClick={handleClose}
              className="w-full btn-secondary"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="dialog-themed max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-themed-primary flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-500" />
            Privacy Request
          </DialogTitle>
          <p className="text-themed-secondary text-sm">
            Exercise your privacy rights under California law (CCPA)
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Request Type */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-themed-primary">Request Type</label>
            <div className="space-y-2">
              {requestTypes.map((type) => (
                <label key={type.id} className="flex items-start gap-3 p-3 border border-themed rounded-lg hover:bg-themed-surface-hover cursor-pointer">
                  <input
                    type="radio"
                    name="request_type"
                    value={type.id}
                    checked={formData.request_type === type.id}
                    onChange={(e) => handleInputChange('request_type', e.target.value)}
                    className="w-4 h-4 mt-0.5 text-blue-500 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-themed-primary">{type.label}</div>
                    <div className="text-xs text-themed-secondary">{type.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-base font-medium text-themed-primary border-b border-themed pb-2">
              Contact Information
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-themed-secondary flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="input-themed"
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-themed-secondary flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Full Name (optional)
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                  className="input-themed"
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-themed-secondary">
                  Verification Information (optional)
                </label>
                <input
                  type="text"
                  value={formData.verification_info}
                  onChange={(e) => handleInputChange('verification_info', e.target.value)}
                  className="input-themed"
                  placeholder="Additional info to help verify your identity"
                />
                <p className="text-xs text-themed-muted">
                  Any additional information that helps us verify your identity (account details, recent events created, etc.)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-themed-secondary flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Additional Details (optional)
                </label>
                <textarea
                  value={formData.details}
                  onChange={(e) => handleInputChange('details', e.target.value)}
                  className="input-themed min-h-[80px] resize-none"
                  placeholder="Any specific details about your request..."
                />
              </div>
            </div>
          </div>

          {/* Legal Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Your Rights</h4>
            <div className="text-blue-700 text-sm space-y-1">
              <p>Under the California Consumer Privacy Act (CCPA), you have the right to:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Know what personal information we collect and how it's used</li>
                <li>Request deletion of your personal information</li>
                <li>Opt-out of the sale of personal information (we don't sell data)</li>
                <li>Non-discriminatory treatment when exercising privacy rights</li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-themed">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.email}
              className="flex-1 btn-yellow-themed disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin mr-2"></div>
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PrivacyRequestForm; 