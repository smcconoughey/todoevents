import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from './EventMap/AuthContext';
import { useEventInteraction } from '../hooks/useEventInteraction';
import { ShareCard } from './EventMap/ShareCard';
import { InterestButton } from './EventMap/InterestButton';
import { ViewCounter } from './EventMap/ViewCounter';
import { ExternalLinkWarning } from './EventMap/ExternalLinkWarning';
import { getCategory } from './EventMap/categoryConfig';

const EventDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [externalLinkDialog, setExternalLinkDialog] = useState({ isOpen: false, url: '' });
  
  const {
    interested,
    interestCount,
    viewCount,
    loading: interactionLoading,
    toggleInterest,
    trackView
  } = useEventInteraction(event?.id);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!slug) return;
      
      try {
        setLoading(true);
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${baseUrl}/api/seo/events/by-slug/${slug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Event not found');
          } else {
            throw new Error('Failed to fetch event');
          }
          return;
        }
        
        const eventData = await response.json();
        setEvent(eventData);
        
        // Track view after event is loaded
        if (eventData?.id) {
          trackView();
        }
      } catch (err) {
        console.error('Error fetching event:', err);
        setError('Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [slug, trackView]);

  const formatEventDate = (event) => {
    if (!event?.date) return 'Date TBD';
    
    try {
      const eventDate = new Date(event.date);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      const isToday = eventDate.toDateString() === today.toDateString();
      const isTomorrow = eventDate.toDateString() === tomorrow.toDateString();
      
      if (isToday) return 'Today';
      if (isTomorrow) return 'Tomorrow';
      
      return eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return event.date;
    }
  };

  const formatEventTime = (event) => {
    if (!event?.start_time) return '';
    
    const convertTo12Hour = (time24) => {
      try {
        const [hours, minutes] = time24.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
      } catch (error) {
        return time24;
      }
    };

    const startTime = convertTo12Hour(event.start_time);
    const endTime = event.end_time ? convertTo12Hour(event.end_time) : null;
    
    return endTime ? `${startTime} - ${endTime}` : startTime;
  };

  const handleExternalLink = (url) => {
    if (!url) return;
    
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      const domain = urlObj.hostname.toLowerCase();
      
      // Allow trusted domains without warning
      const trustedDomains = ['eventbrite.com', 'facebook.com', 'meetup.com', 'instagram.com'];
      if (trustedDomains.some(trusted => domain.includes(trusted))) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      
      // Show warning for other external links
      setExternalLinkDialog({ isOpen: true, url });
    } catch (error) {
      console.error('Invalid URL:', url);
    }
  };

  const generateStructuredData = (event) => {
    if (!event) return null;

    return {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": event.title,
      "startDate": event.start_datetime,
      "endDate": event.end_datetime,
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "location": {
        "@type": "Place",
        "name": event.address,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": event.city,
          "addressRegion": event.state,
          "addressCountry": event.country || "USA"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": event.lat,
          "longitude": event.lng
        }
      },
      "image": `https://todo-events.com/api/events/${event.id}/share-card`,
      "description": event.short_description || event.description,
      "organizer": {
        "@type": "Organization",
        "name": event.host_name || "Independent Organizer"
      },
      "offers": {
        "@type": "Offer",
        "url": `https://todo-events.com/e/${event.slug}`,
        "price": event.price || 0,
        "priceCurrency": event.currency || "USD",
        "availability": "https://schema.org/InStock",
        "validFrom": event.created_at
      },
      "url": `https://todo-events.com/e/${event.slug}`,
      "category": event.category
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full border-4 border-spark-yellow/20 border-t-spark-yellow animate-spin mx-auto"></div>
          <h2 className="text-xl font-display font-bold text-themed-primary">Loading Event...</h2>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md mx-auto p-6">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <span className="text-red-500 text-2xl">⚠️</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-bold text-themed-primary">Event Not Found</h2>
            <p className="text-themed-secondary">
              {error || 'The event you\'re looking for doesn\'t exist or may have been removed.'}
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="bg-pin-blue hover:bg-pin-blue/80 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200"
          >
            Browse All Events
          </button>
        </div>
      </div>
    );
  }

  const category = getCategory(event.category);
  const canonicalUrl = `https://todo-events.com/e/${event.slug}`;
  const structuredData = generateStructuredData(event);

  return (
    <>
      <Helmet>
        {/* Basic Meta Tags */}
        <title>{event.title} - {event.city}, {event.state} | Todo Events</title>
        <meta name="description" content={event.short_description || event.description} />
        <link rel="canonical" href={canonicalUrl} />
        
        {/* Open Graph Tags */}
        <meta property="og:title" content={event.title} />
        <meta property="og:description" content={event.short_description || event.description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="event" />
        <meta property="og:image" content={`https://todo-events.com/api/events/${event.id}/share-card`} />
        <meta property="og:site_name" content="Todo Events" />
        
        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={event.title} />
        <meta name="twitter:description" content={event.short_description || event.description} />
        <meta name="twitter:image" content={`https://todo-events.com/api/events/${event.id}/share-card`} />
        
        {/* Structured Data */}
        {structuredData && (
          <script type="application/ld+json">
            {JSON.stringify(structuredData)}
          </script>
        )}
      </Helmet>

      <div className="min-h-screen bg-neutral-950">
        {/* Header */}
        <header className="bg-neutral-900/95 border-b border-white/10 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-themed-primary hover:text-spark-yellow transition-colors"
            >
              <span className="text-xl">←</span>
              <span className="font-display font-bold">todo-events</span>
            </button>
            
            <div className="flex items-center gap-4">
              <ViewCounter viewCount={viewCount} alwaysShow />
              {user && (
                <InterestButton
                  interested={interested}
                  interestCount={interestCount}
                  loading={interactionLoading}
                  onToggle={toggleInterest}
                  size="md"
                />
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="space-y-8">
            {/* Event Header */}
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: category.color }}>
                  <span className="text-xl">{category.icon}</span>
                </div>
                <div className="flex-1 space-y-2">
                  <h1 className="text-3xl md:text-4xl font-display font-bold text-themed-primary">
                    {event.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 text-themed-secondary">
                    <span className="text-lg font-medium">{formatEventDate(event)}</span>
                    {formatEventTime(event) && (
                      <span className="text-lg">{formatEventTime(event)}</span>
                    )}
                    <span className="px-3 py-1 bg-white/10 rounded-full text-sm font-medium">
                      {category.name}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Details Grid */}
            <div className="grid md:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="md:col-span-2 space-y-6">
                {/* Description */}
                <div className="bg-white/5 rounded-xl p-6">
                  <h2 className="text-xl font-display font-bold text-themed-primary mb-4">About This Event</h2>
                  <p className="text-themed-secondary leading-relaxed whitespace-pre-wrap">
                    {event.description}
                  </p>
                </div>

                {/* Additional Info */}
                {(event.host_name || event.price > 0 || event.fee_required) && (
                  <div className="bg-white/5 rounded-xl p-6">
                    <h2 className="text-xl font-display font-bold text-themed-primary mb-4">Event Details</h2>
                    <div className="space-y-3">
                      {event.host_name && (
                        <div className="flex items-center gap-2">
                          <span className="text-themed-secondary">Hosted by:</span>
                          <span className="text-themed-primary font-medium">{event.host_name}</span>
                        </div>
                      )}
                      {(event.price > 0 || event.fee_required) && (
                        <div className="flex items-center gap-2">
                          <span className="text-themed-secondary">Cost:</span>
                          <span className="text-themed-primary font-medium">
                            {event.price > 0 ? `$${event.price}` : event.fee_required || 'Free'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Location */}
                <div className="bg-white/5 rounded-xl p-6">
                  <h3 className="text-lg font-display font-bold text-themed-primary mb-4">Location</h3>
                  <div className="space-y-3">
                    <p className="text-themed-secondary">{event.address}</p>
                    {(event.city || event.state) && (
                      <p className="text-themed-primary font-medium">
                        {event.city}{event.city && event.state && ', '}{event.state}
                      </p>
                    )}
                    <button
                      onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(event.address)}`, '_blank')}
                      className="w-full bg-pin-blue hover:bg-pin-blue/80 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      View on Maps
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-white/5 rounded-xl p-6">
                  <h3 className="text-lg font-display font-bold text-themed-primary mb-4">Actions</h3>
                  <div className="space-y-3">
                    {event.event_url && (
                      <button
                        onClick={() => handleExternalLink(event.event_url)}
                        className="w-full bg-vibrant-magenta hover:bg-vibrant-magenta/80 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Event Website
                      </button>
                    )}
                    {event.organizer_url && (
                      <button
                        onClick={() => handleExternalLink(event.organizer_url)}
                        className="w-full border border-white/20 hover:bg-white/5 text-themed-primary px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Organizer Info
                      </button>
                    )}
                    <button
                      onClick={() => navigate('/', { state: { selectedEvent: event.id } })}
                      className="w-full border border-white/20 hover:bg-white/5 text-themed-primary px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      View on Map
                    </button>
                  </div>
                </div>

                {/* Share Card */}
                <div className="bg-white/5 rounded-xl p-6">
                  <h3 className="text-lg font-display font-bold text-themed-primary mb-4">Share Event</h3>
                  <ShareCard event={event} />
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* External Link Warning Modal */}
        <ExternalLinkWarning
          isOpen={externalLinkDialog.isOpen}
          onClose={() => setExternalLinkDialog({ isOpen: false, url: '' })}
          onConfirm={() => {
            window.open(externalLinkDialog.url, '_blank', 'noopener,noreferrer');
            setExternalLinkDialog({ isOpen: false, url: '' });
          }}
          url={externalLinkDialog.url}
        />
      </div>
    </>
  );
};

export default EventDetailPage; 