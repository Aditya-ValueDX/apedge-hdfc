import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // target: 'http://31.97.61.83:8580',
        // target: 'https://apedge.automationedge.com:8680',
        target: 'http://localhost:8580',
        changeOrigin: true,
        secure: false, // in case of https self-signed certs
        // Rewrite the URL path to remove the '/api' prefix
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    // Improve build performance
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          vendor: ['react', 'react-dom', 'react-router-dom'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          charts: ['chart.js', 'react-chartjs-2'],
          utils: ['axios', 'jwt-decode', 'crypto-js']
        },
        // Add asset optimization
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return 'css/[name].[hash][extname]';
          }
          if (assetInfo.name.endsWith('.png') || assetInfo.name.endsWith('.jpg')) {
            return 'images/[name].[hash][extname]';
          }
          return '[name].[hash][extname]';
        }
      }
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Reduce chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Optimize asset loading
    assetsInlineLimit: 4096, // Inline small assets
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@reduxjs/toolkit', 'react-redux']
  }
});