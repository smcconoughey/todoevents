import React, { useEffect, useState } from 'react';
import { Sparkles, Zap, Eye, Palette } from 'lucide-react';

const GlassSplashScreen = ({ onComplete }) => {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [progress, setProgress] = useState(0);

  const features = [
    {
      icon: Sparkles,
      title: "Glass UI Design",
      description: "Experience Apple's premium design language"
    },
    {
      icon: Zap,
      title: "Smooth Animations",
      description: "Fluid transitions with perfect timing"
    },
    {
      icon: Eye,
      title: "Frosted Glass",
      description: "Beautiful backdrop blur effects"
    },
    {
      icon: Palette,
      title: "Modern Colors",
      description: "Apple-inspired accent colors"
    }
  ];

  useEffect(() => {
    const duration = 3000; // 3 seconds total
    const steps = 100;
    const interval = duration / steps;

    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressTimer);
          setTimeout(() => onComplete(), 300);
          return 100;
        }
        return prev + 1;
      });
    }, interval);

    const featureTimer = setInterval(() => {
      setCurrentFeature(prev => (prev + 1) % features.length);
    }, 750);

    return () => {
      clearInterval(progressTimer);
      clearInterval(featureTimer);
    };
  }, [onComplete]);

  const currentFeatureData = features[currentFeature];
  const IconComponent = currentFeatureData.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-overlay">
      <div className="glass-modal p-8 max-w-md mx-4 text-center glass-animate-in">
        {/* Logo Section */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-4 glass-panel rounded-full flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold glass-text-primary mb-2">TodoEvents</h1>
          <div className="glass-badge glass-badge-primary">BETA GLASS UI</div>
        </div>

        {/* Feature Showcase */}
        <div className="mb-8 h-24 flex flex-col items-center justify-center">
          <div className="glass-panel-secondary p-4 rounded-full mb-3 transition-all duration-300">
            <IconComponent className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="glass-text-primary font-semibold text-lg mb-1 transition-all duration-300">
            {currentFeatureData.title}
          </h3>
          <p className="glass-text-tertiary text-sm transition-all duration-300">
            {currentFeatureData.description}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="glass-panel-tertiary rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="glass-text-tertiary text-xs mt-2">
            Loading premium experience... {progress}%
          </p>
        </div>

        {/* Feature Dots */}
        <div className="flex justify-center gap-2">
          {features.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentFeature
                  ? 'bg-blue-400 w-6'
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default GlassSplashScreen; 