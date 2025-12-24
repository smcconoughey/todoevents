import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/beta/',
  plugins: [
    react(),
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        // Replace the Google Maps API key placeholder
        return html.replace(
          /%VITE_GOOGLE_MAPS_API_KEY%/g, 
          process.env.VITE_GOOGLE_MAPS_API_KEY || ''
        );
      }
    }
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/admin': {
        target: 'http://localhost:5174',
        changeOrigin: true
      }
    }
  }
})