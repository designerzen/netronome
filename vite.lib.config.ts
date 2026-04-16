import { defineConfig } from 'vite'

/**
 * Library build configuration for Netronome
 * Single ES bundle with all code inlined for Parcel compatibility
 */
export default defineConfig({
  base: './',
  build: {
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
      output: {
        inlineDynamicImports: true,
      }
    }
  }
})
