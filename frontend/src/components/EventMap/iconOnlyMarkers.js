import { THEME_DARK, THEME_LIGHT } from '../ThemeContext';
import categories from './categoryConfig';

// Clean icon-only marker system - larger icons with duplicate stacking (Snapchat style)
// Shows duplicate icons of the dominant category rather than different categories

// Helper function to create clean icon-only SVG markers - no rings, bigger size
const createIconOnlyMarkerSVG = (iconPath, categoryColor, theme = THEME_DARK, isVerified = false) => {
  const isDarkMode = theme === THEME_DARK;
  const outlineColor = isDarkMode ? '#FFFFFF' : '#000000';
  
  // Use gold color for verified events, category color for regular events
  const markerColor = isVerified ? '#FFD700' : categoryColor;
  
  // Clean icon path with better visibility
  const cleanIconPath = iconPath
    .replace(/stroke="white"/g, `stroke="${markerColor}"`)
    .replace(/fill="white"/g, `fill="${markerColor}"`)
    .replace(/stroke-width="[\d.]+"/g, 'stroke-width="4"');
  
  return `
    <svg width="320" height="320" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
      <!-- Main icon - much larger and cleaner -->
      <g transform="translate(112, 112) scale(4)">
        ${cleanIconPath}
      </g>
      <!-- Strong outline for definition -->
      <g transform="translate(112, 112) scale(4)">
        ${iconPath.replace(/fill="white"/g, 'fill="none"').replace(/stroke="white"/g, `stroke="${outlineColor}"`).replace(/stroke-width="[\d.]+"/g, 'stroke-width="3"')}
      </g>
      ${isVerified ? `
      <!-- Verification indicator (small star in corner) -->
      <g transform="translate(240, 80) scale(2)">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
              fill="#FFD700" stroke="#FFA500" stroke-width="1"/>
      </g>
      ` : ''}
    </svg>
  `;
};

// Show multiple copies of the SAME icon (when all events are same category)
const createDuplicateStack = (category, count, theme = THEME_DARK) => {
  const isDarkMode = theme === THEME_DARK;
  const outlineColor = isDarkMode ? '#FFFFFF' : '#000000';
  
  // Determine how many duplicate icons to show (max 4)
  const iconCount = Math.min(4, Math.max(2, count));
  const iconSize = 112; // Much larger individual icons for 320px container (4x)
  
  // Position duplicate icons in formation (4x coordinates)
  const positions = [];
  
  if (iconCount === 2) {
    positions.push(
      { x: 104, y: 96 },
      { x: 216, y: 160 }
    );
  } else if (iconCount === 3) {
    positions.push(
      { x: 96, y: 88 },
      { x: 224, y: 88 },
      { x: 160, y: 200 }
    );
  } else if (iconCount === 4) {
    positions.push(
      { x: 92, y: 92 },
      { x: 228, y: 92 },
      { x: 92, y: 228 },
      { x: 228, y: 228 }
    );
  }
  
  // Get the icon path for this category
  const iconName = categoryIconMap[category.id] || 'MapPin';
  const iconPath = iconPaths[iconName] || iconPaths.MapPin;
  
  // Create duplicate icons (same icon repeated)
  const createDuplicateIcon = (x, y) => {
    return `
      <g transform="translate(${x - iconSize/2}, ${y - iconSize/2})">
        <!-- Category icon -->
        <g transform="translate(${iconSize/2 - 48}, ${iconSize/2 - 48}) scale(4)">
          ${iconPath
            .replace(/stroke="white"/g, `stroke="${category.markerColor}"`)
            .replace(/fill="white"/g, `fill="${category.markerColor}"`)
            .replace(/stroke-width="[\d.]+"/g, 'stroke-width="4"')
          }
        </g>
        <!-- Clean outline -->
        <g transform="translate(${iconSize/2 - 48}, ${iconSize/2 - 48}) scale(4)">
          ${iconPath
            .replace(/fill="white"/g, 'fill="none"')
            .replace(/stroke="white"/g, `stroke="${outlineColor}"`)
            .replace(/stroke-width="[\d.]+"/g, 'stroke-width="3"')
          }
        </g>
      </g>
    `;
  };
  
  // Generate all duplicate icons
  const duplicateIcons = positions.map(pos => createDuplicateIcon(pos.x, pos.y)).join('');
  
  // Same size as individual markers - but with duplicates
  const svg = `
    <svg width="320" height="320" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
      ${duplicateIcons}
    </svg>
  `;
  
  return svg;
};

