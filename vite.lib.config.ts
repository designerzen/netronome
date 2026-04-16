import { defineConfig } from 'vite'
import { resolve } from 'path'

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
      entry: {
        index: './src/index.ts',
        'timing-worklet': './src/worklets/timing.audioworklet.ts',
        // Add workers as library entry points
        'workers/timing.audiocontext.worker': './src/workers/timing.audiocontext.worker.ts',
        'workers/timing.rolling.worker': './src/workers/timing.rolling.worker.ts',
        'workers/timing.setinterval.worker': './src/workers/timing.setinterval.worker.ts',
        'workers/timing.settimeout.worker': './src/workers/timing.settimeout.worker.ts',
      },
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
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js'
      }
    }
  },
  worker: {
    format: 'es'
  }
})
