import { defineConfig } from 'vite'
import path from 'path'

/**
 * Library build configuration for Netronome
 * Single ES bundle with all code (including worklet) inlined.
 * Output goes to lib/ so npm consumers get only library files,
 * while the demo app lives in dist/ for GitHub Pages.
 */
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      'netronome/timing-worklet': path.resolve(__dirname, './src/worklets/timing.audioworklet.ts'),
    }
  },
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'Netronome',
      formats: ['es', 'umd'],
      fileName: (format) => format === 'es' ? 'index.es.js' : 'index.js',
    },
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    outDir: 'lib',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      }
    }
  },
  worker: {
    format: 'es',
  }
})
