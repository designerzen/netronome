import { beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest'

/**
 * Global test setup and teardown
 * Runs before all tests in the tests/ directory
 */

beforeAll(() => {
  // Setup that runs once before all tests
  console.log('🧪 Starting test suite...')
})

beforeEach(() => {
  // Setup that runs before each test
  // Can be used for test isolation
})

afterEach(() => {
  // Cleanup after each test
  vi.clearAllMocks()
  vi.clearAllTimers()
})

afterAll(() => {
  // Final cleanup after all tests
  console.log('✅ Test suite completed')
})

/**
 * Mock Web APIs if needed
 */

// Mock performance if not available
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
    timeOrigin: Date.now()
  } as any
}

// Mock AudioContext
if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') {
  global.AudioContext = class MockAudioContext {
    currentTime = 0
    state = 'running'
    baseLatency = 0.005
    outputLatency = 0.01

    createOscillator() {
      return {}
    }
    createGain() {
      return {}
    }
    resume() {
      return Promise.resolve()
    }
  } as any
}
