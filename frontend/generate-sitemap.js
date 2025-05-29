#!/usr/bin/env node

/**
 * Dynamic Sitemap Generator for todo-events.com
 * 
 * This script generates an up-to-date sitemap.xml file with:
 * - Current date timestamps
 * - Dynamic event URLs (when integrated with API)
 * - All static pages and category combinations
 * 
 * Usage:
 *   node generate-sitemap.js
 *   npm run generate-sitemap
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DOMAIN = 'https://todo-events.com';
const SITEMAP_PATH = path.join(__dirname, 'public', 'sitemap.xml');

// Get current date in ISO format
const getCurrentDate = () => {
  return new Date().toISOString().split('T')[0];
};

// Categories for event pages
const CATEGORIES = ['food-drink', 'music', 'arts', 'sports', 'community'];

// Major cities for location-based SEO
const MAJOR_CITIES = [
  'new-york-ny', 'los-angeles-ca', 'chicago-il', 'san-francisco-ca',
  'miami-fl', 'austin-tx', 'seattle-wa', 'denver-co', 'atlanta-ga',
  'boston-ma', 'portland-or', 'nashville-tn', 'philadelphia-pa',
  'phoenix-az', 'san-diego-ca', 'minneapolis-mn', 'detroit-mi'
];

// Time-based search terms
const TIME_FILTERS = [
  'today', 'tomorrow', 'this-weekend', 'this-week', 'next-week', 'this-month'
];

// Generate URL entry
const createUrlEntry = (loc, lastmod, changefreq, priority, imageInfo = null) => {
  let entry = `  <url>
    <loc>${DOMAIN}${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>`;
  
  if (imageInfo) {
    entry += `
    <image:image>
      <image:loc>${DOMAIN}${imageInfo.loc}</image:loc>
      <image:caption>${imageInfo.caption}</image:caption>
    </image:image>`;
  }
  
  entry += `
  </url>`;
  
  return entry;
};

// Fetch events from API (if available)
const fetchEvents = async () => {
  try {
    // This would be your API endpoint
    // const response = await fetch(`${API_URL}/events`);
    // const events = await response.json();
    // return events;
    
    // For now, return empty array - you can integrate with your API later
    return [];
  } catch (error) {
    console.warn('Could not fetch events from API:', error.message);
    return [];
  }
};

// Generate sitemap content
const generateSitemap = async () => {
  const currentDate = getCurrentDate();
  const events = await fetchEvents();
  
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

  <!-- Homepage - Primary landing page -->
${createUrlEntry('/', currentDate, 'daily', '1.0', {
  loc: '/images/pin-logo.svg',
  caption: 'todo-events logo - Local event discovery platform'
})}

  <!-- Main Category Pages -->`;

  // Add category pages
  CATEGORIES.forEach(category => {
    sitemap += `
${createUrlEntry(`/?category=${category}`, currentDate, 'weekly', '0.9')}`;
  });

  sitemap += `

  <!-- Alternative Category Page Formats for SEO -->`;
  
  CATEGORIES.forEach(category => {
    sitemap += `
${createUrlEntry(`/events/${category}`, currentDate, 'weekly', '0.8')}`;
  });

  sitemap += `

  <!-- Location-based pages (major cities for SEO) -->`;
  
  MAJOR_CITIES.forEach(city => {
    sitemap += `
${createUrlEntry(`/?location=${city}`, currentDate, 'daily', '0.8')}`;
  });

  sitemap += `

  <!-- Time-based event pages -->`;
  
  TIME_FILTERS.forEach(timeFilter => {
    const priority = timeFilter === 'today' || timeFilter === 'tomorrow' ? '0.9' : '0.8';
    const changefreq = timeFilter === 'today' ? 'hourly' : 'daily';
    sitemap += `
${createUrlEntry(`/?date=${timeFilter}`, currentDate, changefreq, priority)}`;
  });

  sitemap += `

  <!-- Popular event combinations for long-tail SEO -->`;
  
  // Category + date combinations
  const popularCombos = [
    ['food-drink', 'today'],
    ['music', 'this-weekend'],
    ['arts', 'this-week'],
    ['sports', 'this-weekend'],
    ['community', 'this-week']
  ];
  
  popularCombos.forEach(([category, date]) => {
    sitemap += `
${createUrlEntry(`/?category=${category}&amp;date=${date}`, currentDate, 'daily', '0.7')}`;
  });

  sitemap += `

  <!-- City + Category combinations for better local SEO -->`;
  
  // Top city + category combinations
  const cityCategories = [
    ['new-york-ny', 'food-drink'],
    ['los-angeles-ca', 'music'],
    ['chicago-il', 'arts'],
    ['san-francisco-ca', 'community'],
    ['miami-fl', 'food-drink'],
    ['austin-tx', 'music'],
    ['seattle-wa', 'arts'],
    ['boston-ma', 'sports']
  ];
  
  cityCategories.forEach(([city, category]) => {
    sitemap += `
${createUrlEntry(`/?location=${city}&amp;category=${category}`, currentDate, 'daily', '0.6')}`;
  });

  // Add individual event pages if events are available
  if (events.length > 0) {
    sitemap += `

  <!-- Individual Event Pages -->`;
    
    events.forEach(event => {
      const eventDate = event.created_at || currentDate;
      sitemap += `
${createUrlEntry(`/event/${event.id}`, eventDate, 'weekly', '0.6')}`;
    });
  }

  sitemap += `

  <!-- Static informational pages (for future expansion) -->
${createUrlEntry('/about', currentDate, 'monthly', '0.6')}
${createUrlEntry('/how-it-works', currentDate, 'monthly', '0.6')}
${createUrlEntry('/create-event', currentDate, 'weekly', '0.7')}
${createUrlEntry('/contact', currentDate, 'monthly', '0.5')}
${createUrlEntry('/privacy', currentDate, 'quarterly', '0.3')}
${createUrlEntry('/terms', currentDate, 'quarterly', '0.3')}

  <!-- Event discovery landing pages -->
${createUrlEntry('/discover', currentDate, 'weekly', '0.6')}
${createUrlEntry('/near-me', currentDate, 'daily', '0.8')}

  <!-- Note: This sitemap was automatically generated on ${currentDate} -->
  <!-- Individual event URLs are dynamically generated when events are available -->

</urlset>`;

  return sitemap;
};

// Write sitemap to file
const writeSitemap = async () => {
  try {
    console.log('🔄 Generating sitemap...');
    
    const sitemapContent = await generateSitemap();
    
    // Ensure public directory exists
    const publicDir = path.dirname(SITEMAP_PATH);
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Write sitemap file
    fs.writeFileSync(SITEMAP_PATH, sitemapContent, 'utf8');
    
    console.log('✅ Sitemap generated successfully!');
    console.log(`📁 Location: ${SITEMAP_PATH}`);
    console.log(`🌐 URL: ${DOMAIN}/sitemap.xml`);
    
    // Calculate stats
    const urlCount = (sitemapContent.match(/<url>/g) || []).length;
    console.log(`📊 Total URLs: ${urlCount}`);
    
  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    process.exit(1);
  }
};

// Check if this script is being run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  writeSitemap();
}

export { generateSitemap, writeSitemap }; 