import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Users, Building2, ExternalLink, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { WebIcon } from './EventMap/WebIcons';

const WelcomePopup = ({ onClose, forceShow = false }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
    } else {
      const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
      if (!hasSeenWelcome) {
        setTimeout(() => setIsVisible(true), 1000);
      }
    }
  }, [forceShow]);

  const handleClose = () => {
    // For first-time users, require acknowledgment to proceed
    if (!forceShow && !localStorage.getItem('hasSeenWelcome') && !hasAcknowledged) {
      return; // Don't allow closing without acknowledgment
    }
    
    setIsVisible(false);
    if (!forceShow) {
      localStorage.setItem('hasSeenWelcome', 'true');
    }
    if (onClose) {
      onClose();
    }
  };

  const handleAcknowledge = () => {
    setHasAcknowledged(true);
    handleClose();
  };

  const steps = [
    {
      title: "Welcome to Your Local Community Hub! 🎉",
      content: "Discover Amazing Events Around You",
      description: "Join thousands of locals who use Todo Events to discover incredible experiences happening right in your neighborhood. From weekend markets and fitness classes to concerts and community meetups - your next adventure is just a click away!",
      features: [
        <><WebIcon emoji="📍" size={16} className="mr-2 inline" />Find events happening within walking distance</>,
        <><WebIcon emoji="🔍" size={16} className="mr-2 inline" />Discover hidden gems and local favorites</>,
        <><WebIcon emoji="🗣️" size={16} className="mr-2 inline" />Share discoveries with friends and family</>,
        <><WebIcon emoji="📅" size={16} className="mr-2 inline" />Create and promote your own community events</>
      ],
      highlight: "🌟 Over 10,000+ events discovered by locals like you"
    },
    {
      title: "Smart Features That Work For You",
      content: "Technology Meets Community Connection",
      description: "We've built intelligent tools to help you find exactly what you're looking for, when you're looking for it. Whether you're planning ahead or looking for something to do right now, we've got you covered.",
      features: [
        <><WebIcon emoji="🎨" size={16} className="mr-2 inline" />Beautiful event cards perfect for social sharing</>,
        <><WebIcon emoji="🔗" size={16} className="mr-2 inline" />Smart links that show rich previews everywhere</>,
        <><WebIcon emoji="📧" size={16} className="mr-2 inline" />Direct contact with event organizers</>,
        <><WebIcon emoji="🗺️" size={16} className="mr-2 inline" />Interactive maps with your exact location</>
      ],
      highlight: "🚀 New events added daily by your community"
    },
    {
      title: "Your Privacy Comes First",
      content: "Safe, Secure, and Respectful",
      description: "We believe great community connections shouldn't come at the cost of your privacy. We've designed Todo Events to be completely respectful of your personal information while still helping you discover amazing local experiences.",
      features: [
        <><WebIcon emoji="🛡️" size={16} className="mr-2 inline" />No spam emails or unwanted notifications</>,
        <><WebIcon emoji="🔒" size={16} className="mr-2 inline" />Your personal data stays private and secure</>,
        <><WebIcon emoji="✨" size={16} className="mr-2 inline" />Optional account creation - browse freely</>,
        <><WebIcon emoji="🤝" size={16} className="mr-2 inline" />Transparent privacy practices</>
      ],
      highlight: "📋 Review our privacy policy for complete transparency",
      showLegalLinks: true
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // On the last step, show acknowledgment requirement for first-time users
      if (!forceShow && !localStorage.getItem('hasSeenWelcome')) {
        // Stay on the last step until acknowledged
        return;
      } else {
        handleClose();
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isVisible) return null;

  const currentStepData = steps[currentStep];
  const isFirstTimeUser = !forceShow && !localStorage.getItem('hasSeenWelcome');
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-neutral-900/95 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 shadow-2xl w-full max-w-xs sm:max-w-md mx-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-3 sm:p-6 border-b border-white/10">
          {!isFirstTimeUser && (
            <button
              onClick={handleClose}
              className="absolute right-2 sm:right-4 top-2 sm:top-4 text-white/70 hover:text-white hover:bg-white/10 rounded-full p-1.5 sm:p-2 transition-all duration-200"
              aria-label="Close welcome popup"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
          
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
            <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-spark-yellow to-pin-blue flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 sm:w-10 sm:h-10 text-neutral-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          </div>

          {/* Description */}
          <p className="text-themed-secondary text-xs sm:text-base leading-relaxed text-center px-1">
            {currentStepData.description}
          </p>

          {/* Highlight */}
          {currentStepData.highlight && (
            <div className="bg-gradient-to-r from-spark-yellow/20 to-pin-blue/20 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-spark-yellow/30 text-center">
              <p className="text-white text-xs sm:text-sm font-medium">
                {currentStepData.highlight}
              </p>
            </div>
          )}

          {/* Features */}
          <div className="bg-themed-surface rounded-lg sm:rounded-xl p-3 sm:p-5 border border-themed">
            <h3 className="font-semibold text-themed-primary mb-2 sm:mb-4 text-sm sm:text-lg">
              {currentStep === 0 && "Why choose Todo Events?"}
              {currentStep === 1 && "Built for real community connection"}
              {currentStep === 2 && "What makes us trustworthy?"}
            </h3>
            <ul className="space-y-1.5 sm:space-y-3">
              {currentStepData.features.map((feature, index) => (
                <li key={index} className="text-themed-secondary text-xs sm:text-sm leading-relaxed">
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links - Show on privacy step */}
          {currentStepData.showLegalLinks && (
            <div className="bg-blue-50 dark:bg-blue-900/30 frost:bg-blue-50/70 p-3 sm:p-4 rounded-lg border border-blue-200 dark:border-blue-700 frost:border-blue-200/50">
              <div className="space-y-2">
                <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 frost:text-blue-800 font-medium">
                  📋 Important Information
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => window.open('/legal', '_blank')}
                    className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 frost:text-blue-700 hover:underline flex items-center gap-1 w-fit"
                  >
                    View Privacy Policy & Terms <ExternalLink className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => window.open('mailto:support@todo-events.com', '_blank')}
                    className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 frost:text-blue-700 hover:underline flex items-center gap-1 w-fit"
                  >
                    Contact Support <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

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
            {/* First-time acknowledgment requirement */}
            {isFirstTimeUser && isLastStep && !hasAcknowledged && (
              <div className="bg-amber-50 dark:bg-amber-900/30 frost:bg-amber-50/70 p-3 sm:p-4 rounded-lg border border-amber-200 dark:border-amber-700 frost:border-amber-200/50">
                <div className="space-y-3">
                  <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200 frost:text-amber-800 font-medium">
                    🤝 Welcome to the Community!
                  </p>
                  <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 frost:text-amber-700">
                    By continuing, you acknowledge that you've reviewed our privacy practices and agree to use Todo Events respectfully to discover and share local community events.
                  </p>
                  <Button
                    onClick={handleAcknowledge}
                    className="w-full bg-spark-yellow text-neutral-900 hover:bg-spark-yellow/90 font-semibold min-h-[36px] sm:min-h-[44px] text-xs sm:text-sm"
                  >
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    I Understand - Let's Explore Events!
                  </Button>
                </div>
              </div>
            )}

            {/* Event Creator & Host Options - Only show on last step if acknowledged or not first time */}
            {isLastStep && (hasAcknowledged || !isFirstTimeUser) && (
              <div className="space-y-3">
                <p className="text-center text-xs sm:text-sm text-themed-tertiary">
                  What brings you to Todo Events today?
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/30 frost:bg-blue-50/70 p-4 rounded-lg border border-blue-200 dark:border-blue-700 frost:border-blue-200/50">
                  <p className="text-sm text-blue-800 dark:text-blue-200 frost:text-blue-800">
                    <WebIcon emoji="💡" size={16} className="mr-2 inline" />
                    <strong>Tip:</strong> You can access this guide anytime by clicking the <strong>?</strong> button in the top left corner of the main page.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    onClick={() => {
                      handleClose();
                      // Just close and let them explore
                    }}
                    variant="outline"
                    className="border-themed text-themed-primary hover:bg-themed-surface-hover min-h-[36px] sm:min-h-[44px] text-xs sm:text-sm w-full"
                  >
                    <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Discover Events
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
                    Host Events
                  </Button>
                </div>
              </div>
            )}
            
            {/* Regular Navigation - Hide next button if first-time user on last step and not acknowledged */}
            {!(isFirstTimeUser && isLastStep && !hasAcknowledged) && (
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
                  onClick={isLastStep ? handleClose : handleNext}
                  className="bg-spark-yellow text-neutral-900 hover:bg-spark-yellow/90 font-semibold min-h-[36px] sm:min-h-[44px] px-4 sm:px-6 text-xs sm:text-sm"
                >
                  {isLastStep ? (
                    "Start Exploring!"
                  ) : (
                    <>
                      Next
                      <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePopup; 