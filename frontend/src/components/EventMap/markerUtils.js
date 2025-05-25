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
    
    // Set default icon paths based on category
    switch(category.id) {
      case 'music':
        iconPath = 'M9 18V5l12-2v13';
        break;
      case 'food-drink':
        iconPath = 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2';
        break;
      case 'arts':
        iconPath = 'M12 19l7-7 3 3-7 7-3-3z';
        break;
      case 'sports':
        iconPath = 'M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z';
        break;
      case 'automotive':
        iconPath = 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2';
        break;
      case 'airshows':
        iconPath = 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z';
        break;
      case 'vehicle-sports':
        iconPath = 'M12 10.189V14 M12 2v3 M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6';
        break;
      case 'community':
        iconPath = 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75';
        break;
      case 'religious':
        iconPath = 'M18 22V5.618a1 1 0 0 0-.553-.894l-4.553-2.277a2 2 0 0 0-1.788 0L6.553 4.724A1 1 0 0 0 6 5.618V22 M10 9h4 M12 7v5';
        break;
      case 'education':
        iconPath = 'M2 10l10-5 10 5-10 5z M6 12v5c0 2 2 3 6 3s6-1 6-3v-5';
        break;
      case 'veteran':
        iconPath = 'M15.477 12.89 17 22l-5-3-5 3 1.523-9.11';
        break;
      case 'cookout':
        iconPath = 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z';
        break;
      case 'graduation':
        iconPath = 'M22 10v6M2 10l10-5 10 5-10 5z';
        break;
      case 'all':
      default:
        // Default location pin icon
        iconPath = 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z';
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
        <g transform="translate(12, 10)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
  const textColor = isDarkMode ? '#333333' : '#333333'; // Dark text for better contrast on both themes
  
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
    
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${radius*2} ${radius*2}" width="${radius*2}" height="${radius*2}">
        ${svgPaths}
        <circle cx="${radius}" cy="${radius}" r="${radius-6}" fill="white" />
        <text x="${radius}" y="${radius+5}" text-anchor="middle" font-size="${radius/1.5}" font-weight="bold" fill="${textColor}">${count}</text>
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