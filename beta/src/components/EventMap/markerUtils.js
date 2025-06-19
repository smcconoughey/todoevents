import { THEME_DARK, THEME_LIGHT } from '../ThemeContext';
import { createIconOnlyMarker, createIconOnlyClusterMarker } from './iconOnlyMarkers';
import categories from './categoryConfig';

// Simply use the existing iconOnlyMarkers system
export const createMarkerIcon = (categoryId, isDetailed = false, theme = THEME_DARK, isVerified = false) => {
  // Find the category object from categoryId
  const category = categories.find(cat => cat.id === categoryId) || categories[0];
  return createIconOnlyMarker(category, theme, isVerified);
};

export const createClusterIcon = (count, categoryIds, theme = THEME_DARK) => {
  return createIconOnlyClusterMarker(count, categoryIds, theme);
};

// Set marker style (kept for compatibility)
export const setMarkerStyle = (style) => {
  return true; // Always return true since we only support raw icons now
};

export const getMarkerStyle = () => 'raw-icons';