import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// Get directory name in a way that works in all environments
const __dirname = import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer()
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client', 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@assets': path.resolve(__dirname, 'attached_assets'),
    },
  },
  root: path.resolve(__dirname, 'client'),
  optimizeDeps: {
    // Force React to be pre-bundled and deduplicated
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    // Ensure React is always treated as a singleton
    exclude: [],
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/public'),
    emptyOutDir: true,
    // Enable minification for production
    minify: 'esbuild', // esbuild is faster than terser and sufficient for most cases
    // Generate sourcemaps for debugging (as separate files)
    sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
    // Disable automatic modulePreload to prevent excessive preload warnings
    // With 72+ lazy-loaded components, preloading all of them causes browser warnings
    // Let the lazy-with-retry handle on-demand loading instead
    modulePreload: false,
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: (id) => {
          // CRITICAL: Don't split React, React-DOM, or Radix UI - keep them in the main bundle
          // React must be in the main bundle to prevent initialization issues
          // Radix UI components depend on React internals and break when loaded in separate chunks
          // Check for React first to prevent it from being caught by other conditions
          if (
            id.includes('node_modules/react/') || 
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react/jsx-runtime') ||
            id.includes('@radix-ui')
          ) {
            return undefined; // Keep React and Radix UI in the main bundle
          }
          
          // Split other vendors (but NOT React or Radix UI)
          if (id.includes('node_modules')) {
            // Double-check: never split React-related packages
            if (
              id.includes('react') || 
              id.includes('@radix-ui')
            ) {
              return undefined; // Safety check - keep in main bundle
            }
            
            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor';
            }
            if (id.includes('wouter')) {
              return 'router-vendor';
            }
            // Put other large vendor libraries in a separate chunk
            return 'vendor';
          }
          
          return undefined;
        },
        // Add content hash to filenames for cache busting
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
    // Increase chunk size warning limit (default is 500kb)
    chunkSizeWarningLimit: 1000,
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Optimize asset handling
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
  },
  server: {
    allowedHosts: [
      '.replit.dev',
      '.spock.replit.dev',
      'bb1d30f8-d852-4bae-abcd-b7c4521e3d85-00-x9tsn55inx51.spock.replit.dev',
      'all',
    ],
    fs: {
      strict: true,
      deny: ['**/.*'],
    },
    // Hot Module Replacement (HMR) settings for faster development
    hmr: {
      overlay: true, // Show errors as overlay
    },
    // Watch options for better file watching
    watch: {
      // Use polling for better compatibility in some environments
      // Disable in local development for better performance
      usePolling: false,
      // Ignore node_modules and .git to improve performance
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
    // Proxy API and Socket.IO requests to the backend server
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
      },
    },
  },
});
