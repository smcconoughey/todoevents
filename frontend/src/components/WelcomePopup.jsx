import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from './ThemeContext';
import { CategoryIcon } from './EventMap/CategoryIcons';
import { X, MapPin, Calendar, Users, Share2, Search, Plus } from 'lucide-react';

const WelcomePopup = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { theme } = useContext(ThemeContext);

  useEffect(() => {
    // Check if user has seen the welcome popup before
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
    
    if (!hasSeenWelcome) {
      // Different delay for development vs production
      const isDevelopment = import.meta.env.DEV;
      const delay = isDevelopment ? 8000 : 1500; // 8s in dev, 1.5s in prod
      
      // Show popup after a delay
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('hasSeenWelcome', 'true');
  };

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

  const bgColor = theme === 'dark' ? '#0f0f0f' : '#ffffff';
  const cardBgColor = theme === 'dark' ? '#171717' : '#fafafa';
  const textColor = theme === 'dark' ? '#ffffff' : '#0f0f0f';
  const secondaryTextColor = theme === 'dark' ? '#a3a3a3' : '#525252';
  const borderColor = theme === 'dark' ? '#262626' : '#e5e5e5';

  const steps = [
    {
      title: "Welcome to todo-events! 🎉",
      subtitle: "Your Ultimate Local Event Discovery Platform",
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" 
                 style={{ backgroundColor: '#FFEC3A20' }}>
              <MapPin className="w-10 h-10" style={{ color: '#FFEC3A' }} />
            </div>
            <p className="text-lg leading-relaxed" style={{ color: textColor }}>
              Discover amazing <strong>local events</strong> in your community! From food festivals 
              and concerts to art shows and sports events - find what's happening around you.
            </p>
          </div>
          
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border" 
               style={{ borderColor: borderColor }}>
            <h4 className="font-semibold mb-2" style={{ color: textColor }}>Why todo-events?</h4>
            <ul className="space-y-1 text-sm" style={{ color: secondaryTextColor }}>
              <li>• Find events by location and category</li>
              <li>• Discover hidden gems in your neighborhood</li>
              <li>• Connect with your local community</li>
              <li>• Share and create your own events</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Explore by Category 🎭",
      subtitle: "Find Events That Match Your Interests",
      content: (
        <div className="space-y-4">
          <p style={{ color: textColor }}>
            Browse through different <strong>event categories</strong> to find exactly what you're looking for:
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'food-drink', name: 'Food & Drink', desc: 'Festivals, tastings, food trucks' },
              { id: 'music', name: 'Music', desc: 'Concerts, live bands, open mics' },
              { id: 'arts', name: 'Arts', desc: 'Gallery shows, workshops, fairs' },
              { id: 'sports', name: 'Sports', desc: 'Games, tournaments, fitness' },
            ].map((category) => (
              <div key={category.id} 
                   className="p-3 rounded-lg border" 
                   style={{ backgroundColor: cardBgColor, borderColor: borderColor }}>
                <div className="flex items-center gap-2 mb-1">
                  <CategoryIcon category={category.id} className="w-4 h-4" />
                  <span className="font-medium text-sm" style={{ color: textColor }}>
                    {category.name}
                  </span>
                </div>
                <p className="text-xs" style={{ color: secondaryTextColor }}>
                  {category.desc}
                </p>
              </div>
            ))}
          </div>
          
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#FFEC3A20' }}>
            <p className="text-sm font-medium" style={{ color: textColor }}>
              💡 Tip: Use the sidebar filters to narrow down events by category, date, and distance!
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Interactive Map View 🗺️",
      subtitle: "Visualize Events Around You",
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" 
                 style={{ backgroundColor: '#3b82f620' }}>
              <MapPin className="w-6 h-6" style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <h4 className="font-semibold mb-1" style={{ color: textColor }}>Location-Based Discovery</h4>
              <p className="text-sm" style={{ color: secondaryTextColor }}>
                See all events on an <strong>interactive map</strong>. Click any pin to view event details, 
                get directions, and see what's happening nearby.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" 
                 style={{ backgroundColor: '#10b98120' }}>
              <Search className="w-6 h-6" style={{ color: '#10b981' }} />
            </div>
            <div>
              <h4 className="font-semibold mb-1" style={{ color: textColor }}>Smart Search</h4>
              <p className="text-sm" style={{ color: secondaryTextColor }}>
                Enter any address to explore events in that area. Perfect for planning outings 
                when visiting new neighborhoods or cities.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" 
                 style={{ backgroundColor: '#f59e0b20' }}>
              <Calendar className="w-6 h-6" style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <h4 className="font-semibold mb-1" style={{ color: textColor }}>Date Filtering</h4>
              <p className="text-sm" style={{ color: secondaryTextColor }}>
                Filter events by specific dates or date ranges to plan your week, weekend, or 
                special occasions perfectly.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Create & Share Events 📢",
      subtitle: "Build Your Community",
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" 
                 style={{ backgroundColor: '#ec489920' }}>
              <Plus className="w-8 h-8" style={{ color: '#ec4899' }} />
            </div>
            <p style={{ color: textColor }}>
              Join our <strong>community of event organizers</strong>! Share your events and help others 
              discover amazing local experiences.
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: cardBgColor }}>
              <Users className="w-5 h-5" style={{ color: '#3b82f6' }} />
              <span className="text-sm" style={{ color: textColor }}>
                <strong>Sign up</strong> to create and manage your events
              </span>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: cardBgColor }}>
              <Share2 className="w-5 h-5" style={{ color: '#10b981' }} />
              <span className="text-sm" style={{ color: textColor }}>
                <strong>Share events</strong> on social media with beautiful cards
              </span>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: cardBgColor }}>
              <Calendar className="w-5 h-5" style={{ color: '#f59e0b' }} />
              <span className="text-sm" style={{ color: textColor }}>
                <strong>Promote</strong> your business or community events
              </span>
            </div>
          </div>
          
          <div className="text-center p-4 rounded-lg border" style={{ borderColor: '#FFEC3A', backgroundColor: '#FFEC3A10' }}>
            <p className="text-sm font-medium" style={{ color: textColor }}>
              Ready to explore? Click "Get Started" to begin discovering events in your area! 🚀
            </p>
          </div>
        </div>
      )
    }
  ];

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" 
         style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
      <div className="relative w-full max-w-md mx-auto rounded-2xl shadow-2xl border overflow-hidden"
           style={{ backgroundColor: bgColor, borderColor: borderColor }}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: borderColor }}>
          <div>
            <h2 className="text-xl font-bold" style={{ color: textColor }}>
              {steps[currentStep].title}
            </h2>
            <p className="text-sm mt-1" style={{ color: secondaryTextColor }}>
              {steps[currentStep].subtitle}
            </p>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" style={{ color: secondaryTextColor }} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {steps[currentStep].content}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t" style={{ borderColor: borderColor }}>
          <div className="flex space-x-1">
            {steps.map((_, index) => (
              <div
                key={index}
                className="w-2 h-2 rounded-full transition-colors"
                style={{ 
                  backgroundColor: index === currentStep ? '#FFEC3A' : (theme === 'dark' ? '#404040' : '#d1d5db')
                }}
              />
            ))}
          </div>
          
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 rounded-lg border transition-colors"
                style={{ 
                  borderColor: borderColor,
                  color: textColor,
                  backgroundColor: 'transparent'
                }}
              >
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{ 
                backgroundColor: '#FFEC3A',
                color: '#1F2937'
              }}
            >
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePopup; 