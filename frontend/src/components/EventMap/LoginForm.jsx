import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Loader2, Clock, Eye, EyeOff } from 'lucide-react';
import PasswordResetForm from './PasswordResetForm';
import { AccountCreationLoader, SuccessAnimation, SparkleLoader } from '../ui/loading-animations';

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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [accountCreationStep, setAccountCreationStep] = useState(null);

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

    // Safety timeout to ensure loading state is cleared
    const safetyTimeout = setTimeout(() => {
      console.warn('Safety timeout triggered - clearing loading state');
      setIsLoading(false);
      if (mode === 'register') {
        setRegistrationStep('error');
      }
      setError('Request timeout. Please try again.');
    }, 45000); // 45 second safety timeout

    try {
      if (mode === 'register') {
        if (form.password !== form.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        // Check basic password requirements
        const allRequirementsMet = Object.values(validationStatus).every(Boolean);
        if (!allRequirementsMet) {
          throw new Error('Password does not meet all requirements');
        }
        
        // Update UI to show registration step with enhanced animations
        setRegistrationStep('creating');
        setAccountCreationStep('creating');
        
        // Add progressive animation steps
        setTimeout(() => setAccountCreationStep('verifying'), 1500);
        setTimeout(() => setAccountCreationStep('finalizing'), 3000);
        
        // Call register function - fetchWithTimeout is now implemented in AuthContext
        const success = await registerUser(form.email, form.password);
        
        if (success) {
          setAccountCreationStep('success');
          setRegistrationStep('success');
          setTimeout(() => {
            onSuccess();
            setAccountCreationStep(null);
          }, 2000);
        } else {
          setRegistrationStep('error');
          setAccountCreationStep(null);
          setError('Registration failed. Please try again.');
        }
      } else {
        // Call login function - fetchWithTimeout is now implemented in AuthContext
        const success = await login(form.email, form.password);
        
        if (success) {
          onSuccess();
        } else {
          setError('Login failed. Please check your credentials and try again.');
        }
      }
    } catch (err) {
      console.error(`${mode === 'login' ? 'Login' : 'Registration'} error:`, err);
      setError(err.message || 'Authentication failed');
      if (mode === 'register') {
        setRegistrationStep('error');
        setAccountCreationStep(null);
      }
      
      // If this is a timeout error on registration, show fallback option
      if (mode === 'register' && err.message && err.message.includes('timeout')) {
        setShowFallbackOption(true);
      }
    } finally {
      // Always clear the safety timeout and loading state
      clearTimeout(safetyTimeout);
      setIsLoading(false);
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
  
  const handleForgotPasswordClick = () => {
    setShowForgotPassword(true);
  };
  
  const handleBackFromReset = () => {
    setShowForgotPassword(false);
  };

  // Password requirements component
  const PasswordRequirements = () => (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-themed-tertiary">Password requirements:</p>
      <ul className="space-y-1">
        <li className={`text-xs flex items-center gap-1 ${validationStatus.length ? 'text-validation-success' : 'text-themed-tertiary'}`}>
          {validationStatus.length ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          At least 8 characters
        </li>
        <li className={`text-xs flex items-center gap-1 ${validationStatus.uppercase ? 'text-validation-success' : 'text-themed-tertiary'}`}>
          {validationStatus.uppercase ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          At least one uppercase letter
        </li>
        <li className={`text-xs flex items-center gap-1 ${validationStatus.lowercase ? 'text-validation-success' : 'text-themed-tertiary'}`}>
          {validationStatus.lowercase ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          At least one lowercase letter
        </li>
        <li className={`text-xs flex items-center gap-1 ${validationStatus.number ? 'text-validation-success' : 'text-themed-tertiary'}`}>
          {validationStatus.number ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          At least one number
        </li>
        <li className={`text-xs flex items-center gap-1 ${validationStatus.special ? 'text-validation-success' : 'text-themed-tertiary'}`}>
          {validationStatus.special ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          At least one special character
        </li>
      </ul>
    </div>
  );

  // Display either local error or auth context error
  const displayError = error || authError;
  // Combined loading state from both local and auth context
  const isProcessing = isLoading || authLoading;
  
  // If showing forgot password form
  if (showForgotPassword) {
    return <PasswordResetForm onBack={handleBackFromReset} onSuccess={handleBackFromReset} />;
  }

  // Show beautiful account creation animation
  if (mode === 'register' && accountCreationStep) {
    return <AccountCreationLoader step={accountCreationStep} />;
  }

  // Show login loading animation
  if (mode === 'login' && isProcessing) {
    return <SparkleLoader message="Signing you in..." />;
  }

  return (
    <div className="space-y-4">
      {/* Registration Steps Indicator - Fallback for non-animated states */}
      {mode === 'register' && registrationStep && !accountCreationStep && (
        <div className="mb-4">
          <div className={`rounded-md p-3 flex items-center gap-2
            ${registrationStep === 'creating' ? 'bg-blue-500/20 text-blue-200' : 
              registrationStep === 'success' ? 'bg-green-500/20 text-green-200' : 
              registrationStep === 'deferred' ? 'notification-yellow-themed' :
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
      
      {/* Error Alert */}
      {displayError && (
        <div className="bg-red-500/20 text-red-200 p-3 rounded-md flex items-start gap-2">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            {/* Add helpful additional context based on error type */}
            <p>{displayError}</p>
            {displayError.includes('Invalid credentials') && mode === 'login' && (
              <p className="text-sm mt-1">
                Check that your email and password are correct. 
                <button 
                  className="text-red-200 underline hover:text-red-100 ml-1"
                  onClick={handleForgotPasswordClick}
                >
                  Forgot password?
                </button>
              </p>
            )}
            {displayError.includes('timeout') && (
              <p className="text-sm mt-1">The server might be busy. Please try again later.</p>
            )}
          </div>
        </div>
      )}
      
      {/* Fallback Option for Registration */}
      {showFallbackOption && mode === 'register' && (
        <div className="notification-yellow-themed p-3 rounded-md mb-3">
          <p className="mb-2">Server appears to be busy. You can:</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSubmit({ preventDefault: () => {} })}
              className="btn-yellow-themed"
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleContinueAnyway}
              className="btn-yellow-themed"
            >
              Continue As Guest
            </Button>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-themed-secondary">Email</label>
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
          <label className="text-sm text-themed-secondary">Password</label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              disabled={isProcessing}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-themed-tertiary hover:text-themed-primary"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          
          {/* Show password requirements for registration */}
          {mode === 'register' && <PasswordRequirements />}
        </div>
        
        {mode === 'register' && (
          <div className="space-y-2">
            <label className="text-sm text-themed-secondary">Confirm Password</label>
            <Input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
              disabled={isProcessing}
            />
            {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="text-xs text-red-300 mt-1">Passwords do not match</p>
            )}
          </div>
        )}
        
        <Button 
          type="submit" 
          className="w-full bg-white text-black hover:bg-white/90"
          disabled={isProcessing || (mode === 'register' && (!Object.values(validationStatus).every(Boolean) || form.password !== form.confirmPassword))}
        >
          {isProcessing 
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {mode === 'login' ? 'Signing In...' : 'Creating Account...'}</>
            : mode === 'login' 
              ? 'Sign In' 
              : 'Create Account'
          }
        </Button>
        
        {mode === 'login' && (
          <div className="text-center">
            <button
              type="button"
              onClick={handleForgotPasswordClick}
              className="text-sm text-themed-tertiary hover:text-themed-primary underline"
            >
              Forgot Password?
            </button>
          </div>
        )}
      </form>
      
      <div className="pt-2 text-center">
        <p className="text-sm text-themed-tertiary">
          {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            className="link-themed"
            onClick={toggleMode}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginForm;