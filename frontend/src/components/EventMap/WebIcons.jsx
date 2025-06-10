import React from 'react';
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Link as LinkIcon, 
  Target, 
  Lightbulb, 
  BarChart3, 
  Rocket, 
  Sparkles, 
  Star, 
  Flame, 
  PinIcon, 
  PartyPopper, 
  Trophy, 
  Balloon,
  Sun,
  Moon,
  Filter
} from 'lucide-react';

// Icon mapping for common emojis
export const iconMap = {
  '📍': MapPin,
  '📅': Calendar,
  '⏰': Clock,
  '🔗': LinkIcon,
  '🎯': Target,
  '💡': Lightbulb,
  '📊': BarChart3,
  '🚀': Rocket,
  '✨': Sparkles,
  '🌟': Star,
  '⭐': Star,
  '🔥': Flame,
  '📌': PinIcon,
  '🎪': PartyPopper,
  '🏆': Trophy,
  '🎈': Balloon,
  '☀️': Sun,
  '🌙': Moon,
  'filter': Filter
};

// Helper component to render icons
export const WebIcon = ({ emoji, className = "w-4 h-4", color, ...props }) => {
  const IconComponent = iconMap[emoji];
  
  if (!IconComponent) {
    return <span className={className} {...props}>{emoji}</span>;
  }
  
  return (
    <IconComponent 
      className={className} 
      style={{ color }} 
      {...props} 
    />
  );
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

export default WebIcon; 