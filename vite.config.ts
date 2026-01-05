import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'monaco': ['@monaco-editor/react', 'monaco-editor'],
          'ui-vendor': ['framer-motion', 'lucide-react'],
          'state-vendor': ['zustand'],
          
          // Feature chunks
          'logic-editor': ['./src/pages/LogicEditor.tsx'],
          'tag-database': ['./src/pages/TagDatabase.tsx'],
          'deploy': ['./src/pages/Deploy.tsx'],
          'versioning': ['./src/pages/VersioningCenter.tsx'],
        },
      },
    },
    // Increase chunk size warning limit for large Monaco bundles
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging
    sourcemap: false,
    // Minify for production
    minify: 'esbuild',
    target: 'es2015',
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', 'framer-motion'],
    exclude: ['@monaco-editor/react'],
  },
  worker: {
    format: 'es',
    plugins: () => [react()],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
