# todo-events Beta Dashboard

A standalone beta dashboard for previewing upcoming features and testing new functionality.

## 🚀 Beta Features

This dashboard contains experimental features and upcoming functionality that may not be available in the main admin dashboard yet. Features include:

- **Beta Features Preview**: Early access to upcoming features
- **Enhanced Analytics**: Advanced metrics and insights (Preview)
- **User Groups**: Organize users by roles or interests (Development)
- **Smart Scheduling**: AI-powered event scheduling (Coming Soon)
- **Custom Workflows**: Build automated processes (Beta Testing)

## ⚠️ Beta Notice

**This is a beta version** - features may be unstable and are subject to change. Please report any issues or feedback to the development team.

## Deployment Options

### Option 1: Deploy to Render.com (Recommended)

1. **Create a new Render.com Static Site**:
   - Go to [Render.com](https://render.com)
   - Click "New" → "Static Site"
   - Connect your GitHub repository
   - Set the following configuration:
     - **Name**: `todoevents-beta` (or your preferred name)
     - **Root Directory**: `beta`
     - **Build Command**: `npm ci && npm run build`
     - **Publish Directory**: `beta/dist`

2. **Environment Variables**:
   - Add the following environment variable in Render.com:
     - `VITE_API_URL`: `https://todoevents-backend.onrender.com`

3. **Deploy**: Render will automatically build and deploy your beta dashboard

### Option 2: Deploy to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Deploy from the beta directory**:
   ```bash
   cd beta
   vercel --prod
   ```

3. **Set Environment Variables**:
   - In Vercel dashboard, add:
     - `VITE_API_URL`: `https://todoevents-backend.onrender.com`

### Option 3: Deploy to Netlify

1. **Build the project**:
   ```bash
   cd beta
   npm ci
   npm run build
   ```

2. **Deploy the dist folder** to Netlify:
   - Drag and drop the `dist` folder to Netlify
   - Or use Netlify CLI:
     ```bash
     netlify deploy --prod --dir=dist
     ```

3. **Configure Environment Variables** in Netlify dashboard:
   - `VITE_API_URL`: `https://todoevents-backend.onrender.com`

## Local Development

1. **Install dependencies**:
   ```bash
   cd beta
   npm install
   ```

2. **Create environment file**:
   ```bash
   echo 'VITE_API_URL=https://todoevents-backend.onrender.com' > .env
   # For local backend development, use:
   # echo 'VITE_API_URL=http://localhost:8000' > .env
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Access the beta dashboard**:
   - Open http://localhost:5175
   - Login with admin credentials

## Default Admin Credentials

**Email**: `admin@todoevents.com`  
**Password**: `Admin123!`

⚠️ **Important**: Change the default password after first login!

## What's Different from Admin Dashboard

### New Features in Beta:
- ⚡ **Beta Features Tab**: Preview upcoming functionality
- 🔬 **Experimental Tools**: Test new admin capabilities
- 📊 **Enhanced Analytics Preview**: Next-generation metrics
- 👥 **User Groups Management**: Role-based organization
- 🤖 **Smart Scheduling**: AI-powered recommendations
- ⚙️ **Custom Workflows**: Automated process builders

### Beta-Specific UI:
- 🟡 Beta indicators and warnings throughout the interface
- 📋 Feature status tracking (Active, Testing, Coming Soon)
- 💬 Direct feedback channels to development team
- 📝 Beta testing program enrollment

## Configuration

### Backend Connection

The beta dashboard connects to the same backend API as the admin dashboard:

- **Production**: `https://todoevents-backend.onrender.com`
- **Local Development**: `http://localhost:8000`

### API Endpoints Used

All standard admin endpoints plus experimental beta endpoints:

- `POST /token` - Authentication
- `GET /users/me` - Get current user details
- `GET /admin/users` - Get all users (admin only)
- `GET /events` - Get all events
- `DELETE /admin/users/{id}` - Delete user (admin only)
- `PUT /admin/users/{id}/role` - Update user role (admin only)
- Beta endpoints (coming soon)

## Troubleshooting

### Connection Issues

1. **Check API URL**: Ensure `VITE_API_URL` is correctly set
2. **Check Backend**: Verify the backend at https://todoevents-backend.onrender.com/health
3. **CORS Issues**: The backend should handle CORS for .onrender.com domains
4. **Check Console**: Open browser dev tools for detailed error messages

### Beta-Specific Issues

1. **Feature Not Working**: Check if it's marked as "Coming Soon" or "In Development"
2. **UI Glitches**: Clear browser cache and try again
3. **Data Sync**: Beta features may have delayed data synchronization

## Architecture

```
beta/
├── src/
│   ├── AdminDashboard.jsx  # Main beta dashboard (renamed BetaDashboard)
│   ├── main.jsx           # Entry point
│   └── index.css          # Styles
├── public/                # Static assets (copied from admin)
├── dist/                  # Built files (after npm run build)
├── .env                   # Environment variables
├── vite.config.js         # Vite configuration (port 5175)
├── render.yaml            # Render.com deployment config
└── package.json           # Dependencies and scripts
```

## Beta Testing Program

### How to Participate:
1. Use the beta dashboard regularly
2. Test new features as they become available
3. Report bugs and provide feedback
4. Suggest improvements and new features

### Current Beta Status:
- ✅ **Enhanced Bulk Import**: Active and stable
- 🧪 **Advanced User Management**: Testing phase
- ⏳ **Real-time Notifications**: Coming soon
- 📱 **Mobile App Integration**: Development
- 🔧 **API v2 Endpoints**: Development

## Support

For beta-specific issues or feedback:
1. Check the Beta Features tab for known issues
2. Use the feedback buttons in the beta dashboard
3. Check browser console for error messages
4. Verify proper admin credentials and permissions

## Security Notes

- Same security model as admin dashboard
- Admin authentication required
- Only users with 'admin' role can access
- Beta features may have additional logging for debugging
- Environment variables should never be committed to version control

---

**🚧 This is beta software** - Use in production environments with caution and always have backups ready! 