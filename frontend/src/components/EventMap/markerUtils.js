import { THEME_DARK, THEME_LIGHT } from '../ThemeContext';
import allCategories from './categoryConfig';

// *** USE FULL DETAILED ICONS FROM CATEGORYCONFIG ***
// Default to using the full detailed category icons that match the sidebar
let currentMarkerStyle = 'detailed-icons'; // 'detailed-icons' or 'diamond-pins'

// Function to switch marker styles dynamically
export const setMarkerStyle = (style) => {
  if (style === 'detailed-icons' || style === 'diamond-pins') {
    currentMarkerStyle = style;
    return true;
  }
  return false;
};

export const getMarkerStyle = () => currentMarkerStyle;

// Function to check if using detailed category icons
const useDetailedIcons = () => currentMarkerStyle === 'detailed-icons';

// Create full category marker using the exact same SVG from categoryConfig.js
const createDetailedCategoryMarker = (category, theme = THEME_DARK) => {
  if (!category || !category.markerSVG) {
    console.warn('No marker SVG found for category:', category?.id);
    // Fallback to first category (All Events)
    const fallbackCategory = allCategories[0];
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(fallbackCategory.markerSVG),
      scaledSize: new google.maps.Size(40, 50),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(20, 50), // Bottom center of the diamond
      optimized: false
    };
  }

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(category.markerSVG),
    scaledSize: new google.maps.Size(40, 50),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(20, 50), // Bottom center of the diamond
    optimized: false
  };
};

// Create cluster marker that shows multiple detailed category icons
const createDetailedClusterMarker = (count, categoryIds, theme = THEME_DARK) => {
  if (!categoryIds || categoryIds.length === 0) {
    // Fallback to default category
    const fallbackCategory = allCategories[0];
    return createDetailedCategoryMarker(fallbackCategory, theme);
  }
  
  // Get unique categories to understand diversity
  const uniqueCategoryIds = [...new Set(categoryIds)];
  const categories = uniqueCategoryIds.map(id => 
    allCategories.find(cat => cat.id === id) || allCategories[0]
  ).filter(Boolean).slice(0, 4); // Max 4 categories

  // If only one category type, just use that category's marker but slightly larger
  if (categories.length === 1) {
    const category = categories[0];
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(category.markerSVG),
      scaledSize: new google.maps.Size(50, 62), // Slightly larger for clusters
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(25, 62),
      optimized: false
    };
  }

  // For multiple categories, create a cluster SVG with multiple small diamonds
  const clusterSVG = createMultiCategoryClusterSVG(categories, count, theme);
  
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(clusterSVG),
    scaledSize: new google.maps.Size(60, 60),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(30, 30),
    optimized: false
  };
};

// Create SVG with multiple small category diamonds for clusters
const createMultiCategoryClusterSVG = (categories, count, theme = THEME_DARK) => {
  const isDarkMode = theme === THEME_DARK;
  const strokeColor = isDarkMode ? '#FFFFFF' : '#000000';
  
  // Positions for up to 4 small diamonds
  const positions = [
    { x: 15, y: 15, size: 20 },
    { x: 45, y: 15, size: 20 },
    { x: 15, y: 45, size: 20 },
    { x: 45, y: 45, size: 20 }
  ];

  let diamonds = '';
  
  categories.slice(0, 4).forEach((category, index) => {
    const pos = positions[index];
    // Create small diamond for each category
    diamonds += `
      <g>
        <!-- Small diamond background -->
        <path 
          d="M${pos.x} ${pos.y - pos.size/2} L${pos.x + pos.size/2} ${pos.y} L${pos.x} ${pos.y + pos.size/2} L${pos.x - pos.size/2} ${pos.y} Z" 
          fill="${category.markerColor}" 
          stroke="${strokeColor}" 
          stroke-width="1"
        />
        <!-- Simplified icon -->
        <g transform="translate(${pos.x - 6}, ${pos.y - 6}) scale(0.5)">
          ${getSimplifiedIconPath(category.id)}
        </g>
      </g>
    `;
  });

  return `
    <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      ${diamonds}
      <!-- Count indicator -->
      <circle cx="50" cy="10" r="8" fill="${strokeColor}" stroke="${isDarkMode ? '#000000' : '#FFFFFF'}" stroke-width="1"/>
      <text x="50" y="14" text-anchor="middle" font-size="10" font-weight="bold" fill="${isDarkMode ? '#000000' : '#FFFFFF'}">${count}</text>
    </svg>
  `;
};

