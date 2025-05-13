import React, { useState, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const LoginForm = ({ mode = 'login', onSuccess = () => {}, onModeChange = () => {} }) => {
  const { login, registerUser, loading, error: authError, statusMessage, clearError } = useContext(AuthContext);
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
        await registerUser(form.email, form.password);
      } else {
        // Call login function
        await login(form.email, form.password);
      }
      onSuccess();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    onModeChange(mode === 'login' ? 'register' : 'login');
  };

  // Display either local error or auth context error
  const displayError = error || authError;

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
            />
          </div>
        )}
        
        <Button 
          type="submit" 
          className="w-full bg-white text-black hover:bg-white/90"
          disabled={isLoading || loading}
        >
          {(isLoading || loading)
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