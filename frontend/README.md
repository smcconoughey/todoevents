# Event Finder Frontend

## Environment Setup

To properly run the application, you need to set up environment variables:

1. Create a `.env` file in the frontend directory with the following content:

```
# API URLs
VITE_API_URL=https://eventfinder-api.onrender.com

# Google Maps API key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

2. Replace `your_google_maps_api_key_here` with your actual Google Maps API key.

3. Make sure your Google Maps API key has the following APIs enabled:
   - Maps JavaScript API
   - Places API
   - Geocoding API

## Render.com Deployment

When deploying to Render.com, add the following environment variables in your service settings:

- `VITE_API_URL` = URL of your backend API
- `VITE_GOOGLE_MAPS_API_KEY` = Your Google Maps API key

## Development

1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