// Get simplified icon paths for cluster display
const getSimplifiedIconPath = (categoryId) => {
  const simplifiedIcons = {
    'food-drink': '<path d="M2 1v4c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V1" fill="none" stroke="white" stroke-width="1.5"/><path d="M3 1v12" fill="none" stroke="white" stroke-width="1.5"/><path d="M12 9V1c-1.7 0-3 1.3-3 3v3c0 .6.4 1 1 1h2v1" fill="none" stroke="white" stroke-width="1.5"/>',
    'music': '<path d="M5 12V3l6-1v8" fill="none" stroke="white" stroke-width="1.5"/><circle cx="3" cy="12" r="2" fill="none" stroke="white" stroke-width="1.5"/><circle cx="11" cy="10" r="2" fill="none" stroke="white" stroke-width="1.5"/>',
    'arts': '<circle cx="8" cy="8" r="6" fill="none" stroke="white" stroke-width="1.5"/><circle cx="8.5" cy="4.5" r=".3" fill="white"/><circle cx="11.5" cy="6.5" r=".3" fill="white"/>',
    'sports': '<path d="M4 6H3a1.5 1.5 0 0 1 0-3h1" fill="none" stroke="white" stroke-width="1.5"/><path d="M12 6h1a1.5 1.5 0 0 0 0-3h-1" fill="none" stroke="white" stroke-width="1.5"/><path d="M12 2H4v4a4 4 0 0 0 8 0V2Z" fill="none" stroke="white" stroke-width="1.5"/>',
    'automotive': '<path d="M12 11h1c.3 0 .6-.2.6-.6v-2c0-.5-.4-1-1-1.2C11.5 7 10 7 10 7s-.8-.8-1.3-1.4c-.3-.2-.7-.4-1.1-.4H3c-.4 0-.7.2-.8.5l-.8 1.7c-.3.5-.3 1 0 1.4V10c0 .3.2.6.6.6h1" fill="none" stroke="white" stroke-width="1.5"/><circle cx="4.5" cy="11" r="1" fill="none" stroke="white" stroke-width="1.5"/><circle cx="10.5" cy="11" r="1" fill="none" stroke="white" stroke-width="1.5"/>',
    'agriculture': '<path d="M1 11L15 11" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M8 1L8 11" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M5 2L5 9" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M11 2L11 9" stroke="white" stroke-width="1.5" stroke-linecap="round"/><circle cx="5" cy="2" r="0.8" fill="white"/><circle cx="8" cy="1" r="0.8" fill="white"/><circle cx="11" cy="2" r="0.8" fill="white"/>',
    'default': '<circle cx="8" cy="8" r="2" fill="white" stroke="white" stroke-width="1.5"/>'
  };
  
  return simplifiedIcons[categoryId] || simplifiedIcons['default'];
};

export const createMarkerIcon = (categoryOrId, isDetailed = false, theme = THEME_DARK) => {
  // Handle both category objects and category ID strings
  let category;
  if (typeof categoryOrId === 'string') {
    // Find category by ID
    category = allCategories.find(cat => cat.id === categoryOrId) || allCategories[0];
  } else {
    category = categoryOrId || allCategories[0];
  }
  
  // *** NEW FEATURE: Use detailed category icons that match the sidebar ***
  if (useDetailedIcons()) {
    return createDetailedCategoryMarker(category, theme);
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
export const createClusterIcon = (count, categoriesOrIds, theme = THEME_DARK) => {
  // Handle both category objects and category ID strings
  let categories;
  if (Array.isArray(categoriesOrIds) && categoriesOrIds.length > 0) {
    if (typeof categoriesOrIds[0] === 'string') {
      // Convert category IDs to category objects
      categories = categoriesOrIds.map(id => 
        allCategories.find(cat => cat.id === id) || allCategories[0]
      ).filter(Boolean);
    } else {
      categories = categoriesOrIds;
    }
  } else {
    categories = [];
  }
  
  // *** NEW FEATURE: Use detailed cluster markers that match the sidebar ***
  if (useDetailedIcons()) {
    return createDetailedClusterMarker(count, categoriesOrIds, theme);
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
      scale: Math.min(20 + Math.log2(count) * 4, 50),
      // Add subtle glow for brand appeal
      anchor: new google.maps.Point(0, 0),
      zIndex: 2000
    };
  }

  // Multiple categories - create multi-colored circle
  const dominantColor = categories[0].markerColor;
  
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: dominantColor,
    fillOpacity: 0.9,
    strokeColor: brandColors.stroke,
    strokeWeight: 3,
    scale: Math.min(20 + Math.log2(count) * 4, 50),
    anchor: new google.maps.Point(0, 0),
    zIndex: 2000
  };
};

export default {
  createMarkerIcon,
  createClusterIcon,
  setMarkerStyle,
  getMarkerStyle
};