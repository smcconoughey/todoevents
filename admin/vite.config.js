import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5174  // Different port from the main event app
  },
  build: {
    outDir: 'dist'
  }
})