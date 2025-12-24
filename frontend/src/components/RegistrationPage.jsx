import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from './EventMap/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, AlertCircle, Crown, ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { API_URL } from '@/config';

const RegistrationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useContext(AuthContext);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    inviteCode: searchParams.get('invite_code') || ''
  });
  
  const [validationStatus, setValidationStatus] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    sufficient: false
  });
  
  const [inviteInfo, setInviteInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingInvite, setIsValidatingInvite] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  useEffect(() => {
    if (formData.inviteCode) {
      validateInviteCode(formData.inviteCode);
    }
  }, [formData.inviteCode]);

  useEffect(() => {
    if (formData.password) {
      const validation = validatePassword(formData.password);
      setValidationStatus(validation);
    }
  }, [formData.password]);

  const validateInviteCode = async (code) => {
    if (!code) {
      setInviteInfo(null);
      return;
    }

    setIsValidatingInvite(true);
    try {
      const response = await fetch(`${API_URL}/validate-trial-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invite_code: code })
      });

      const data = await response.json();
      
      if (data.valid) {
        setInviteInfo({
          valid: true,
          trialType: data.trial_type,
          trialDays: data.trial_duration_days,
          remainingUses: data.remaining_uses
        });
        setError('');
      } else {
        setInviteInfo({ valid: false, error: data.error });
        setError(data.error || 'Invalid invite code');
      }
    } catch (err) {
      console.error('Error validating invite code:', err);
      setInviteInfo({ valid: false, error: 'Failed to validate invite code' });
      setError('Failed to validate invite code');
    } finally {
      setIsValidatingInvite(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'password') {
      validatePassword(value);
    }

    if (name === 'inviteCode') {
      setTimeout(() => validateInviteCode(value), 500);
    }
  };

  const validatePassword = (password) => {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const typeCount = [hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;
    
    return {
        minLength: password.length >= 8,
        sufficient: typeCount >= 2 && password.length >= 8,
        typeCount,
        hasUppercase,
        hasLowercase,
        hasNumber,
        hasSpecial
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    const allRequirementsMet = validationStatus.minLength && validationStatus.sufficient;
    if (!allRequirementsMet) {
      setError('Password must be at least 8 characters and contain at least 2 different character types');
      setIsLoading(false);
      return;
    }

    if (formData.inviteCode && (!inviteInfo || !inviteInfo.valid)) {
      setError('Please enter a valid invite code or remove it to continue');
      setIsLoading(false);
      return;
    }

    try {
      const endpoint = formData.inviteCode ? '/users-with-invite' : '/users';
      const payload = {
        email: formData.email,
        password: formData.password,
        role: 'user'
      };

      if (formData.inviteCode) {
        payload.invite_code = formData.inviteCode;
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      const userData = await response.json();
      setRegistrationSuccess(true);

      setTimeout(async () => {
        const loginSuccess = await login(formData.email, formData.password);
        if (loginSuccess) {
          if (userData.trial_activated) {
            const message = `Welcome! Your ${userData.trial_type} premium trial is now active until ${new Date(userData.trial_expires_at).toLocaleDateString()}.`;
            setTimeout(() => alert(message), 500);
          }
          navigate('/');
        }
      }, 2000);

    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const PasswordRequirements = () => (
    <div className="space-y-1 text-xs">
      <div className={`flex items-center gap-1 ${validationStatus.minLength ? 'text-green-400' : 'text-gray-400'}`}>
        {validationStatus.minLength ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 border border-gray-400 rounded-full" />}
        <span>At least 8 characters</span>
      </div>
      <div className={`flex items-center gap-1 ${validationStatus.sufficient ? 'text-green-400' : 'text-gray-400'}`}>
        {validationStatus.sufficient ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 border border-gray-400 rounded-full" />}
        <span>At least 2 of: uppercase, lowercase, number, special character</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">
        Current types: {validationStatus.typeCount || 0}/4
      </div>
    </div>
  );

  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-blue-900 to-neutral-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gradient-to-br from-neutral-800/90 to-blue-800/90 backdrop-blur-lg border border-white/20 rounded-xl text-white">
          <div className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Account Created Successfully!</h2>
            {inviteInfo?.valid && (
              <p className="text-spark-yellow mb-4">🎉 Your premium trial has been activated!</p>
            )}
            <p className="text-white/70 mb-4">You're being signed in automatically...</p>
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/70" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-blue-900 to-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gradient-to-br from-neutral-800/90 to-blue-800/90 backdrop-blur-lg border border-white/20 rounded-xl text-white">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">Create Account</h1>
          </div>
          
          {inviteInfo?.valid && (
            <div className="bg-gradient-to-r from-spark-yellow/20 to-pin-blue/20 border border-spark-yellow/30 rounded-md p-3 text-white">
              <div className="flex items-start gap-2">
                <Crown className="w-4 h-4 text-spark-yellow mt-0.5" />
                <div>
                  <strong className="text-spark-yellow">Premium Trial Invite Detected!</strong><br/>
                  You'll get {inviteInfo.trialDays} days of premium access for free.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-md p-3 text-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90">Email Address</label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="your@email.com"
                required
                disabled={isLoading}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90">Invite Code (Optional)</label>
              <div className="relative">
                <Input
                  type="text"
                  name="inviteCode"
                  value={formData.inviteCode}
                  onChange={handleInputChange}
                  placeholder="Enter invite code (optional)"
                  disabled={isLoading}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
                {isValidatingInvite && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-white/70" />
                )}
              </div>
              {inviteInfo && !inviteInfo.valid && (
                <p className="text-xs text-red-300">{inviteInfo.error}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create a strong password"
                  required
                  disabled={isLoading}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordRequirements />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/90">Confirm Password</label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  required
                  disabled={isLoading}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-300">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || isValidatingInvite || (formData.inviteCode && (!inviteInfo || !inviteInfo.valid))}
              className="w-full bg-gradient-to-r from-spark-yellow to-pin-blue text-neutral-900 font-bold hover:opacity-90 transition-all duration-200 py-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  {inviteInfo?.valid && <Crown className="w-4 h-4 mr-2" />}
                  Create Account
                  {inviteInfo?.valid && ' + Activate Trial'}
                </>
              )}
            </Button>
          </form>

          <div className="pt-4 text-center border-t border-white/10">
            <p className="text-sm text-white/70">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/')}
                className="text-spark-yellow hover:text-pin-blue transition-colors font-medium"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationPage; 