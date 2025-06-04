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
  CheckCircle
} from 'lucide-react';

const EventCreatorPage = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const benefits = [
    {
      icon: Users,
      title: "Build Your Community",
      description: "Connect with like-minded people in your area. Every big community started with one person taking initiative.",
      color: "text-blue-400"
    },
    {
      icon: Heart,
      title: "Make a Real Impact",
      description: "Your small gathering could be exactly what someone needs. Create meaningful connections that last.",
      color: "text-pink-400"
    },
    {
      icon: Megaphone,
      title: "Your Voice Matters",
      description: "Share your passion, skill, or interest. You don't need to be a corporation to create valuable experiences.",
      color: "text-yellow-400"
    },
    {
      icon: Calendar,
      title: "Start Small, Dream Big",
      description: "Begin with a coffee meetup, book club, or hobby group. Every successful event series started somewhere.",
      color: "text-green-400"
    }
  ];

  const features = [
    {
      icon: Share2,
      title: "Beautiful Share Cards",
      description: "Instantly generate professional-looking cards for social media. No design skills needed.",
      highlight: "Free"
    },
    {
      icon: MapPin,
      title: "Location Discovery",
      description: "Help people find your event easily with interactive maps and precise location data.",
      highlight: "Easy"
    },
    {
      icon: Star,
      title: "Build Credibility",
      description: "Gather interest and track engagement to show your event's growing popularity.",
      highlight: "Authentic"
    },
    {
      icon: Zap,
      title: "Instant Publishing",
      description: "Go from idea to published event in minutes. No approval process or waiting periods.",
      highlight: "Fast"
    }
  ];

  const successStories = [
    {
      title: "Sarah's Book Club",
      description: "Started with 3 friends, now hosts 25+ people monthly",
      impact: "Built lasting friendships and a love for reading"
    },
    {
      title: "Mike's Photography Walks",
      description: "Casual weekend photo walks turned into a photography community",
      impact: "Helped 50+ people improve their photography skills"
    },
    {
      title: "Ana's Language Exchange",
      description: "Bi-weekly Spanish practice sessions in a local café",
      impact: "Created a supportive space for language learners"
    }
  ];

  return (
    <div className="min-h-screen bg-themed-surface">
      {/* Header */}
      <header className="border-b border-themed bg-themed-surface sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="text-themed-secondary hover:text-themed-primary"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Events
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => navigate('/hosts')}
                variant="outline"
                className="border-themed text-themed-primary hover:bg-themed-surface-hover"
              >
                For Organizations
              </Button>
              <Button
                onClick={() => {
                  // Navigate to home and open create form with URL parameter
                  window.location.href = '/?create=true';
                }}
                className="btn-yellow-themed"
              >
                Create Event
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 sm:py-20 bg-gradient-to-br from-spark-yellow/5 via-pin-blue/5 to-vibrant-magenta/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-spark-yellow/20 rounded-full flex items-center justify-center">
              <Heart className="w-8 h-8 text-spark-yellow" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-themed-primary mb-4">
              Every Event Starts with <span className="text-spark-yellow">One Person</span>
            </h1>
            <p className="text-lg sm:text-xl text-themed-secondary max-w-3xl mx-auto leading-relaxed">
              You don't need a big budget, corporate backing, or hundreds of followers. 
              You just need a passion to share and the courage to bring people together.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={() => navigate('/')}
              className="btn-yellow-themed text-lg px-8 py-3 min-h-[48px]"
            >
              Start Your First Event
            </Button>
            <Button
              onClick={() => document.getElementById('benefits').scrollIntoView({ behavior: 'smooth' })}
              variant="outline"
              className="border-themed text-themed-primary hover:bg-themed-surface-hover text-lg px-8 py-3 min-h-[48px]"
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-themed-primary mb-4">
              Why Your Event Matters
            </h2>
            <p className="text-lg text-themed-secondary max-w-2xl mx-auto">
              Individual creators are the heart of vibrant communities. Here's why your event can make a difference.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="bg-themed-surface border-themed hover:bg-themed-surface-hover transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg bg-themed-surface-hover ${benefit.color}`}>
                      <benefit.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-themed-primary mb-2">
                        {benefit.title}
                      </h3>
                      <p className="text-themed-secondary leading-relaxed">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 bg-themed-surface-hover/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-themed-primary mb-4">
              Tools Built for Individual Creators
            </h2>
            <p className="text-lg text-themed-secondary max-w-2xl mx-auto">
              Professional-grade features that are simple enough for anyone to use, and always free for individual event creators.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-themed-surface border-themed hover:bg-themed-surface-hover transition-all duration-300 text-center">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="w-12 h-12 mx-auto bg-themed-surface-hover rounded-lg flex items-center justify-center mb-3">
                      <feature.icon className="w-6 h-6 text-spark-yellow" />
                    </div>
                    <span className="inline-block px-3 py-1 bg-spark-yellow/20 text-spark-yellow text-xs font-semibold rounded-full">
                      {feature.highlight}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-themed-primary mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-themed-secondary text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-themed-primary mb-4">
              Real Stories from Real People
            </h2>
            <p className="text-lg text-themed-secondary max-w-2xl mx-auto">
              See how ordinary people created extraordinary community experiences.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {successStories.map((story, index) => (
              <Card key={index} className="bg-themed-surface border-themed">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <CheckCircle className="w-8 h-8 text-green-400 mb-3" />
                    <h3 className="text-xl font-semibold text-themed-primary mb-2">
                      {story.title}
                    </h3>
                    <p className="text-themed-secondary mb-4">
                      {story.description}
                    </p>
                    <div className="p-3 bg-themed-surface-hover rounded-lg">
                      <p className="text-sm text-themed-secondary italic">
                        "{story.impact}"
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-spark-yellow/10 via-pin-blue/10 to-vibrant-magenta/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-4xl font-bold text-themed-primary mb-4">
            Ready to Start Your Event?
          </h2>
          <p className="text-lg text-themed-secondary mb-8 max-w-2xl mx-auto">
            Join thousands of individuals who've discovered the joy of bringing their community together. 
            Your first event is just a few clicks away.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={() => {
                // Navigate to home and open create form with URL parameter
                window.location.href = '/?create=true';
              }}
              className="btn-yellow-themed text-lg px-8 py-3 min-h-[48px]"
            >
              Create Your Event Now
            </Button>
            <Button
              onClick={() => navigate('/hosts')}
              variant="outline"
              className="border-themed text-themed-primary hover:bg-themed-surface-hover text-lg px-8 py-3 min-h-[48px]"
            >
              Learn About Premium Features
            </Button>
          </div>
          
          <p className="text-sm text-themed-tertiary mt-6">
            Always free for individual creators • No hidden fees • No approval required
          </p>
        </div>
      </section>
    </div>
  );
};

export default EventCreatorPage; 