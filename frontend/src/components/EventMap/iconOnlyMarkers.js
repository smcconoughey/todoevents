import { THEME_DARK, THEME_LIGHT } from '../ThemeContext';
import categories from './categoryConfig';

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
  
  Laptop: '<rect width="20" height="14" x="2" y="3" rx="2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 21h12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 17v4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  // NEW CATEGORY ICONS - Adding all the missing categories
  CalendarDays: '<path d="M8 2v4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 2v4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect width="18" height="18" x="3" y="4" rx="2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 10h18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 14h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 14h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 14h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 18h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 18h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Waves: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c1.8 0 2.5 2 5 2s3.2-2 5-2c1.3 0 1.9.5 2.5 1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.2 2 5 2 3.2-2 5-2c1.3 0 1.9.5 2.5 1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.2 2 5 2 3.2-2 5-2c1.3 0 1.9.5 2.5 1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Snowflake: '<path d="M12 2L12 22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 6.5L6.5 17.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 6.5L17.5 17.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 6L9 3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 3L12 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 18L9 21" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 21L12 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Stethoscope: '<path d="M5 6c0 2.2 1.8 4 4 4s4-1.8 4-4V2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 6v7a7 7 0 0 1-14 0v-7" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="19" cy="13" r="2" fill="white" stroke="white" stroke-width="2"/>',
  
  Gamepad2: '<rect width="20" height="12" x="2" y="6" rx="6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="12" r="2" fill="white" stroke="white" stroke-width="2"/><path d="M16 12h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  MapIcon: '<polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="8" y1="2" x2="8" y2="18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="16" y1="6" x2="16" y2="22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="13" r="4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Theater: '<path d="M4 9h1v11H4z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 9h1v11h-1z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 9h12v11H6z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 9l18-6v18l-18-6z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  PartyPopper: '<path d="M5.8 11.3 2 22l10.7-3.79" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 3h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 8h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 2h.01" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 20h.01" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Briefcase: '<rect width="20" height="14" x="2" y="7" rx="2" ry="2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Trees: '<circle cx="12" cy="12" r="3" fill="white" stroke="white" stroke-width="2"/><path d="M12 1v6m0 6v6" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M21 12h-6m-6 0H3" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M18.364 5.636L13 11M11 13l-5.364 5.364" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M18.364 18.364L13 13M11 11l-5.364-5.364" stroke="white" stroke-width="2" stroke-linecap="round"/>',

  Heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Calendar: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="16" y1="2" x2="16" y2="6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="8" y1="2" x2="8" y2="6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="3" y1="10" x2="21" y2="10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Baby: '<path d="M9 12h6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 19c0 1.5 1.2 3 3.5 3s3.5-1.4 3.5-3c0-1.5 1.2-3 3.5-3s3.5 1.4 3.5 3c0 1.5 1.2 3 3.5 3s3.5-1.4 3.5-3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12h20" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="5" r="3" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  TreePine: '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h10z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m17 9 3 3.2a1 1 0 0 1-.7 1.8H4.7a1 1 0 0 1-.7-1.8L7 9h10z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5 12 2 6 5h12z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 22V19" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Dumbbell: '<path d="M14.4 14.4 9.6 9.6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.829 2.829l-3.534-3.536z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m21.5 21.5-1.4-1.4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.9 3.9 2.5 2.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.829 2.829l-3.535-3.536z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Zap: '<polygon points="13,2 3,14 12,14 11,22 21,10 12,10" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Plus: '<path d="M12 5v14" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12h14" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Building2: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 12H4a2 2 0 0 0-2 2v8h20v-8a2 2 0 0 0-2-2h-2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Footprints: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Bike: '<circle cx="18.5" cy="17.5" r="3.5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5.5" cy="17.5" r="3.5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="5" r="1" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 17.5V14l-3-3 4-3 2 3h2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Tent: '<path d="M3.5 21 14 3l10.5 18H3.5Z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 3v18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Fish: '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 12v.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 17.93a9.77 9.77 0 0 1 0 0 1.9 1.9 0 0 0-2.4-1.4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1.42-.23-2.48.04-2.72 1.22-.48 2.44 2.04 3.64 2.99 4.28" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Star: '<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Target: '<circle cx="12" cy="12" r="10" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Coffee: '<path d="M10 2v20M14 2v20M4 7h16l-1 11H5L4 7Z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 7V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Wine: '<path d="M12 8V2H8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 8V2h4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15c-3 0-6-1-6-4V8h12v3c0 3-3 4-6 4Z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15v7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 22h8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Martini: '<path d="M8 22h8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15v7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15 4 3h16l-8 12Z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  IceCream: '<path d="M7 11v8a1 1 0 0 1-2 0v-8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 11v8a1 1 0 0 1-2 0v-8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 11a7 7 0 0 1 14 0" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 4v7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  Sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
};

// Map category IDs to icon names - UPDATED with all categories
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
  'networking': 'Laptop',

  // NEW CATEGORIES - Adding all the missing ones
  'fair-festival': 'CalendarDays',
  'diving': 'Waves',
  'seasonal': 'Snowflake',
  'health-wellness': 'Stethoscope',
  'gaming': 'Gamepad2',
  'outdoor-recreation': 'MapIcon',
  'photography': 'Camera',
  'performing-arts': 'Theater',
  'celebration': 'PartyPopper',
  'professional': 'Briefcase',
  'nature-environment': 'Trees',
  'charity-fundraising': 'Heart',
  'cultural': 'Calendar',
  'family-kids': 'Baby',
  'holiday': 'TreePine',
  'fitness': 'Dumbbell',
  'technology': 'Zap',
  'other': 'Plus',
  'workshop-class': 'Building2',
  'walking-running': 'Footprints',
  'cycling': 'Bike',
  'camping': 'Tent',
  'hiking': 'Mountain',
  'fishing-hunting': 'Fish',
  'competition': 'Star',
  'shooting-sports': 'Target',
  'beverage-tasting': 'Coffee',
  'wine-spirits': 'Wine',
  'cocktail-mixology': 'Martini',
  'dessert-sweets': 'IceCream',
  'entertainment': 'Sparkles'
};

// Create larger, cleaner icon-only marker
export const createIconOnlyMarker = (category, theme = THEME_DARK) => {
  const iconName = categoryIconMap[category.id] || 'MapPin';
  const iconPath = iconPaths[iconName];
  
  if (!iconPath) {
    console.warn('No icon path found for category:', category.id, 'using MapPin');
    const fallbackPath = iconPaths.MapPin;
    const svg = createIconOnlyMarkerSVG(fallbackPath, category.markerColor, theme);
    
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(80, 80),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(40, 40),
      optimized: false
    };
  }
  
  const svg = createIconOnlyMarkerSVG(iconPath, category.markerColor, theme);
  
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