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
      fileName: (format) => `index.${format === 'es' ? 'es' : 'js'}`
    },
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: false, // Don't empty dist - HTML files are already there from app build
    rollupOptions: {
      external: [],
      output: [
        {
          format: 'es',
          entryFileNames: 'index.es.js',
          chunkFileNames: '[name].es.js',
          assetFileNames: '[name].[ext]'
        },
        {
          format: 'umd',
          name: 'Netronome',
          entryFileNames: 'index.js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]'
        }
      ]
    }
  }
})
