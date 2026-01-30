import { defineConfig } from 'vite'

export default defineConfig({
  worker: {
    format: 'es'
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    sourcemap: true
  },
  server: {
    port: 3000,
    https: process.env.HTTPS === 'true',
    open: true
  },
  preview: {
    port: 4173
  }
})
