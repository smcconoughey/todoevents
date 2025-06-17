import React from 'react';
import { Heart, Sparkles, Calendar, User, MapPin, Clock, Target, Zap } from 'lucide-react';

// Beautiful pulsing ring loader
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

// Floating heart animation for interest loading
export const InterestHeartLoader = ({ size = 'sm' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className="relative">
      {/* Multiple hearts floating up */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Heart className={`${sizeClasses[size]} text-vibrant-magenta animate-bounce`} />
      </div>
      {/* Background hearts */}
      <div className="absolute inset-0 flex items-center justify-center opacity-30">
        <Heart className={`${sizeClasses[size]} text-vibrant-magenta animate-pulse`} style={{ animationDelay: '0.2s' }} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <Heart className={`${sizeClasses[size]} text-vibrant-magenta animate-ping`} style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  );
};

// Sparkle burst animation for successful actions
export const SparkleLoader = ({ message = "Processing..." }) => {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-spark-yellow to-pin-blue flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-white animate-pulse" />
        </div>
        {/* Orbiting sparkles */}
        <div className="absolute inset-0 animate-spin">
          <Sparkles className="absolute -top-2 left-1/2 w-3 h-3 text-spark-yellow opacity-80" style={{ transform: 'translateX(-50%)' }} />
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDelay: '0.5s', animationDirection: 'reverse' }}>
          <Sparkles className="absolute -bottom-2 left-1/2 w-3 h-3 text-pin-blue opacity-80" style={{ transform: 'translateX(-50%)' }} />
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDelay: '1s' }}>
          <Sparkles className="absolute top-1/2 -left-2 w-3 h-3 text-vibrant-magenta opacity-80" style={{ transform: 'translateY(-50%)' }} />
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDelay: '1.5s', animationDirection: 'reverse' }}>
          <Sparkles className="absolute top-1/2 -right-2 w-3 h-3 text-fresh-teal opacity-80" style={{ transform: 'translateY(-50%)' }} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-themed-primary font-medium animate-pulse">{message}</p>
        <div className="flex justify-center gap-1 mt-2">
          <div className="w-2 h-2 bg-pin-blue rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-pin-blue rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-pin-blue rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
};

// Event creation/opening animation
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
      {/* Main loading icon with animated background */}
      <div className="relative">
        <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-pin-blue/20 to-spark-yellow/20 backdrop-blur-sm border border-white/10 flex items-center justify-center">
          <Icon className="w-10 h-10 text-pin-blue animate-pulse" />
        </div>
        {/* Floating elements */}
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-spark-yellow/30 rounded-full flex items-center justify-center animate-bounce">
          <Sparkles className="w-3 h-3 text-spark-yellow" />
        </div>
        <div className="absolute -bottom-2 -left-2 w-5 h-5 bg-vibrant-magenta/30 rounded-full flex items-center justify-center animate-pulse" style={{ animationDelay: '0.5s' }}>
          <Zap className="w-2.5 h-2.5 text-vibrant-magenta" />
        </div>
        {/* Pulsing rings */}
        <div className="absolute inset-0 rounded-xl border-2 border-pin-blue/20 animate-ping"></div>
        <div className="absolute inset-2 rounded-lg border border-spark-yellow/30 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
      </div>

      {/* Loading text */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-themed-primary">{messages[type]}</h3>
        {title && (
          <p className="text-themed-secondary text-sm max-w-xs truncate">"{title}"</p>
        )}
        
        {/* Animated progress bar */}
        <div className="w-48 h-1 bg-themed-surface-hover rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-pin-blue to-spark-yellow rounded-full animate-pulse"></div>
        </div>
        
        {/* Bouncing dots */}
        <div className="flex justify-center gap-1 pt-2">
          <div className="w-1.5 h-1.5 bg-pin-blue rounded-full animate-bounce"></div>
          <div className="w-1.5 h-1.5 bg-pin-blue rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
          <div className="w-1.5 h-1.5 bg-pin-blue rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
        </div>
      </div>
    </div>
  );
};

