import { defineConfig } from 'vite'

/**
 * Library build configuration for Netronome
 * Generates CommonJS and ES module bundles for npm distribution
 * This builds AFTER the app build, so we don't empty dist
 */
export default defineConfig({
  build: {
    assetsDir: '', // Put assets at root instead of in subfolder
    lib: {
      entry: './index.ts',
      name: 'Netronome',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format === 'es' ? 'es.js' : 'js'}`
    },
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: false, // Don't empty dist - HTML files are already there from app build
    rollupOptions: {
      external: []
    }
  }
})
