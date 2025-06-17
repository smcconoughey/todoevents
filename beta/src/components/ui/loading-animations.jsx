import React from 'react';
import { Heart, Calendar, User, MapPin, Clock, Target, CheckCircle, AlertCircle } from 'lucide-react';

// Beautiful pulsing ring loader - minimal and clean
export const PulsingRing = ({ size = 'md', color = 'pin-blue' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className={`${sizeClasses[size]} relative`}>
      <div className={`absolute inset-0 rounded-full border-2 border-${color}/20 animate-ping`}></div>
      <div className={`absolute inset-0 rounded-full border-2 border-${color} border-t-transparent animate-spin`}></div>
      <div className={`absolute inset-2 rounded-full bg-${color}/10 animate-pulse`}></div>
    </div>
  );
};

// Floating heart animation for interest loading - enhanced and more satisfying
export const InterestHeartLoader = ({ size = 'sm' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className="relative">
      {/* Main heart with satisfying bounce */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Heart className={`${sizeClasses[size]} text-vibrant-magenta animate-heart-bounce fill-current`} />
      </div>
      {/* Background hearts creating depth */}
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
        <Heart className={`${sizeClasses[size]} text-vibrant-magenta animate-heart-pulse scale-110`} style={{ animationDelay: '0.2s' }} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <Heart className={`${sizeClasses[size]} text-vibrant-magenta animate-heart-float scale-125`} style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  );
};

// Smooth loading dots - no sparkles, just satisfying movement
export const SmoothLoader = ({ message = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <div className="relative">
        {/* Central icon with subtle glow */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pin-blue/20 to-pin-blue/5 backdrop-blur-sm border border-pin-blue/20 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-pin-blue animate-smooth-pulse"></div>
        </div>
        {/* Subtle orbiting ring */}
        <div className="absolute inset-0 rounded-2xl border border-pin-blue/10 animate-slow-spin"></div>
      </div>
      <div className="text-center">
        <p className="text-themed-primary font-medium">{message}</p>
        {/* Smooth flowing dots */}
        <div className="flex justify-center gap-1 mt-3">
          <div className="w-2 h-2 bg-pin-blue rounded-full animate-flow-dot"></div>
          <div className="w-2 h-2 bg-pin-blue rounded-full animate-flow-dot" style={{ animationDelay: '0.15s' }}></div>
          <div className="w-2 h-2 bg-pin-blue rounded-full animate-flow-dot" style={{ animationDelay: '0.3s' }}></div>
        </div>
      </div>
    </div>
  );
};

// Event loading animation - refined and minimal
export const EventLoadingAnimation = ({ type = 'creating', title = '' }) => {
  const messages = {
    creating: 'Creating your event...',
    opening: 'Loading event details...',
    saving: 'Saving changes...',
    deleting: 'Removing event...'
  };

  const icons = {
    creating: Calendar,
    opening: MapPin,
    saving: Clock,
    deleting: Target
  };

  const Icon = icons[type];

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {/* Clean animated icon */}
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pin-blue/10 to-themed-surface backdrop-blur-sm border border-pin-blue/20 flex items-center justify-center">
          <Icon className="w-10 h-10 text-pin-blue animate-smooth-bounce" />
        </div>
        {/* Minimal breathing ring */}
        <div className="absolute inset-0 rounded-2xl border-2 border-pin-blue/20 animate-breathe"></div>
      </div>

      {/* Loading text */}
      <div className="text-center space-y-3">
        <h3 className="text-lg font-semibold text-themed-primary">{messages[type]}</h3>
        {title && (
          <p className="text-themed-secondary text-sm max-w-xs truncate">"{title}"</p>
        )}
        
        {/* Smooth progress bar */}
        <div className="w-48 h-1 bg-themed-surface-hover rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-pin-blue to-pin-blue/60 rounded-full animate-progress-flow"></div>
        </div>
        
        {/* Flowing dots */}
        <div className="flex justify-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-pin-blue rounded-full animate-flow-dot"></div>
          <div className="w-1.5 h-1.5 bg-pin-blue rounded-full animate-flow-dot" style={{ animationDelay: '0.15s' }}></div>
          <div className="w-1.5 h-1.5 bg-pin-blue rounded-full animate-flow-dot" style={{ animationDelay: '0.3s' }}></div>
        </div>
      </div>
    </div>
  );
};

// Account creation animation with proper error states
export const AccountCreationLoader = ({ step = 'creating', error = null }) => {
  const steps = {
    creating: { message: 'Creating your account...', icon: User, color: 'pin-blue' },
    verifying: { message: 'Verifying details...', icon: Clock, color: 'spark-yellow' },
    finalizing: { message: 'Setting up your profile...', icon: Target, color: 'vibrant-magenta' },
    success: { message: 'Welcome to TodoEvents!', icon: CheckCircle, color: 'fresh-teal' },
    error: { message: error || 'Something went wrong', icon: AlertCircle, color: 'red-500' }
  };

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {/* Animated avatar circle */}
      <div className="relative">
        <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${
          step === 'error' 
            ? 'from-red-500/20 to-red-500/10 border-2 border-red-500/30' 
            : `from-${currentStep.color}/20 to-${currentStep.color}/10 border-2 border-${currentStep.color}/30`
        } flex items-center justify-center`}>
          <Icon className={`w-12 h-12 ${
            step === 'error' ? 'text-red-400' : `text-${currentStep.color}`
          } ${step === 'error' ? 'animate-shake' : 'animate-smooth-pulse'}`} />
        </div>
        
        {/* Progress ring for non-error states */}
        {step !== 'error' && (
          <div className={`absolute inset-0 rounded-full border-2 border-${currentStep.color}/20 animate-breathe`}></div>
        )}
      </div>

      {/* Progress steps - only show for non-error states */}
      {step !== 'error' && (
        <div className="flex items-center gap-2">
          {Object.keys(steps).slice(0, -2).map((stepKey, index) => (
            <React.Fragment key={stepKey}>
              <div className={`w-3 h-3 rounded-full transition-all duration-500 ${
                Object.keys(steps).indexOf(step) >= index 
                  ? `bg-${currentStep.color} scale-110` 
                  : 'bg-themed-surface-hover scale-100'
              }`}></div>
              {index < Object.keys(steps).length - 3 && (
                <div className={`w-8 h-0.5 transition-all duration-500 ${
                  Object.keys(steps).indexOf(step) > index 
                    ? `bg-${currentStep.color}` 
                    : 'bg-themed-surface-hover'
                }`}></div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Status message */}
      <div className="text-center">
        <p className={`text-lg font-medium ${
          step === 'error' ? 'text-red-400' : 'text-themed-primary'
        }`}>{currentStep.message}</p>
        
        {/* Animated dots for non-error states */}
        {step !== 'error' && (
          <div className="flex justify-center gap-1 mt-3">
            <div className={`w-2 h-2 bg-${currentStep.color} rounded-full animate-flow-dot`}></div>
            <div className={`w-2 h-2 bg-${currentStep.color} rounded-full animate-flow-dot`} style={{ animationDelay: '0.1s' }}></div>
            <div className={`w-2 h-2 bg-${currentStep.color} rounded-full animate-flow-dot`} style={{ animationDelay: '0.2s' }}></div>
          </div>
        )}
      </div>
    </div>
  );
};

// Premium Welcome Animation - beautiful celebration for new subscribers
export const PremiumWelcomeAnimation = ({ tier = 'premium', userName = '', onComplete }) => {
  const tierConfig = {
    premium: {
      color: 'pin-blue',
      gradient: 'from-pin-blue to-pin-blue/60',
      title: 'Welcome to Premium!',
      subtitle: 'You now have access to all premium features',
      features: ['Verified Events', 'Event Analytics', 'Recurring Events', 'Priority Support']
    },
    enterprise: {
      color: 'vibrant-magenta',
      gradient: 'from-vibrant-magenta to-vibrant-magenta/60',
      title: 'Welcome to Enterprise!',
      subtitle: 'You now have access to enterprise-grade features',
      features: ['Enterprise Dashboard', 'Client Organization', 'Bulk Operations', 'Priority Support']
    }
  };

  const config = tierConfig[tier] || tierConfig.premium;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, 6000); // Auto-close after 6 seconds

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Main celebration card */}
      <div className="bg-themed-surface border border-themed rounded-2xl p-8 max-w-md w-full text-center animate-scale-in shadow-2xl">
        {/* Celebration burst */}
        <div className="relative mb-6">
          {/* Main crown/rocket icon */}
          <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center animate-success-expand`}>
            <span className="text-4xl animate-bounce" style={{ animationDelay: '0.5s' }}>
              {config.icon}
            </span>
          </div>
          
          {/* Expanding celebration rings */}
          <div className={`absolute inset-0 rounded-full border-2 border-${config.color}/30 animate-success-ring`}></div>
          <div className={`absolute inset-0 rounded-full border-2 border-${config.color}/20 animate-success-ring`} style={{ animationDelay: '0.3s' }}></div>
          
          {/* Floating celebration elements */}
          <div className="absolute -top-2 -right-2 w-3 h-3 bg-spark-yellow rounded-full animate-float-up" style={{ animationDelay: '0.8s' }}></div>
          <div className="absolute -top-4 left-2 w-2 h-2 bg-fresh-teal rounded-full animate-float-up" style={{ animationDelay: '1.1s' }}></div>
          <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-vibrant-magenta rounded-full animate-float-up" style={{ animationDelay: '1.4s' }}></div>
          <div className="absolute -bottom-4 right-4 w-2 h-2 bg-pin-blue rounded-full animate-float-up" style={{ animationDelay: '1.7s' }}></div>
        </div>

        {/* Welcome message */}
        <div className="space-y-4 mb-6">
          <h1 className={`text-2xl font-bold text-${config.color} animate-fade-in-up`} style={{ animationDelay: '0.2s' }}>
            {config.title}
          </h1>
          {userName && (
            <p className="text-lg text-themed-primary animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              Welcome, {userName}! 🎉
            </p>
          )}
          <p className="text-themed-secondary animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
            {config.subtitle}
          </p>
        </div>

        {/* Feature list */}
        <div className="space-y-2 mb-6">
          {config.features.map((feature, index) => (
            <div 
              key={feature}
              className="flex items-center justify-center gap-2 text-sm text-themed-secondary animate-fade-in-up"
              style={{ animationDelay: `${0.8 + index * 0.1}s` }}
            >
              <CheckCircle className={`w-4 h-4 text-${config.color}`} />
              {feature}
            </div>
          ))}
        </div>

        {/* Call to action */}
        <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '1.5s' }}>
          <button
            onClick={onComplete}
            className={`w-full bg-gradient-to-r ${config.gradient} text-white py-3 px-6 rounded-lg font-medium hover:opacity-90 transition-opacity`}
          >
            Start Exploring Premium Features
          </button>
          <p className="text-xs text-themed-secondary">
            Thank you for choosing TodoEvents {tier}! 💙
          </p>
        </div>
      </div>
    </div>
  );
};

