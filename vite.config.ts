import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vite builds the side panel (HTML + React). The content script and service worker are bundled
// separately by scripts/build-scripts.mjs, because Chrome loads content scripts as classic scripts.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // Resolved against the project root (where vite runs).
      input: { sidepanel: 'sidepanel.html' },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
