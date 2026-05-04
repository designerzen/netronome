import { defineConfig } from 'vite'

/**
 * Worker build configuration for Netronome
 * Builds each worker as a standalone ES module file in dist/workers/
 * These are loaded at runtime relative to the library via import.meta.url
 */
export default defineConfig({
  build: {
    outDir: 'dist/workers',
    emptyOutDir: false,
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      input: {
        'timing.audiocontext.worker': './src/workers/timing.audiocontext.worker.ts',
        'timing.rolling.worker': './src/workers/timing.rolling.worker.ts',
        'timing.setinterval.worker': './src/workers/timing.setinterval.worker.ts',
        'timing.settimeout.worker': './src/workers/timing.settimeout.worker.ts'
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js'
      }
    }
  }
})
