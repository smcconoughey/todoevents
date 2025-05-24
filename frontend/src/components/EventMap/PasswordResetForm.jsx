import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Loader2, ChevronLeft } from 'lucide-react';
import { API_URL } from '@/config';

const PasswordResetForm = ({ onBack, onSuccess }) => {
  // Reset steps
  const STEPS = {
    REQUEST: 'request',
    VERIFY: 'verify',
    RESET: 'reset',
    SUCCESS: 'success'
  };

  const [step, setStep] = useState(STEPS.REQUEST);
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Password validation state
  const [validationStatus, setValidationStatus] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  // Update validation status when password changes
  const validatePassword = (pass) => {
    setValidationStatus({
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      lowercase: /[a-z]/.test(pass),
      number: /\d/.test(pass),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pass)
    });
  };

  // Step 1: Request reset code
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to request password reset');
      }

      setSuccess('Reset code sent. Please check your email. (For demo purposes, check server logs)');
      
      // In development, the API returns the reset code directly
      if (data.reset_code) {
        setResetCode(data.reset_code);
      }
      
      setStep(STEPS.VERIFY);
    } catch (error) {
      setError(error.message || 'Failed to request reset code');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify reset code
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/verify-reset-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, reset_code: resetCode })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Invalid or expired reset code');
      }

      setSuccess('Code verified! Now set your new password');
      setStep(STEPS.RESET);
    } catch (error) {
      setError(error.message || 'Failed to verify reset code');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set new password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          reset_code: resetCode,
          new_password: newPassword
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to reset password');
      }

      setSuccess('Password reset successfully!');
      setStep(STEPS.SUCCESS);
    } catch (error) {
      setError(error.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Password validation indicator
  const PasswordRequirements = () => (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-white/50">Password requirements:</p>
      <ul className="space-y-1">
        <li className={`text-xs flex items-center gap-1 ${validationStatus.length ? 'text-green-400' : 'text-white/50'}`}>
          {validationStatus.length ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          At least 8 characters
        </li>
        <li className={`text-xs flex items-center gap-1 ${validationStatus.uppercase ? 'text-green-400' : 'text-white/50'}`}>
          {validationStatus.uppercase ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          At least one uppercase letter
        </li>
        <li className={`text-xs flex items-center gap-1 ${validationStatus.lowercase ? 'text-green-400' : 'text-white/50'}`}>
          {validationStatus.lowercase ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          At least one lowercase letter
        </li>
        <li className={`text-xs flex items-center gap-1 ${validationStatus.number ? 'text-green-400' : 'text-white/50'}`}>
          {validationStatus.number ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          At least one number
        </li>
        <li className={`text-xs flex items-center gap-1 ${validationStatus.special ? 'text-green-400' : 'text-white/50'}`}>
          {validationStatus.special ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          At least one special character
        </li>
      </ul>
    </div>
  );

  // Render different forms based on current step
  const renderStepContent = () => {
    switch (step) {
      case STEPS.REQUEST:
        return (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70">Email Address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-white text-black hover:bg-white/90"
              disabled={loading}
            >
              {loading 
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending Code...</>
                : 'Send Reset Code'
              }
            </Button>
          </form>
        );
        
      case STEPS.VERIFY:
        return (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70">Reset Code</label>
              <Input
                type="text"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                placeholder="Enter 6-digit code"
                required
                disabled={loading}
              />
              <p className="text-xs text-white/50">Enter the 6-digit code sent to your email</p>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-white text-black hover:bg-white/90"
              disabled={loading}
            >
              {loading 
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
                : 'Verify Code'
              }
            </Button>
          </form>
        );
        
      case STEPS.RESET:
        return (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  validatePassword(e.target.value);
                }}
                placeholder="Enter new password"
                required
                disabled={loading}
              />
              <PasswordRequirements />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-white/70">Confirm Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                disabled={loading}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-white text-black hover:bg-white/90"
              disabled={loading || !Object.values(validationStatus).every(Boolean) || newPassword !== confirmPassword}
            >
              {loading 
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Resetting Password...</>
                : 'Reset Password'
              }
            </Button>
          </form>
        );
        
      case STEPS.SUCCESS:
        return (
          <div className="space-y-4">
            <div className="bg-green-500/20 text-green-200 p-4 rounded-md flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium">Password Reset Successful</h3>
                <p className="text-sm">Your password has been changed. You can now log in with your new password.</p>
              </div>
            </div>
            
            <Button 
              onClick={onSuccess}
              className="w-full bg-white text-black hover:bg-white/90"
            >
              Return to Login
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Reset Password</h2>
        
        {/* Back button, except on success step */}
        {step !== STEPS.SUCCESS && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => step === STEPS.REQUEST ? onBack() : setStep(STEPS.REQUEST)}
            className="text-white/70 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {step === STEPS.REQUEST ? "Back to Login" : "Restart"}
          </Button>
        )}
      </div>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-500/20 text-red-200 p-3 rounded-md flex items-start gap-2">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}
      
      {/* Success message */}
      {success && step !== STEPS.SUCCESS && (
        <div className="bg-green-500/20 text-green-200 p-3 rounded-md flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>{success}</div>
        </div>
      )}
      
      {renderStepContent()}
    </div>
  );
};

export default PasswordResetForm; 