// Show diverse category icons to represent the variety in a cluster
const createDiversityStack = (categoryIds, theme = THEME_DARK) => {
  const isDarkMode = theme === THEME_DARK;
  const outlineColor = isDarkMode ? '#FFFFFF' : '#000000';
  
  // Determine positions based on how many different categories we're showing
  const iconCount = categoryIds.length;
  const iconSize = 112; // Much larger individual icons for 320px container (4x)
  
  // Position different category icons in formation (4x coordinates)
  const positions = [];
  
  if (iconCount === 2) {
    positions.push(
      { x: 104, y: 96 },
      { x: 216, y: 160 }
    );
  } else if (iconCount === 3) {
    positions.push(
      { x: 96, y: 88 },
      { x: 224, y: 88 },
      { x: 160, y: 200 }
    );
  } else if (iconCount === 4) {
    positions.push(
      { x: 92, y: 92 },
      { x: 228, y: 92 },
      { x: 92, y: 228 },
      { x: 228, y: 228 }
    );
  }
  
  // Create diverse icons (different category for each position)
  const createDiverseIcon = (categoryId, x, y) => {
    const category = categories.find(cat => cat.id === categoryId) || 
                    { id: categoryId, markerColor: '#6B7280' };
    const iconName = categoryIconMap[categoryId] || 'MapPin';
    const iconPath = iconPaths[iconName] || iconPaths.MapPin;
    
    return `
      <g transform="translate(${x - iconSize/2}, ${y - iconSize/2})">
        <!-- Category icon with its own color -->
        <g transform="translate(${iconSize/2 - 48}, ${iconSize/2 - 48}) scale(4)">
          ${iconPath
            .replace(/stroke="white"/g, `stroke="${category.markerColor}"`)
            .replace(/fill="white"/g, `fill="${category.markerColor}"`)
            .replace(/stroke-width="[\d.]+"/g, 'stroke-width="4"')
          }
        </g>
        <!-- Clean outline -->
        <g transform="translate(${iconSize/2 - 48}, ${iconSize/2 - 48}) scale(4)">
          ${iconPath
            .replace(/fill="white"/g, 'fill="none"')
            .replace(/stroke="white"/g, `stroke="${outlineColor}"`)
            .replace(/stroke-width="[\d.]+"/g, 'stroke-width="3"')
          }
        </g>
      </g>
    `;
  };
  
  // Generate diverse icons for each category
  const diverseIcons = categoryIds.map((categoryId, index) => 
    createDiverseIcon(categoryId, positions[index].x, positions[index].y)
  ).join('');
  
  // Same size as individual markers - but with diverse category icons
  const svg = `
    <svg width="320" height="320" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
      ${diverseIcons}
    </svg>
  `;
  
  return svg;
};

// Complete icon paths optimized for visibility - matching exactly with categoryConfig.js
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
  
  Laptop: '<rect width="20" height="14" x="2" y="3" rx="2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 21h12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 17v4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  // Additional category icons for exact matches with categoryConfig.js
  CalendarDays: '<path d="M8 2v4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 2v4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect width="18" height="18" x="3" y="4" rx="2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 10h18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 14h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 14h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 14h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 18h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 18h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  // Tent icon for fair/festival
  Tent: '<path d="M12 3L2 18h20L12 3z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3v15" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 15h18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Waves: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c1.8 0 2.5 2 5 2s3.2-2 5-2c1.3 0 1.9.5 2.5 1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.2 2 5 2 3.2-2 5-2c1.3 0 1.9.5 2.5 1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.2 2 5 2 3.2-2 5-2c1.3 0 1.9.5 2.5 1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  ShoppingBag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 6h18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 10a4 4 0 0 1-8 0" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  TreePine: '<path d="M12 2 L8 8 h8 Z" fill="white" stroke="white" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 6 L6 12 h12 Z" fill="white" stroke="white" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 10 L4 16 h16 Z" fill="white" stroke="white" stroke-width="1.5" stroke-linejoin="round"/><rect x="11" y="16" width="2" height="6" fill="white" stroke="white" stroke-width="1" stroke-linejoin="round"/>',
  
  Camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="13" r="3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Baby: '<path d="M9 12h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 12h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2.69 0 5.12 1.18 6.8 3.3z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Gamepad2: '<line x1="6" x2="10" y1="12" y2="12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="8" x2="8" y1="10" y2="14" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="15" x2="15.01" y1="13" y2="13" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="18" x2="18.01" y1="11" y2="11" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect width="20" height="12" x="2" y="6" rx="2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Snowflake: '<path d="M12 2L12 22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 6.5L6.5 17.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 6.5L17.5 17.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 6L9 3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 3L12 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 18L9 21" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 21L12 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  // Wheat icon for agriculture
  Wheat: '<path d="M2 22L22 22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 2L12 22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 4L8 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 4L16 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6L6 16" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 6L18 16" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="4" r="1" fill="white"/><circle cx="12" cy="2" r="1" fill="white"/><circle cx="16" cy="4" r="1" fill="white"/>',

  // Additional icons for missing categories
  DollarSign: '<line x1="12" x2="12" y1="2" y2="22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect width="20" height="14" x="2" y="6" rx="2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Cross: '<path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  // Custom Cow icon for livestock (keeping for backward compatibility)
  Cow: '<ellipse cx="12" cy="14" rx="8" ry="4" fill="none" stroke="white" stroke-width="2"/><circle cx="8" cy="8" r="2" fill="none" stroke="white" stroke-width="2"/><circle cx="16" cy="8" r="2" fill="none" stroke="white" stroke-width="2"/><path d="M6 8v2" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M18 8v2" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="11" r="0.5" fill="white"/><circle cx="14" cy="11" r="0.5" fill="white"/><path d="M10 13h4" stroke="white" stroke-width="1.5" stroke-linecap="round"/>'

};

