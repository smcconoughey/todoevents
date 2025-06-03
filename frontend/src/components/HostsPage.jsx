import React from 'react';
import { useTheme } from './ThemeContext';
import { 
  Users, 
  MapPin, 
  Calendar, 
  Heart, 
  Star, 
  Target, 
  TrendingUp, 
  Award, 
  Crown, 
  Sparkles, 
  ArrowRight 
} from 'lucide-react';

const HostsPage = () => {
  const { theme } = useTheme();

  const features = [
    {
      icon: Users,
      title: 'Reach More People',
      description: 'Connect with thousands of locals actively looking for events in your area.'
    },
    {
      icon: MapPin,
      title: 'Location Discovery',
      description: 'Your events appear on our interactive map, making them easily discoverable.'
    },
    {
      icon: Calendar,
      title: 'Smart Scheduling',
      description: 'Built-in calendar integration and date filtering help people find your events.'
    },
    {
      icon: Heart,
      title: 'Engagement Tracking',
      description: 'See who\'s interested in your events and track attendance trends.'
    }
  ];

  const premiumFeatures = [
    {
      title: 'Event Analytics Dashboard',
      description: 'Comprehensive analytics with detailed insights on event views, interests, attendance trends, and audience demographics.',
      status: 'Coming Soon'
    },
    {
      title: 'Recurring Events',
      description: 'Create and manage recurring events with flexible scheduling options - weekly, monthly, or custom patterns.',
      status: 'In Development'
    },
    {
      title: 'Priority Showcasing',
      description: 'Featured positioning in search results, map clusters, and event lists to maximize visibility.',
      status: 'Coming Soon'
    },
    {
      title: 'Custom Event Banners',
      description: 'Upload custom banners, logos, and create beautifully branded event pages that stand out.',
      status: 'Beta Testing'
    },
    {
      title: 'Native Ticket Sales',
      description: 'Sell tickets directly through our platform with integrated payment processing and attendee management.',
      status: 'Coming Soon'
    }
  ];

  const successTips = [
    {
      number: '01',
      title: 'Compelling Event Titles',
      tip: 'Use clear, descriptive titles that immediately tell people what to expect. Include key details like "Free," "Family-Friendly," or "Beginner Welcome."'
    },
    {
      number: '02',
      title: 'Detailed Descriptions',
      tip: 'Provide comprehensive information including what to bring, parking details, age restrictions, and what makes your event special.'
    },
    {
      number: '03',
      title: 'Perfect Timing',
      tip: 'Post your events at least 1-2 weeks in advance. Weekend events get more traction when posted on Monday-Wednesday.'
    },
    {
      number: '04',
      title: 'Choose the Right Category',
      tip: 'Select the most relevant category to ensure your event reaches the right audience who are specifically interested in that type of activity.'
    },
    {
      number: '05',
      title: 'Accurate Location Info',
      tip: 'Double-check your address and provide landmarks or parking instructions to make your venue easy to find.'
    },
    {
      number: '06',
      title: 'Engage with Attendees',
      tip: 'Respond to questions quickly and update your event if details change. Active hosts build trust and larger audiences.'
    }
  ];

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-neutral-950' : 'bg-white'} transition-colors duration-300`}>
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-spark-yellow/20 via-pin-blue/20 to-vibrant-magenta/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-themed-primary mb-4">
              Host Successful Events
            </h1>
            <p className="text-xl text-themed-secondary max-w-3xl mx-auto">
              Connect with your local community and create memorable experiences. 
              Learn how to host events that people love and make a lasting impact.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        
        {/* Why Host Section */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-themed-primary mb-4">
              Why Host on Todo Events?
            </h2>
            <p className="text-lg text-themed-secondary max-w-2xl mx-auto">
              Join thousands of successful event hosts who trust our platform to reach their community
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div key={index} className="text-center p-6 bg-themed-surface rounded-xl border border-themed hover:bg-themed-surface-hover transition-all duration-300">
                  <div className="w-16 h-16 mx-auto mb-4 p-3 bg-spark-yellow/20 rounded-full flex items-center justify-center">
                    <IconComponent className="w-8 h-8 text-spark-yellow" />
                  </div>
                  <h3 className="text-lg font-semibold text-themed-primary mb-2">{feature.title}</h3>
                  <p className="text-themed-secondary">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Success Tips Section */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-themed-primary mb-4">
              6 Tips for Event Success
            </h2>
            <p className="text-lg text-themed-secondary max-w-2xl mx-auto">
              Follow these proven strategies to maximize attendance and create events people will remember
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {successTips.map((tip, index) => (
              <div key={index} className="flex gap-6 p-6 bg-themed-surface rounded-xl border border-themed hover:bg-themed-surface-hover transition-all duration-300">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-pin-blue/20 text-pin-blue rounded-full flex items-center justify-center font-bold text-lg">
                    {tip.number}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-themed-primary mb-2">{tip.title}</h3>
                  <p className="text-themed-secondary">{tip.tip}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Premium Features Section */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-themed-primary mb-4">
              Premium Features <span className="text-vibrant-magenta">Coming Soon</span>
            </h2>
            <p className="text-lg text-themed-secondary max-w-2xl mx-auto">
              We're working on advanced tools to help you host even more successful events
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {premiumFeatures.map((feature, index) => (
              <div key={index} className="p-6 bg-themed-surface rounded-xl border border-themed relative overflow-hidden group hover:bg-themed-surface-hover transition-all duration-300">
                <div className="absolute top-4 right-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    feature.status === 'Beta Testing' ? 'bg-fresh-teal/20 text-fresh-teal' :
                    feature.status === 'In Development' ? 'bg-vibrant-magenta/20 text-vibrant-magenta' :
                    'bg-spark-yellow/20 text-spark-yellow'
                  }`}>
                    {feature.status}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-themed-primary mb-3 pr-24">{feature.title}</h3>
                <p className="text-themed-secondary">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Getting Started Section */}
        <section className="bg-themed-surface rounded-2xl p-8 md:p-12 border border-themed">
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-themed-primary mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-themed-secondary mb-8 max-w-2xl mx-auto">
              Creating your first event is simple and free. Join our community of hosts and start connecting with your neighbors today.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => window.open('/', '_self')}
                className="px-8 py-3 bg-spark-yellow text-black font-semibold rounded-lg hover:bg-spark-yellow/90 transition-colors duration-200"
              >
                Create Your First Event
              </button>
              <button 
                onClick={() => window.open('mailto:support@todo-events.com', '_blank')}
                className="px-8 py-3 border border-themed text-themed-primary font-semibold rounded-lg hover:bg-themed-surface-hover transition-colors duration-200"
              >
                Contact Support
              </button>
            </div>
          </div>
        </section>

        {/* Footer Info */}
        <div className="text-center mt-16 pt-8 border-t border-themed">
          <p className="text-themed-tertiary">
            Have questions? We're here to help! Reach out to our team at{' '}
            <a href="mailto:support@todo-events.com" className="text-pin-blue hover:underline">
              support@todo-events.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default HostsPage; 