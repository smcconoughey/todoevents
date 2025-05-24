# Render Deployment Fix for TodoEvents

## Frontend Build Issues Fixed

I've fixed the frontend build issue that was causing the "vite: not found" error during deployment. This is a common problem with Render's static site deployments. The changes include:

1. **Moved build dependencies**: Moved Vite and related packages from `devDependencies` to `dependencies` in package.json to make them available during the build process.

2. **Changed deployment environment**: Changed the frontend service from `static` to `node` environment in render.yaml.

3. **Added serve package**: Added the `serve` package to handle static file serving after build, with a proper start command.

4. **Set Node version**: Explicitly set Node.js version to 18.x to ensure compatibility.

## How to Update Your Deployment

### Option 1: Via GitHub (Recommended)

If your Render service is connected to GitHub:

1. Push these changes to your GitHub repository
2. Go to your `todoevents` service in Render
3. Click "Manual Deploy" → "Clear build cache & deploy"

### Option 2: Direct Render Update

If you prefer to update directly in Render:

1. Update your frontend `render.yaml` configuration:
   - Change environment from `static` to `node`
   - Add `startCommand: npx serve -s dist`
   - Add Node version environment variable

2. Update your `package.json`:
   - Move Vite from devDependencies to dependencies
   - Add `serve` as a dependency
   - Add `"start": "npx serve -s dist"` to scripts

3. Deploy using "Clear build cache & deploy" option

## Verifying the Fix

After deployment, check the build logs in Render dashboard. You should no longer see the "vite: not found" error, and the frontend should build successfully.

## Troubleshooting

If you encounter issues:
- Check Node.js version is compatible (18.x recommended)
- Verify all dependencies are properly moved to the dependencies section
- Ensure the startCommand is correctly set to use serve for static file serving 