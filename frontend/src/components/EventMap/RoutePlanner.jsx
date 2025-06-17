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
  theme = 'light'
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

  // Sample points along the route for event discovery (optimized for batch API)
  const sampleRoutePoints = (route, sampleDistance = 15000) => {
    const points = [];
    const legs = route.legs;
    
    // Always include start and end points
    if (legs.length > 0) {
      // Add route start point
      points.push({
        lat: legs[0].start_location.lat(),
        lng: legs[0].start_location.lng(),
        legIndex: 0,
        stepIndex: -1,
        stepStart: true,
        isWaypoint: true
      });
    }
    
    for (let legIndex = 0; legIndex < legs.length; legIndex++) {
      const leg = legs[legIndex];
      const steps = leg.steps;
      
      // Add waypoint at the end of each leg (except the last one, handled separately)
      if (legIndex < legs.length - 1) {
        points.push({
          lat: leg.end_location.lat(),
          lng: leg.end_location.lng(),
          legIndex,
          stepIndex: 999,
          stepStart: false,
          isWaypoint: true
        });
      }
      
      // Sample points along major steps only (to reduce API calls)
      for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
        const step = steps[stepIndex];
        
        // Only sample from longer steps (> 10 miles) to reduce coordinate count
        if (step.distance.value > 16000) {
          const path = step.path || step.overview_path;
          
          if (!path || path.length === 0) continue;
          
          // Sample fewer points along the step path for efficiency
          let accumulatedDistance = 0;
          for (let i = 1; i < path.length; i++) {
            const prev = path[i - 1];
            const curr = path[i];
            
            // Calculate distance between consecutive points using Haversine formula
            const lat1 = prev.lat() * Math.PI / 180;
            const lat2 = curr.lat() * Math.PI / 180;
            const deltaLat = (curr.lat() - prev.lat()) * Math.PI / 180;
            const deltaLng = (curr.lng() - prev.lng()) * Math.PI / 180;
            
            const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                      Math.cos(lat1) * Math.cos(lat2) *
                      Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const segmentDistance = 6371000 * c; // Earth radius in meters
            
            accumulatedDistance += segmentDistance;
            
            // Add sample point every sampleDistance meters (increased from 8km to 15km)
            if (accumulatedDistance >= sampleDistance) {
              points.push({
                lat: curr.lat(),
                lng: curr.lng(),
                legIndex,
                stepIndex,
                stepStart: false
              });
              accumulatedDistance = 0;
            }
          }
        }
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
        isDestination: true
      });
    }
    
    // Limit total points to prevent API overload
    const maxPoints = 30;
    if (points.length > maxPoints) {
      console.log(`🔄 Reducing route sample points from ${points.length} to ${maxPoints} for efficiency`);
      
      // Keep waypoints and distribute remaining points evenly
      const waypoints = points.filter(p => p.isWaypoint);
      const nonWaypoints = points.filter(p => !p.isWaypoint);
      
      const remainingSlots = maxPoints - waypoints.length;
      const step = Math.max(1, Math.floor(nonWaypoints.length / remainingSlots));
      const sampledNonWaypoints = nonWaypoints.filter((_, index) => index % step === 0);
      
      return [...waypoints, ...sampledNonWaypoints.slice(0, remainingSlots)];
    }
    
    return points;
  };

  // Fetch events along the route using efficient batch endpoint
  const fetchEventsAlongRoute = async (samplePoints) => {
    try {
      // Convert sample points to coordinate format for batch API
      const coordinates = samplePoints.map(point => ({
        lat: point.lat,
        lng: point.lng
      }));

      // Use the new batch endpoint for efficient event retrieval
      const response = await fetchWithTimeout(`${API_URL}/events/route-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: coordinates,
          radius: searchRadius
        })
      }, 15000); // Increased timeout for batch request

      if (!response.ok) {
        throw new Error(`Batch API request failed: ${response.status}`);
      }

      const events = await response.json();
      
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
      return await fetchEventsAlongRouteFallback(samplePoints);
    }
  };

  // Fallback method using individual requests (kept for reliability)
  const fetchEventsAlongRouteFallback = async (samplePoints) => {
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
          
          // Calculate departure datetime from user input
          const departureDateTime = new Date(`${departureDate}T${departureTime}`);
          
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
          const samplePoints = sampleRoutePoints(route);
          
          // Fetch events along the route
          const eventsAlongRoute = await fetchEventsAlongRoute(samplePoints);
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
    <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-h-96 overflow-y-auto ${isFrost ? 'bg-opacity-25 backdrop-blur-md' : ''}`}>
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
            <label className="block text-sm font-medium mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Departure Date
            </label>
            <input
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              <Clock className="w-4 h-4 inline mr-1" />
              Departure Time
            </label>
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Event Search Radius: {searchRadius} miles
          </label>
          <input
            type="range"
            min="1"
            max="50"
            value={searchRadius}
            onChange={(e) => setSearchRadius(parseInt(e.target.value))}
            className="w-full"
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