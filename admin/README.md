# todo-events Admin Dashboard

A standalone admin dashboard for managing the todo-events application.

## Features

- **User Management**: View, manage, and moderate users
- **Event Management**: Monitor and manage all events
- **Analytics Dashboard**: View statistics and insights
- **Moderation Tools**: Content moderation and administration

## Deployment Options

### Option 1: Deploy to Render.com (Recommended)

1. **Create a new Render.com Static Site**:
   - Go to [Render.com](https://render.com)
   - Click "New" → "Static Site"
   - Connect your GitHub repository
   - Set the following configuration:
     - **Name**: `todoevents-admin` (or your preferred name)
     - **Root Directory**: `admin`
     - **Build Command**: `npm ci && npm run build`
     - **Publish Directory**: `admin/dist`

2. **Environment Variables**:
   - Add the following environment variable in Render.com:
     - `VITE_API_URL`: `https://todoevents-backend.onrender.com`

3. **Deploy**: Render will automatically build and deploy your admin dashboard

### Option 2: Deploy to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Deploy from the admin directory**:
   ```bash
   cd admin
   vercel --prod
   ```

3. **Set Environment Variables**:
   - In Vercel dashboard, add:
     - `VITE_API_URL`: `https://todoevents-backend.onrender.com`

### Option 3: Deploy to Netlify

1. **Build the project**:
   ```bash
   cd admin
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
   cd admin
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

4. **Access the dashboard**:
   - Open http://localhost:5174
   - Login with admin credentials


## Configuration

### Backend Connection

The admin dashboard connects to the backend API using the `VITE_API_URL` environment variable:

- **Production**: `https://todoevents-backend.onrender.com`
- **Local Development**: `http://localhost:8000`

### API Endpoints Used

- `POST /token` - Authentication
- `GET /users/me` - Get current user details
- `GET /admin/users` - Get all users (admin only)
- `GET /events` - Get all events
- `DELETE /admin/users/{id}` - Delete user (admin only)
- `PUT /admin/users/{id}/role` - Update user role (admin only)

## Troubleshooting

### Connection Issues

1. **Check API URL**: Ensure `VITE_API_URL` is correctly set
2. **Check Backend**: Verify the backend at https://todoevents-backend.onrender.com/health
3. **CORS Issues**: The backend should handle CORS for .onrender.com domains
4. **Check Console**: Open browser dev tools for detailed error messages

### Authentication Issues

1. **Clear Storage**: Clear localStorage and try again
2. **Check Credentials**: Verify admin credentials are correct
3. **Token Expiry**: Tokens expire after 30 minutes

### Build Issues

1. **Node Version**: Ensure Node.js 18+ is installed
2. **Clean Install**: Delete node_modules and run `npm ci`
3. **Environment Variables**: Ensure all required env vars are set

## Architecture

```
admin/
├── src/
│   ├── AdminDashboard.jsx  # Main dashboard component
│   ├── main.jsx           # Entry point
│   └── index.css          # Styles
├── public/                # Static assets
├── dist/                  # Built files (after npm run build)
├── .env                   # Environment variables
├── vite.config.js         # Vite configuration
├── render.yaml            # Render.com deployment config
└── package.json           # Dependencies and scripts
```

## Security Notes

- Admin dashboard requires authentication
- Only users with 'admin' role can access
- API tokens expire automatically
- All API requests include authentication headers
- Environment variables should never be committed to version control

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify backend connectivity at `/health` endpoint
3. Ensure proper admin credentials and permissions 