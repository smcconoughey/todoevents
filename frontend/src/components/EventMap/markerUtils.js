import { THEME_DARK, THEME_LIGHT } from '../ThemeContext';
import allCategories from './categoryConfig';

// Create marker icon using the raw SVG from categoryConfig
export const createMarkerIcon = (categoryOrId, isDetailed = false, theme = THEME_DARK) => {
  // Handle both category objects and category ID strings
  let category;
  if (typeof categoryOrId === 'string') {
    // Find category by ID
    category = allCategories.find(cat => cat.id === categoryOrId) || allCategories[0];
  } else {
    category = categoryOrId || allCategories[0];
  }
  
  // Use the raw category icon directly from categoryConfig
  if (category && category.icon) {
    const iconSvg = `
      <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="12" fill="${category.markerColor}" stroke="white" stroke-width="2"/>
        ${category.icon}
      </svg>
    `;
    
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(iconSvg),
      scaledSize: new google.maps.Size(32, 32),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(16, 16),
      optimized: false
    };
  }
  
  // Fallback to simple circle
  const isDarkMode = theme === THEME_DARK;
  const strokeColor = isDarkMode ? '#FFFFFF' : '#1A1A1A';
  
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: category.markerColor,
    fillOpacity: 0.9,
    strokeWeight: 2,
    strokeColor: strokeColor,
    scale: 7,
    anchor: new google.maps.Point(0, 0),
  };
};

// Function to create cluster icons
export const createClusterIcon = (count, categoriesOrIds, theme = THEME_DARK) => {
  if (!categoriesOrIds || categoriesOrIds.length === 0) {
    categoriesOrIds = ['all-events'];
  }
  
  // Get unique categories
  const uniqueCategoryIds = [...new Set(categoriesOrIds)];
  const categories = uniqueCategoryIds.map(id => 
    allCategories.find(cat => cat.id === id) || allCategories[0]
  ).filter(Boolean);

  // If only one category type, use that category's color
  const primaryCategory = categories[0];
  const isDarkMode = theme === THEME_DARK;
  const strokeColor = isDarkMode ? '#FFFFFF' : '#1A1A1A';
  const textColor = isDarkMode ? '#000000' : '#FFFFFF';
  
  const clusterSvg = `
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="${primaryCategory.markerColor}" stroke="${strokeColor}" stroke-width="2"/>
      <text x="20" y="25" text-anchor="middle" font-size="12" font-weight="bold" fill="${textColor}">${count}</text>
    </svg>
  `;
  
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(clusterSvg),
    scaledSize: new google.maps.Size(40, 40),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(20, 20),
    optimized: false
  };
};

// Set marker style (kept for compatibility)
export const setMarkerStyle = (style) => {
  return true; // Always return true since we only support raw icons now
};

export const getMarkerStyle = () => 'raw-icons';