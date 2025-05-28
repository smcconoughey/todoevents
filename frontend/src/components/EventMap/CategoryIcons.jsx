import React from 'react';
import { 
  Utensils, 
  Music, 
  Palette, 
  Trophy, 
  Car, 
  Users, 
  Church, 
  MapPin,
  Book,
  Flame
} from 'lucide-react';
import { getCategory } from './categoryConfig';

export const categoryIcons = {
  'Food & Drink': {
    icon: Utensils,
    color: 'text-orange-500'
  },
  'food-drink': {
    icon: Utensils,
    color: 'text-orange-500'
  },
  'cookout': {
    icon: Flame,
    color: 'text-red-500'
  },
  'Music': {
    icon: Music,
    color: 'text-purple-500'
  },
  'music': {
    icon: Music,
    color: 'text-purple-500'
  },
  'Arts': {
    icon: Palette,
    color: 'text-blue-500'
  },
  'arts': {
    icon: Palette,
    color: 'text-blue-500'
  },
  'Sports': {
    icon: Trophy,
    color: 'text-green-500'
  },
  'sports': {
    icon: Trophy,
    color: 'text-green-500'
  },
  'Automotive': {
    icon: Car,
    color: 'text-red-500'
  },
  'automotive': {
    icon: Car,
    color: 'text-red-500'
  },
  'Community': {
    icon: Users,
    color: 'text-yellow-500'
  },
  'community': {
    icon: Users,
    color: 'text-yellow-500'
  },
  'Religious': {
    icon: Church,
    color: 'text-indigo-500'
  },
  'religious': {
    icon: Church,
    color: 'text-indigo-500'
  },
  'Tech & Education': {
    icon: Book,
    color: 'text-indigo-500'
  },
  'tech-education': {
    icon: Book,
    color: 'text-indigo-500'
  },
  'default': {
    icon: MapPin,
    color: 'text-gray-500'
  }
};

export const CategoryIcon = ({ category, className, style }) => {
  // First try to get from categoryConfig
  const categoryConfig = getCategory(category);
  
  // If we have an icon from categoryConfig, use it
  if (categoryConfig && categoryConfig.icon) {
    const Icon = categoryConfig.icon;
    return <Icon className={className || ''} style={style} />;
  }
  
  // Otherwise fall back to our local mapping
  const { icon: Icon, color } = categoryIcons[category] || categoryIcons.default;
  return <Icon className={`${style ? '' : color} ${className || ''}`} style={style} />;
};

export const categories = [
  { id: 'all', name: 'All Events', icon: MapPin, color: 'bg-gray-500' },
  { id: 'food-drink', name: 'Food & Drink', icon: Utensils, color: 'bg-orange-500' },
  { id: 'cookout', name: 'Cookout', icon: Flame, color: 'bg-red-500' },
  { id: 'music', name: 'Music', icon: Music, color: 'bg-purple-500' },
  { id: 'arts', name: 'Arts', icon: Palette, color: 'bg-blue-500' },
  { id: 'sports', name: 'Sports', icon: Trophy, color: 'bg-green-500' },
  { id: 'automotive', name: 'Automotive', icon: Car, color: 'bg-red-500' },
  { id: 'community', name: 'Community', icon: Users, color: 'bg-yellow-500' },
  { id: 'religious', name: 'Religious', icon: Church, color: 'bg-indigo-500' },
  { id: 'tech-education', name: 'Tech & Education', icon: Book, color: 'bg-indigo-500' }
];