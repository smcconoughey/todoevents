// Debug script for marker system
console.log('=== Marker System Debug ===');

// Test if markerUtils functions are working
import { getMarkerStyle, setMarkerStyle, createMarkerIcon, createClusterIcon } from './src/components/EventMap/markerUtils.js';
import categories from './src/components/EventMap/categoryConfig.js';

console.log('Current marker style:', getMarkerStyle());

// Test creating a marker icon
console.log('Testing marker creation...');
try {
  const testCategory = categories[1]; // food-drink
  console.log('Test category:', testCategory);
  
  const markerIcon = createMarkerIcon(testCategory.id, true, 'dark');
  console.log('Marker icon created:', markerIcon);
  
  const clusterIcon = createClusterIcon(5, [testCategory.id], 'dark');
  console.log('Cluster icon created:', clusterIcon);
  
} catch (error) {
  console.error('Error creating markers:', error);
}

// Test toggle
console.log('Testing marker style toggle...');
setMarkerStyle('diamond-pins');
console.log('Changed to diamond-pins:', getMarkerStyle());

setMarkerStyle('icon-only');
console.log('Changed to icon-only:', getMarkerStyle()); 