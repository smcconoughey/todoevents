import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Loader2, Clock } from 'lucide-react';

const LoginForm = ({ mode = 'login', onSuccess = () => {}, onModeChange = () => {} }) => {
  const { login, registerUser, loading: authLoading, error: authError, statusMessage, clearError } = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [validationStatus, setValidationStatus] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });
  const [registrationStep, setRegistrationStep] = useState(null);
  const [showFallbackOption, setShowFallbackOption] = useState(false);

  // This will help ensure that loading state doesn't get stuck
  useEffect(() => {
    // If auth context is no longer loading, we shouldn't be either
    if (!authLoading && isLoading) {
      setIsLoading(false);
    }

    // If auth context has an error, make sure we're not in loading state
    if (authError) {
      setIsLoading(false);
      console.error("Auth error:", authError);
      
      // If it's a timeout error on registration, show fallback option
      if (mode === 'register' && authError.includes('timeout')) {
        setShowFallbackOption(true);
      }
    }
  }, [authLoading, authError, mode]);

  // Add a timeout to reset loading state after 30 seconds as a safety measure
  useEffect(() => {
    let timeout;
    if (isLoading) {
      timeout = setTimeout(() => {
        console.warn("Login form loading timeout - resetting state");
        setIsLoading(false);
        const timeoutMessage = "Request took too long. The server might be busy.";
        setError(timeoutMessage);
        
        // Show fallback option if on registration screen
        if (mode === 'register') {
          setShowFallbackOption(true);
        }
      }, 30000);  // Increased to 30 seconds
    }
    return () => clearTimeout(timeout);
  }, [isLoading, mode]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });

    if (e.target.name === 'password') {
      validatePassword(e.target.value);
    }
  };

  const validatePassword = (pass) => {
    setValidationStatus({
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      lowercase: /[a-z]/.test(pass),
      number: /\d/.test(pass),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pass)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setError(null);
    setIsLoading(true);
    setShowFallbackOption(false);

    console.log(`Attempting to ${mode === 'login' ? 'login' : 'register'} with email: ${form.email}`);

    try {
      if (mode === 'register') {
        if (form.password !== form.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        // Check basic password requirements
        if (form.password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }
        
        // Update UI to show registration step
        setRegistrationStep('creating');
        
        // Call register function - fetchWithTimeout is now implemented in AuthContext
        const success = await registerUser(form.email, form.password);
        
        if (success) {
          setRegistrationStep('success');
          onSuccess();
        } else {
          setRegistrationStep('error');
        }
      } else {
        // Call login function - fetchWithTimeout is now implemented in AuthContext
        const success = await login(form.email, form.password);
        
        if (success) {
          onSuccess();
        }
      }
    } catch (err) {
      console.error(`${mode === 'login' ? 'Login' : 'Registration'} error:`, err);
      setError(err.message || 'Authentication failed');
      setIsLoading(false);
      setRegistrationStep('error');
      
      // If this is a timeout error on registration, show fallback option
      if (mode === 'register' && err.message && err.message.includes('timeout')) {
        setShowFallbackOption(true);
      }
    }
  };

  const handleContinueAnyway = () => {
    // Store credentials in localStorage to attempt registration later
    try {
      localStorage.setItem('pendingRegistration', JSON.stringify({
        email: form.email,
        password: form.password,
        timestamp: new Date().toISOString()
      }));
      
      console.log("Stored registration info for later attempt");
      setRegistrationStep('deferred');
      onSuccess(); // Allow user to continue using the app
    } catch (err) {
      console.error("Failed to save registration for later:", err);
    }
  };

  const toggleMode = () => {
    // Clear any existing errors and reset loading state when switching modes
    setError(null);
    clearError();
    setIsLoading(false);
    setRegistrationStep(null);
    setShowFallbackOption(false);
    onModeChange(mode === 'login' ? 'register' : 'login');
  };

  // Display either local error or auth context error
  const displayError = error || authError;
  // Combined loading state from both local and auth context
  const isProcessing = isLoading || authLoading;

  return (
    <div className="space-y-4">
      {/* Registration Steps Indicator */}
      {mode === 'register' && registrationStep && (
        <div className="mb-4">
          <div className={`rounded-md p-3 flex items-center gap-2
            ${registrationStep === 'creating' ? 'bg-blue-500/20 text-blue-200' : 
              registrationStep === 'success' ? 'bg-green-500/20 text-green-200' : 
              registrationStep === 'deferred' ? 'bg-yellow-500/20 text-yellow-200' :
              'bg-red-500/20 text-red-200'}`}>
            {registrationStep === 'creating' && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating your account...</span>
              </>
            )}
            {registrationStep === 'success' && (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Account created successfully!</span>
              </>
            )}
            {registrationStep === 'deferred' && (
              <>
                <Clock className="w-4 h-4" />
                <span>Registration saved for later. Using app as guest.</span>
              </>
            )}
            {registrationStep === 'error' && (
              <>
                <AlertCircle className="w-4 h-4" />
                <span>Error creating account.</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error Messages */}
      {displayError && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-md text-red-200 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      {/* Fallback Option */}
      {showFallbackOption && mode === 'register' && (
        <div className="p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-md text-yellow-200 text-sm space-y-2">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>The registration service is currently taking too long to respond. This may be due to temporary server issues at Render.com.</span>
          </div>
          <Button 
            onClick={handleContinueAnyway}
            className="w-full mt-2 bg-yellow-500/30 hover:bg-yellow-500/50 text-yellow-100"
          >
            Continue Without Account
          </Button>
        </div>
      )}

      {/* Success Messages */}
      {statusMessage && (
        <div className="p-3 bg-green-500/20 border border-green-500/50 rounded text-green-200 text-sm flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-white/70">Email</label>
          <Input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="your@email.com"
            required
            disabled={isProcessing}
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm text-white/70">Password</label>
          <Input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
            disabled={isProcessing}
          />
        </div>
        
        {mode === 'register' && (
          <div className="space-y-2">
            <label className="text-sm text-white/70">Confirm Password</label>
            <Input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
              disabled={isProcessing}
            />
          </div>
        )}
        
        <Button 
          type="submit" 
          className="w-full bg-white text-black hover:bg-white/90"
          disabled={isProcessing}
        >
          {isProcessing 
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {mode === 'login' ? 'Signing In...' : 'Creating Account...'}</>
            : mode === 'login' 
              ? 'Sign In' 
              : 'Create Account'
          }
        </Button>
      </form>
      
      <div className="text-center mt-4">
        <button 
          type="button"
          className="text-sm text-white/70 hover:text-white"
          onClick={toggleMode}
          disabled={isProcessing}
        >
          {mode === 'login' 
            ? "Don't have an account? Sign up" 
            : "Already have an account? Sign in"
          }
        </button>
      </div>
    </div>
  );
};

export default LoginForm;