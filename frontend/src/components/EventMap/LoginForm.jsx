import { useState, useContext, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AuthContext } from './AuthContext';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const LoginForm = ({ onSuccess, mode: initialMode = 'login' }) => {
  const { login, registerUser, loading, error, statusMessage } = useContext(AuthContext);
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [validationStatus, setValidationStatus] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  const validatePassword = (pass) => {
    setValidationStatus({
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      lowercase: /[a-z]/.test(pass),
      number: /\d/.test(pass),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pass)
    });
  };

  useEffect(() => {
    if (mode === 'register') {
      validatePassword(password);
    }
  }, [password, mode]);

  const validateForm = () => {
    setFormError('');

    if (!email || !password) {
      setFormError('Please fill in all fields');
      return false;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setFormError('Passwords do not match');
        return false;
      }

      const allValid = Object.values(validationStatus).every(status => status);
      if (!allValid) {
        setFormError('Password does not meet all requirements');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const success = await (mode === 'register' 
      ? registerUser(email, password)
      : login(email, password)
    );

    if (success && onSuccess) {
      // Clear form
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      onSuccess();
    }
  };

  return (
    <div className="space-y-4">
      {/* Error Messages */}
      {(error || formError) && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error || formError}</span>
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
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:outline-none"
            required
          />
        </div>

        <div className="space-y-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:outline-none"
            required
          />
        </div>

        {mode === 'register' && (
          <>
            <div className="space-y-2">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:outline-none"
                required
              />
            </div>

            {/* Password Requirements */}
            <div className="space-y-1 text-sm">
              <h4 className="text-white/70">Password Requirements:</h4>
              <ul className="space-y-1">
                {[
                  { key: 'length', text: 'At least 8 characters' },
                  { key: 'uppercase', text: 'One uppercase letter' },
                  { key: 'lowercase', text: 'One lowercase letter' },
                  { key: 'number', text: 'One number' },
                  { key: 'special', text: 'One special character' }
                ].map(({ key, text }) => (
                  <li 
                    key={key}
                    className={`flex items-center gap-2 ${
                      validationStatus[key] ? 'text-green-400' : 'text-white/50'
                    }`}
                  >
                    {validationStatus[key] ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <Button 
          type="submit"
          className="w-full bg-white text-black hover:bg-white/90 disabled:bg-white/50"
          disabled={loading}
        >
          {loading 
            ? 'Please wait...' 
            : mode === 'register' 
              ? 'Create Account' 
              : 'Sign In'
          }
        </Button>
      </form>

      <div className="text-center text-sm">
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setFormError('');
            setPassword('');
            setConfirmPassword('');
          }}
          className="text-white/70 hover:text-white"
        >
          {mode === 'login' 
            ? "Don't have an account? Sign up" 
            : 'Already have an account? Sign in'
          }
        </button>
      </div>
    </div>
  );
};

export default LoginForm;