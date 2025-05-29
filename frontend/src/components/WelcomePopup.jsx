import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WelcomePopup = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
    if (!hasSeenWelcome) {
      setTimeout(() => setIsVisible(true), 1000);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('hasSeenWelcome', 'true');
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
      title: "How it works",
      content: "Getting started is easy!",
      description: "Browse events on the interactive map, filter by category or date, and discover what's happening near you.",
      features: [
        "🗺️ Interactive map view",
        "🔍 Smart search and filters",
        "💾 Save your favorite events",
        "🎯 Get personalized recommendations"
      ]
    },
    {
      title: "Ready to explore?",
      content: "Start discovering local events today!",
      description: "Join thousands of people who use todo-events to stay connected with their community and never miss out on amazing local experiences.",
      features: [
        "🆓 Completely free to use",
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900/95 backdrop-blur-lg rounded-2xl border border-white/10 shadow-2xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-6 border-b border-white/10">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 text-white/70 hover:text-white hover:bg-white/10 rounded-full p-2 transition-all duration-200"
            aria-label="Close welcome popup"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <h1 className="text-2xl font-display font-bold text-white mb-2 pr-8">
              {currentStepData.title}
            </h1>
            <p className="text-lg font-medium text-spark-yellow">
              {currentStepData.content}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Logo/Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-spark-yellow to-pin-blue flex items-center justify-center">
              <svg className="w-10 h-10 text-neutral-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          </div>

          {/* Description */}
          <p className="text-white/90 text-base leading-relaxed text-center">
            {currentStepData.description}
          </p>

          {/* Features */}
          <div className="bg-white/5 rounded-xl p-5 border border-white/10">
            <h3 className="font-semibold text-white mb-4 text-lg">
              {currentStep === 0 && "Why todo-events?"}
              {currentStep === 1 && "Key Features"}
              {currentStep === 2 && "What makes us special?"}
            </h3>
            <ul className="space-y-3">
              {currentStepData.features.map((feature, index) => (
                <li key={index} className="text-white/80 text-sm leading-relaxed">
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Progress Indicators */}
          <div className="flex justify-center gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
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
          <div className="flex justify-between items-center pt-4">
            <Button
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`text-white/70 hover:text-white hover:bg-white/10 min-h-[44px] ${
                currentStep === 0 ? 'invisible' : 'visible'
              }`}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <Button
              onClick={handleNext}
              className="bg-spark-yellow text-neutral-900 hover:bg-spark-yellow/90 font-semibold min-h-[44px] px-6"
            >
              {currentStep === steps.length - 1 ? (
                "Get Started!"
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePopup; 