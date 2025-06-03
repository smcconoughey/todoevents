import { THEME_DARK, THEME_LIGHT } from '../ThemeContext';

// Clean icon-only marker system - larger icons with duplicate stacking (Snapchat style)
// Shows duplicate icons of the dominant category rather than different categories

// Helper function to create clean icon-only SVG markers - no rings, bigger size
const createIconOnlyMarkerSVG = (iconPath, categoryColor, theme = THEME_DARK) => {
  const isDarkMode = theme === THEME_DARK;
  const outlineColor = isDarkMode ? '#FFFFFF' : '#000000';
  
  // Clean icon path with better visibility
  const cleanIconPath = iconPath
    .replace(/stroke="white"/g, `stroke="${categoryColor}"`)
    .replace(/fill="white"/g, `fill="${categoryColor}"`)
    .replace(/stroke-width="[\d.]+"/g, 'stroke-width="2.5"');
  
  return `
    <svg width="52" height="52" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
      <!-- Main icon - larger and cleaner -->
      <g transform="translate(14, 14) scale(1)">
        ${cleanIconPath}
      </g>
      <!-- Strong outline for definition -->
      <g transform="translate(14, 14) scale(1)">
        ${iconPath.replace(/fill="white"/g, 'fill="none"').replace(/stroke="white"/g, `stroke="${outlineColor}"`).replace(/stroke-width="[\d.]+"/g, 'stroke-width="1.5"')}
      </g>
    </svg>
  `;
};

// Snapchat-style duplicate stacking - show multiple copies of the SAME icon
const createDuplicateStack = (dominantCategory, count, theme = THEME_DARK) => {
  const isDarkMode = theme === THEME_DARK;
  const outlineColor = isDarkMode ? '#FFFFFF' : '#000000';
  
  // Determine how many duplicate icons to show (max 4)
  const iconCount = Math.min(4, Math.max(2, Math.floor(count / 2)));
  const iconSize = 20; // Larger individual icons for 52px container
  
  // Snapchat-style positions for duplicate icons (no rings, just stacked)
  const positions = [];
  
  if (iconCount === 2) {
    positions.push(
      { x: 18, y: 16 },
      { x: 34, y: 28 }
    );
  } else if (iconCount === 3) {
    positions.push(
      { x: 16, y: 14 },
      { x: 36, y: 14 },
      { x: 26, y: 32 }
    );
  } else {
    // 4 icons in a loose formation
    positions.push(
      { x: 15, y: 15 },
      { x: 37, y: 15 },
      { x: 15, y: 37 },
      { x: 37, y: 37 }
    );
  }
  
  // Get the icon path for the dominant category
  const iconName = categoryIconMap[dominantCategory.id] || 'MapPin';
  const iconPath = iconPaths[iconName] || iconPaths.MapPin;
  
  // Create duplicate icons (same icon repeated)
  const createDuplicateIcon = (x, y) => {
    return `
      <g transform="translate(${x - iconSize/2}, ${y - iconSize/2})">
        <!-- Pure icon without any background -->
        <g transform="translate(${iconSize/2 - 12}, ${iconSize/2 - 12}) scale(1)">
          ${iconPath
            .replace(/stroke="white"/g, `stroke="${dominantCategory.markerColor}"`)
            .replace(/fill="white"/g, `fill="${dominantCategory.markerColor}"`)
            .replace(/stroke-width="[\d.]+"/g, 'stroke-width="2"')
          }
        </g>
        <!-- Clean outline -->
        <g transform="translate(${iconSize/2 - 12}, ${iconSize/2 - 12}) scale(1)">
          ${iconPath
            .replace(/fill="white"/g, 'fill="none"')
            .replace(/stroke="white"/g, `stroke="${outlineColor}"`)
            .replace(/stroke-width="[\d.]+"/g, 'stroke-width="1"')
          }
        </g>
      </g>
    `;
  };
  
  // Generate all duplicate icons
  const duplicateIcons = positions.map(pos => createDuplicateIcon(pos.x, pos.y)).join('');
  
  // Same size as individual markers - just with duplicates
  return `
    <svg width="52" height="52" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
      ${duplicateIcons}
    </svg>
  `;
};

// Simplified icon paths optimized for visibility
const iconPaths = {
  MapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="3" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 2v20" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Music: '<path d="M9 18V5l12-2v13" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="16" r="3" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Palette: '<circle cx="13.5" cy="6.5" r=".5" fill="white"/><circle cx="17.5" cy="10.5" r=".5" fill="white"/><circle cx="8.5" cy="7.5" r=".5" fill="white"/><circle cx="6.5" cy="12.5" r=".5" fill="white"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 22h16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="17" r="2" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="17" r="2" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Ship: '<path d="M12 10.189V14" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 2v3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="7" r="4" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 21v-2a4 4 0 0 0-3-3.87" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Church: '<path d="M10 9h4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7v5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 22V5.618a1 1 0 0 0-.553-.894l-4.553-2.277a2 2 0 0 0-1.788 0L6.553 4.724A1 1 0 0 0 6 5.618V22" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  BookOpen: '<path d="M12 7v14" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  GraduationCap: '<path d="M22 10v6M2 10l10-5 10 5-10 5z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Award: '<circle cx="12" cy="8" r="6" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Laptop: '<rect width="20" height="14" x="2" y="3" rx="2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 21h12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 17v4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
};

// Map category IDs to icon names  
const categoryIconMap = {
  'all': 'MapPin',
  'food-drink': 'Utensils', 
  'music': 'Music',
  'arts': 'Palette',
  'sports': 'Trophy',
  'automotive': 'Car',
  'airshows': 'Plane',
  'vehicle-sports': 'Ship',
  'community': 'Users',
  'religious': 'Church',
  'education': 'BookOpen',
  'veteran': 'Award',
  'cookout': 'Flame',
  'graduation': 'GraduationCap',
  'networking': 'Laptop'
};

// Create larger, cleaner icon-only marker
export const createIconOnlyMarker = (category, theme = THEME_DARK) => {
  console.log('Creating larger icon-only marker for category:', category);
  const iconName = categoryIconMap[category.id] || 'MapPin';
  const iconPath = iconPaths[iconName];
  
  if (!iconPath) {
    console.warn('No icon path found for category:', category.id, 'using MapPin');
    const fallbackPath = iconPaths.MapPin;
    const svg = createIconOnlyMarkerSVG(fallbackPath, category.markerColor, theme);
    
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(52, 52),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(26, 26),
      optimized: false
    };
  }
  
  const svg = createIconOnlyMarkerSVG(iconPath, category.markerColor, theme);
  
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(52, 52),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(26, 26),
    optimized: false
  };
};

// Create duplicate-icon cluster - same size, shows duplicates of dominant category
export const createIconOnlyClusterMarker = (count, categories, theme = THEME_DARK) => {
  console.log('Creating duplicate-stack cluster with', count, 'events and categories:', categories?.map(c => c.id));
  
  // Get the dominant (most common) category
  const dominantCategory = categories && categories.length > 0 ? categories[0] : { id: 'all', markerColor: '#6B7280' };
  
  const svg = createDuplicateStack(dominantCategory, count, theme);
  
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(52, 52),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(26, 26),
    optimized: false
  };
};

export default {
  createIconOnlyMarker,
  createIconOnlyClusterMarker
}; 