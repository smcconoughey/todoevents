import {
  MapPin,
  Utensils,
  Music,
  Palette,
  Trophy,
  Car,
  Users,
  Church,
  BookOpen,
  Laptop,
  Plane,
  Ship,
  GraduationCap,
  Award,
  Flame
} from 'lucide-react';

// Helper function to create SVG marker with icon path
const createCategoryMarkerSVG = (color, iconPath) => {
  return `
    <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
      <!-- Diamond shape background -->
      <path 
        d="M20 0 L40 20 L20 50 L0 20 Z" 
        fill="${color}" 
        stroke="white" 
        stroke-width="2"
      />
      <!-- Icon container -->
      <g transform="translate(8, 13)">
        ${iconPath}
      </g>
    </svg>
  `;
};

// Exact SVG paths from Lucide icons
const iconPaths = {
  MapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 2v20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Music: '<path d="M9 18V5l12-2v13" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="16" r="3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Palette: '<circle cx="13.5" cy="6.5" r=".5" fill="white"/><circle cx="17.5" cy="10.5" r=".5" fill="white"/><circle cx="8.5" cy="7.5" r=".5" fill="white"/><circle cx="6.5" cy="12.5" r=".5" fill="white"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 22h16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="17" r="2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 17h6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="17" r="2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Ship: '<path d="M12 10.189V14" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 2v3" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="7" r="4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 21v-2a4 4 0 0 0-3-3.87" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Church: '<path d="M10 9h4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7v5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 22v-4a2 2 0 0 0-4 0v4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 22V5.618a1 1 0 0 0-.553-.894l-4.553-2.277a2 2 0 0 0-1.788 0L6.553 4.724A1 1 0 0 0 6 5.618V22" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m18 7 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.618a1 1 0 0 1 .553-.894L6 7" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  BookOpen: '<path d="M12 7v14" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  GraduationCap: '<path d="M22 10v6M2 10l10-5 10 5-10 5z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Award: '<circle cx="12" cy="8" r="6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  
  Flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
};

const categories = [
  {
    id: 'all',
    name: 'All Events',
    icon: MapPin,
    color: 'text-gray-400',
    markerColor: '#6B7280',
    markerSVG: createCategoryMarkerSVG('#6B7280', iconPaths.MapPin)
  },
  {
    id: 'food-drink',
    name: 'Food & Drink',
    icon: Utensils,
    color: 'text-vibrant-magenta',
    markerColor: '#FF5A87',
    markerSVG: createCategoryMarkerSVG('#FF5A87', iconPaths.Utensils)
  },
  {
    id: 'music',
    name: 'Music',
    icon: Music,
    color: 'text-pin-blue',
    markerColor: '#2684FF',
    markerSVG: createCategoryMarkerSVG('#2684FF', iconPaths.Music)
  },
  {
    id: 'arts',
    name: 'Arts',
    icon: Palette,
    color: 'text-fresh-teal',
    markerColor: '#38D6C0',
    markerSVG: createCategoryMarkerSVG('#38D6C0', iconPaths.Palette)
  },
  {
    id: 'sports',
    name: 'Sports',
    icon: Trophy,
    color: 'text-spark-yellow',
    markerColor: '#F5C842',
    markerSVG: createCategoryMarkerSVG('#F5C842', iconPaths.Trophy)
  },
  {
    id: 'automotive',
    name: 'Automotive',
    icon: Car,
    color: 'text-vibrant-magenta-600',
    markerColor: '#FF2968',
    markerSVG: createCategoryMarkerSVG('#FF2968', iconPaths.Car)
  },
  {
    id: 'airshows',
    name: 'Airshows',
    icon: Plane,
    color: 'text-pin-blue-600',
    markerColor: '#0066FF',
    markerSVG: createCategoryMarkerSVG('#0066FF', iconPaths.Plane)
  },
  {
    id: 'vehicle-sports',
    name: 'Vehicle Sports',
    icon: Ship,
    color: 'text-spark-yellow-600',
    markerColor: '#FFE916',
    markerSVG: createCategoryMarkerSVG('#FFE916', iconPaths.Ship)
  },
  {
    id: 'community',
    name: 'Community',
    icon: Users,
    color: 'text-fresh-teal-600',
    markerColor: '#1BC2A4',
    markerSVG: createCategoryMarkerSVG('#1BC2A4', iconPaths.Users)
  },
  {
    id: 'religious',
    name: 'Religious',
    icon: Church,
    color: 'text-pin-blue-700',
    markerColor: '#0052CC',
    markerSVG: createCategoryMarkerSVG('#0052CC', iconPaths.Church)
  },
  {
    id: 'education',
    name: 'Tech & Education',
    icon: BookOpen,
    color: 'text-fresh-teal-700',
    markerColor: '#159F87',
    markerSVG: createCategoryMarkerSVG('#159F87', iconPaths.BookOpen)
  },
  {
    id: 'veteran',
    name: 'Veteran',
    icon: Award,
    color: 'text-pin-blue-800',
    markerColor: '#003D99',
    markerSVG: createCategoryMarkerSVG('#003D99', iconPaths.Award)
  },
  {
    id: 'cookout',
    name: 'Cookout',
    icon: Flame,
    color: 'text-vibrant-magenta-700',
    markerColor: '#F70049',
    markerSVG: createCategoryMarkerSVG('#F70049', iconPaths.Flame)
  },
  {
    id: 'graduation',
    name: 'Graduation',
    icon: GraduationCap,
    color: 'text-spark-yellow-700',
    markerColor: '#F5D700',
    markerSVG: createCategoryMarkerSVG('#F5D700', iconPaths.GraduationCap)
  }
];

export const getCategory = (id) =>
  categories.find((cat) => cat.id === id) || categories[0];

export default categories;