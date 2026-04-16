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
  resolve: {
    alias: {
      // For app build, resolve worker imports to inline version
      './workers/timing.audiocontext.worker.ts': '/src/workers/timing.audiocontext.worker.ts?worker&inline',
      './workers/timing.rolling.worker.ts': '/src/workers/timing.rolling.worker.ts?worker&inline',
      './workers/timing.setinterval.worker.ts': '/src/workers/timing.setinterval.worker.ts?worker&inline',
      './workers/timing.settimeout.worker.ts': '/src/workers/timing.settimeout.worker.ts?worker&inline',
    }
  },
  worker: {
    format: 'es',
    // Build workers as separate files
    rollupOptions: {
      output: {
        entryFileNames: 'timing.[name].worker.js'
      }
    }
  },
  build: {
    // Build demo/test application with HTML entry points
    assetsDir: '', // Put assets at root instead of in subfolder
    rollupOptions: {
      input: {
        main: './index.html',
        'multi-timer': './multi-timer.html'
      },
      output: {
        assetFileNames: '[name].[ext]',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js'
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
