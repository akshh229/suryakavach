import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // plotly.js-basic-dist-min is inherently ~1.1 MB; it is split into its
    // own chunk above and deliberately not code-split further (dynamic
    // import would only delay the main screen's chart render).
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Split the heavy vendor libs into their own chunks so a release
        // that only changes app code doesn't invalidate the ~1 MB plotly
        // bundle in every visitor's cache.
        manualChunks: {
          plotly: ['react-plotly.js', 'plotly.js-basic-dist-min'],
          motion: ['framer-motion'],
          vendor: ['react', 'react-dom', '@tanstack/react-query', 'zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },
});
