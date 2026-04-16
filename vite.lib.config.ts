import { defineConfig } from 'vite'

/**
 * Library build configuration for Netronome
 * Generates ES module bundle for npm distribution
 * This builds AFTER the app build, so we don't empty dist
 */
export default defineConfig({
  base: './',
  build: {
    assetsDir: '', // Put assets at root instead of in subfolder
    lib: {
      entry: './src/index.ts',
      name: 'Netronome',
      formats: ['es'],
      fileName: 'index.es'
    },
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: false, // Don't empty dist - HTML files are already there from app build
    rollupOptions: {
      external: [],
      output: {
        format: 'es',
        entryFileNames: 'index.es.js',
        chunkFileNames: '[name].es.js',
        assetFileNames: 'workers/[name][extname]'
      }
    }
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        // Remove content hashes from worker filenames for predictable paths
        entryFileNames: 'workers/[name].js',
        chunkFileNames: 'workers/[name].js'
      }
    }
  }
})
