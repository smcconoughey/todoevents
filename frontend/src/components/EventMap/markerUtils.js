import { THEME_DARK, THEME_LIGHT } from '../ThemeContext';

export const createMarkerIcon = (category, isDetailed = false, theme = THEME_DARK) => {
  const isDarkMode = theme === THEME_DARK;
  const strokeColor = isDarkMode ? '#FFFFFF' : '#52B788';
  
  if (!isDetailed) {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: category.markerColor,
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: strokeColor,
      scale: 6,
    };
  }

  try {
    // Create a SVG string with the category icon embedded
    // Use a more simplified and reliable approach for icon embedding
    let iconPath = '';
    
    // Set default icon paths based on category ID
    // Using very simple paths that are guaranteed to work
    switch(category.id) {
      case 'music':
        iconPath = 'M9 18V5l12-2v13';
        break;
      case 'food-drink':
        iconPath = 'M5 10l5 5 9-9';
        break;
      case 'arts':
        iconPath = 'M12 19l7-7 3 3-7 7-3-3z';
        break;
      case 'sports':
        iconPath = 'M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z';
        break;
      case 'automotive':
        iconPath = 'M5 9h14M5 15h14M5 21h14';
        break;
      case 'airshows':
        iconPath = 'M5 5l7 7M12 5l-7 7';
        break;
      case 'vehicle-sports':
        iconPath = 'M3 12h18M3 6h18M3 18h18';
        break;
      case 'community':
        iconPath = 'M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0';
        break;
      case 'religious':
        iconPath = 'M12 4v16M4 12h16';
        break;
      case 'tech-education':
        iconPath = 'M2 12h20M12 2v20';
        break;
      case 'veteran':
        iconPath = 'M12 2L4 10l8 8 8-8z';
        break;
      case 'cookout':
        iconPath = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z';
        break;
      case 'graduation':
        iconPath = 'M2 10l10-5 10 5-10 5z';
        break;
      case 'all':
      default:
        // Default location pin icon (simplified)
        iconPath = 'M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z';
    }

    // Create a map pin marker with the category icon
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="48" height="64">
        <!-- Pin body -->
        <path d="M24 0C14.6 0 7 7.6 7 17c0 7.6 5.9 17.8 17 31.5 11.1-13.7 17-23.9 17-31.5C41 7.6 33.4 0 24 0z" 
              fill="${category.markerColor}" 
              stroke="${strokeColor}" 
              stroke-width="2" />
              
        <!-- Icon - using simplified path -->
        <g transform="translate(12, 10)" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="${iconPath}" />
        </g>
      </svg>
    `;

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgString),
      scaledSize: new google.maps.Size(36, 48), // Adjusted size for pin
      anchor: new google.maps.Point(18, 48), // Bottom center of the pin
      labelOrigin: new google.maps.Point(18, 17) // Position for optional labels
    };
  } catch (error) {
    console.error('Error creating detailed marker:', error);
    // Fallback to simple circle if detailed icon fails
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: category.markerColor,
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: strokeColor,
      scale: 6,
    };
  }
};

// Helper function to extract the SVG path from Lucide icons - we're not using this anymore
// because it was causing issues. Keeping for reference but using hardcoded paths instead.
const getIconPath = (iconComponent) => {
  try {
    // Try to get SVG paths from the icon component
    const iconElement = iconComponent({});
    
    // Handle different icon structure possibilities
    if (iconElement && iconElement.props && iconElement.props.children) {
      // If children is an array, map through and extract paths
      if (Array.isArray(iconElement.props.children)) {
        return iconElement.props.children
          .filter(child => child && child.props && child.props.d)
          .map(child => `<path d="${child.props.d}" />`)
          .join('');
      } 
      // If it's a single child with 'd' property
      else if (iconElement.props.children && iconElement.props.children.props && iconElement.props.children.props.d) {
        return `<path d="${iconElement.props.children.props.d}" />`;
      }
    }
    
    // If we couldn't get the path, use a simple circle as fallback
    return '<circle cx="12" cy="12" r="6" />';
  } catch (error) {
    console.error('Error extracting icon path:', error);
    return '<circle cx="12" cy="12" r="6" />';
  }
};

// Function to create custom cluster icons that show the category colors
export const createClusterIcon = (count, categories, theme = THEME_DARK) => {
  const isDarkMode = theme === THEME_DARK;
  const strokeColor = isDarkMode ? '#FFFFFF' : '#52B788';
  const textColor = '#000000'; // Pure black text for maximum readability
  
  // If we have no categories or only one, use simple cluster
  if (!categories || categories.length <= 1) {
    const backgroundColor = categories && categories.length === 1 
      ? categories[0].markerColor 
      : (isDarkMode ? '#1976D2' : '#52B788');
      
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: backgroundColor,
      fillOpacity: 0.9,
      strokeColor: strokeColor,
      strokeWeight: 2,
      scale: Math.min(10 + Math.log2(count) * 2, 22),
    };
  }
  
  // For multiple categories, create a pie chart style cluster
  try {
    // Limit to max 5 categories for clarity
    const limitedCategories = categories.slice(0, 5);
    
    // Calculate slice angles
    const slices = limitedCategories.map((category, index) => {
      const startAngle = (index / limitedCategories.length) * 2 * Math.PI;
      const endAngle = ((index + 1) / limitedCategories.length) * 2 * Math.PI;
      
      return {
        color: category.markerColor,
        startAngle,
        endAngle
      };
    });
    
    // Size based on count
    const radius = Math.min(12 + Math.log2(count) * 2, 24);
    
    // Create SVG
    let svgPaths = '';
    slices.forEach(slice => {
      const startX = Math.sin(slice.startAngle) * radius + radius;
      const startY = -Math.cos(slice.startAngle) * radius + radius;
      const endX = Math.sin(slice.endAngle) * radius + radius;
      const endY = -Math.cos(slice.endAngle) * radius + radius;
      
      // Create arc path
      const largeArcFlag = slice.endAngle - slice.startAngle > Math.PI ? 1 : 0;
      svgPaths += `
        <path d="M ${radius} ${radius} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z"
              fill="${slice.color}" stroke="${strokeColor}" stroke-width="1" />
      `;
    });
    
    // Use a cleaner text rendering approach with a white background circle and black text
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${radius*2} ${radius*2}" width="${radius*2}" height="${radius*2}">
        ${svgPaths}
        <circle cx="${radius}" cy="${radius}" r="${radius-5}" fill="white" stroke="${strokeColor}" stroke-width="0.5" />
        <text x="${radius}" y="${radius+5}" text-anchor="middle" font-size="${radius/1.8}" font-weight="bold" fill="${textColor}">${count}</text>
      </svg>
    `;
    
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgString),
      scaledSize: new google.maps.Size(radius*2, radius*2),
      anchor: new google.maps.Point(radius, radius)
    };
  } catch (error) {
    console.error('Error creating cluster icon:', error);
    // Fallback
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: isDarkMode ? '#1976D2' : '#52B788',
      fillOpacity: 0.9,
      strokeColor: strokeColor,
      strokeWeight: 2,
      scale: Math.min(10 + Math.log2(count) * 2, 22),
    };
  }
};