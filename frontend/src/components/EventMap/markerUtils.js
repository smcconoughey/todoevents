import { THEME_DARK, THEME_LIGHT } from '../ThemeContext';
import categories from './categoryConfig';
import { createIconOnlyMarker, createIconOnlyClusterMarker } from './iconOnlyMarkers';

// *** DYNAMIC MARKER STYLE SYSTEM ***
// Default to icon-only markers (new approach), but allow runtime switching
let currentMarkerStyle = 'icon-only'; // 'icon-only' or 'diamond-pins'

// Function to switch marker styles dynamically
export const setMarkerStyle = (style) => {
  if (style === 'icon-only' || style === 'diamond-pins') {
    currentMarkerStyle = style;
    return true;
  }
  return false;
};

// Function to get current marker style
export const getMarkerStyle = () => currentMarkerStyle;

// Function to check if using icon-only markers
const useIconOnlyMarkers = () => currentMarkerStyle === 'icon-only';

// Get pre-defined icon paths from categoryConfig
const getIconPathFromCategory = (category) => {
  // Extract the category name from the icon component name
  const iconName = category.icon.name || 'MapPin';
  
  // Get paths from categoryConfig.js iconPaths
  // This is a workaround since we can't directly extract SVG content from React components
  const iconPaths = {
    MapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    
    Utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 2v20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
    
    Music: '<path d="M9 18V5l12-2v13" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="16" r="3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    
    Palette: '<circle cx="13.5" cy="6.5" r=".5" fill="white"/><circle cx="17.5" cy="10.5" r=".5" fill="white"/><circle cx="8.5" cy="7.5" r=".5" fill="white"/><circle cx="6.5" cy="12.5" r=".5" fill="white"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    
    Trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 22h16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    
    Car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="17" r="2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 17h6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="17" r="2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    
    Plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    
    Ship: '<path d="M12 10.189V14" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 2v3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    
    Users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="7" r="4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 21v-2a4 4 0 0 0-3-3.87" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    
    Church: '<path d="M10 9h4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7v5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 22v-4a2 2 0 0 0-4 0v4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 22V5.618a1 1 0 0 0-.553-.894l-4.553-2.277a2 2 0 0 0-1.788 0L6.553 4.724A1 1 0 0 0 6 5.618V22" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m18 7 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.618a1 1 0 0 1 .553-.894L6 7" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    
    BookOpen: '<path d="M12 7v14" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    
    GraduationCap: '<path d="M22 10v6M2 10l10-5 10 5-10 5z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    
    Award: '<circle cx="12" cy="8" r="6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    
    Flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  };
  
  return iconPaths[iconName] || iconPaths.MapPin;
};

export const createMarkerIcon = (category, isDetailed = false, theme = THEME_DARK) => {
  // *** NEW FEATURE: Use icon-only markers if flag is enabled ***
  if (useIconOnlyMarkers()) {
    return createIconOnlyMarker(category, theme);
  }
  
  // *** ORIGINAL CODE: Keep existing diamond pin approach ***
  const isDarkMode = theme === THEME_DARK;
  
  // Brand-aware stroke colors
  const strokeColor = isDarkMode ? '#FFFFFF' : '#1A1A1A';
  const glowColor = isDarkMode ? '#FFD82E' : '#2684FF'; // Spark Yellow (dark) / Pin Blue (light)
  
  if (!isDetailed) {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: category.markerColor,
      fillOpacity: 0.9,
      strokeWeight: 2,
      strokeColor: strokeColor,
      scale: 7,
      // Add subtle glow effect for brand appeal
      anchor: new google.maps.Point(0, 0),
    };
  }

  // Enhanced detailed marker with brand styling
  return {
    // Modern teardrop pin shape with better proportions
    path: 'M 0,0 C -3,-25 -12,-28 -12,-36 A 12,12 0 1,1 12,-36 C 12,-28 3,-25 0,0 z',
    fillColor: category.markerColor,
    fillOpacity: 0.95,
    strokeColor: strokeColor,
    strokeWeight: 2.5,
    scale: 1.3,
    // Anchor at the bottom point of the pin
    anchor: new google.maps.Point(0, 0),
    // Higher z-index for better layering
    zIndex: 1000,
    // Add subtle shadow effect
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowSize: new google.maps.Size(20, 20),
    shadowAnchor: new google.maps.Point(0, 0)
  };
};

// Function to create custom cluster icons with brand colors
export const createClusterIcon = (count, categories, theme = THEME_DARK) => {
  // *** NEW FEATURE: Use icon-only cluster markers if flag is enabled ***
  if (useIconOnlyMarkers()) {
    return createIconOnlyClusterMarker(count, categories, theme);
  }
  
  // *** ORIGINAL CODE: Keep existing cluster approach ***
  const isDarkMode = theme === THEME_DARK;
  
  // Brand colors for different themes
  const brandColors = {
    primary: isDarkMode ? '#FFD82E' : '#FFEC3A',    // Spark Yellow
    secondary: isDarkMode ? '#3C92FF' : '#2684FF',   // Pin Blue
    accent: isDarkMode ? '#E04A73' : '#FF5A87',      // Vibrant Magenta
    teal: isDarkMode ? '#2FB8A6' : '#38D6C0',        // Fresh Teal
    stroke: isDarkMode ? '#FFFFFF' : '#1A1A1A',
    text: isDarkMode ? '#1A1A1A' : '#FFFFFF'
  };
  
  // If we have no categories or only one, use brand colors
  if (!categories || categories.length <= 1) {
    const backgroundColor = categories && categories.length === 1 
      ? categories[0].markerColor 
      : brandColors.primary;
      
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: backgroundColor,
      fillOpacity: 0.95,
      strokeColor: brandColors.stroke,
      strokeWeight: 3,
      scale: Math.min(16 + Math.log2(count) * 3, 35),
      labelOrigin: new google.maps.Point(0, 0),
      // Add subtle glow for brand appeal
      anchor: new google.maps.Point(0, 0),
      zIndex: 2000
    };
  }
  
  // For multiple categories, create a vibrant cluster with dominant category color
  try {
    // Get up to 3 dominant categories
    const dominantCategories = categories.slice(0, 3);
    
    // Use the most common category's color as base, with brand accent
    const baseColor = dominantCategories[0].markerColor;
    const pieSize = Math.min(20 + Math.log2(count) * 2.5, 40);
    
    // Create gradient-like effect by using the dominant color with brand styling
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: baseColor,
      fillOpacity: 0.9,
      strokeColor: brandColors.stroke,
      strokeWeight: 3.5,
      scale: pieSize,
      labelOrigin: new google.maps.Point(0, 0),
      // Enhanced visual appeal
      anchor: new google.maps.Point(0, 0),
      zIndex: 2000
    };
  } catch (error) {
    console.error('Error creating cluster icon:', error);
    // Brand-consistent fallback
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: brandColors.primary,
      fillOpacity: 0.9,
      strokeColor: brandColors.stroke,
      strokeWeight: 3,
      scale: Math.min(12 + Math.log2(count) * 2, 28),
      labelOrigin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(0, 0),
      zIndex: 2000
    };
  }
};