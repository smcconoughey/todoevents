import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Loader2, Clock, Eye, EyeOff } from 'lucide-react';
import PasswordResetForm from './PasswordResetForm';
import { AccountCreationLoader, SuccessAnimation, SmoothLoader } from '../ui/loading-animations';

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

  // Enhanced error handling to prevent stuck states
  useEffect(() => {
    if (!authLoading && isLoading) {
      setIsLoading(false);
    }

    if (authError) {
      setIsLoading(false);
      setAccountCreationStep(null);
      setRegistrationStep(null);
      console.error("Auth error:", authError);
      
      if (mode === 'register' && authError.includes('timeout')) {
        setShowFallbackOption(true);
      }
    }
  }, [authLoading, authError, mode]);

  // Safety timeout to prevent stuck states
  useEffect(() => {
    let timeout;
    if (isLoading || accountCreationStep) {
      timeout = setTimeout(() => {
        console.warn("Form timeout - resetting state");
        setIsLoading(false);
        setAccountCreationStep(null);
        setRegistrationStep(null);
        
        const timeoutMessage = "Request took too long. Please try again.";
        setError(timeoutMessage);
        
        if (mode === 'register') {
          setShowFallbackOption(true);
        }
      }, 30000);
    }
    return () => clearTimeout(timeout);
  }, [isLoading, accountCreationStep, mode]);

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
    setAccountCreationStep(null);
    setRegistrationStep(null);

    console.log(`Attempting to ${mode === 'login' ? 'login' : 'register'} with email: ${form.email}`);

    // Enhanced safety timeout
    const safetyTimeout = setTimeout(() => {
      console.warn('Safety timeout triggered - clearing all states');
      setIsLoading(false);
      setAccountCreationStep('error');
      setRegistrationStep('error');
      setError('Request timeout. Please try again.');
      
      // Auto-clear error state after showing it
      setTimeout(() => {
        setAccountCreationStep(null);
        setRegistrationStep(null);
      }, 3000);
    }, 45000);

    try {
      if (mode === 'register') {
        if (form.password !== form.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        const allRequirementsMet = Object.values(validationStatus).every(Boolean);
        if (!allRequirementsMet) {
          throw new Error('Password does not meet all requirements');
        }
        
        // Start animation sequence
        setRegistrationStep('creating');
        setAccountCreationStep('creating');
        
        setTimeout(() => {
          if (accountCreationStep === 'creating') setAccountCreationStep('verifying');
        }, 1500);
        setTimeout(() => {
          if (accountCreationStep === 'verifying') setAccountCreationStep('finalizing');
        }, 3000);
        
        const success = await registerUser(form.email, form.password);
        
        if (success) {
          setAccountCreationStep('success');
          setRegistrationStep('success');
          setTimeout(() => {
            onSuccess();
            setAccountCreationStep(null);
            setRegistrationStep(null);
          }, 2000);
        } else {
          // Handle registration failure
          const errorMessage = authError || 'Registration failed. Please try again.';
          setAccountCreationStep('error');
          setRegistrationStep('error');
          setError(errorMessage);
          
          // Auto-clear error animation after 3 seconds
          setTimeout(() => {
            setAccountCreationStep(null);
            setRegistrationStep(null);
          }, 3000);
        }
      } else {
        const success = await login(form.email, form.password);
        
        if (success) {
          onSuccess();
        } else {
          setError('Login failed. Please check your credentials and try again.');
        }
      }
    } catch (err) {
      console.error(`${mode === 'login' ? 'Login' : 'Registration'} error:`, err);
      const errorMessage = err.message || 'Authentication failed';
      setError(errorMessage);
      
      if (mode === 'register') {
        setAccountCreationStep('error');
        setRegistrationStep('error');
        
        // Auto-clear error animation after 3 seconds
        setTimeout(() => {
          setAccountCreationStep(null);
          setRegistrationStep(null);
        }, 3000);
      }
      
      if (mode === 'register' && errorMessage.includes('timeout')) {
        setShowFallbackOption(true);
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
    }
  };

  const handleContinueAnyway = () => {
    try {
      localStorage.setItem('pendingRegistration', JSON.stringify({
        email: form.email,
        password: form.password,
        timestamp: new Date().toISOString()
      }));
      
      console.log("Stored registration info for later attempt");
      setRegistrationStep('deferred');
      setAccountCreationStep(null);
      onSuccess();
    } catch (err) {
      console.error("Failed to save registration for later:", err);
    }
  };

  const toggleMode = () => {
    setError(null);
    clearError();
    setIsLoading(false);
    setRegistrationStep(null);
    setAccountCreationStep(null);
    setShowFallbackOption(false);
    onModeChange(mode === 'login' ? 'register' : 'login');
  };
  
  const handleForgotPasswordClick = () => {
    setShowForgotPassword(true);
  };
  
  const handleBackFromReset = () => {
    setShowForgotPassword(false);
  };

  const PasswordRequirements = () => (
    <div className="space-y-1 text-xs">
      {Object.entries({
        length: 'At least 8 characters',
        uppercase: 'One uppercase letter',
        lowercase: 'One lowercase letter', 
        number: 'One number',
        special: 'One special character'
      }).map(([key, label]) => (
        <div key={key} className={`flex items-center gap-1 ${validationStatus[key] ? 'text-green-400' : 'text-themed-tertiary'}`}>
          {validationStatus[key] ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 border border-themed-tertiary rounded-full" />}
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
  
  if (showForgotPassword) {
    return <PasswordResetForm onBack={handleBackFromReset} />;
  }
  
  const isProcessing = isLoading || authLoading;
  const displayError = error || authError;

  // Show enhanced account creation animation with error handling
  if (mode === 'register' && accountCreationStep) {
    return <AccountCreationLoader step={accountCreationStep} error={displayError} />;
  }

  // Show login loading animation
  if (mode === 'login' && isProcessing) {
    return <SmoothLoader message="Signing you in..." />;
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
                <span>Error creating account. Please try again.</span>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Error Alert */}
      {displayError && !accountCreationStep && (
        <div className="bg-red-500/20 text-red-200 p-3 rounded-md flex items-start gap-2">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
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
            {displayError.includes('Email already registered') && (
              <p className="text-sm mt-1">This email is already registered. Try signing in instead.</p>
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