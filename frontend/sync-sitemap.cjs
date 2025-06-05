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
        
        // Write the synchronized sitemap to the frontend
        fs.writeFileSync(FRONTEND_SITEMAP_PATH, frontendSitemap, 'utf8');
        
        console.log('✅ Sitemap successfully synced to frontend');
        console.log(`📍 Frontend sitemap saved to: ${FRONTEND_SITEMAP_PATH}`);
        
        // Count URLs in the sitemap
        const urlCount = (frontendSitemap.match(/<loc>/g) || []).length;
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