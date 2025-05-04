import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'html-transform',
      transformIndexHtml(html) {
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
})