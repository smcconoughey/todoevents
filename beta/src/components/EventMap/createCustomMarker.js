// Function to create SVG marker icons for each category
const createSvgMarker = (category) => {
  const icons = {
    'Food & Drink': `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="20" fill="#F97316" stroke="white" stroke-width="2"/>
        <path d="M16 18h2l1 15h-4l1-15zm8-3h2l.5 18h-3l.5-18zm7 3c4 0 4 3 4 6s-4 9-4 9h-2l1-15h1z" fill="white"/>
      </svg>
    `,
    'Music': `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="20" fill="#A855F7" stroke="white" stroke-width="2"/>
        <path d="M32 16l-12 4v12c-1-1-2-1-4-1-3 0-4 2-4 4s2 4 4 4 4-2 4-4V24l8-2v6c-1-1-2-1-4-1-3 0-4 2-4 4s2 4 4 4 4-2 4-4V16z" fill="white"/>
      </svg>
    `,
    'Arts': `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="20" fill="#3B82F6" stroke="white" stroke-width="2"/>
        <path d="M24 16c-8 0-12 8-12 8s4 8 12 8 12-8 12-8-4-8-12-8zm0 13a5 5 0 100-10 5 5 0 000 10z" fill="white"/>
      </svg>
    `,
    'Sports': `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="20" fill="#22C55E" stroke="white" stroke-width="2"/>
        <path d="M24 14l-6 6h12l-6-6zm-8 8v4h16v-4H16zm2 6l6 6 6-6H18z" fill="white"/>
      </svg>
    `,
    'Automotive': `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="20" fill="#EF4444" stroke="white" stroke-width="2"/>
        <path d="M34 24l-2-6H16l-2 6h-2v4h2v2h4v-2h12v2h4v-2h2v-4h-2zm-17-4h14l1.5 4h-17l1.5-4zm1 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm14 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" fill="white"/>
      </svg>
    `,
    'Community': `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="20" fill="#EAB308" stroke="white" stroke-width="2"/>
        <path d="M24 14a4 4 0 100 8 4 4 0 000-8zm-8 18v2h16v-2c0-5.33-3.33-8-8-8s-8 2.67-8 8zm20-9a3 3 0 100-6 3 3 0 000 6zM12 23a3 3 0 100-6 3 3 0 000 6zm24 5v2h6v-2c0-3.33-2-5-4.5-5-1 0-2 .25-2.75.75.75 1.25 1.25 3 1.25 4.25zM10 30v-2c0-1.25.5-3 1.25-4.25C10.5 23.25 9.5 23 8.5 23 6 23 4 24.67 4 28v2h6z" fill="white"/>
      </svg>
    `,
    'Religious': `
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="20" fill="#6366F1" stroke="white" stroke-width="2"/>
        <path d="M24 14v4h-4v4h4v12h4V22h4v-4h-4v-4h-4z" fill="white"/>
      </svg>
    `
  };

  const svg = icons[category] || icons['Community'];
  
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(48, 48),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(24, 24)
  };
};

// Function to create animated pulse effect for new events
const createPulseEffect = (marker) => {
  let scale = 1;
  let growing = true;

  setInterval(() => {
    if (growing) {
      scale += 0.02;
      if (scale >= 1.2) growing = false;
    } else {
      scale -= 0.02;
      if (scale <= 1) growing = true;
    }

    marker.setIcon({
      ...marker.getIcon(),
      scaledSize: new google.maps.Size(48 * scale, 48 * scale)
    });
  }, 50);
};

export { createSvgMarker, createPulseEffect };