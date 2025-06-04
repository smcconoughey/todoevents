import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Mail, Copy, Check } from 'lucide-react';

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
    window.open(`mailto:${supportEmail}?subject=Todo Events - Contact`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-themed-surface border border-themed rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-themed-primary">
            <Mail className="w-5 h-5 text-pin-blue" />
            Contact Support
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="text-center space-y-3">
            <div className="text-themed-secondary">
              Have problems, suggestions, or concerns?
            </div>
            <div className="text-lg font-medium text-themed-primary">
              We're here to help! 
            </div>
          </div>
          
          <div className="bg-themed-surface-hover rounded-lg p-4 border border-themed">
            <div className="text-sm text-themed-secondary mb-2">Contact us at:</div>
            <div className="flex items-center justify-between gap-3">
              <code className="bg-themed-surface px-3 py-2 rounded text-pin-blue font-mono text-sm flex-1">
                {supportEmail}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyEmail}
                className="text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover"
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
          
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1 text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              className="flex-1 bg-pin-blue hover:bg-pin-blue-600 text-white"
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Email
            </Button>
          </div>
          
          <div className="text-xs text-themed-tertiary text-center">
            💡 We typically respond within 24 hours
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailContactPopup; 