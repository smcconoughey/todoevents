import React from 'react';
import { ExternalLink, AlertTriangle, Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/radix-dialog';
import { Button } from '@/components/ui/button';

const ExternalLinkWarning = ({ isOpen, onClose, onConfirm, url }) => {
  const getDomain = (url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="dialog-themed max-w-md"
        aria-describedby="external-link-warning-description"
      >
        <DialogHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          
          <DialogTitle className="text-lg font-display font-bold dialog-title-themed">
            You're leaving TodoEvents
          </DialogTitle>
          
          <DialogDescription id="external-link-warning-description" className="dialog-description-themed text-center">
            You're about to visit an external website. TodoEvents is not responsible 
            for the content or security of external sites.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* URL Display */}
          <div className="p-3 bg-themed-surface border border-themed rounded-md">
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="w-4 h-4 text-themed-secondary flex-shrink-0" />
              <span className="text-themed-secondary">Destination:</span>
            </div>
            <p className="text-sm font-mono text-themed-primary mt-1 break-all">
              {getDomain(url)}
            </p>
          </div>

          {/* Safety Tips */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-300">
                <p className="font-medium mb-1">Safety Tips:</p>
                <ul className="space-y-1 text-blue-200">
                  <li>• Only enter personal information on trusted websites</li>
                  <li>• Check the URL for suspicious characters or misspellings</li>
                  <li>• Look for secure (https://) connections when entering sensitive data</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={onClose}
              variant="ghost"
              className="flex-1 h-10"
            >
              Cancel
            </Button>
            
            <Button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 h-10 btn-yellow-themed"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Continue to Site
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExternalLinkWarning; 