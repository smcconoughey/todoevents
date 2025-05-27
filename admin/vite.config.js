import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5174,  // Different port from the main event app
    host: true   // Allow external connections
  },
  build: {
    outDir: 'dist'
  }
})