import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Clock, Calendar, AlertCircle, MapPin, Star, Crown, Repeat, Sparkles, AlertTriangle, Building2, Image, Upload } from 'lucide-react';
import { EventLoadingAnimation, SuccessAnimation, AnimatedModalWrapper } from '../ui/loading-animations';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/radix-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import categories from './categoryConfig';
import { AuthContext } from './AuthContext';
import AddressAutocomplete from './AddressAutocomplete';
import PrivacyNotice from '../PrivacyNotice';
import ImageUpload from '../ImageUpload';
import { API_URL } from '@/config';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

const CreateEventForm = ({
  isOpen,
  onClose,
  onSubmit,
  selectedLocation,
  onLocationSelect,
  initialEvent = null
}) => {
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [isSameDay, setIsSameDay] = useState(true);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [premiumFeatures, setPremiumFeatures] = useState({});
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [loadingPremiumStatus, setLoadingPremiumStatus] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [imageUploadType, setImageUploadType] = useState('banner'); // 'banner' or 'logo'
  const [bannerImage, setBannerImage] = useState(null);
  const [logoImage, setLogoImage] = useState(null);
  
  // For new events - temporary file storage
  const [pendingBannerFile, setPendingBannerFile] = useState(null);
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    start_time: '',
    end_time: '',
    end_date: '',
    category: 'community',
    secondary_category: '',
    address: '',
    location: null,
    recurring: false,
    frequency: '',
    is_premium_event: false,
    // New UX enhancement fields
    fee_required: '',
    event_url: '',
    host_name: '',
    // Enterprise fields
    client_name: ''
  });

  // Reset form when initialEvent changes
  useEffect(() => {
    if (isOpen) {
      if (initialEvent && typeof initialEvent === 'object') {

        setFormData({
          title: initialEvent.title || '',
          description: initialEvent.description || '',
          date: initialEvent.date || '',
          start_time: initialEvent.start_time || '',
          end_time: initialEvent.end_time || '',
          end_date: initialEvent.end_date || '',
          category: initialEvent.category || '',
          secondary_category: initialEvent.secondary_category || '',
          address: initialEvent.address || '',
          location: initialEvent.lat != null && initialEvent.lng != null ? {
            lat: initialEvent.lat,
            lng: initialEvent.lng,
            address: initialEvent.address
          } : null,
          recurring: initialEvent.recurring || false,
          frequency: initialEvent.frequency || '',
          // New UX enhancement fields
          fee_required: initialEvent.fee_required || '',
          event_url: initialEvent.event_url || '',
          host_name: initialEvent.host_name || '',
          is_premium_event: initialEvent.is_premium_event || false,
          // Enterprise fields
          client_name: initialEvent.client_name || ''
        });
        setError(null);
        setConnectionError(false);
        setIsSameDay(!initialEvent.end_date || initialEvent.end_date === initialEvent.date);
        setBannerImage(initialEvent.banner_image || null);
        setLogoImage(initialEvent.logo_image || null);
        // Clear previews for existing events
        setBannerPreview(null);
        setLogoPreview(null);
        setPendingBannerFile(null);
        setPendingLogoFile(null);
      } else {
        // Reset to default values when no initialEvent or initialEvent is null
        setFormData({
          title: '',
          description: '',
          date: '',
          start_time: '',
          end_time: '',
          end_date: '',
          category: '',
          secondary_category: '',
          address: '',
          location: null,
          recurring: false,
          frequency: '',
          // New UX enhancement fields
          fee_required: '',
          event_url: '',
          host_name: '',
          is_premium_event: false,
          // Enterprise fields
          client_name: ''
        });
        setError(null);
        setConnectionError(false);
        setIsSameDay(true);
        setBannerImage(null);
        setLogoImage(null);
        // Clear previews for new events
        setBannerPreview(null);
        setLogoPreview(null);
        setPendingBannerFile(null);
        setPendingLogoFile(null);
      }
    }
  }, [isOpen, initialEvent]);

  // Check premium status when user changes
  useEffect(() => {
    const checkPremiumStatus = async () => {
      if (!user || !token) {
        setIsPremiumUser(false);
        setPremiumFeatures({});
        setPremiumStatus(null);
        setLoadingPremiumStatus(false);
        return;
      }

      try {
        setLoadingPremiumStatus(true);
        const response = await fetchWithTimeout(`${API_URL}/users/premium-status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }, 10000);

        setIsPremiumUser(response.is_premium || response.is_enterprise);
        setPremiumFeatures(response.features || {});
        
        // Use backend values directly, only add fallbacks for missing fields
        const enhancedData = {
          ...response,
          // Only add fallbacks if the backend didn't provide values
          event_limit: response.event_limit !== undefined ? response.event_limit : (response.is_premium ? 10 : 0),
          current_month_events: response.current_month_events !== undefined ? response.current_month_events : 0,
          events_remaining: response.events_remaining !== undefined ? response.events_remaining : null,
          can_create_events: response.can_create_events !== undefined ? response.can_create_events : true,
          features: response.features || {
            verified_events: response.is_premium || response.is_enterprise,
            analytics: response.is_premium || response.is_enterprise,
            recurring_events: response.is_premium || response.is_enterprise,
            priority_support: response.is_premium || response.is_enterprise,
            enhanced_visibility: response.is_premium || response.is_enterprise
          }
        };
        
        setPremiumStatus(enhancedData);
      } catch (error) {
        console.error('Error checking premium status:', error);
        setIsPremiumUser(false);
        setPremiumFeatures({});
        setPremiumStatus(null);
      } finally {
        setLoadingPremiumStatus(false);
      }
    };

    if (isOpen) {
      checkPremiumStatus();
    }
  }, [user, token, isOpen]);

  // Update location when selected
  useEffect(() => {
    if (selectedLocation) {
      setFormData(prev => ({
        ...prev,
        location: selectedLocation,
        address: selectedLocation.address || prev.address
      }));
      setError(null);
    }
  }, [selectedLocation]);

  // Handle address input changes
  const handleAddressChange = (newAddress) => {
    setFormData(prev => ({
      ...prev,
      address: newAddress
    }));
  };

  // Health check with reduced frequency
  useEffect(() => {
    if (!isOpen) return;

    const checkConnection = async () => {
      try {
        const response = await fetch(`${API_URL}/health`);
        if (!response.ok) throw new Error('Server health check failed');
        setConnectionError(false);
      } catch (err) {
        setConnectionError(true);
        console.error('Server connection error:', err);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 60000); // Reduced to once per minute
    return () => clearInterval(interval);
  }, [isOpen]);

  // Cleanup preview URLs when component unmounts or previews change
  useEffect(() => {
    return () => {
      if (bannerPreview) {
        URL.revokeObjectURL(bannerPreview);
      }
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [bannerPreview, logoPreview]);

  const handleAddressSelect = (data) => {
    console.log('Address selected:', data);
    
    // AddressAutocomplete returns { address, lat, lng } directly
    const location = { lat: data.lat, lng: data.lng };
    
    setFormData(prev => ({
      ...prev,
      address: data.address,
      location: location
    }));
    
    // Also call the parent callback if provided
    onLocationSelect?.(location);
  };

  const handleClearLocation = () => {
    setFormData(prev => ({
      ...prev,
      location: null,
      address: ''
    }));
    onLocationSelect?.(null);
  };

  const handleSameDayChange = (checked) => {
    setIsSameDay(checked);
    if (checked) {
      setFormData(prev => ({
        ...prev,
        end_date: ''
      }));
    }
  };

  // Function to calculate end time automatically (2 hours after start time)
  const calculateEndTime = (startTime) => {
    if (!startTime) return '';
    
    try {
      const [hours, minutes] = startTime.split(':').map(Number);
      const endHours = (hours + 2) % 24; // Handle day rollover
      return `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } catch (error) {
      console.error('Error calculating end time:', error);
      return '';
    }
  };

  const handleStartTimeChange = (newStartTime) => {
    setFormData(prev => {
      const newEndTime = calculateEndTime(newStartTime);
      return {
        ...prev,
        start_time: newStartTime,
        // Only auto-set end time if it's currently empty or if we're updating from an empty start time
        end_time: !prev.end_time || !prev.start_time ? newEndTime : prev.end_time
      };
    });
  };

  const handleImageUpload = (type) => {
    if (initialEvent && initialEvent.id) {
      // For existing events, use the modal upload
      setImageUploadType(type);
      setShowImageUpload(true);
    } else {
      // For new events, trigger file selection
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/jpg,image/png';
      input.onchange = (e) => handleFileSelect(e, type);
      input.click();
    }
  };

  const handleFileSelect = (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a JPG or PNG image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file must be smaller than 5MB');
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);

    if (type === 'banner') {
      // Clean up old preview
      if (bannerPreview) {
        URL.revokeObjectURL(bannerPreview);
      }
      setPendingBannerFile(file);
      setBannerPreview(previewUrl);
    } else {
      // Clean up old preview
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
      }
      setPendingLogoFile(file);
      setLogoPreview(previewUrl);
    }

    setError(null);
  };

  const handleImageUpdate = (filename) => {
    if (imageUploadType === 'banner') {
      setBannerImage(filename);
    } else {
      setLogoImage(filename);
    }
  };

  const uploadPendingImages = async (eventId) => {
    const uploadPromises = [];

    if (pendingBannerFile) {
      console.log('Preparing to upload banner image:', pendingBannerFile.name, pendingBannerFile.size, 'bytes');
      const bannerFormData = new FormData();
      bannerFormData.append('file', pendingBannerFile);
      
      uploadPromises.push(
        fetchWithTimeout(`${API_URL}/events/${eventId}/upload-banner`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: bannerFormData
        }, 15000).then(response => {
          console.log('Banner upload response:', response);
          return response;
        }).catch(error => {
          console.error('Banner upload failed:', error);
          throw new Error(`Banner upload failed: ${error.message}`);
        })
      );
    }

    if (pendingLogoFile) {
      console.log('Preparing to upload logo image:', pendingLogoFile.name, pendingLogoFile.size, 'bytes');
      const logoFormData = new FormData();
      logoFormData.append('file', pendingLogoFile);
      
      uploadPromises.push(
        fetchWithTimeout(`${API_URL}/events/${eventId}/upload-logo`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: logoFormData
        }, 15000).then(response => {
          console.log('Logo upload response:', response);
          return response;
        }).catch(error => {
          console.error('Logo upload failed:', error);
          throw new Error(`Logo upload failed: ${error.message}`);
        })
      );
    }

    if (uploadPromises.length > 0) {
      try {
        console.log(`Starting upload of ${uploadPromises.length} images for event ${eventId}`);
        const results = await Promise.all(uploadPromises);
        console.log('All images uploaded successfully:', results);
        
        // Show success message for image uploads
        if (results.length > 0) {
          console.log('✅ Images uploaded and attached to event successfully');
        }
      } catch (error) {
        console.error('Error uploading images:', error);
        // Still show the error to user but don't prevent event creation success
        setError(`Event created successfully, but image upload failed: ${error.message}. You can add images later by editing the event.`);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      handleFileSelect({ target: { files: [file] } }, type);
    }
  };

  // Function to validate if address has street-level detail
  const isStreetLevelAddress = (address) => {
    if (!address || typeof address !== 'string') return false;
    
    const trimmedAddress = address.trim().toLowerCase();
    
    // Check for common street indicators (numbers followed by street names)
    const streetPatterns = [
      /^\d+\s+.*(street|st|avenue|ave|boulevard|blvd|road|rd|drive|dr|lane|ln|way|court|ct|circle|cir|place|pl|parkway|pkwy|terrace|ter)/i,
      /^\d+\s+\w+.*\w+/i, // At least number + 2 words (like "123 Main Street")
    ];
    
    // Check for any of the street patterns
    const hasStreetPattern = streetPatterns.some(pattern => pattern.test(trimmedAddress));
    
    // Check that it's not just a city/state (common patterns to avoid)
    const cityOnlyPatterns = [
      /^[a-z\s]+,\s*[a-z]{2}$/i, // "City, ST" format
      /^[a-z\s]+,\s*[a-z\s]+,\s*usa?$/i, // "City, State, US" format
      /^[a-z\s]+\s+county/i, // County names
      /^[a-z\s]+,\s*united states$/i, // "City, United States"
    ];
    
    const isCityOnly = cityOnlyPatterns.some(pattern => pattern.test(trimmedAddress));
    
    // Must have street patterns and not be city-only
    return hasStreetPattern && !isCityOnly;
  };

  const validateForm = () => {
    const now = new Date();
    const selectedDate = new Date(formData.date + 'T' + formData.start_time);

    if (!formData.title.trim()) {
      setError('Please enter an event title');
      return false;
    }
    if (!formData.description.trim()) {
      setError('Please enter an event description');
      return false;
    }
    if (!formData.date) {
      setError('Please select an event date');
      return false;
    }
    if (!formData.start_time) {
      setError('Please select an event start time');
      return false;
    }
    if (!formData.end_time) {
      setError('Please select an event end time');
      return false;
    }
    // Validate end_time is after start_time (if same day)
    if (isSameDay && formData.start_time && formData.end_time) {
      const startTime = new Date(`2000-01-01T${formData.start_time}`);
      const endTime = new Date(`2000-01-01T${formData.end_time}`);
      if (endTime <= startTime) {
        setError('End time must be after start time');
        return false;
      }
    }
    if (selectedDate < now) {
      setError('Event cannot be scheduled in the past');
      return false;
    }
    if (!formData.category) {
      setError('Please select a category');
      return false;
    }
    if (!formData.location) {
      setError('Please select a location for the event');
      return false;
    }
    // Validate address has street-level detail
    if (!isStreetLevelAddress(formData.address)) {
      setError('Please provide a specific street address (e.g., "123 Main Street, City, State") rather than just a city name. This helps attendees find the exact location.');
      return false;
    }
    if (formData.end_date && new Date(formData.end_date) <= selectedDate) {
      setError('End date must be after the event start date');
      return false;
    }
    
    // Premium feature validation
    if (formData.recurring && !isPremiumUser) {
      setError('Recurring events are a premium feature. Please upgrade to create recurring events.');
      return false;
    }
    
    if (formData.recurring && (!formData.frequency || formData.frequency === '')) {
      setError('Please select a frequency for recurring events');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Prevent double submission with multiple checks
    if (isSubmitting) {
      console.log('Form already submitting, ignoring duplicate submission');
      return;
    }

    if (!user) {
      setError('You must be logged in to create events');
      return;
    }

    if (!validateForm()) {
      return;
    }

    // Set submitting state immediately to prevent double clicks
    setIsSubmitting(true);

    try {
      if (connectionError) {
        throw new Error('Unable to connect to server. Please try again later.');
      }

      const eventData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        end_date: isSameDay ? null : (formData.end_date || null),
        category: formData.category,
        address: formData.address.trim(),
        lat: formData.location.lat,
        lng: formData.location.lng,
        recurring: formData.recurring,
        frequency: formData.frequency,
        // New UX enhancement fields
        fee_required: formData.fee_required.trim() || null,
        event_url: formData.event_url.trim() || null,
        host_name: formData.host_name.trim() || null,
        is_premium_event: formData.is_premium_event,
        // Enterprise fields
        client_name: formData.client_name.trim() || null
      };

      const url = initialEvent
        ? `${API_URL}/events/${initialEvent.id}`
        : `${API_URL}/events`;
      const method = initialEvent ? 'PUT' : 'POST';

      console.log('Submitting event data:', eventData);
      console.log('Request URL:', url);
      console.log('Request method:', method);
      console.log('Form data before submission:', formData);
      console.log('UX Enhancement fields:', {
        fee_required: formData.fee_required,
        event_url: formData.event_url,
        host_name: formData.host_name
      });

      // Use our fetchWithTimeout utility with improved error handling
      const savedEvent = await fetchWithTimeout(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(eventData)
      }, 20000); // 20 second timeout for event creation

      console.log('Event saved successfully:', savedEvent);

      // For new events, upload pending images
      if (!initialEvent && savedEvent.id) {
        await uploadPendingImages(savedEvent.id);
      }

      // Show success animation before closing
      setShowSuccessAnimation(true);
      
      // Wait for animation, then handle completion
      setTimeout(() => {
        // Pass the saved event back to parent for any additional processing
        // BUT DON'T make another API call - this was causing the duplication
        if (onSubmit) {
          onSubmit(savedEvent, true); // true = skip API call, form already made it
        }
        
        // Close the form only after successful submission
        onClose();
        setShowSuccessAnimation(false);
        
        // Navigate to the created event's URL only for new events (not edits)
        if (!initialEvent && savedEvent.slug) {
          // Navigate to the event page using the slug
          navigate(`/e/${savedEvent.slug}`);
          // Also refresh the page to ensure the event appears
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }
      }, 2000); // 2 second success animation
    } catch (error) {
      console.error('Error saving event:', error);
      
      // Check for specific duplicate error
      if (error.message && error.message.includes('409')) {
        setError('This event already exists. Please check for duplicates or modify the details.');
      } else if (error.message && error.message.includes('already exists')) {
        setError('An event with these details already exists at this location and time.');
      } else {
        setError(error.message || 'Failed to save event. Please try again.');
      }
    } finally {
      // Always reset submitting state
      setIsSubmitting(false);
    }
  };

  // Show loading animation during submission
  if (isSubmitting) {
    return (
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent className="dialog-themed max-w-md w-full border-0 bg-transparent shadow-none">
          <EventLoadingAnimation 
            type={initialEvent ? 'saving' : 'creating'} 
            title={formData.title}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Show success animation
  if (showSuccessAnimation) {
    return (
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent className="dialog-themed max-w-lg w-full border-0 bg-transparent shadow-none">
          <SuccessAnimation 
            message={initialEvent ? 'Event updated successfully!' : 'Event created successfully!'}
            showSocialSharing={!initialEvent} // Only show for new events, not edits
            eventTitle={formData.title}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="dialog-themed max-w-[95vw] sm:max-w-[90vw] lg:max-w-[1200px] w-full max-h-[95vh] overflow-y-auto bg-gradient-to-br from-themed-surface via-themed-surface to-themed-surface-hover border-2 border-themed shadow-2xl"
        aria-describedby="create-event-dialog-description"
      >
        <AnimatedModalWrapper isOpen={isOpen}>
          <DialogHeader className="relative pb-6 border-b border-themed/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-spark-yellow to-pin-blue rounded-full flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-display font-bold dialog-title-themed">
            {initialEvent ? 'Edit Event' : 'Create New Event'}
          </DialogTitle>
              <DialogDescription id="create-event-dialog-description" className="dialog-description-themed text-sm mt-1">
            {initialEvent ? 'Edit an existing event with details' : 'Create a new event with details'}
          </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8 px-1 py-2">
          {(error || connectionError) && (
            <div className="p-4 bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/50 rounded-xl text-red-200 flex items-start gap-3 shadow-lg">
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Error</h4>
              <span className="text-sm">{connectionError ? 'Unable to connect to server. Please try again later.' : error}</span>
              </div>
            </div>
          )}

          {/* Event Info Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-themed/30">
              <div className="w-8 h-8 bg-gradient-to-br from-pin-blue/20 to-pin-blue/10 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-pin-blue" />
              </div>
              <h3 className="text-lg font-semibold text-themed-primary">Event Information</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Event Title */}
              <div className="sm:col-span-2 lg:col-span-1 space-y-3">
                <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                  <div className="w-2 h-2 bg-spark-yellow rounded-full"></div>
                  Event Title
                </label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter event title"
                  className="input-themed h-12 text-base font-medium border-2 focus:border-pin-blue/50 focus:ring-2 focus:ring-pin-blue/20 transition-all duration-200"
              />
            </div>

              {/* Primary Category */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                  <div className="w-2 h-2 bg-vibrant-magenta rounded-full"></div>
                  Primary Category
                </label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                  <SelectTrigger className="input-themed h-12 border-2 focus:border-pin-blue/50 transition-all duration-200">
                    <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                  <SelectContent className="bg-themed-surface border-themed shadow-xl">
                  {categories.filter(cat => cat.id !== 'all').map(category => (
                      <SelectItem key={category.id} value={category.id} className="hover:bg-themed-surface-hover">
                        <div className="flex items-center gap-3 py-1">
                        {React.createElement(category.icon, {
                            className: `w-5 h-5 ${category.color}`
                        })}
                          <span className="font-medium">{category.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

              {/* Secondary Category */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                  <div className="w-2 h-2 bg-fresh-teal rounded-full"></div>
                  Secondary Category
                </label>
              <div className="relative">
                <Select 
                  value={formData.secondary_category || "none"} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, secondary_category: value === "none" ? "" : value }))}
                >
                    <SelectTrigger className="input-themed h-12 border-2 focus:border-pin-blue/50 transition-all duration-200">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                    <SelectContent className="bg-themed-surface border-themed shadow-xl">
                      <SelectItem value="none" className="hover:bg-themed-surface-hover">
                        <span className="text-themed-muted font-medium">None</span>
                    </SelectItem>
                    {categories.filter(cat => cat.id !== 'all' && cat.id !== formData.category).map(category => (
                        <SelectItem key={category.id} value={category.id} className="hover:bg-themed-surface-hover">
                          <div className="flex items-center gap-3 py-1">
                          {React.createElement(category.icon, {
                              className: `w-5 h-5 ${category.color}`
                          })}
                            <span className="font-medium">{category.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                  <span className="absolute -top-2 right-3 text-xs font-medium text-themed-muted bg-themed-surface px-2 py-0.5 rounded-full border border-themed/30">
                  Optional
                </span>
              </div>
            </div>
          </div>

            {/* Description */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                <div className="w-2 h-2 bg-pin-blue rounded-full"></div>
                Description
              </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter event description"
                className="w-full px-4 py-3 rounded-xl input-themed resize-none border-2 focus:border-pin-blue/50 focus:ring-2 focus:ring-pin-blue/20 transition-all duration-200 text-base"
                rows="4"
            />
            </div>
          </div>



          {/* Schedule Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-themed/30">
              <div className="w-8 h-8 bg-gradient-to-br from-fresh-teal/20 to-fresh-teal/10 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-fresh-teal" />
              </div>
              <h3 className="text-lg font-semibold text-themed-primary">Schedule</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-fresh-teal" />
                  Start Date
                </label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="input-themed h-12 border-2 focus:border-pin-blue/50 transition-all duration-200"
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                  <Clock className="w-4 h-4 text-fresh-teal" />
                  Start Time
                </label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="input-themed h-12 border-2 focus:border-pin-blue/50 transition-all duration-200"
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-fresh-teal" />
                  End Date
                  {isSameDay && <span className="text-xs bg-themed-surface px-2 py-0.5 rounded-full border border-themed/30">Auto</span>}
                </label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  className="input-themed h-12 border-2 focus:border-pin-blue/50 transition-all duration-200"
                    disabled={isSameDay}
                  required
                  />
                </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                  <Clock className="w-4 h-4 text-fresh-teal" />
                  End Time
                </label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  className="input-themed h-12 border-2 focus:border-pin-blue/50 transition-all duration-200"
                  required
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-themed-surface to-themed-surface-hover rounded-xl border border-themed/30">
              <input
                type="checkbox"
                id="sameDay"
                checked={isSameDay}
                onChange={(e) => handleSameDayChange(e.target.checked)}
                className="w-5 h-5 rounded-md border-2 border-themed bg-themed-surface text-spark-yellow focus:ring-spark-yellow/50 transition-all duration-200"
              />
              <label htmlFor="sameDay" className="text-sm font-medium text-themed-secondary flex items-center gap-2">
                <div className="w-2 h-2 bg-spark-yellow rounded-full"></div>
                Single day event (end date same as start date)
              </label>
            </div>
          </div>

          {/* Additional Details Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-themed/30">
              <div className="w-8 h-8 bg-gradient-to-br from-fresh-teal/20 to-fresh-teal/10 rounded-lg flex items-center justify-center">
                <Plus className="w-4 h-4 text-fresh-teal" />
              </div>
              <h3 className="text-lg font-semibold text-themed-primary">Additional Details</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                  <div className="w-2 h-2 bg-pin-blue rounded-full"></div>
                  Host/Organization
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={formData.host_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, host_name: e.target.value }))}
                    placeholder="e.g., Local Restaurant"
                    className="input-themed h-12 border-2 focus:border-pin-blue/50 transition-all duration-200"
                  />
                  <span className="absolute -top-2 right-3 text-xs font-medium text-themed-muted bg-themed-surface px-2 py-0.5 rounded-full border border-themed/30">
                    Optional
                  </span>
                </div>
              </div>

              {/* Client Name field for Enterprise users */}
              {user && (user.role === 'enterprise' || user.role === 'admin') && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Client/Brand Name
                    {user.role === 'enterprise' && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-full">
                        <Building2 className="w-3 h-3 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">Enterprise</span>
                      </div>
                    )}
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={formData.client_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                      placeholder="e.g., Acme Corporation, TechStart Inc"
                      className="input-themed h-12 border-2 focus:border-blue-500/50 transition-all duration-200"
                    />
                    <span className="absolute -top-2 right-3 text-xs font-medium text-themed-muted bg-themed-surface px-2 py-0.5 rounded-full border border-themed/30">
                      Optional
                    </span>
                  </div>
                  <p className="text-xs text-themed-muted">Associate this event with a specific client or brand for enterprise tracking.</p>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                  <div className="w-2 h-2 bg-vibrant-magenta rounded-full"></div>
                  Ticket Price/Entry Fee
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={formData.fee_required}
                    onChange={(e) => setFormData(prev => ({ ...prev, fee_required: e.target.value }))}
                    placeholder="e.g., $10, $25, $5-$15"
                    className="input-themed h-12 border-2 focus:border-pin-blue/50 transition-all duration-200"
                  />
                  <span className="absolute -top-2 right-3 text-xs font-medium text-themed-muted bg-themed-surface px-2 py-0.5 rounded-full border border-themed/30">
                    Optional
                  </span>
                </div>
                <p className="text-xs text-themed-muted">Leave empty for free events. Only enter price if tickets are required.</p>
              </div>

              <div className="sm:col-span-2 lg:col-span-1 space-y-3">
                <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                  <div className="w-2 h-2 bg-vibrant-magenta rounded-full"></div>
                  Event Website
                </label>
                <div className="relative">
                  <Input
                    type="url"
                    value={formData.event_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, event_url: e.target.value }))}
                    placeholder="https://example.com"
                    className="input-themed h-12 border-2 focus:border-pin-blue/50 transition-all duration-200"
                  />
                  <span className="absolute -top-2 right-3 text-xs font-medium text-themed-muted bg-themed-surface px-2 py-0.5 rounded-full border border-themed/30">
                    Optional
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Premium Event Toggle Section */}
          {isPremiumUser && premiumStatus && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-3 border-b border-themed/30">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Crown className="w-4 h-4 text-amber-500" />
                  </div>
                <h3 className="text-lg font-semibold text-themed-primary">Premium Event Features</h3>
              </div>
              
              <div className="p-6 bg-gradient-to-br from-amber-50/50 via-yellow-50/30 to-amber-50/50 dark:from-amber-900/20 dark:via-yellow-900/10 dark:to-amber-900/20 rounded-2xl border-2 border-amber-200/50 dark:border-amber-800/50 shadow-lg">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        type="checkbox"
                        id="is_premium_event"
                        checked={formData.is_premium_event}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_premium_event: e.target.checked }))}
                        disabled={!premiumStatus.can_create_events}
                        className="w-5 h-5 rounded-md border-2 border-amber-300 bg-themed-surface focus:ring-2 text-amber-600 focus:ring-amber-500/50 transition-all duration-200"
                      />
                      <label htmlFor="is_premium_event" className="text-base font-semibold text-themed-primary">
                        Make this a Premium Event
                      </label>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500/30 to-yellow-500/30 rounded-full border border-amber-400/30">
                        <Crown className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-bold text-amber-700 dark:text-amber-300">Verified</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-themed-secondary mb-4 leading-relaxed">
                      Premium events get verified badges, enhanced visibility, and priority placement in search results.
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-white/30 dark:bg-black/20 rounded-xl border border-amber-200/30 dark:border-amber-700/30">
                        <div className="text-xl font-bold text-themed-primary">
                          {premiumStatus.current_month_events || 0}
                        </div>
                        <div className="text-xs text-themed-secondary font-medium">Used This Month</div>
                      </div>
                      
                      <div className="text-center p-3 bg-white/30 dark:bg-black/20 rounded-xl border border-amber-200/30 dark:border-amber-700/30">
                        <div className="text-xl font-bold text-amber-600">
                          {premiumStatus.event_limit || 0}
                        </div>
                        <div className="text-xs text-themed-secondary font-medium">Monthly Limit</div>
                      </div>
                      
                      <div className="text-center p-3 bg-white/30 dark:bg-black/20 rounded-xl border border-amber-200/30 dark:border-amber-700/30">
                        <div className={`text-xl font-bold ${
                          (premiumStatus.events_remaining || 0) <= 2 ? 'text-red-500' : 
                          (premiumStatus.events_remaining || 0) <= 5 ? 'text-amber-500' : 'text-green-500'
                        }`}>
                          {premiumStatus.events_remaining || 0}
                        </div>
                        <div className="text-xs text-themed-secondary font-medium">Remaining</div>
                      </div>
                    </div>
                    
                    {premiumStatus.events_remaining <= 2 && premiumStatus.events_remaining > 0 && (
                      <div className="mt-4 p-3 bg-amber-100/50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm font-medium">You're running low on premium events this month!</span>
                        </div>
                      </div>
                    )}
                    
                    {premiumStatus.events_remaining === 0 && (
                      <div className="mt-4 p-3 bg-red-100/50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm font-medium">You've reached your premium event limit for this month.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
              
          {/* Recurring Events Section - Only show when premium event is selected */}
          {isPremiumUser && formData.is_premium_event && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-3 border-b border-themed/30">
                <div className="w-8 h-8 bg-gradient-to-br from-vibrant-magenta/20 to-vibrant-magenta/10 rounded-lg flex items-center justify-center">
                  <Repeat className="w-4 h-4 text-vibrant-magenta" />
                </div>
                <h3 className="text-lg font-semibold text-themed-primary">Recurring Events</h3>
                <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-full">
                  <Crown className="w-3 h-3 text-amber-600" />
                  <span className="text-xs font-medium text-amber-700">Premium</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                    <div className="w-2 h-2 bg-vibrant-magenta rounded-full"></div>
                    Recurring Event
                  </label>
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-themed-surface to-themed-surface-hover rounded-xl border border-themed/30">
                    <input
                      type="checkbox"
                      id="recurring"
                      checked={formData.recurring}
                      onChange={(e) => setFormData(prev => ({ ...prev, recurring: e.target.checked, frequency: e.target.checked ? prev.frequency : '' }))}
                      className="w-5 h-5 rounded-md border-2 border-themed bg-themed-surface focus:ring-2 transition-all duration-200 text-vibrant-magenta focus:ring-vibrant-magenta/50"
                    />
                    <label htmlFor="recurring" className="text-sm font-medium text-themed-secondary">
                      This event repeats regularly
                    </label>
                  </div>
                </div>

                {formData.recurring && (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                      <div className="w-2 h-2 bg-vibrant-magenta rounded-full"></div>
                      Frequency
                    </label>
                    <Select 
                      value={formData.frequency || ""} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
                    >
                      <SelectTrigger className="input-themed h-12 border-2 border-vibrant-magenta/30 focus:border-vibrant-magenta/50 transition-all duration-200">
                        <SelectValue placeholder="Select frequency..." />
                      </SelectTrigger>
                      <SelectContent className="bg-themed-surface border-themed shadow-xl">
                        <SelectItem value="daily" className="hover:bg-themed-surface-hover">
                          <div className="flex items-center gap-3 py-1">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            <span className="font-medium">Daily</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="weekly" className="hover:bg-themed-surface-hover">
                          <div className="flex items-center gap-3 py-1">
                            <Calendar className="w-4 h-4 text-green-500" />
                            <span className="font-medium">Weekly</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="monthly" className="hover:bg-themed-surface-hover">
                          <div className="flex items-center gap-3 py-1">
                            <Calendar className="w-4 h-4 text-purple-500" />
                            <span className="font-medium">Monthly</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="yearly" className="hover:bg-themed-surface-hover">
                          <div className="flex items-center gap-3 py-1">
                            <Calendar className="w-4 h-4 text-orange-500" />
                            <span className="font-medium">Yearly</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                  </div>
                </div>
              )}

          {/* Premium Image Uploads Section */}
          {isPremiumUser && formData.is_premium_event && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-3 border-b border-themed/30">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Image className="w-4 h-4 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold text-themed-primary">Event Images</h3>
                <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 rounded-full">
                  <Crown className="w-3 h-3 text-amber-600" />
                  <span className="text-xs font-medium text-amber-700">Premium</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Banner Image */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Banner Image
                  </label>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600">
                    {(bannerImage || bannerPreview) ? (
                      <div className="space-y-3">
                        <div className="relative">
                          <img
                            src={bannerImage || bannerPreview}
                            alt="Banner"
                            className="w-full h-24 object-cover rounded-lg border"
                          />
                          <button
                            type="button"
                            onClick={() => handleImageUpload('banner')}
                            className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                          >
                            <Upload className="w-5 h-5 text-white" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Click image to replace • Recommended: 600x200px
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleImageUpload('banner')}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'banner')}
                        className="w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-200"
                      >
                        <Upload className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Upload Banner</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">600x200px • Drag & drop or click</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Logo Image */}
                                  <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Logo Image
                  </label>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600">
                    {(logoImage || logoPreview) ? (
                      <div className="space-y-3">
                        <div className="relative">
                          <img
                            src={logoImage || logoPreview}
                            alt="Logo"
                            className="w-16 h-16 object-cover rounded-lg border mx-auto"
                          />
                          <button
                            type="button"
                            onClick={() => handleImageUpload('logo')}
                            className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                          >
                            <Upload className="w-4 h-4 text-white" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                          Click image to replace • Recommended: 200x200px
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleImageUpload('logo')}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, 'logo')}
                        className="w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-200"
                      >
                        <Upload className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Upload Logo</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">200x200px • Drag & drop or click</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-600">
                <div className="flex items-start gap-3">
                  <Image className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <p className="font-medium mb-1">Premium Image Features:</p>
                    <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                       <li>• Banner image appears at the top of event details</li>
                       <li>• Logo image displays next to the event title</li>
                       <li>• Images enhance your event's professional appearance</li>
                       <li>• Supports JPG, PNG formats up to 5MB</li>
                       <li>• Images are automatically compressed and optimized</li>
                     </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Location Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-themed/30">
              <div className="w-8 h-8 bg-gradient-to-br from-pin-blue/20 to-pin-blue/10 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-pin-blue" />
            </div>
              <h3 className="text-lg font-semibold text-themed-primary">Event Location</h3>
          </div>

            <div className="space-y-4">
          <div className="space-y-3">
                <label className="text-sm font-semibold text-themed-secondary flex items-center gap-2">
                  <div className="w-2 h-2 bg-pin-blue rounded-full"></div>
                  Search for a location
                </label>
                <AddressAutocomplete
                  onSelect={handleAddressSelect}
                  value={formData.address}
                  onChange={handleAddressChange}
                  className="input-themed h-12 border-2 focus:border-pin-blue/50 focus:ring-2 focus:ring-pin-blue/20 transition-all duration-200"
                />
                      </div>
              
              {formData.location && (
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-pin-blue/5 to-pin-blue/10 rounded-xl border-2 border-pin-blue/20">
                  <div className="w-8 h-8 bg-pin-blue/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-pin-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-themed-primary block truncate">
                      {formData.address || `${formData.location.lat.toFixed(6)}, ${formData.location.lng.toFixed(6)}`}
                    </span>
                    <span className="text-xs text-themed-secondary">Selected location</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-themed-secondary hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all duration-200"
                    onClick={handleClearLocation}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Privacy Notice */}
          <PrivacyNotice context="event_creation" />

          {/* Submit Button */}
          <div className="pt-6 border-t-2 border-themed/30">
            <button 
              type="submit" 
              className={`w-full px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 shadow-lg
                ${isSubmitting || !formData.location || connectionError || !user
                  ? 'bg-themed-surface text-themed-muted cursor-not-allowed border-2 border-themed/30'
                  : 'bg-gradient-to-r from-spark-yellow to-pin-blue text-white hover:scale-[1.02] hover:shadow-xl border-2 border-transparent hover:from-spark-yellow/90 hover:to-pin-blue/90'
                }`}
              disabled={isSubmitting || !formData.location || connectionError || !user}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                  {initialEvent ? 'Updating Event...' : 'Creating Event...'}
                </>
              ) : (
                <>
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                  </div>
                  {initialEvent ? 'Update Event' : 'Create Event'}
                </>
              )}
            </button>
          </div>
        </form>
        </AnimatedModalWrapper>
      </DialogContent>
      
      {/* Image Upload Modal */}
      {showImageUpload && (
        <ImageUpload
          eventId={initialEvent?.id}
          imageType={imageUploadType}
          currentImage={imageUploadType === 'banner' ? bannerImage : logoImage}
          onImageUpdate={handleImageUpdate}
          onClose={() => setShowImageUpload(false)}
        />
      )}
    </Dialog>
  );
};

export default CreateEventForm;