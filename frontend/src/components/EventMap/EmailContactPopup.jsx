import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Mail, Copy, Check, X, Send, ExternalLink } from 'lucide-react';
import { WebIcon } from './WebIcons';

const EmailContactPopup = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const supportEmail = 'support@todo-events.com';

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(supportEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = supportEmail;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendEmail = () => {
    window.open(`mailto:${supportEmail}?subject=Todo Events - Support Request`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-4 bg-themed-surface border border-themed rounded-xl shadow-xl">
        {/* Header with close button */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pin-blue/10 rounded-lg">
              <Mail className="w-5 h-5 text-pin-blue" />
            </div>
            <DialogTitle className="text-lg font-semibold text-themed-primary">
              Contact Support
            </DialogTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-themed-surface-hover text-themed-secondary hover:text-themed-primary"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="px-6 pb-6 space-y-6">
          {/* Main message */}
          <div className="text-center space-y-2">
            <h3 className="text-themed-primary font-medium">
              Have problems, suggestions, or concerns?
            </h3>
            <p className="text-themed-secondary text-sm">
              We're here to help! Get in touch with our support team.
            </p>
          </div>
          
          {/* Email contact section */}
          <div className="bg-themed-surface-hover rounded-xl p-4 border border-themed">
            <div className="text-xs text-themed-tertiary mb-3 uppercase tracking-wide font-medium">
              Contact us at:
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-themed-surface px-4 py-3 rounded-lg border border-themed">
                <div className="text-pin-blue font-mono text-sm font-medium">
                  {supportEmail}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyEmail}
                className="p-3 rounded-lg hover:bg-themed-surface text-themed-secondary hover:text-themed-primary transition-colors"
                title="Copy email address"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1 py-3 text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover rounded-lg border border-themed"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              className="flex-1 py-3 bg-pin-blue hover:bg-pin-blue/90 text-white rounded-lg font-medium transition-colors"
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Email
            </Button>
          </div>
          
          {/* Footer note */}
          <div className="text-center">
            <div className="bg-blue-50 dark:bg-blue-900/20 bg-blue-50/70 p-3 rounded-lg border border-blue-200 dark:border-blue-700 border-blue-200/50 mb-4">
              <p className="text-sm text-blue-800 dark:text-blue-200 text-blue-800 flex items-center">
                <WebIcon emoji="💡" size={16} className="mr-2" />
                This form sends your message directly to the event organizer. Your email is not stored on our servers.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailContactPopup; 