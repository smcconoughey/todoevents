import React from 'react';
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Search, 
  Target, 
  Lightbulb, 
  BarChart3, 
  Rocket, 
  Sparkles, 
  Star, 
  PartyPopper, 
  Sun, 
  Moon, 
  Sunset,
  Settings,
  Tag,
  Link,
  Mail,
  MessageSquare,
  Map,
  AlertTriangle,
  Sunrise,
  Filter,
  DollarSign,
  Check,
  User,
  Share2,
  Instagram,
  Facebook,
  Twitter
} from 'lucide-react';

// Icon mapping for common emojis
const iconMapping = {
  '📍': MapPin,
  '📅': Calendar,
  '⏰': Clock,
  '🕐': Clock,
  'clock': Clock,
  '🔍': Search,
  '🎯': Target,
  '💡': Lightbulb,
  '📊': BarChart3,
  '🚀': Rocket,
  '✨': Sparkles,
  '🌟': Star,
  '⭐': Star,
  '🎉': PartyPopper,
  '🎪': PartyPopper,
  '🎨': PartyPopper,
  '☀️': Sun,
  'sun': Sun,
  '🌙': Moon,
  'moon': Moon,
  '🌆': Sunset,
  'sunset': Sunset,
  '🌅': Sunrise,
  'sunrise': Sunrise,
  '⚙️': Settings,
  '🏷️': Tag,
  '🔗': Link,
  '📧': Mail,
  '🗣️': MessageSquare,
  '🗺️': Map,
  '⚠️': AlertTriangle,
  '💰': DollarSign,
  '✅': Check,
  '👤': User,
  '📤': Share2,
  '📱': Instagram,
  'share': Share2,
  'instagram': Instagram,
  'facebook': Facebook,
  'twitter': Twitter
};

// Helper component to render icons
export const WebIcon = ({ emoji, size = 16, className = "", ...props }) => {
  const IconComponent = iconMapping[emoji];
  
  if (!IconComponent) {
    // Fallback to emoji if no icon mapping exists
    return <span className={className} {...props}>{emoji}</span>;
  }
  
  return <IconComponent size={size} className={className} {...props} />;
};

// Specific icon components for common use cases
export const LocationIcon = ({ className = "w-4 h-4", ...props }) => (
  <MapPin className={className} {...props} />
);

export const DateIcon = ({ className = "w-4 h-4", ...props }) => (
  <Calendar className={className} {...props} />
);

export const TimeIcon = ({ className = "w-4 h-4", ...props }) => (
  <Clock className={className} {...props} />
);

export const FilterIcon = ({ className = "w-4 h-4", ...props }) => (
  <Filter className={className} {...props} />
);

export const TipIcon = ({ className = "w-4 h-4", ...props }) => (
  <Lightbulb className={className} {...props} />
);

export const TargetIcon = ({ className = "w-4 h-4", ...props }) => (
  <Target className={className} {...props} />
);

export const PaidIcon = ({ className = "w-4 h-4", ...props }) => (
  <DollarSign className={className} {...props} />
);

export const FreeIcon = ({ className = "w-4 h-4", ...props }) => (
  <Check className={className} {...props} />
);

export const HostIcon = ({ className = "w-4 h-4", ...props }) => (
  <User className={className} {...props} />
);

export const ShareIcon = ({ className = "w-4 h-4", ...props }) => (
  <Share2 className={className} {...props} />
);

export const InstagramIcon = ({ className = "w-4 h-4", ...props }) => (
  <Instagram className={className} {...props} />
);

export const FacebookIcon = ({ className = "w-4 h-4", ...props }) => (
  <Facebook className={className} {...props} />
);

export const TwitterIcon = ({ className = "w-4 h-4", ...props }) => (
  <Twitter className={className} {...props} />
);

export default WebIcon; 