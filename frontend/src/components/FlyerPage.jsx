import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { 
  Users, 
  Heart, 
  Megaphone, 
  Calendar, 
  Share2, 
  MapPin, 
  Star,
  Zap,
  ArrowLeft,
  CheckCircle,
  Download,
  Target,
  TrendingUp,
  Award
} from 'lucide-react';

const FlyerPage = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const downloadPDF = () => {
    window.print();
  };

  const keyBenefits = [
    {
      icon: Users,
      title: "Build Your Community",
      description: "Connect with like-minded people in your area and create meaningful connections."
    },
    {
      icon: MapPin,
      title: "Location Discovery",
      description: "Your events appear on our interactive map, making them easily discoverable."
    },
    {
      icon: Share2,
      title: "Beautiful Share Cards",
      description: "Generate professional event cards for social media with zero design skills needed."
    },
    {
      icon: Calendar,
      title: "Smart Scheduling",
      description: "Built-in calendar integration and date filtering help people find your events."
    }
  ];

  const features = [
    {
      icon: Star,
      title: "Build Credibility",
      description: "Track engagement and interest to show your event's growing popularity"
    },
    {
      icon: Zap,
      title: "Instant Publishing",
      description: "Go from idea to published event in minutes with no approval process"
    },
    {
      icon: Target,
      title: "Reach More People",
      description: "Connect with thousands of locals actively looking for events"
    },
    {
      icon: TrendingUp,
      title: "Easy Management",
      description: "Simple tools to update, promote, and manage your events effortlessly"
    }
  ];

  const successStories = [
    {
      title: "Sarah's Book Club",
      description: "Started with 3 friends, now hosts 25+ people monthly"
    },
    {
      title: "Mike's Photography Walks",
      description: "Casual weekend walks turned into a photography community"
    },
    {
      title: "Ana's Language Exchange",
      description: "Bi-weekly Spanish practice sessions in a local café"
    }
  ];

  const tips = [
    "Use clear, descriptive titles that tell people what to expect",
    "Provide comprehensive information including what to bring and parking details",
    "Post events 1-2 weeks in advance for best results",
    "Choose the right category to reach your target audience",
    "Include accurate location info with landmarks or parking instructions",
    "Engage with attendees and respond to questions quickly"
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Print-hidden header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Events
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={downloadPDF}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button
                onClick={() => {
                  window.location.href = '/?create=true';
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Create Event
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Flyer Content - Optimized for single page */}
      <div className="max-w-4xl mx-auto p-8 print:p-4 print:max-w-none print:mx-0">
        
        {/* Header Section */}
        <div className="text-center mb-8 print:mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center print:w-12 print:h-12 print:mb-2">
            <Heart className="w-8 h-8 text-yellow-600 print:w-6 print:h-6" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2 print:text-3xl print:mb-1">
            Todo Events
          </h1>
          <p className="text-xl text-yellow-600 font-semibold mb-4 print:text-lg print:mb-2">
            Connect Your Community • Host Amazing Events • 100% Free
          </p>
          <p className="text-lg text-gray-700 max-w-2xl mx-auto print:text-base">
            Every great community starts with one person taking initiative. 
            You don't need a big budget or corporate backing - just passion and the courage to bring people together.
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-8 mb-8 print:gap-4 print:mb-4">
          
          {/* Left Column - Why Host Events */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 print:text-xl print:mb-2">
              Why Your Event Matters
            </h2>
            <div className="space-y-4 print:space-y-2">
              {keyBenefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3 print:gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg print:p-1">
                    <benefit.icon className="w-5 h-5 text-blue-600 print:w-4 print:h-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1 print:text-sm">
                      {benefit.title}
                    </h3>
                    <p className="text-gray-600 text-sm print:text-xs">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Platform Features */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 print:text-xl print:mb-2">
              Free Platform Features
            </h2>
            <div className="space-y-4 print:space-y-2">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3 print:gap-2">
                  <div className="p-2 bg-green-100 rounded-lg print:p-1">
                    <feature.icon className="w-5 h-5 text-green-600 print:w-4 print:h-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1 print:text-sm">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 text-sm print:text-xs">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Success Stories Section */}
        <div className="mb-8 print:mb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center print:text-xl print:mb-2">
            Real Success Stories
          </h2>
          <div className="grid md:grid-cols-3 gap-4 print:gap-2">
            {successStories.map((story, index) => (
              <div key={index} className="text-center p-4 bg-gray-50 rounded-lg print:p-2">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 print:w-6 print:h-6 print:mb-1" />
                <h3 className="font-semibold text-gray-900 mb-1 print:text-sm">
                  {story.title}
                </h3>
                <p className="text-gray-600 text-sm print:text-xs">
                  {story.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Tips Section */}
        <div className="mb-8 print:mb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center print:text-xl print:mb-2">
            6 Tips for Event Success
          </h2>
          <div className="grid md:grid-cols-2 gap-3 print:gap-1">
            {tips.map((tip, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold print:w-5 print:h-5 print:text-xs">
                  {index + 1}
                </div>
                <p className="text-gray-700 text-sm print:text-xs flex-1">
                  {tip}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Getting Started & Contact */}
        <div className="bg-yellow-50 rounded-xl p-6 print:p-4 print:rounded-lg">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3 print:text-xl print:mb-2">
              Ready to Get Started?
            </h2>
            <p className="text-gray-700 mb-4 print:text-sm print:mb-2">
              Creating events is completely free with optional, non-intrusive premium features coming soon.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center print:gap-2">
              <div className="text-center">
                <p className="font-semibold text-gray-900 print:text-sm">Visit: todo-events.com</p>
                <p className="text-gray-600 text-sm print:text-xs">Create your first event in minutes</p>
              </div>
              <div className="w-px h-8 bg-gray-300 print:hidden"></div>
              <div className="text-center">
                <p className="font-semibold text-gray-900 print:text-sm">Questions? support@todo-events.com</p>
                <p className="text-gray-600 text-sm print:text-xs">We're here to help you succeed</p>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-white rounded-lg border-2 border-dashed border-yellow-300 print:mt-2 print:p-2">
              <p className="text-sm text-gray-600 print:text-xs">
                <strong>100% Free Platform</strong> • No hidden fees • No approval required • 
                Optional premium features in development will remain completely non-intrusive
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 pt-4 border-t border-gray-200 print:mt-3 print:pt-2">
          <p className="text-gray-500 text-sm print:text-xs">
            Todo Events - Connecting communities, one event at a time
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          @page {
            margin: 0.5in;
            size: letter;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:text-xs {
            font-size: 0.75rem !important;
          }
          
          .print\\:text-sm {
            font-size: 0.875rem !important;
          }
          
          .print\\:text-base {
            font-size: 1rem !important;
          }
          
          .print\\:text-lg {
            font-size: 1.125rem !important;
          }
          
          .print\\:text-xl {
            font-size: 1.25rem !important;
          }
          
          .print\\:text-3xl {
            font-size: 1.875rem !important;
          }
          
          .print\\:p-1 {
            padding: 0.25rem !important;
          }
          
          .print\\:p-2 {
            padding: 0.5rem !important;
          }
          
          .print\\:p-4 {
            padding: 1rem !important;
          }
          
          .print\\:gap-1 {
            gap: 0.25rem !important;
          }
          
          .print\\:gap-2 {
            gap: 0.5rem !important;
          }
          
          .print\\:gap-4 {
            gap: 1rem !important;
          }
          
          .print\\:mb-1 {
            margin-bottom: 0.25rem !important;
          }
          
          .print\\:mb-2 {
            margin-bottom: 0.5rem !important;
          }
          
          .print\\:mb-4 {
            margin-bottom: 1rem !important;
          }
          
          .print\\:mt-2 {
            margin-top: 0.5rem !important;
          }
          
          .print\\:mt-3 {
            margin-top: 0.75rem !important;
          }
          
          .print\\:pt-2 {
            padding-top: 0.5rem !important;
          }
          
          .print\\:w-4 {
            width: 1rem !important;
          }
          
          .print\\:h-4 {
            height: 1rem !important;
          }
          
          .print\\:w-5 {
            width: 1.25rem !important;
          }
          
          .print\\:h-5 {
            height: 1.25rem !important;
          }
          
          .print\\:w-6 {
            width: 1.5rem !important;
          }
          
          .print\\:h-6 {
            height: 1.5rem !important;
          }
          
          .print\\:w-12 {
            width: 3rem !important;
          }
          
          .print\\:h-12 {
            height: 3rem !important;
          }
          
          .print\\:space-y-2 > * + * {
            margin-top: 0.5rem !important;
          }
          
          .print\\:max-w-none {
            max-width: none !important;
          }
          
          .print\\:mx-0 {
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          
          .print\\:rounded-lg {
            border-radius: 0.5rem !important;
          }
        }
      `}</style>
    </div>
  );
};

export default FlyerPage; 