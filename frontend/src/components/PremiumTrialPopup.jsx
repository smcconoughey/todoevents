import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Sparkles, Users, Building2, Star, Crown, Zap, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { WebIcon } from './EventMap/WebIcons';
import { API_URL } from '@/config';

const PremiumTrialPopup = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Track visit count and show popup on 5th visit
    const visitCount = parseInt(localStorage.getItem('visitCount') || '0', 10);
    const hasSeenPremiumTrial = localStorage.getItem('hasSeenPremiumTrial');
    
    // Show popup on 5th visit if they haven't seen it yet
    if (visitCount === 5 && !hasSeenPremiumTrial) {
      setTimeout(() => setIsVisible(true), 1500);
      generateInviteCode();
    }
  }, []);

  const generateInviteCode = async () => {
    setIsGeneratingCode(true);
    try {
      const response = await fetch(`${API_URL}/generate-premium-trial-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInviteCode(data.invite_code);
      } else {
        // Fallback code generation
        const fallbackCode = 'TRIAL7D' + Math.random().toString(36).substr(2, 6).toUpperCase();
        setInviteCode(fallbackCode);
      }
    } catch (error) {
      console.error('Error generating invite code:', error);
      // Fallback code generation
      const fallbackCode = 'TRIAL7D' + Math.random().toString(36).substr(2, 6).toUpperCase();
      setInviteCode(fallbackCode);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('hasSeenPremiumTrial', 'true');
    if (onClose) {
      onClose();
    }
  };

  const handleSignUp = () => {
    // Navigate to registration with the invite code pre-populated
    const signupUrl = `/register?invite_code=${inviteCode}&trial=premium7d`;
    navigate(signupUrl);
    handleClose();
  };

  const handleLearnMore = () => {
    navigate('/hosts');
    handleClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-gradient-to-br from-neutral-900/98 to-blue-900/95 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl w-full max-w-md mx-auto max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-6 border-b border-white/10">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 text-white/70 hover:text-white hover:bg-white/10 rounded-full p-2 transition-all duration-200"
            aria-label="Close premium trial popup"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-spark-yellow to-pin-blue flex items-center justify-center shadow-lg">
                <Crown className="w-8 h-8 text-neutral-900" />
              </div>
            </div>
            <h1 className="text-2xl font-display font-bold text-white mb-2 leading-tight">
              🎉 Special Offer!
            </h1>
            <p className="text-lg font-medium text-spark-yellow leading-tight">
              7-Day Premium Trial - Completely FREE
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Value Proposition */}
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-white">
              Ready to promote your local events?
            </h2>
            <p className="text-themed-secondary text-sm leading-relaxed">
              Perfect for businesses, churches, community groups, and event organizers who want to reach more local people and grow their audience.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-spark-yellow" />
                <span className="text-white text-sm font-medium">Auto-Verified</span>
              </div>
              <p className="text-xs text-themed-secondary">
                Instant verification badges & enhanced search visibility
              </p>
            </div>

            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-pin-blue" />
                <span className="text-white text-sm font-medium">Priority Placement</span>
              </div>
              <p className="text-xs text-themed-secondary">
                Your events show up first in local searches
              </p>
            </div>

            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <WebIcon emoji="🎨" size={16} className="text-vibrant-magenta" />
                <span className="text-white text-sm font-medium">Pro Branding</span>
              </div>
              <p className="text-xs text-themed-secondary">
                Custom banners & logos for professional look
              </p>
            </div>

            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-fresh-teal" />
                <span className="text-white text-sm font-medium">Analytics</span>
              </div>
              <p className="text-xs text-themed-secondary">
                Track views, interest, and engagement
              </p>
            </div>
          </div>

          {/* Invite Code Section */}
          <div className="bg-gradient-to-r from-spark-yellow/20 to-pin-blue/20 rounded-xl p-4 border border-spark-yellow/30">
            <div className="text-center space-y-3">
              <p className="text-white text-sm font-medium">
                <WebIcon emoji="🎟️" size={16} className="mr-2 inline" />
                Your Exclusive Invite Code:
              </p>
              {isGeneratingCode ? (
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="animate-pulse bg-white/20 h-6 rounded"></div>
                </div>
              ) : (
                <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                  <code className="text-2xl font-bold text-spark-yellow tracking-wider">
                    {inviteCode}
                  </code>
                </div>
              )}
              <p className="text-xs text-themed-secondary">
                This code will automatically activate your 7-day trial when you sign up
              </p>
            </div>
          </div>

          {/* Target Audience */}
          <div className="space-y-3">
            <h3 className="text-white font-semibold text-center">Perfect for:</h3>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                <Building2 className="w-5 h-5 text-pin-blue" />
                <span className="text-themed-secondary text-sm">
                  <strong className="text-white">Local Businesses:</strong> Promote grand openings, sales events, workshops
                </span>
              </div>
              <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                <Users className="w-5 h-5 text-fresh-teal" />
                <span className="text-themed-secondary text-sm">
                  <strong className="text-white">Churches & Nonprofits:</strong> Community outreach, fundraisers, services
                </span>
              </div>
              <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                <WebIcon emoji="🎭" size={20} className="text-vibrant-magenta" />
                <span className="text-themed-secondary text-sm">
                  <strong className="text-white">Event Organizers:</strong> Concerts, festivals, meetups, classes
                </span>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={handleSignUp}
              className="w-full bg-gradient-to-r from-spark-yellow to-pin-blue text-neutral-900 hover:opacity-90 font-bold py-3 text-lg"
              disabled={isGeneratingCode}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start Free 7-Day Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            
            <button
              onClick={handleLearnMore}
              className="w-full text-themed-secondary hover:text-themed-primary text-sm underline"
            >
              Learn more about premium features
            </button>
            
            <div className="text-center">
              <p className="text-xs text-themed-tertiary">
                No credit card required • Cancel anytime • Full access for 7 days
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumTrialPopup; 