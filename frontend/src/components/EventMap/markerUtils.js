import { THEME_DARK, THEME_LIGHT } from '../ThemeContext';
import { createIconOnlyMarker, createIconOnlyClusterMarker } from './iconOnlyMarkers';

// Simply use the existing iconOnlyMarkers system
export const createMarkerIcon = (categoryId, isDetailed = false, theme = THEME_DARK) => {
  return createIconOnlyMarker(categoryId, theme);
};

export const createClusterIcon = (count, categoryIds, theme = THEME_DARK) => {
  return createIconOnlyClusterMarker(count, categoryIds, theme);
};

// Set marker style (kept for compatibility)
export const setMarkerStyle = (style) => {
  return true; // Always return true since we only support raw icons now
};

export const getMarkerStyle = () => 'raw-icons';