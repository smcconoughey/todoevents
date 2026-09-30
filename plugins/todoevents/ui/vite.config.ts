import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    lib: { entry: 'src/main.ts', name: 'TodoEventsWidget', formats: ['iife'], fileName: () => 'widget.js' },
    cssCodeSplit: false,
    sourcemap: false,
  },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'], clearMocks: true },
});
