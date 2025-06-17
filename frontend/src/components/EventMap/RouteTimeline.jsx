import React, { useState, useMemo } from 'react';
import { Clock, MapPin, Calendar, Users, Navigation, ChevronDown, ChevronUp, ExternalLink, Star } from 'lucide-react';
import { WebIcon } from './WebIcons';

const RouteTimeline = ({ 
  routeSteps = [], 
  routeEvents = [], 
  onEventClick,
  theme = 'light' 
}) => {
  const [showMajorStopsOnly, setShowMajorStopsOnly] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState(new Set());

  // Group events by their proximity to route steps
  const eventsGroupedByStep = useMemo(() => {
    const grouped = {};
    
    routeEvents.forEach(event => {
      // Find the closest route step to this event
      let closestStepIndex = 0;
      let closestDistance = Infinity;
      
      routeSteps.forEach((step, index) => {
        if (!step.startLocation) return;
        
        // Calculate distance using Haversine formula
        const lat1 = event.lat * Math.PI / 180;
        const lat2 = step.startLocation.lat * Math.PI / 180;
        const deltaLat = (step.startLocation.lat - event.lat) * Math.PI / 180;
        const deltaLng = (step.startLocation.lng - event.lng) * Math.PI / 180;
        
        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = 6371 * c; // Earth radius in km
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestStepIndex = index;
        }
      });
      
      // Only include events within reasonable distance (50km)
      if (closestDistance <= 50) {
        if (!grouped[closestStepIndex]) {
          grouped[closestStepIndex] = [];
        }
        grouped[closestStepIndex].push({
          ...event,
          distanceFromRoute: closestDistance
        });
      }
    });
    
    // Sort events within each group by interest count and distance
    Object.keys(grouped).forEach(stepIndex => {
      grouped[stepIndex].sort((a, b) => {
        const interestScore = (b.interest_count || 0) - (a.interest_count || 0);
        if (interestScore !== 0) return interestScore;
        return a.distanceFromRoute - b.distanceFromRoute;
      });
    });
    
    return grouped;
  }, [routeSteps, routeEvents]);

  // Filter steps based on view preference
  const displaySteps = useMemo(() => {
    if (showMajorStopsOnly) {
      return routeSteps.filter(step => step.isMajorWaypoint);
    }
    return routeSteps;
  }, [routeSteps, showMajorStopsOnly]);

  const toggleStepExpansion = (stepId) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDateTime = (date) => {
    return {
      date: date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric' 
      }),
      time: formatTime(date)
    };
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const extractCityFromAddress = (address) => {
    if (!address) return 'Unknown Location';
    
    // Try to extract city name from Google's formatted address
    const parts = address.split(', ');
    if (parts.length >= 2) {
      // Usually format is: "Street, City, State ZIP, Country"
      return parts[1] || parts[0];
    }
    return parts[0] || address;
  };

  const isDark = theme === 'dark';
  const isFrost = theme === 'frost';

  if (routeSteps.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Navigation className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Plan a route to see the timeline and discover events along your journey</p>
      </div>
    );
  }

  return (
    <div className={`route-timeline bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 ${isFrost ? 'bg-opacity-25 backdrop-blur-md' : ''} ${isDark ? 'dark' : isFrost ? 'frost' : 'light'}`}>
      <div className="timeline-header">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Route Timeline
          </h3>
          
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showMajorStopsOnly}
                onChange={(e) => setShowMajorStopsOnly(e.target.checked)}
                className="rounded"
              />
              <span>Major stops only</span>
            </label>
          </div>
        </div>
        
        {routeEvents.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <Star className="w-4 h-4 inline mr-1" />
              Found {routeEvents.length} events along your route
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Legend</h4>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span>Waypoint</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Destination</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Major Stop</span>
            </div>
          </div>
        </div>
      </div>

      <div className="timeline-content">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
          
          <div className="space-y-6">
            {displaySteps.map((step, index) => {
              const stepEvents = eventsGroupedByStep[routeSteps.indexOf(step)] || [];
              const isExpanded = expandedSteps.has(step.id);
              const hasEvents = stepEvents.length > 0;
              
              return (
                <div key={step.id} className="relative">
                  {/* Timeline dot */}
                  <div className={`absolute left-4 w-4 h-4 rounded-full border-2 ${
                    step.isWaypoint && step.isDestination
                      ? 'bg-green-500 border-green-500' 
                      : step.isWaypoint
                      ? 'bg-purple-500 border-purple-500'
                      : step.isMajorWaypoint 
                      ? 'bg-blue-500 border-blue-500' 
                      : 'bg-white dark:bg-gray-800 border-gray-400 dark:border-gray-500'
                  }`}></div>
                  
                  {/* Step content */}
                  <div className="ml-12">
                    <div 
                      className={`p-4 rounded-lg cursor-pointer transition-colors ${
                        step.isMajorWaypoint 
                          ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30' 
                          : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => hasEvents && toggleStepExpansion(step.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {formatDateTime(step.estimatedArrivalTime).time}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDateTime(step.estimatedArrivalTime).date}
                              </span>
                            </div>
                            {step.isWaypoint && step.isDestination && (
                              <span className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 text-xs rounded-full">
                                Destination
                              </span>
                            )}
                            {step.isWaypoint && !step.isDestination && (
                              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                                Waypoint
                              </span>
                            )}
                            {step.isMajorWaypoint && !step.isWaypoint && (
                              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                                Major Stop
                              </span>
                            )}
                          </div>
                          
                          <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                            {step.address ? (
                              <span className="font-medium">{extractCityFromAddress(step.address)}</span>
                            ) : (
                              step.instruction
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>{step.distance}</span>
                            <span>{step.duration}</span>
                            {hasEvents && (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                {stepEvents.length} event{stepEvents.length !== 1 ? 's' : ''} nearby
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {hasEvents && (
                          <button className="ml-2 p-1 rounded hover:bg-white/50">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                      
                      {/* Events section */}
                      {hasEvents && isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-medium mb-3 text-gray-900 dark:text-gray-100">
                            Events Near This Stop
                          </h4>
                          
                          <div className="space-y-3">
                            {stepEvents.slice(0, 5).map(event => (
                              <div 
                                key={event.id}
                                className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEventClick?.(event);
                                }}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-1">
                                      {event.title}
                                    </h5>
                                    
                                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(event.date)}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {Math.round(event.distanceFromRoute)} km away
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {event.interest_count || 0}
                                      </span>
                                    </div>
                                    
                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                      {event.city}, {event.state}
                                    </div>
                                    
                                    {event.verified && (
                                      <div className="mt-1">
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded-full">
                                          <WebIcon emoji="✅" className="w-3 h-3" />
                                          Verified
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                                </div>
                              </div>
                            ))}
                            
                            {stepEvents.length > 5 && (
                              <div className="text-center">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  +{stepEvents.length - 5} more events nearby
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .route-timeline {
          max-height: 100%;
          overflow-y: auto;
        }
        
        .route-timeline.dark {
          color: white;
        }
        
        .route-timeline.frost {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
        }
      `}</style>
    </div>
  );
};

export default RouteTimeline; 