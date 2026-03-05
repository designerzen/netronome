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
    lib: {
      entry: './index.ts',
      name: 'Netronome',
      fileName: (format) => `index.${format === 'es' ? 'es' : 'js'}`
    },
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      output: [
        {
          format: 'es',
          entryFileNames: 'index.es.js',
          chunkFileNames: '[name].js'
        },
        {
          format: 'umd',
          name: 'Netronome',
          entryFileNames: 'index.js',
          chunkFileNames: '[name].js'
        }
      ]
    }
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
