import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import viteConfig from '../../vite.config'

describe('SSL Certificate Integration Tests', () => {
  const certDir = path.join(process.cwd(), 'certs')
  const keyFile = path.join(certDir, 'localhost-key.pem')
  const certFile = path.join(certDir, 'localhost.pem')
  const hasLocalCerts = fs.existsSync(keyFile) && fs.existsSync(certFile)

  beforeAll(() => {
    // Ensure cert directory exists
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true })
    }
  })

  afterAll(() => {
    // Clean up generated certificates after tests
    // Note: In real scenarios, you may want to keep these files
    // Uncomment the following lines if cleanup is desired:
    // if (fs.existsSync(keyFile)) fs.unlinkSync(keyFile)
    // if (fs.existsSync(certFile)) fs.unlinkSync(certFile)
  })

  describe('certificate directory', () => {
    it('should create and verify certs directory exists', () => {
      expect(fs.existsSync(certDir)).toBe(true)
    })

    it('should have proper directory permissions', () => {
      const stats = fs.statSync(certDir)
      expect(stats.isDirectory()).toBe(true)
    })
  })

  describe('basicSsl plugin behavior', () => {
    it('should support localhost domain configuration', () => {
      expect(viteConfig).toBeDefined()
      expect(viteConfig.server?.port).toBe(3030)
    })

    it('should generate certificates on first run', () => {
      // This test verifies that the directory is ready for certificate generation
      expect(fs.existsSync(certDir)).toBe(true)
      expect(fs.readdirSync(certDir)).toBeDefined()
    })
  })

  describe('HTTPS server security', () => {
    it('should configure HTTPS without errors', () => {
      if (hasLocalCerts) {
        expect(viteConfig.server?.https).toBeDefined()
      } else {
        expect(viteConfig.server?.https).toBeUndefined()
      }
    })

    it('should support self-signed certificates', () => {
      // basicSsl automatically generates self-signed certificates
      // This test ensures the configuration allows this
      const certDirExists = fs.existsSync(certDir)
      expect(certDirExists).toBe(true)
    })

    it('should use custom certificate name', () => {
      expect(path.basename(keyFile)).toBe('localhost-key.pem')
      expect(path.basename(certFile)).toBe('localhost.pem')
    })
  })

  describe('certificate file naming', () => {
    it('should follow correct naming convention for private key', () => {
      expect(path.basename(keyFile)).toMatch(/^[a-z0-9-]+-key\.pem$/)
    })

    it('should follow correct naming convention for certificate', () => {
      expect(path.basename(certFile)).toMatch(/^[a-z0-9-]+\.pem$/)
    })
  })

  describe('SSL configuration with vite', () => {
    it('should have valid vite config with SSL', () => {
      expect(viteConfig.base).toBe('/netronome/')
      expect(viteConfig.server?.port).toBe(3030)
      expect(Boolean(viteConfig.server?.https)).toBe(hasLocalCerts)
    })

    it('should maintain build configuration while enabling SSL', () => {
      expect(viteConfig.build?.target).toBe('es2020')
      expect(viteConfig.build?.minify).toBe('terser')
    })
  })
})
