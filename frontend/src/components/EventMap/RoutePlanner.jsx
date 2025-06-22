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
  const [isGoogleMapsLoading, setIsGoogleMapsLoading] = useState(true);
  
  const directionsServiceRef = useRef(null);
  const routeData = useRef(null);

  useEffect(() => {
    const initServices = async () => {
      try {
        console.log('🔍 RoutePlanner initialization check:', {
          hasApiKey: !!apiKey,
          apiKeyType: typeof apiKey,
          apiKeyLength: apiKey?.length,
          apiKeyStart: apiKey?.substring(0, 10) + '...',
          isProduction: process.env.NODE_ENV === 'production'
        });
        
        if (!apiKey) {
          console.warn('❌ No Google Maps API key provided to RoutePlanner');
          setIsGoogleMapsLoading(false);
          return;
        }
        
        if (apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE' || apiKey.length < 10) {
          console.warn('❌ Invalid Google Maps API key provided to RoutePlanner');
          setIsGoogleMapsLoading(false);
          return;
        }
        
        console.log('🔄 Initializing Google Maps services...');
        await initGoogleMaps(apiKey);
        
        // Wait a bit for Google Maps to fully load
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkAndInit = () => {
          attempts++;
          console.log(`🔍 Checking Google Maps readiness (attempt ${attempts}/${maxAttempts})`, {
            isMapsReady: isMapsReady(),
            hasWindowGoogle: !!window.google,
            hasGoogleMaps: !!window.google?.maps,
            hasDirectionsService: !!window.google?.maps?.DirectionsService
          });
          
          if (isMapsReady() && window.google?.maps?.DirectionsService) {
            // Only initialize the DirectionsService, don't set any map
            directionsServiceRef.current = new window.google.maps.DirectionsService();
            console.log('✅ DirectionsService initialized successfully');
            setIsGoogleMapsLoading(false);
            return true;
          } else {
            console.log(`⏳ Google Maps not ready yet (attempt ${attempts}/${maxAttempts})`);
            if (attempts < maxAttempts) {
              setTimeout(checkAndInit, 1000); // Wait 1 second and try again
            } else {
              console.error('❌ Failed to initialize Google Maps after maximum attempts');
              setIsGoogleMapsLoading(false); // Stop showing loading even if failed
            }
            return false;
          }
        };
        
        // Start checking
        checkAndInit();
        
      } catch (error) {
        console.error('❌ Failed to initialize Google Maps services:', error);
        setIsGoogleMapsLoading(false);
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

  // Simplified method to extract notable points from Google Directions response
  const extractRouteEvents = (directionsResult) => {
    const routeEvents = [];
    const route = directionsResult.routes[0];
    
    if (!route || !route.legs) {
      console.log('❌ No route legs found');
      return routeEvents;
    }
    
    console.log('🎯 Extracting notable waypoints from route...');
    
    // Get current date for route waypoints
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().slice(0, 5);
    
    // Extract key points from the route
    route.legs.forEach((leg, legIndex) => {
      // Add start location (major city/landmark)
      if (leg.start_address && leg.start_location) {
        routeEvents.push({
          id: `start-${legIndex}`,
          title: `🚗 ${leg.start_address}`,
          description: `Starting point for route segment ${legIndex + 1}. This is an automatically generated route waypoint to help you navigate your journey.`,
          address: leg.start_address,
          lat: leg.start_location.lat(),
          lng: leg.start_location.lng(),
          category: 'navigation',
          isRouteWaypoint: true,
          waypointType: 'start',
          distance: leg.distance?.text || 'N/A',
          duration: leg.duration?.text || 'N/A',
          city: leg.start_address.split(',')[0],
          state: leg.start_address.split(',')[1]?.trim() || '',
          date: currentDate,
          start_time: currentTime,
          end_time: null,
          end_date: null,
          created_by: 'system',
          host_name: 'Route Planner',
          event_url: null,
          fee_required: null,
          is_verified: false,
          interest_count: 0,
          view_count: 0
        });
      }
      
      // Extract major steps (highways, significant turns)
      leg.steps?.forEach((step, stepIndex) => {
        // Only include major highway changes or significant distance steps
        const instructions = step.instructions?.replace(/<[^>]*>/g, '') || '';
        const isSignificant = 
          step.distance?.value > 50000 || // More than 50km
          instructions.toLowerCase().includes('highway') ||
          instructions.toLowerCase().includes('interstate') ||
          instructions.toLowerCase().includes('freeway') ||
          instructions.toLowerCase().includes('exit');
          
        if (isSignificant && step.start_location) {
          const shortInstruction = instructions.length > 60 
            ? instructions.substring(0, 60) + '...' 
            : instructions;
            
          routeEvents.push({
            id: `step-${legIndex}-${stepIndex}`,
            title: `🛣️ ${shortInstruction}`,
            description: `${instructions}. This is an automatically generated route waypoint marking a significant navigation point along your journey.`,
            address: `Highway waypoint: ${step.start_location.lat().toFixed(4)}, ${step.start_location.lng().toFixed(4)}`,
            lat: step.start_location.lat(),
            lng: step.start_location.lng(),
            category: 'navigation',
            isRouteWaypoint: true,
            waypointType: 'highway',
            distance: step.distance?.text || 'N/A',
            duration: step.duration?.text || 'N/A',
            city: 'Highway Junction',
            state: '',
            date: currentDate,
            start_time: currentTime,
            end_time: null,
            end_date: null,
            created_by: 'system',
            host_name: 'Route Planner',
            event_url: null,
            fee_required: null,
            is_verified: false,
            interest_count: 0,
            view_count: 0
          });
        }
      });
      
      // Add end location (major city/landmark)
      if (leg.end_address && leg.end_location) {
        routeEvents.push({
          id: `end-${legIndex}`,
          title: `🏁 ${leg.end_address}`,
          description: `${legIndex === route.legs.length - 1 ? 'Final destination' : 'Intermediate waypoint'} for your planned route. This is an automatically generated route waypoint.`,
          address: leg.end_address,
          lat: leg.end_location.lat(),
          lng: leg.end_location.lng(),
          category: 'navigation',
          isRouteWaypoint: true,
          waypointType: legIndex === route.legs.length - 1 ? 'destination' : 'waypoint',
          distance: leg.distance?.text || 'N/A',
          duration: leg.duration?.text || 'N/A',
          city: leg.end_address.split(',')[0],
          state: leg.end_address.split(',')[1]?.trim() || '',
          date: currentDate,
          start_time: currentTime,
          end_time: null,
          end_date: null,
          created_by: 'system',
          host_name: 'Route Planner',
          event_url: null,
          fee_required: null,
          is_verified: false,
          interest_count: 0,
          view_count: 0
        });
      }
    });
    
    console.log(`✅ Extracted ${routeEvents.length} route waypoints`);
    return routeEvents;
  };

  // Simplified and reliable method to fetch events along route
  const fetchEventsAlongRoute = async (samplePoints, timingContext = null) => {
    if (!samplePoints || samplePoints.length === 0) {
      console.log('❌ No sample points provided for event search');
      return [];
    }

    console.log(`🎯 Searching for events along ${samplePoints.length} route points...`);
    
    try {
      // Build the API URL for route events
      const API_URL = import.meta.env.VITE_API_URL || 'https://todoevents-backend.onrender.com';
      
      // Prepare the request payload for the backend
      const requestPayload = {
        coordinates: samplePoints.map(point => ({
          lat: point.lat,
          lng: point.lng
        })),
        radius: searchRadius
      };
      
      // Add timing context if provided
      if (timingContext && enableEventTimeFilter) {
        const flexibility = eventTimeFlexibility;
        const startDate = new Date(timingContext.departureDate);
        const endDate = new Date(timingContext.arrivalDate);
        
        // Extend search window based on flexibility
        startDate.setDate(startDate.getDate() - flexibility);
        endDate.setDate(endDate.getDate() + flexibility);
        
        requestPayload.dateRange = {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        };
      }
      
      const searchUrl = `${API_URL}/events/route-batch`;
      console.log('🔍 Event search URL:', searchUrl);
      console.log('📦 Request payload:', requestPayload);
      
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        timeout: 45000 // 45 second timeout for route searches
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const events = await response.json();
      
      console.log(`✅ Found ${events.length} events along route`);
      
      // Add route context to events
      const eventsWithRouteContext = events.map(event => ({
        ...event,
        isRouteEvent: true,
        routeContext: 'Found along your planned route'
      }));
      
      return eventsWithRouteContext;
      
    } catch (error) {
      console.error('❌ Error fetching events along route:', error);
      // Don't fail the entire route calculation if event search fails
      return [];
    }
  };

  const calculateRoute = async () => {
    // Debug the current values
    console.log('🎯 Route calculation attempt:', {
      startLocation: startLocation,
      endLocation: endLocation,
      startLocationEmpty: !startLocation || startLocation.trim() === '',
      endLocationEmpty: !endLocation || endLocation.trim() === '',
      directionsServiceReady: !!directionsServiceRef.current
    });
    
    if (!startLocation || startLocation.trim() === '' || !endLocation || endLocation.trim() === '') {
      alert('Please enter both start and end locations');
      return;
    }
    
    // If DirectionsService isn't ready, try to initialize it
    if (!directionsServiceRef.current) {
      console.log('🔄 DirectionsService not ready, attempting to initialize...');
      
      if (isMapsReady() && window.google?.maps?.DirectionsService) {
        try {
          directionsServiceRef.current = new window.google.maps.DirectionsService();
          console.log('✅ DirectionsService initialized on demand');
        } catch (error) {
          console.error('❌ Failed to initialize DirectionsService on demand:', error);
          alert('Google Maps service not ready. Please wait a moment and try again.');
          return;
        }
      } else {
        alert('Google Maps is still loading. Please wait a moment and try again.');
        return;
      }
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

      console.log('📍 Route request:', request);

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

          // Extract route waypoints from Google Directions response
          const routeWaypoints = extractRouteEvents(result);
          
          // Sample points along the route for event discovery
          const samplePoints = sampleRoutePoints(route, searchRadius);
          console.log(`🎯 Sampling ${samplePoints.length} points along route for event search`);
          
          // Search for actual events along the route
          const timingContext = {
            departureDate,
            arrivalDate,
            departureTime,
            arrivalTime
          };
          
          const actualEvents = await fetchEventsAlongRoute(samplePoints, timingContext);
          
          // Combine route waypoints with actual events
          const combinedEvents = [
            ...routeWaypoints,
            ...actualEvents
          ];
          
          console.log(`✅ Combined results: ${routeWaypoints.length} waypoints + ${actualEvents.length} events = ${combinedEvents.length} total`);
          
          setRouteEvents(combinedEvents);

          // Pass data back to parent components
          onRouteCalculated?.(result, steps);
          onEventsDiscovered?.(combinedEvents);

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
            disabled={isCalculating || !startLocation || !endLocation || isGoogleMapsLoading}
            className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isCalculating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Calculating...
              </>
            ) : isGoogleMapsLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Loading Maps...
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
              <div>Route waypoints: {routeEvents.filter(e => e.isRouteWaypoint).length}</div>
              <div>Events discovered: {routeEvents.filter(e => !e.isRouteWaypoint).length}</div>
              <div>Total items: {routeEvents.length}</div>
            </div>
            
            {routeEvents.length > 0 && (
              <div className="mt-3">
                <h5 className="font-medium text-sm mb-2">Route Items</h5>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {routeEvents.slice(0, 8).map(item => (
                    <div 
                      key={item.id} 
                      className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded"
                      onClick={() => onEventsDiscovered && onEventsDiscovered([item])}
                      title="Click to view on map"
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.isRouteWaypoint ? (
                          item.waypointType === 'start' ? 'bg-green-500' :
                          item.waypointType === 'destination' ? 'bg-red-500' :
                          'bg-blue-500'
                        ) : 'bg-purple-500'
                      }`}></div>
                      <div className="flex-1 truncate">
                        <div className="font-medium truncate">
                          {item.isRouteWaypoint ? '🗺️' : '🎉'} {item.title}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 truncate">
                          {item.isRouteWaypoint 
                            ? (item.waypointType === 'highway' ? item.description : item.address)
                            : `${item.city || 'Event'} • ${item.category || 'other'}`
                          }
                        </div>
                      </div>
                    </div>
                  ))}
                  {routeEvents.length > 8 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      +{routeEvents.length - 8} more items
                    </div>
                  )}
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