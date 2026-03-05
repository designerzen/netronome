import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

const certDir = path.resolve(__dirname, './certs')
const keyFile = path.join(certDir, 'localhost-key.pem')
const certFile = path.join(certDir, 'localhost.pem')

const hasLocalCerts = fs.existsSync(keyFile) && fs.existsSync(certFile)

export default defineConfig({
  base: '/netronome/',
  plugins: [],
  worker: {
    format: 'es'
  },
  build: {
    // Build demo/test application with HTML entry points
    rollupOptions: {
      input: {
        main: './index.html',
        'multi-timer': './multi-timer.html'
      }
    },
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    outDir: 'dist'
  },
  server: {
    port: 3030,
    open: true,
    https: hasLocalCerts ? {
      key: fs.readFileSync(keyFile),
      cert: fs.readFileSync(certFile)
    } : undefined
  },
  preview: {
    port: 3030
  }
})
