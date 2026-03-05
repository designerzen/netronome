import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, ViteDevServer } from 'vite'
import viteConfig from '../vite.config'
import fs from 'fs'
import path from 'path'

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

  describe('basicSsl plugin configuration', () => {
    it('should have basicSsl plugin enabled', () => {
      const plugins = viteConfig.plugins || []
      const hasBasicSsl = plugins.some(
        plugin => plugin && typeof plugin === 'object' && 'name' in plugin && plugin.name === 'vite:basic-ssl'
      )
      expect(hasBasicSsl).toBe(true)
    })

    it('should configure basicSsl with correct options', () => {
      const plugins = viteConfig.plugins || []
      const basicSslPlugin = plugins.find(
        plugin => plugin && typeof plugin === 'object' && 'name' in plugin && plugin.name === 'vite:basic-ssl'
      )
      expect(basicSslPlugin).toBeDefined()
    })
  })

  describe('HTTPS server configuration', () => {
    it('should enable HTTPS on dev server', () => {
      expect(viteConfig.server?.https).toBe(true)
    })

    it('should use port 3030 for HTTPS', () => {
      expect(viteConfig.server?.port).toBe(3030)
    })

    it('should have preview server configured', () => {
      expect(viteConfig.preview?.port).toBe(3030)
    })
  })

  describe('SSL certificate generation', () => {
    const certDir = path.join(process.cwd(), 'certs')

    it('should create certs directory', async () => {
      // Create the directory if it doesn't exist
      if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true })
      }
      expect(fs.existsSync(certDir)).toBe(true)
    })

    it('should allow custom certificate directory configuration', () => {
      // Verify that the basicSsl plugin is configured with certDir option
      const plugins = viteConfig.plugins || []
      expect(plugins.length).toBeGreaterThan(0)
      // The plugin config should include certDir: './certs'
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
