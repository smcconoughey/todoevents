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
    port: 5175,  // Different port for beta (5174 is admin, 5173 is frontend)
    host: true   // Allow external connections
  },
  build: {
    outDir: 'dist'
  }
})