# Sitemap Synchronization Guide

## Overview

This guide explains how the sitemap synchronization works between the backend (`https://todoevents-backend.onrender.com/sitemap.xml`) and the frontend (`https://www.todo-events.com/sitemap.xml`).

## Architecture

### Backend Sitemap (Source of Truth)
- **URL**: `https://todoevents-backend.onrender.com/sitemap.xml`
- **Type**: Dynamic, auto-generated
- **Content**: 413+ URLs including:
  - Homepage and main navigation pages
  - Category pages (food-drink, music, arts, etc.)
  - Individual event URLs with multiple formats:
    - `/event/slug` (primary)
    - `/e/slug` (short format)
    - `/events/yyyy/mm/dd/slug` (dated format)
  - City-based discovery pages (25+ major cities)
  - Time-based discovery pages (today, tonight, this-weekend)
  - SEO-optimized content discovery pages

### Frontend Sitemap (Synchronized Copy)
- **URL**: `https://www.todo-events.com/sitemap.xml`
- **Type**: Static file, synchronized from backend
- **Location**: `frontend/public/sitemap.xml`

## Synchronization Process

### Automatic Sync (During Build)
The sitemap is automatically synchronized during the frontend build process:

1. **Build Command**: `npm run build`
2. **Pre-build Step**: `npm run sync-sitemap`
3. **Sync Script**: `frontend/sync-sitemap.cjs`
4. **Domain Replacement**: Replaces `todoevents-backend.onrender.com` with `todo-events.com`

### Manual Sync
You can manually sync the sitemap at any time:

```bash
cd frontend
npm run sync-sitemap
```

### Sync Script Details
**File**: `frontend/sync-sitemap.cjs`

**Features**:
- Fetches latest sitemap from backend
- Replaces backend domain with frontend domain
- Creates fallback sitemap if sync fails
- Provides detailed logging and URL count
- Error handling with graceful fallbacks

## Usage Examples

### Manual Sync
```bash
# Navigate to frontend directory
cd frontend

# Sync sitemap manually
node sync-sitemap.cjs

# Or use npm script
npm run sync-sitemap
```

### Build with Sync
```bash
# Frontend build (includes automatic sync)
npm run build

# The build process will:
# 1. Sync sitemap from backend
# 2. Install dependencies
# 3. Build the frontend
# 4. Deploy with updated sitemap
```

## Sitemap Content Analysis

### Current Status (as of June 5, 2025)
- **Total URLs**: 413
- **Individual Events**: 40+ events with 3 URL formats each
- **City Pages**: 25 major cities × 4 page types = 100 URLs
- **Category Pages**: 16 event categories
- **Discovery Pages**: 50+ SEO-optimized pages

### URL Structure Examples

#### Individual Events
```xml
<!-- Primary event URL -->
<url>
  <loc>https://todo-events.com/event/michigan-antique-festival-midland</loc>
  <lastmod>2025-06-01</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.85</priority>
</url>

<!-- Short format -->
<url>
  <loc>https://todo-events.com/e/michigan-antique-festival-midland</loc>
  <lastmod>2025-06-01</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>

<!-- Dated format -->
<url>
  <loc>https://todo-events.com/events/2025/05/31/michigan-antique-festival-midland</loc>
  <lastmod>2025-06-01</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.75</priority>
</url>
```

#### City-Based Discovery
```xml
<!-- "This weekend in" pages -->
<url>
  <loc>https://todo-events.com/this-weekend-in-new-york</loc>
  <lastmod>2025-06-05</lastmod>
  <changefreq>daily</changefreq>
  <priority>0.75</priority>
</url>

<!-- "Free events in" pages -->
<url>
  <loc>https://todo-events.com/free-events-in-new-york</loc>
  <lastmod>2025-06-05</lastmod>
  <changefreq>daily</changefreq>
  <priority>0.7</priority>
</url>
```

## Deployment Integration

### Render.com Deployment
The sitemap sync is integrated into the Render deployment process:

**Build Command**: `npm ci && npm run build`

This ensures every deployment includes the latest sitemap from the backend.

### Verification Steps
After deployment, verify synchronization:

1. **Backend Sitemap**: Check `https://todoevents-backend.onrender.com/sitemap.xml`
2. **Frontend Sitemap**: Check `https://www.todo-events.com/sitemap.xml`
3. **URL Count**: Both should have the same number of URLs
4. **Content**: URLs should be identical except for domain names

## Monitoring and Maintenance

### Health Checks
- **Daily**: Automatic sync during builds
- **Manual**: Run sync script when needed
- **Monitoring**: Check URL count consistency

### Troubleshooting

#### Sync Failures
If sync fails, the script creates a fallback sitemap with basic pages:
- Homepage
- Hosts page
- Creators page

#### Debug Information
The sync script provides detailed logging:
```
🔄 Syncing sitemap from backend...
✅ Sitemap successfully synced to frontend
📍 Frontend sitemap saved to: /path/to/sitemap.xml
📊 Total URLs in sitemap: 413
```

#### Common Issues
1. **Network Issues**: Backend temporarily unreachable
   - **Solution**: Automatic fallback sitemap created
   
2. **Domain Mismatch**: URLs not properly replaced
   - **Solution**: Check regex pattern in sync script
   
3. **Build Failures**: Sync script errors during build
   - **Solution**: Fallback ensures build continues

## SEO Benefits

### Comprehensive Coverage
- **Individual Event Pages**: Direct search engine access to events
- **City-Based Discovery**: Local SEO optimization
- **Category Organization**: Topic-based content discovery
- **Multiple URL Formats**: Flexible linking and sharing

### Search Engine Optimization
- **Fresh Content**: Dynamic generation ensures up-to-date content
- **Proper Metadata**: Change frequency and priority settings
- **Structured URLs**: SEO-friendly URL patterns
- **Geographic Targeting**: City-specific pages for local search

## Technical Implementation

### Backend (Source)
```python
@app.get("/sitemap.xml")
async def get_dynamic_sitemap():
    # Dynamic sitemap generation with current events
    # Includes individual event URLs, city pages, categories
    # Returns XML sitemap with 400+ URLs
```

### Frontend (Sync)
```javascript
// sync-sitemap.cjs
const BACKEND_SITEMAP_URL = 'https://todoevents-backend.onrender.com/sitemap.xml';
const FRONTEND_SITEMAP_PATH = path.join(__dirname, 'public', 'sitemap.xml');

async function syncSitemap() {
    // Fetch backend sitemap
    // Replace domain names
    // Save to frontend public directory
}
```

### Build Integration
```json
{
  "scripts": {
    "build": "npm run sync-sitemap && npm install tailwindcss-animate && vite build",
    "sync-sitemap": "node sync-sitemap.cjs"
  }
}
```

## Conclusion

The sitemap synchronization system ensures that:
1. **Frontend and backend sitemaps are always in sync**
2. **Search engines discover all event pages automatically**
3. **SEO optimization is maintained across deployments**
4. **Fallback mechanisms prevent deployment failures**

The system provides 413+ URLs for comprehensive search engine coverage while maintaining automated synchronization and error resilience. 