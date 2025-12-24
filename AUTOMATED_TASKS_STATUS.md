# TodoEvents Automated Tasks Status

## Current Automated Task Setup (Production Only)

The application has a comprehensive automated task management system that runs **only in production** on Render. The system is disabled in development mode to prevent interference with local testing.

### 🤖 AutomatedTaskManager Overview

The `AutomatedTaskManager` class handles all background automation with the following architecture:
- **Scheduler**: Uses APScheduler (Advanced Python Scheduler) with BackgroundScheduler
- **Environment Detection**: Only runs in production (`IS_PRODUCTION = True`)
- **Task Monitoring**: Health checks and status tracking for all tasks
- **Error Handling**: Comprehensive error logging and recovery

---

## 📅 Active Automated Tasks

### 1. **Sitemap Generation** 
- **Frequency**: Every 6 hours
- **Purpose**: Generate dynamic XML sitemap with current event data
- **What it does**:
  - Fetches current and upcoming events (30 days lookback)
  - Builds comprehensive sitemap with static pages + event pages
  - Includes category pages, SEO-friendly URLs
  - Saves sitemap for search engine consumption
  - Pings Google/Bing about sitemap updates
- **Status Endpoint**: `/api/v1/automation/status`

### 2. **Event Data Refresh**
- **Frequency**: Every 6 hours (offset by 2 hours from sitemap)
- **Purpose**: Clean and optimize event data for performance
- **What it does**:
  - Removes expired events (cleanup with 32-day archive policy)
  - Updates search indexes for faster queries
  - Caches popular search queries
  - Optimizes database for AI consumption
- **Benefits**: Keeps database clean, improves API response times

### 3. **AI Tools Synchronization**
- **Frequency**: Every 6 hours (offset by 4 hours from sitemap)
- **Purpose**: Optimize data specifically for AI tools and search integration
- **What it does**:
  - Updates AI-optimized data cache
  - Tests AI endpoint responsiveness
  - Validates structured data (Schema.org)
  - Ensures compatibility with AI search tools
- **API**: Powers the `/api/v1/local-events` endpoint for AI consumption

### 4. **Event Cleanup**
- **Frequency**: Every 6 hours (offset by 3 hours from sitemap)
- **Purpose**: Remove expired events while maintaining 32-day archive policy
- **What it does**:
  - Identifies events past their end date/time
  - Archives events for 32 days before deletion
  - Cleans up related data (interests, views)
  - Prevents database bloat
- **Archive Policy**: Events remain accessible for 32 days after expiry

### 5. **System Health Check**
- **Frequency**: Every 1 hour
- **Purpose**: Monitor automated task health and performance
- **What it does**:
  - Checks if tasks are running on schedule
  - Alerts if tasks haven't run in 8+ hours
  - Monitors system resources
  - Logs health status

---

## 🔧 Manual Task Triggers

Administrative users can manually trigger tasks via API:

### Available Endpoints:
```
GET  /api/v1/automation/status          # Check task status
POST /api/v1/automation/trigger/sitemap_generation
POST /api/v1/automation/trigger/event_refresh  
POST /api/v1/automation/trigger/ai_sync
POST /api/v1/automation/trigger/event_cleanup
```

### Usage Example:
```bash
curl -X POST https://your-app.render.com/api/v1/automation/trigger/sitemap_generation
```

---

## 📊 Task Schedule Timeline

```
Hour 0:  Sitemap Generation
Hour 1:  Health Check
Hour 2:  Event Data Refresh, Health Check  
Hour 3:  Event Cleanup, Health Check
Hour 4:  AI Sync, Health Check
Hour 5:  Health Check
Hour 6:  Sitemap Generation, Health Check
Hour 7:  Health Check
Hour 8:  Event Data Refresh, Health Check
...continues every 6 hours with 1-hour health checks...
```

---

## 🚨 Task Monitoring & Alerts

### Health Check Monitoring:
- ✅ **Normal**: Tasks run within expected timeframe
- ⚠️  **Warning**: Task hasn't run in 6-8 hours
- ❌ **Alert**: Task hasn't run in 8+ hours

### Status Tracking:
Each task maintains status information:
- `status`: "pending", "completed", "failed"
- `last_run`: ISO timestamp of last execution
- `next_run`: Scheduled next execution time

### Logging:
- All task executions are logged with timestamps
- Errors include full stack traces for debugging
- Health checks log system status every hour

---

## 🛠️ Production Benefits

### Performance Optimization:
- **Faster API Responses**: Pre-cached popular queries
- **Optimized Database**: Regular cleanup prevents bloat
- **Updated Sitemaps**: Fresh content for search engines

### SEO & Discovery:
- **Dynamic Sitemaps**: Always current with latest events
- **Search Engine Pings**: Proactive search engine notification
- **Structured Data**: Maintained Schema.org compliance

### AI Integration:
- **AI-Ready Data**: Optimized format for AI tools
- **Fast AI Endpoints**: Pre-processed data for quick responses
- **Tool Compatibility**: Regular validation ensures compatibility

---

## 🔒 Security & Reliability

### Environment Safety:
- Tasks only run in production environment
- Development mode completely disables automation
- Prevents interference with local testing

### Error Recovery:
- Individual task failures don't affect others
- Comprehensive error logging for debugging
- Graceful degradation if tasks fail

### Resource Management:
- Tasks are offset to prevent resource contention
- Background execution doesn't block API requests
- Efficient database operations with proper indexing

---

## 📈 Current Status

**System Status**: ✅ Operational
**Environment**: Production-only (disabled in development)
**Next Review**: Monitor logs for any task failures
**Performance**: All tasks completing within expected timeframes

The automated task system is essential for maintaining TodoEvents' performance, SEO ranking, and AI tool compatibility in production. 