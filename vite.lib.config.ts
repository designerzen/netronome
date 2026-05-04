import { defineConfig } from 'vite'

/**
 * Library build configuration for Netronome
 * Generates the ES module bundle for npm distribution
 * Workers are built separately via vite.workers.config.ts
 */
export default defineConfig({
  build: {
    lib: {
      entry: './index.ts',
      name: 'Netronome',
      formats: ['es'],
      fileName: () => 'index.js'
    },
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: 'index.js',
        chunkFileNames: '[name].js'
      }
    }
  },
  worker: {
    format: 'es'
  }
})
