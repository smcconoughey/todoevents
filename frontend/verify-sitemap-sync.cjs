const https = require('https');
const fs = require('fs');
const path = require('path');

const BACKEND_SITEMAP_URL = 'https://todoevents-backend.onrender.com/sitemap.xml';
const FRONTEND_SITEMAP_PATH = path.join(__dirname, 'public', 'sitemap.xml');

/**
 * Fetches content from a URL
 */
function fetchContent(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: Failed to fetch ${url}`));
                return;
            }
            
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

/**
 * Counts URLs in sitemap content
 */
function countUrls(content) {
    return (content.match(/<loc>/g) || []).length;
}

/**
 * Extracts sample URLs from sitemap content
 */
function extractSampleUrls(content, count = 5) {
    const urlMatches = content.match(/<loc>(.*?)<\/loc>/g) || [];
    return urlMatches
        .slice(0, count)
        .map(match => match.replace(/<\/?loc>/g, ''));
}

/**
 * Verifies sitemap synchronization
 */
async function verifySitemapSync() {
    console.log('🔍 Verifying sitemap synchronization...\n');
    
    try {
        // Fetch backend sitemap
        console.log('📡 Fetching backend sitemap...');
        const backendContent = await fetchContent(BACKEND_SITEMAP_URL);
        const backendUrlCount = countUrls(backendContent);
        console.log(`   ✅ Backend sitemap: ${backendUrlCount} URLs`);
        
        // Check frontend sitemap
        console.log('📁 Checking frontend sitemap...');
        if (!fs.existsSync(FRONTEND_SITEMAP_PATH)) {
            throw new Error('Frontend sitemap not found');
        }
        
        const frontendContent = fs.readFileSync(FRONTEND_SITEMAP_PATH, 'utf8');
        const frontendUrlCount = countUrls(frontendContent);
        console.log(`   ✅ Frontend sitemap: ${frontendUrlCount} URLs`);
        
        // Compare URL counts
        console.log('\n📊 Comparison:');
        console.log(`   Backend URLs:  ${backendUrlCount}`);
        console.log(`   Frontend URLs: ${frontendUrlCount}`);
        console.log(`   Difference:    ${Math.abs(backendUrlCount - frontendUrlCount)}`);
        
        // Check domain replacement
        console.log('\n🔄 Domain verification:');
        const hasBackendDomain = frontendContent.includes('todoevents-backend.onrender.com');
        const hasFrontendDomain = frontendContent.includes('todo-events.com');
        
        console.log(`   Backend domain in frontend: ${hasBackendDomain ? '❌ Found' : '✅ Not found'}`);
        console.log(`   Frontend domain in frontend: ${hasFrontendDomain ? '✅ Found' : '❌ Not found'}`);
        
        // Show sample URLs
        console.log('\n📋 Sample URLs from frontend sitemap:');
        const sampleUrls = extractSampleUrls(frontendContent);
        sampleUrls.forEach((url, index) => {
            console.log(`   ${index + 1}. ${url}`);
        });
        
        // Check for individual event URLs
        console.log('\n🎪 Event URL verification:');
        const eventUrls = (frontendContent.match(/<loc>https:\/\/todo-events\.com\/event\/[^<]+<\/loc>/g) || []).length;
        const shortEventUrls = (frontendContent.match(/<loc>https:\/\/todo-events\.com\/e\/[^<]+<\/loc>/g) || []).length;
        const datedEventUrls = (frontendContent.match(/<loc>https:\/\/todo-events\.com\/events\/\d{4}\/\d{2}\/\d{2}\/[^<]+<\/loc>/g) || []).length;
        
        console.log(`   /event/ URLs: ${eventUrls}`);
        console.log(`   /e/ URLs: ${shortEventUrls}`);
        console.log(`   /events/date/ URLs: ${datedEventUrls}`);
        
        // Check for city-based URLs
        console.log('\n🏙️  City-based URL verification:');
        const weekendUrls = (frontendContent.match(/<loc>https:\/\/todo-events\.com\/this-weekend-in-[^<]+<\/loc>/g) || []).length;
        const freeUrls = (frontendContent.match(/<loc>https:\/\/todo-events\.com\/free-events-in-[^<]+<\/loc>/g) || []).length;
        const todayUrls = (frontendContent.match(/<loc>https:\/\/todo-events\.com\/today-in-[^<]+<\/loc>/g) || []).length;
        
        console.log(`   "This weekend in" URLs: ${weekendUrls}`);
        console.log(`   "Free events in" URLs: ${freeUrls}`);
        console.log(`   "Today in" URLs: ${todayUrls}`);
        
        // Overall sync status
        console.log('\n🎯 Synchronization Status:');
        const isInSync = Math.abs(backendUrlCount - frontendUrlCount) <= 5; // Allow small difference
        const domainsCorrect = !hasBackendDomain && hasFrontendDomain;
        const hasEvents = eventUrls > 0;
        const hasCityPages = weekendUrls > 0;
        
        if (isInSync && domainsCorrect && hasEvents && hasCityPages) {
            console.log('   ✅ SYNCHRONIZED - Sitemap is properly synced');
        } else {
            console.log('   ⚠️  ISSUES DETECTED:');
            if (!isInSync) console.log('      - URL count mismatch');
            if (!domainsCorrect) console.log('      - Domain replacement issues');
            if (!hasEvents) console.log('      - Missing event URLs');
            if (!hasCityPages) console.log('      - Missing city-based URLs');
        }
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        process.exit(1);
    }
}

// Run verification
if (require.main === module) {
    verifySitemapSync().catch(console.error);
}

module.exports = { verifySitemapSync }; 