// Account creation animation
export const AccountCreationLoader = ({ step = 'creating' }) => {
  const steps = {
    creating: { message: 'Creating your account...', icon: User, color: 'pin-blue' },
    verifying: { message: 'Verifying details...', icon: Sparkles, color: 'spark-yellow' },
    finalizing: { message: 'Setting up your profile...', icon: Target, color: 'vibrant-magenta' },
    success: { message: 'Welcome to TodoEvents!', icon: Sparkles, color: 'fresh-teal' }
  };

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      {/* Animated avatar circle */}
      <div className="relative">
        <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-${currentStep.color}/20 to-${currentStep.color}/10 backdrop-blur-sm border-2 border-${currentStep.color}/30 flex items-center justify-center`}>
          <Icon className={`w-12 h-12 text-${currentStep.color} animate-pulse`} />
        </div>
        
        {/* Orbiting dots */}
        <div className="absolute inset-0 animate-spin">
          <div className={`absolute -top-1 left-1/2 w-3 h-3 bg-${currentStep.color} rounded-full opacity-60`} style={{ transform: 'translateX(-50%)' }}></div>
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDelay: '0.5s', animationDirection: 'reverse' }}>
          <div className={`absolute -bottom-1 left-1/2 w-2 h-2 bg-${currentStep.color} rounded-full opacity-40`} style={{ transform: 'translateX(-50%)' }}></div>
        </div>
        
        {/* Pulsing background */}
        <div className={`absolute inset-0 rounded-full border-2 border-${currentStep.color}/20 animate-ping`}></div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2">
        {Object.keys(steps).slice(0, -1).map((stepKey, index) => (
          <React.Fragment key={stepKey}>
            <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
              Object.keys(steps).indexOf(step) >= index 
                ? `bg-${currentStep.color}` 
                : 'bg-themed-surface-hover'
            }`}></div>
            {index < Object.keys(steps).length - 2 && (
              <div className={`w-8 h-0.5 transition-all duration-300 ${
                Object.keys(steps).indexOf(step) > index 
                  ? `bg-${currentStep.color}` 
                  : 'bg-themed-surface-hover'
              }`}></div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Status message */}
      <div className="text-center">
        <p className="text-lg font-medium text-themed-primary animate-pulse">{currentStep.message}</p>
        <div className="flex justify-center gap-1 mt-3">
          <div className={`w-2 h-2 bg-${currentStep.color} rounded-full animate-bounce`}></div>
          <div className={`w-2 h-2 bg-${currentStep.color} rounded-full animate-bounce`} style={{ animationDelay: '0.1s' }}></div>
          <div className={`w-2 h-2 bg-${currentStep.color} rounded-full animate-bounce`} style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
};

// Success animation burst
export const SuccessAnimation = ({ message = "Success!", showSparkles = true }) => {
  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="relative">
        {/* Success circle */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-fresh-teal to-pin-blue flex items-center justify-center animate-pulse">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        {showSparkles && (
          <>
            {/* Burst sparkles */}
            <div className="absolute inset-0 animate-ping">
              <Sparkles className="absolute -top-2 left-1/2 w-4 h-4 text-spark-yellow opacity-80" style={{ transform: 'translateX(-50%)' }} />
              <Sparkles className="absolute -bottom-2 left-1/2 w-3 h-3 text-fresh-teal opacity-60" style={{ transform: 'translateX(-50%)' }} />
              <Sparkles className="absolute top-1/2 -left-2 w-3 h-3 text-vibrant-magenta opacity-70" style={{ transform: 'translateY(-50%)' }} />
              <Sparkles className="absolute top-1/2 -right-2 w-4 h-4 text-pin-blue opacity-50" style={{ transform: 'translateY(-50%)' }} />
            </div>
          </>
        )}
      </div>
      
      <p className="text-lg font-semibold text-themed-primary animate-pulse">{message}</p>
    </div>
  );
};

// Modal/Dialog entrance animation wrapper
export const AnimatedModalWrapper = ({ children, isOpen, className = '' }) => {
  return (
    <div className={`
      transform transition-all duration-300 ease-out
      ${isOpen 
        ? 'translate-y-0 opacity-100 scale-100' 
        : 'translate-y-4 opacity-0 scale-95'
      }
      ${className}
    `}>
      {children}
    </div>
  );
};

// Staggered list animation for event lists
export const StaggeredListAnimation = ({ children, delay = 100 }) => {
  return (
    <div className="space-y-2">
      {React.Children.map(children, (child, index) => (
        <div 
          className="transform transition-all duration-500 ease-out"
          style={{ 
            animationDelay: `${index * delay}ms`,
            animation: 'slideInUp 0.5s ease-out forwards'
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}; 