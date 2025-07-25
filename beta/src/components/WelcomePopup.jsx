import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Users, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const WelcomePopup = ({ onClose, forceShow = false }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
    } else {
      // Track visit count instead of just first-time visit
      const visitCount = parseInt(localStorage.getItem('visitCount') || '0', 10);
      const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
      
      // Increment visit count
      const newVisitCount = visitCount + 1;
      localStorage.setItem('visitCount', newVisitCount.toString());
      
      // Show popup on 3rd visit if they haven't seen it yet
      if (newVisitCount === 3 && !hasSeenWelcome) {
        setTimeout(() => setIsVisible(true), 1000);
      }
    }
  }, [forceShow]);

  const handleClose = () => {
    setIsVisible(false);
    if (!forceShow) {
      localStorage.setItem('hasSeenWelcome', 'true');
    }
    if (onClose) {
      onClose();
    }
  };

  const steps = [
    {
      title: "Welcome to todo-events! 🎉",
      content: "Your Ultimate Local Event Discovery Platform",
      description: "Discover amazing local events in your community! From food festivals and concerts to art shows and sports events - find what's happening around you.",
      features: [
        "📍 Find events by location and category",
        "🔍 Discover hidden gems in your neighborhood", 
        "🤝 Connect with your local community",
        "📅 Share and create your own events"
      ]
    },
    {
      title: "Create & Share Events",
      content: "Make your events visible to everyone!",
      description: "Create beautiful event listings and share them instantly. Generate stunning shareable images for social media with just one click.",
      features: [
        "🎨 Auto-generated share cards with event details",
        "📱 Download images for Instagram & Facebook",
        "📋 Copy direct links to share anywhere",
        "🗺️ Interactive map with your exact location"
      ]
    },
    {
      title: "Ready to explore?",
      content: "Start discovering local events today!",
      description: "Join thousands of people who use todo-events to stay connected with their community and never miss out on amazing local experiences.",
      features: [
        "🆓 Free for attendees",
        "📱 Works on all devices",
        "🌟 No spam or unwanted notifications",
        "🚀 New events added daily"
      ]
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isVisible) return null;

  const currentStepData = steps[currentStep];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-neutral-900/95 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 shadow-2xl w-full max-w-xs sm:max-w-md mx-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-3 sm:p-6 border-b border-white/10">
          <button
            onClick={handleClose}
            className="absolute right-2 sm:right-4 top-2 sm:top-4 text-white/70 hover:text-white hover:bg-white/10 rounded-full p-1.5 sm:p-2 transition-all duration-200"
            aria-label="Close welcome popup"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          
          <div className="text-center">
            <h1 className="text-lg sm:text-2xl font-display font-bold text-white mb-1 sm:mb-2 pr-6 sm:pr-8 leading-tight">
              {currentStepData.title}
            </h1>
            <p className="text-sm sm:text-lg font-medium text-spark-yellow leading-tight">
              {currentStepData.content}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6 space-y-3 sm:space-y-6">
          {/* Logo/Icon */}
          <div className="flex justify-center">
            <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-spark-yellow to-pin-blue flex items-center justify-center">
              <svg className="w-6 h-6 sm:w-10 sm:h-10 text-neutral-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          </div>

          {/* Description */}
          <p className="text-themed-secondary text-xs sm:text-base leading-relaxed text-center px-1">
            {currentStepData.description}
          </p>

          {/* Features */}
          <div className="bg-themed-surface rounded-lg sm:rounded-xl p-3 sm:p-5 border border-themed">
            <h3 className="font-semibold text-themed-primary mb-2 sm:mb-4 text-sm sm:text-lg">
              {currentStep === 0 && "Why todo-events?"}
              {currentStep === 1 && "Sharing Made Easy"}
              {currentStep === 2 && "What makes us special?"}
            </h3>
            <ul className="space-y-1.5 sm:space-y-3">
              {currentStepData.features.map((feature, index) => (
                <li key={index} className="text-themed-secondary text-xs sm:text-sm leading-relaxed">
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Progress Indicators */}
          <div className="flex justify-center gap-1.5 sm:gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${
                  index === currentStep 
                    ? 'bg-spark-yellow' 
                    : index < currentStep 
                      ? 'bg-pin-blue' 
                      : 'bg-white/20'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="space-y-3 pt-2 sm:pt-4">
            {/* Event Creator & Host Options - Only show on last step */}
            {currentStep === steps.length - 1 && (
              <div className="space-y-3">
                <p className="text-center text-xs sm:text-sm text-themed-tertiary">
                  What type of events are you interested in?
                </p>
                <div className="bg-pin-blue/10 border border-pin-blue/20 rounded-lg p-3 mb-3">
                  <p className="text-xs sm:text-sm text-themed-secondary text-center">
                    💡 <strong>Tip:</strong> You can access this guide anytime by clicking the <strong>?</strong> button in the top left corner of the main page.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    onClick={() => {
                      handleClose();
                      navigate('/creators');
                    }}
                    variant="outline"
                    className="border-themed text-themed-primary hover:bg-themed-surface-hover min-h-[36px] sm:min-h-[44px] text-xs sm:text-sm w-full"
                  >
                    <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Individual Events
                  </Button>
                  <Button
                    onClick={() => {
                      handleClose();
                      navigate('/hosts');
                    }}
                    variant="outline"
                    className="border-themed text-themed-primary hover:bg-themed-surface-hover min-h-[36px] sm:min-h-[44px] text-xs sm:text-sm w-full"
                  >
                    <Building2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Organization Events
                  </Button>
                </div>
              </div>
            )}
            
            {/* Regular Navigation */}
            <div className="flex justify-between items-center gap-2">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className={`text-themed-secondary hover:text-themed-primary hover:bg-themed-surface-hover min-h-[36px] sm:min-h-[44px] px-3 sm:px-4 text-xs sm:text-sm ${
                  currentStep === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                ← Previous
              </Button>

              <Button
                onClick={currentStep === steps.length - 1 ? handleClose : handleNext}
                className="bg-spark-yellow text-neutral-900 hover:bg-spark-yellow/90 font-semibold min-h-[36px] sm:min-h-[44px] px-4 sm:px-6 text-xs sm:text-sm"
              >
                {currentStep === steps.length - 1 ? (
                  "Explore Events"
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePopup; 