// Success animation - clean and satisfying
export const SuccessAnimation = ({ message = "Success!" }) => {
  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="relative">
        {/* Success circle with smooth expansion */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-fresh-teal to-pin-blue flex items-center justify-center animate-success-expand">
          <svg className="w-8 h-8 text-white animate-success-check" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        {/* Expanding ring */}
        <div className="absolute inset-0 rounded-full border-2 border-fresh-teal/30 animate-success-ring"></div>
      </div>
      
      <p className="text-lg font-semibold text-themed-primary animate-fade-in-up">{message}</p>
    </div>
  );
};

// Modal entrance animation - smooth and elegant
export const AnimatedModalWrapper = ({ children, isOpen, className = '' }) => {
  return (
    <div className={`
      transform transition-all duration-500 ease-out
      ${isOpen 
        ? 'translate-y-0 opacity-100 scale-100' 
        : 'translate-y-6 opacity-0 scale-95'
      }
      ${className}
    `}>
      {children}
    </div>
  );
};

// Panel slide animation for event details
export const PanelSlideAnimation = ({ children, isOpen, direction = 'right', className = '' }) => {
  const directionClasses = {
    right: isOpen ? 'translate-x-0' : 'translate-x-full',
    left: isOpen ? 'translate-x-0' : '-translate-x-full',
    up: isOpen ? 'translate-y-0' : 'translate-y-full',
    down: isOpen ? 'translate-y-0' : '-translate-y-full'
  };

  return (
    <div className={`
      transform transition-all duration-400 ease-out
      ${directionClasses[direction]}
      ${isOpen ? 'opacity-100' : 'opacity-0'}
      ${className}
    `}>
      {children}
    </div>
  );
};

// Staggered list animation for event lists
export const StaggeredListAnimation = ({ children, delay = 100 }) => {
  const childrenArray = React.Children.toArray(children);
  
  return (
    <>
      {childrenArray.map((child, index) => (
        <div 
          key={index}
          className="animate-slide-in-up"
          style={{ animationDelay: `${index * delay}ms` }}
        >
          {child}
        </div>
      ))}
    </>
  );
}; 