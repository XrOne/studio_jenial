import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Root is current directory (where index.html is)
  root: __dirname,
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  
  server: {
    port: 5173,
    strictPort: false, // Will try next available port if 5173 is busy
    host: true, // Listen on all addresses
    open: true, // Auto-open browser
    
    // Proxy API calls to backend
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
})
