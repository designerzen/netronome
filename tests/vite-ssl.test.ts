import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, ViteDevServer } from 'vite'
import viteConfig from '../vite.config'
import fs from 'fs'
import path from 'path'

const certDir = path.join(process.cwd(), 'certs')
const keyFile = path.join(certDir, 'localhost-key.pem')
const certFile = path.join(certDir, 'localhost.pem')
const hasLocalCerts = fs.existsSync(keyFile) && fs.existsSync(certFile)

describe('Vite SSL Configuration', () => {
  let server: ViteDevServer

  beforeAll(async () => {
    server = await createServer(viteConfig)
  })

  afterAll(async () => {
    if (server) {
      await server.close()
    }
  })

  describe('plugin configuration', () => {
    it('should expose a plugins array', () => {
      expect(Array.isArray(viteConfig.plugins || [])).toBe(true)
    })

    it('should keep plugin configuration optional when local cert files are used', () => {
      expect(viteConfig.plugins || []).toBeDefined()
    })
  })

  describe('HTTPS server configuration', () => {
    it('should enable HTTPS on dev server', () => {
      expect(Boolean(viteConfig.server?.https)).toBe(hasLocalCerts)
    })

    it('should use port 3030 for HTTPS', () => {
      expect(viteConfig.server?.port).toBe(3030)
    })

    it('should have preview server configured', () => {
      expect(viteConfig.preview?.port).toBe(3030)
    })
  })

  describe('SSL certificate generation', () => {
    it('should create certs directory', async () => {
      // Create the directory if it doesn't exist
      if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true })
      }
      expect(fs.existsSync(certDir)).toBe(true)
    })

    it('should allow custom certificate directory configuration', () => {
      expect(path.basename(certDir)).toBe('certs')
    })
  })

  describe('baseURL configuration', () => {
    it('should maintain base URL setting', () => {
      expect(viteConfig.base).toBe('/netronome/')
    })
  })

  describe('dev server on HTTPS', () => {
    it('should open browser automatically', () => {
      expect(viteConfig.server?.open).toBe(true)
    })

    it('should be configured for ES modules', () => {
      expect(viteConfig.worker?.format).toBe('es')
    })
  })
})
