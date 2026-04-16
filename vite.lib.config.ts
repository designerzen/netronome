import { defineConfig } from 'vite'

/**
 * Library build configuration for Netronome
 * Single bundle with inlined imports for Parcel compatibility
 */
export default defineConfig({
  base: './',
  build: {
    assetsDir: '',
    lib: {
      entry: './src/index.ts',
      name: 'Netronome',
      formats: ['es'],
      fileName: 'index.es'
    },
    target: 'es2020',
    minify: false,
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: [],
      output: {
        format: 'es',
        inlineDynamicImports: true
      }
    }
  }
})
