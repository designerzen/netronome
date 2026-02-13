import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  base: '/netronome/',
  plugins: [basicSsl()],
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
          entryFileNames: 'index.es.js'
        },
        {
          format: 'umd',
          name: 'Netronome',
          entryFileNames: 'index.js'
        }
      ]
    }
  },
  server: {
    port: 3000,
    open: true
  },
  preview: {
    port: 4173
  }
})
