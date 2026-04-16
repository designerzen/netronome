import { defineConfig } from 'vite'

/**
 * Library build configuration for Netronome
 * Single bundle with all code inlined for Parcel compatibility
 */
export default defineConfig({
  base: './',
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'Netronome',
      formats: ['es'],
      fileName: 'index'
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
