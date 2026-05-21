import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  // Phase 55 D-10 (Pitfall 2): @sqlite.org/sqlite-wasm ships .wasm + worker
  // assets that Vite must NOT pre-bundle, or the dynamic WASM-loading path
  // breaks with "Failed to fetch dynamically imported module". Excluding it
  // from optimizeDeps lets Vite serve the package's assets as-is.
  //
  // NOTE: COOP/COEP server.headers are intentionally OMITTED. The opfs-sahpool
  // VFS (our chosen backend) uses synchronous OPFS SyncAccessHandles WITHOUT a
  // SharedArrayBuffer, so it does not require Cross-Origin-Opener-Policy /
  // Cross-Origin-Embedder-Policy on Chromium. The 55-01 OPFS spike confirmed
  // navigator.storage.getDirectory resolves on localhost without those headers
  // (GO verdict). Adding them would risk breaking other dev tooling for no gain.
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react'],
          'vendor-motion': ['framer-motion'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
          'vendor-mindmap': ['mind-elixir'],
        },
      },
    },
  },
})
