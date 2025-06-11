import React from 'react';
import { Shield } from 'lucide-react';

const PrivacyNotice = ({ context = "general", compact = false }) => {
  const getContextMessage = () => {
    switch (context) {
      case "event_creation":
        return "Event details and your account information will be collected and stored. All submitted content becomes property of Watchtower AB, Inc.";
      case "report":
        return "Your contact information and report details will be collected for moderation purposes.";
      case "account":
        return "Your account information will be collected and stored securely.";
      default:
        return "Your information will be collected and stored in accordance with our privacy policy.";
    }
  };

  if (compact) {
    return (
      <div className="text-xs text-themed-muted">
        <p>
          {getContextMessage()}{' '}
          <a href="/legal" target="_blank" className="text-pin-blue hover:underline">
            Privacy Policy
          </a>
          {' • '}
          <span className="font-medium">California residents:</span>{' '}
          <a href="mailto:privacy@todo-events.com" className="text-pin-blue hover:underline">
            privacy@todo-events.com
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-themed-primary">
          <p className="mb-2">{getContextMessage()}</p>
          <p>
            By submitting this form, you agree to our{' '}
            <a href="/legal" target="_blank" className="text-pin-blue hover:underline">
              Legal Notice and Privacy Policy
            </a>.
          </p>
          <p className="mt-1">
            <strong>California residents:</strong> You have rights regarding your personal data.{' '}
            <a href="mailto:privacy@todo-events.com" className="text-pin-blue hover:underline">
              Contact us
            </a>{' '}
            for access, deletion, or opt-out requests.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyNotice; 