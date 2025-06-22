import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Navigation, Clock, Calendar, ChevronDown, ChevronUp, Settings, X, Plus, Minus } from 'lucide-react';
import AddressAutocomplete from './AddressAutocomplete';
import { initGoogleMaps, isMapsReady } from '../../googleMapsLoader';
import { API_URL } from '@/config';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

const RoutePlanner = ({ 
  onRouteCalculated, 
  onEventsDiscovered,
  mapInstance,
  apiKey,
  onClose,
  theme = 'light',
  embedded = false
}) => {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [waypoints, setWaypoints] = useState([]);
  const [searchRadius, setSearchRadius] = useState(10);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeSteps, setRouteSteps] = useState([]);
  const [routeEvents, setRouteEvents] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [travelMode, setTravelMode] = useState('DRIVING');
  const [departureTime, setDepartureTime] = useState(() => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  });
  const [departureDate, setDepartureDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [arrivalDate, setArrivalDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [arrivalTime, setArrivalTime] = useState('18:00');
  const [eventTimeFlexibility, setEventTimeFlexibility] = useState(1); // Days before/after
  const [enableEventTimeFilter, setEnableEventTimeFilter] = useState(false);
  
  const directionsServiceRef = useRef(null);
  const routeData = useRef(null);

  useEffect(() => {
    const initServices = async () => {
      try {
        await initGoogleMaps(apiKey);
        if (isMapsReady() && window.google?.maps?.DirectionsService) {
          directionsServiceRef.current = new window.google.maps.DirectionsService();
        }
      } catch (error) {
        console.error('Failed to initialize Google Maps services:', error);
      }
    };
    
    initServices();
  }, [apiKey]);

  const addWaypoint = () => {
    setWaypoints([...waypoints, '']);
  };

  const removeWaypoint = (index) => {
    const newWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(newWaypoints);
  };

  const updateWaypoint = (index, value) => {
    const newWaypoints = [...waypoints];
    newWaypoints[index] = value;
    setWaypoints(newWaypoints);
  };

  // Sample points along the route for event discovery (optimized based on route distance and search radius)
  const sampleRoutePoints = (route, searchRadiusMiles) => {
    const points = [];
    const legs = route.legs;
    
    // Calculate total route distance in miles
    const totalDistanceMiles = legs.reduce((total, leg) => total + leg.distance.value, 0) / 1609.34;
    
    // Calculate optimal point spacing based on search radius
    // For a 50 mile radius, sample every 100 miles (50 * 2) to ensure coverage with minimal overlap
    // For smaller radii, adjust proportionally
    const optimalSpacingMiles = Math.max(searchRadiusMiles * 2, 25); // Minimum 25 miles between points
    const calculatedPointCount = Math.ceil(totalDistanceMiles / optimalSpacingMiles);
    
    // Apply reasonable limits: minimum 2 points (start/end), maximum 20 for very long routes
    const optimalPointCount = Math.max(2, Math.min(calculatedPointCount, 20));
    
    console.log(`🔄 Route optimization: ${totalDistanceMiles.toFixed(0)} miles, ${searchRadiusMiles} mile radius → ${optimalPointCount} points (${optimalSpacingMiles.toFixed(0)} mile spacing)`);
    
    // Always include start point
    if (legs.length > 0) {
      points.push({
        lat: legs[0].start_location.lat(),
        lng: legs[0].start_location.lng(),
        legIndex: 0,
        stepIndex: -1,
        stepStart: true,
        isWaypoint: true,
        routeProgress: 0
      });
    }
    
    // If we only need start and end points, skip intermediate sampling
    if (optimalPointCount <= 2) {
      // Add final destination
      const lastLeg = legs[legs.length - 1];
      points.push({
        lat: lastLeg.end_location.lat(),
        lng: lastLeg.end_location.lng(),
        legIndex: legs.length - 1,
        stepIndex: 999,
        stepStart: false,
        isWaypoint: true,
        isDestination: true,
        routeProgress: 1
      });
      return points;
    }
    
    // Calculate intermediate points with even distribution
    const spacingMeters = optimalSpacingMiles * 1609.34; // Convert to meters
    let accumulatedDistance = 0;
    let targetDistance = spacingMeters; // First intermediate point target
    
    for (let legIndex = 0; legIndex < legs.length; legIndex++) {
      const leg = legs[legIndex];
      const steps = leg.steps;
      
      // Add waypoint at the end of each leg (except the last one)
      if (legIndex < legs.length - 1) {
        points.push({
          lat: leg.end_location.lat(),
          lng: leg.end_location.lng(),
          legIndex,
          stepIndex: 999,
          stepStart: false,
          isWaypoint: true,
          routeProgress: accumulatedDistance / (totalDistanceMiles * 1609.34)
        });
      }
      
      // Sample points along steps based on target distances
      for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
        const step = steps[stepIndex];
        const stepDistanceMeters = step.distance.value;
        
        // If we haven't reached enough intermediate points yet
        if (points.filter(p => !p.isWaypoint).length < optimalPointCount - 2) {
          // Check if this step crosses our target distance
          if (accumulatedDistance + stepDistanceMeters >= targetDistance) {
            // Add a point at the step location (good approximation)
            points.push({
              lat: step.start_location.lat(),
              lng: step.start_location.lng(),
              legIndex,
              stepIndex,
              stepStart: true,
              isWaypoint: false,
              routeProgress: accumulatedDistance / (totalDistanceMiles * 1609.34)
            });
            
            // Set next target distance
            targetDistance += spacingMeters;
          }
        }
        
        accumulatedDistance += stepDistanceMeters;
      }
    }
    
    // Always include final destination
    if (legs.length > 0) {
      const lastLeg = legs[legs.length - 1];
      points.push({
        lat: lastLeg.end_location.lat(),
        lng: lastLeg.end_location.lng(),
        legIndex: legs.length - 1,
        stepIndex: 999,
        stepStart: false,
        isWaypoint: true,
        isDestination: true,
        routeProgress: 1
      });
    }
    
    console.log(`✅ Final route sampling: ${points.length} points for ${totalDistanceMiles.toFixed(0)} mile route`);
    return points;
  };

  // Fetch events along the route using efficient batch endpoint
  const fetchEventsAlongRoute = async (samplePoints, timingContext = null) => {
    try {
      // Convert sample points to coordinate format for batch API
      const coordinates = samplePoints.map(point => ({
        lat: point.lat,
        lng: point.lng
      }));

      // Use the new batch endpoint for efficient event retrieval
      const requestBody = {
        coordinates: coordinates,
        radius: searchRadius
      };

      // Add timing parameters if provided
      if (timingContext && timingContext.eventTimeFlexibility > 0) {
        const startDate = new Date(timingContext.departureDateTime);
        startDate.setDate(startDate.getDate() - timingContext.eventTimeFlexibility);
        
        const endDate = new Date(timingContext.arrivalDateTime);
        endDate.setDate(endDate.getDate() + timingContext.eventTimeFlexibility);
        
        requestBody.dateRange = {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        };
      }

      const response = await fetchWithTimeout(`${API_URL}/events/route-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }, 15000); // Increased timeout for batch request

      if (!response.ok) {
        throw new Error(`Batch API request failed: ${response.status} ${response.statusText}`);
      }

      const events = await response.json();
      
      if (!Array.isArray(events)) {
        throw new Error(`Invalid response format: expected array, got ${typeof events}`);
      }
      
      // Add route context to events
      const eventsWithContext = events.map(event => ({
        ...event,
        routeContext: {
          estimatedArrivalTime: null // Will be calculated later
        }
      }));

      console.log(`✅ Batch API returned ${eventsWithContext.length} events for ${coordinates.length} route points`);
      return eventsWithContext;
      
    } catch (error) {
      console.error('❌ Error fetching events along route via batch API:', error);
      
      // Fallback to original method if batch API fails
      console.log('🔄 Falling back to individual requests...');
      return await fetchEventsAlongRouteFallback(samplePoints, timingContext);
    }
  };

  // Fallback method using individual requests (kept for reliability)
  const fetchEventsAlongRouteFallback = async (samplePoints, timingContext = null) => {
    const allEvents = [];
    const seenEventIds = new Set();
    
    try {
      // Reduced batch size and increased delay for fallback
      const batchSize = 2;
      for (let i = 0; i < samplePoints.length; i += batchSize) {
        const batch = samplePoints.slice(i, i + batchSize);
        
        const promises = batch.map(point => 
          fetchWithTimeout(`${API_URL}/events?lat=${point.lat}&lng=${point.lng}&radius=${searchRadius}&limit=10`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          }, 8000)
        );
        
        const responses = await Promise.allSettled(promises);
        
        for (const response of responses) {
          if (response.status === 'fulfilled' && response.value.ok) {
            const events = await response.value.json();
            
            // Add unique events with route context
            events.forEach(event => {
              if (!seenEventIds.has(event.id) && event.lat && event.lng) {
                seenEventIds.add(event.id);
                allEvents.push({
                  ...event,
                  routeContext: {
                    pointIndex: i,
                    estimatedArrivalTime: null
                  }
                });
              }
            });
          }
        }
        
        // Longer delay between batches for fallback
        if (i + batchSize < samplePoints.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Sort by interest count and date
      return allEvents.sort((a, b) => {
        const interestScore = (b.interest_count || 0) - (a.interest_count || 0);
        if (interestScore !== 0) return interestScore;
        
        // Secondary sort by date (upcoming events first)
        const today = new Date();
        const aDate = new Date(a.date);
        const bDate = new Date(b.date);
        return Math.abs(aDate - today) - Math.abs(bDate - today);
      });
      
    } catch (error) {
      console.error('❌ Fallback event fetching also failed:', error);
      return [];
    }
  };

  const calculateRoute = async () => {
    if (!startLocation || !endLocation || !directionsServiceRef.current) {
      alert('Please enter both start and end locations');
      return;
    }

    setIsCalculating(true);
    
    try {
      const waypointData = waypoints
        .filter(wp => wp.trim())
        .map(wp => ({
          location: wp,
          stopover: true
        }));

      const request = {
        origin: startLocation,
        destination: endLocation,
        waypoints: waypointData,
        travelMode: window.google.maps.TravelMode[travelMode],
        unitSystem: window.google.maps.UnitSystem.IMPERIAL
      };

      directionsServiceRef.current.route(request, async (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          routeData.current = result;
          
          const steps = [];
          const route = result.routes[0];
          let cumulativeTime = 0;
          
          // Calculate departure and arrival datetime from user input
          const departureDateTime = new Date(`${departureDate}T${departureTime}`);
          const arrivalDateTime = new Date(`${arrivalDate}T${arrivalTime}`);
          
          // Calculate total route duration and available time
          const totalRouteDuration = route.legs.reduce((total, leg) => total + leg.duration.value, 0);
          const tripDuration = (arrivalDateTime - departureDateTime) / 1000; // seconds
          const timeBuffer = Math.max(0, tripDuration - totalRouteDuration); // Extra time available
          
          // Process route steps and extract major cities
          route.legs.forEach((leg, legIndex) => {
            // Add leg start as a major waypoint
            const legStart = {
              id: `leg-${legIndex}-start`,
              instruction: legIndex === 0 ? `Start your journey from ${leg.start_address}` : `Continue from ${leg.start_address}`,
              distance: '0 mi',
              duration: '0 mins',
              startLocation: {
                lat: leg.start_location.lat(),
                lng: leg.start_location.lng()
              },
              estimatedArrivalTime: new Date(departureDateTime.getTime() + cumulativeTime * 1000),
              legIndex,
              stepIndex: -1,
              isMajorWaypoint: true,
              address: leg.start_address,
              isWaypoint: true
            };
            steps.push(legStart);

            leg.steps.forEach((step, stepIndex) => {
              const stepInfo = {
                id: `${legIndex}-${stepIndex}`,
                instruction: step.instructions.replace(/<[^>]*>/g, ''),
                distance: step.distance.text,
                duration: step.duration.text,
                startLocation: {
                  lat: step.start_location.lat(),
                  lng: step.start_location.lng()
                },
                estimatedArrivalTime: new Date(departureDateTime.getTime() + cumulativeTime * 1000),
                legIndex,
                stepIndex,
                isMajorWaypoint: step.distance.value > 16000 // Mark steps > 10 miles as major
              };
              
              steps.push(stepInfo);
              cumulativeTime += step.duration.value;
            });

            // Add leg end as a major waypoint
            const legEnd = {
              id: `leg-${legIndex}-end`,
              instruction: legIndex === route.legs.length - 1 ? `Arrive at your destination: ${leg.end_address}` : `Waypoint: ${leg.end_address}`,
              distance: leg.distance.text,
              duration: leg.duration.text,
              startLocation: {
                lat: leg.end_location.lat(),
                lng: leg.end_location.lng()
              },
              estimatedArrivalTime: new Date(departureDateTime.getTime() + cumulativeTime * 1000),
              legIndex,
              stepIndex: 999,
              isMajorWaypoint: true,
              address: leg.end_address,
              isWaypoint: true,
              isDestination: legIndex === route.legs.length - 1
            };
            steps.push(legEnd);
          });

          setRouteSteps(steps);

          // Sample points along the route for event discovery
          const samplePoints = sampleRoutePoints(route, searchRadius);
          
          // Fetch events along the route with timing context
          const routeTimingContext = {
            departureDateTime,
            arrivalDateTime,
            totalRouteDuration,
            timeBuffer,
            eventTimeFlexibility: enableEventTimeFilter ? eventTimeFlexibility : 0
          };
          
          const eventsAlongRoute = await fetchEventsAlongRoute(samplePoints, routeTimingContext);
          setRouteEvents(eventsAlongRoute);

          // Pass data back to parent components
          onRouteCalculated?.(result, steps);
          onEventsDiscovered?.(eventsAlongRoute);

        } else {
          console.error('Directions request failed due to ' + status);
          alert('Failed to calculate route. Please check your locations and try again.');
        }
        
        setIsCalculating(false);
      });

    } catch (error) {
      console.error('Error calculating route:', error);
      alert('An error occurred while calculating the route.');
      setIsCalculating(false);
    }
  };

  const clearRoute = () => {
    setRouteSteps([]);
    setRouteEvents([]);
    routeData.current = null;
    onRouteCalculated?.(null, []);
    onEventsDiscovered?.(null);
  };

  const isDark = theme === 'dark';
  const isFrost = theme === 'frost';

  return (
    <div className={`${embedded ? 'p-2 h-full overflow-y-auto' : 'p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-h-96 overflow-y-auto'} ${isFrost && !embedded ? 'bg-opacity-25 backdrop-blur-md' : ''}`}>
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
        
        .dark .slider::-webkit-slider-thumb {
          background: #60a5fa;
        }
        
        .dark .slider::-moz-range-thumb {
          background: #60a5fa;
        }
      `}</style>
      {!embedded && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Navigation className="w-5 h-5" />
            Route Planner
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            <MapPin className="w-4 h-4 inline mr-1" />
            Start Location
          </label>
          <AddressAutocomplete
            value={startLocation}
            onChange={setStartLocation}
            onSelect={(data) => setStartLocation(data.address)}
          />
        </div>

        {waypoints.map((waypoint, index) => (
          <div key={index} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">
                Waypoint {index + 1}
              </label>
              <AddressAutocomplete
                value={waypoint}
                onChange={(value) => updateWaypoint(index, value)}
                onSelect={(data) => updateWaypoint(index, data.address)}
              />
            </div>
            <button
              onClick={() => removeWaypoint(index)}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          onClick={addWaypoint}
          className="w-full py-2 px-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:border-gray-400 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Waypoint
        </button>

        <div>
          <label className="block text-sm font-medium mb-1">
            <Navigation className="w-4 h-4 inline mr-1" />
            End Location
          </label>
          <AddressAutocomplete
            value={endLocation}
            onChange={setEndLocation}
            onSelect={(data) => setEndLocation(data.address)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
              <Calendar className="w-4 h-4 inline mr-1" />
              Departure Date
            </label>
            <input
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
              <Clock className="w-4 h-4 inline mr-1" />
              Departure Time
            </label>
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
              <Calendar className="w-4 h-4 inline mr-1" />
              Arrival Date
            </label>
            <input
              type="date"
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
              <Clock className="w-4 h-4 inline mr-1" />
              Arrival Time
            </label>
            <input
              type="time"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="enableEventTimeFilter"
              checked={enableEventTimeFilter}
              onChange={(e) => setEnableEventTimeFilter(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800"
            />
            <label htmlFor="enableEventTimeFilter" className="text-sm font-medium flex items-center gap-1 text-gray-900 dark:text-gray-100">
              <Calendar className="w-4 h-4" />
              Expand event search window
            </label>
          </div>
          
          {enableEventTimeFilter && (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                Event Time Flexibility: ±{eventTimeFlexibility} day{eventTimeFlexibility !== 1 ? 's' : ''}
              </label>
              <input
                type="range"
                min="1"
                max="7"
                value={eventTimeFlexibility}
                onChange={(e) => setEventTimeFlexibility(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>±1 day</span>
                <span>±7 days</span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Find events {eventTimeFlexibility} day{eventTimeFlexibility !== 1 ? 's' : ''} before/after your trip dates
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
            Event Search Radius: {searchRadius} miles
          </label>
          <input
            type="range"
            min="1"
            max="50"
            value={searchRadius}
            onChange={(e) => setSearchRadius(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={calculateRoute}
            disabled={isCalculating || !startLocation || !endLocation}
            className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isCalculating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Calculating...
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                Plan Route
              </>
            )}
          </button>
          
          {routeSteps.length > 0 && (
            <button
              onClick={clearRoute}
              className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Clear
            </button>
          )}
        </div>

        {routeSteps.length > 0 && routeData.current && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="font-medium mb-2">Route Summary</h4>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div>Distance: {Math.round(routeData.current.routes[0].legs.reduce((total, leg) => 
                total + leg.distance.value, 0) / 1609.34)} miles</div>
              <div>Duration: {Math.round(routeData.current.routes[0].legs.reduce((total, leg) => 
                total + leg.duration.value, 0) / 60)} minutes</div>
              <div>Events discovered: {routeEvents.length}</div>
            </div>
            
            {routeEvents.length > 0 && (
              <div className="mt-3">
                <h5 className="font-medium text-sm mb-2">Top Events Along Route</h5>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {routeEvents.slice(0, 5).map(event => (
                    <div key={event.id} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                      <div className="flex-1 truncate">
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="text-gray-500 dark:text-gray-400">
                          {event.city}, {event.state} • {event.interest_count || 0} interested
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoutePlanner; 