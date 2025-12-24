const fs = require('fs');
const https = require('https');
const path = require('path');

const BACKEND_SITEMAP_URL = 'https://todoevents-backend.onrender.com/sitemap.xml';
const FRONTEND_SITEMAP_PATH = path.join(__dirname, 'public', 'sitemap.xml');

/**
 * Fetches the sitemap from the backend and saves it to the frontend public directory
 */
async function syncSitemap() {
    console.log('🔄 Syncing sitemap from backend...');
    
    try {
        const sitemapContent = await fetchSitemap(BACKEND_SITEMAP_URL);
        
        // Replace backend domain with frontend domain in the sitemap
        const frontendSitemap = sitemapContent.replace(
            /https:\/\/todoevents-backend\.onrender\.com/g,
            'https://todo-events.com'
        );
        
        // Post-process to ensure alternate event URL formats exist
        const enhancedSitemap = addAlternateEventUrls(frontendSitemap);
        
        // Write the synchronized sitemap to the frontend
        fs.writeFileSync(FRONTEND_SITEMAP_PATH, enhancedSitemap, 'utf8');
        
        console.log('✅ Sitemap successfully synced to frontend');
        console.log(`📍 Frontend sitemap saved to: ${FRONTEND_SITEMAP_PATH}`);
        
        // Count URLs in the sitemap
        const urlCount = (enhancedSitemap.match(/<loc>/g) || []).length;
        console.log(`📊 Total URLs in sitemap: ${urlCount}`);
        
    } catch (error) {
        console.error('❌ Failed to sync sitemap:', error.message);
        
        // Create a fallback sitemap if sync fails
        createFallbackSitemap();
    }
}

/**
 * Fetches content from a URL using https
 */
function fetchSitemap(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: Failed to fetch sitemap`));
                return;
            }
            
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

/**
 * Creates a basic fallback sitemap if backend sync fails
 */
function createFallbackSitemap() {
    console.log('🔧 Creating fallback sitemap...');
    
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://todo-events.com/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://todo-events.com/hosts</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://todo-events.com/creators</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://todo-events.com/flyer</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`;

    fs.writeFileSync(FRONTEND_SITEMAP_PATH, fallbackSitemap, 'utf8');
    console.log('✅ Fallback sitemap created');
}

/**
 * Main function with CLI support
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Sitemap Sync Tool
Usage: node sync-sitemap.js [options]

Options:
  --help, -h     Show this help message
  --watch, -w    Watch for changes and auto-sync (not implemented yet)
  
Description:
  Syncs the sitemap from the backend (${BACKEND_SITEMAP_URL}) 
  to the frontend public directory, replacing domain names as needed.
        `);
        return;
    }
    
    await syncSitemap();
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { syncSitemap }; 

/**
 * Adds alternate URL patterns for each event entry so we always have:
 *   /events/<slug-id>
 *   /e/<slug-id>
 *   /events/YYYY/MM/DD/<slug-id> (if original contained the date)
 */
function addAlternateEventUrls(xml) {
    const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
    const existingUrls = new Set();
    urlBlocks.forEach(block => {
        const locMatch = block.match(/<loc>(.*?)<\/loc>/);
        if (locMatch) {
            existingUrls.add(locMatch[1]);
        }
    });

    let additions = '';

    urlBlocks.forEach(block => {
        const locMatch = block.match(/<loc>(.*?)<\/loc>/);
        const lastModMatch = block.match(/<lastmod>(.*?)<\/lastmod>/);
        if (!locMatch) return;
        const url = locMatch[1];
        const lastmod = lastModMatch ? lastModMatch[1] : new Date().toISOString().split('T')[0];

        // Extract slug-id (last segment)
        const slugId = url.split('/').pop();

        // Determine date parts if present
        const datePattern = /\/events\/(\d{4})\/(\d{2})\/(\d{2})\//;
        const dateMatch = url.match(datePattern);
        let ymdPath = '';
        if (dateMatch) {
            ymdPath = `/events/${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}/${slugId}`;
        }

        const basePath = `/events/${slugId}`;
        const shortPath = `/e/${slugId}`;

        [basePath, shortPath, ymdPath].forEach(p => {
            if (p && !existingUrls.has(`https://todo-events.com${p}`)) {
                additions += `  <url>\n` +
                    `    <loc>https://todo-events.com${p}</loc>\n` +
                    `    <lastmod>${lastmod}</lastmod>\n` +
                    `    <changefreq>monthly</changefreq>\n` +
                    `    <priority>0.75</priority>\n` +
                    `  </url>\n`;
                existingUrls.add(`https://todo-events.com${p}`);
            }
        });
    });

    if (!additions) return xml; // nothing new

    // Insert before closing tag
    return xml.replace('</urlset>', `${additions}</urlset>`);
} 