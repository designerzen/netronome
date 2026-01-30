import { defineConfig } from 'vite'

export default defineConfig({
  base: '/netronome/',
  worker: {
    format: 'es'
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  server: {
    port: 3000,
    https: process.env.HTTPS === 'true',
    open: true,
    mimeTypes: {
      'js': 'application/javascript',
      'mjs': 'application/javascript'
    }
  },
  preview: {
    port: 4173
  }
})
