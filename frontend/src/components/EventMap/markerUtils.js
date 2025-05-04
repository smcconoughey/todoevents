export const createMarkerIcon = (category, isDetailed = false) => {
  if (!isDetailed) {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: category.markerColor,
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
      scale: 6,
    };
  }

  try {
    // Get the raw SVG path from the Lucide icon
    const iconElement = category.icon({});
    const pathData = iconElement.props.children[0].props.d;

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="15" fill="${category.markerColor}" stroke="white" stroke-width="2"/>
        <g transform="translate(8,8) scale(0.66)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="${pathData}"/>
        </g>
      </svg>
    `;

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgString),
      scaledSize: new google.maps.Size(32, 32),
      anchor: new google.maps.Point(16, 16)
    };
  } catch (error) {
    console.error('Error creating detailed marker:', error);
    // Fallback to simple circle if detailed icon fails
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: category.markerColor,
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#FFFFFF',
      scale: 6,
    };
  }
};