// Map category IDs to icon names - EXACT MATCH with categoryConfig.js
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
  'networking': 'Laptop',
  'fair-festival': 'Tent',
  'diving': 'Waves',
  'shopping': 'ShoppingBag',
  'health': 'Heart',
  'outdoors': 'TreePine',
  'photography': 'Camera',
  'family': 'Baby',
  'gaming': 'Gamepad2',
  'real-estate': 'Home',
  'agriculture': 'Wheat',
  'adventure': 'Mountain',
  'seasonal': 'Snowflake',
  'livestock': 'Cow', // Add livestock mapping if it exists
  'other': 'MapPin'
};

// Create larger, cleaner icon-only marker
export const createIconOnlyMarker = (category, theme = THEME_DARK, isVerified = false) => {
  const iconName = categoryIconMap[category.id] || 'MapPin';
  const iconPath = iconPaths[iconName];
  
  if (!iconPath) {
    console.warn('No icon path found for category:', category.id, 'using MapPin');
    const fallbackPath = iconPaths.MapPin;
    const svg = createIconOnlyMarkerSVG(fallbackPath, category.markerColor, theme, isVerified);
    
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(80, 80),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(40, 40),
      optimized: false
    };
  }
  
  const svg = createIconOnlyMarkerSVG(iconPath, category.markerColor, theme, isVerified);
  
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(80, 80),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(40, 40),
    optimized: false
  };
};

// Create cluster marker - show diverse category icons to represent variety in the cluster
export const createIconOnlyClusterMarker = (count, categoryIds, theme = THEME_DARK) => {
  if (!categoryIds || categoryIds.length === 0) {
    // Fallback to single icon for unknown categories
    const fallbackCategory = { id: 'all', markerColor: '#6B7280' };
    const svg = createIconOnlyMarkerSVG(iconPaths.MapPin, fallbackCategory.markerColor, theme);
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(80, 80),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(40, 40),
      optimized: false
    };
  }
  
  // Get unique categories to understand diversity
  const uniqueCategoryIds = [...new Set(categoryIds)];
  
  // If ALL events are the same category, show duplicates (like 4 food icons)
  if (uniqueCategoryIds.length === 1) {
    const category = categories.find(cat => cat.id === uniqueCategoryIds[0]) || 
                    { id: uniqueCategoryIds[0], markerColor: '#6B7280' };
    
    // Show multiple icons for same category (max 4)
    const duplicateCount = Math.min(4, Math.max(2, Math.floor(count / 2)));
    if (count >= 2) {
      const svg = createDuplicateStack(category, duplicateCount, theme);
      return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(80, 80),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(40, 40),
        optimized: false
      };
    } else {
      // Single event - just show single icon
      const iconName = categoryIconMap[category.id] || 'MapPin';
      const iconPath = iconPaths[iconName] || iconPaths.MapPin;
      const svg = createIconOnlyMarkerSVG(iconPath, category.markerColor, theme);
      return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(80, 80),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(40, 40),
        optimized: false
      };
    }
  }
  
  // Mixed categories - show diversity (up to 4 different categories)
  const categoriesToShow = uniqueCategoryIds.slice(0, 4);
  const svg = createDiversityStack(categoriesToShow, theme);
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(80, 80),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(40, 40),
    optimized: false
  };
};

export default {
  createIconOnlyMarker,
  createIconOnlyClusterMarker
}; 