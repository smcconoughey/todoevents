import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

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

  // This will help ensure that loading state doesn't get stuck
  useEffect(() => {
    // If auth context is no longer loading, we shouldn't be either
    if (!authLoading && isLoading) {
      setIsLoading(false);
    }
  }, [authLoading]);

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

    try {
      if (mode === 'register') {
        if (form.password !== form.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        // Check basic password requirements
        if (form.password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }
        
        // Call register function
        const success = await registerUser(form.email, form.password);
        if (success) {
          onSuccess();
        }
      } else {
        // Call login function
        const success = await login(form.email, form.password);
        if (success) {
          onSuccess();
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      // Set loading to false even if there's an error
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    // Clear any existing errors and reset loading state when switching modes
    setError(null);
    clearError();
    setIsLoading(false);
    onModeChange(mode === 'login' ? 'register' : 'login');
  };

  // Display either local error or auth context error
  const displayError = error || authError;
  // Combined loading state from both local and auth context
  const isProcessing = isLoading || authLoading;

  return (
    <div className="space-y-4">
      {/* Error Messages */}
      {displayError && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-md text-red-200 text-sm">
          {displayError}
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
            ? 'Loading...' 
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