/**
 * Test fixtures and factories for Timer tests
 */

import Timer from '../../src/timer'

/**
 * Factory function to create a Timer with common test configurations
 */
export function createTestTimer(overrides?: Partial<ConstructorParameters<typeof Timer>[0]>) {
  const defaults = {
    bars: 16,
    divisions: 24,
    bpm: 120
  }

  return new Timer({ ...defaults, ...overrides })
}

/**
 * Common test data sets
 */
export const TEST_TEMPOS = [
  60,    // Very slow
  90,    // Slow
  120,   // Standard
  140,   // Fast
  180    // Very fast
]

export const TEST_BAR_COUNTS = [1, 4, 8, 16, 32]

export const TEST_DIVISIONS = [8, 12, 16, 24, 32]

/**
 * Mock callback for testing tick events
 */
export function createMockCallback() {
  const calls: any[] = []

  const callback = (data: any) => {
    calls.push(data)
  }

  return {
    callback,
    getCalls: () => calls,
    getLastCall: () => calls[calls.length - 1],
    getCallCount: () => calls.length,
    clear: () => calls.splice(0, calls.length)
  }
}

/**
 * Helper to simulate tick events
 */
export function simulateTicks(timer: Timer, count: number, timePassed = 0.1) {
  for (let i = 0; i < count; i++) {
    timer.onTick(
      timePassed * (i + 1), // timePassed
      timePassed * (i + 1), // expected
      0,                     // drift
      i,                     // level
      i,                     // intervals
      0                      // lag
    )
  }
}

/**
 * Timing test scenarios
 */
export const TIMING_SCENARIOS = {
  singleBar: {
    bars: 1,
    divisions: 24,
    description: 'Single bar'
  },
  standard4x4: {
    bars: 4,
    divisions: 4,
    description: 'Standard 4/4 bar'
  },
  standard16Bar: {
    bars: 16,
    divisions: 24,
    description: 'Standard 16-bar phrase'
  },
  odd7_8: {
    bars: 7,
    divisions: 8,
    description: 'Odd 7/8 time'
  },
  complex: {
    bars: 32,
    divisions: 24,
    description: 'Complex 32-bar section'
  }
}

/**
 * Convert test data to formatted strings for assertions
 */
export function formatTimerState(timer: Timer): string {
  return `Bar: ${timer.currentBar}/${timer.bars}, Division: ${timer.divisionsElapsed}/${timer.divisions}, BPM: ${timer.BPM.toFixed(1)}`
}

/**
 * Helper to test tempo consistency
 */
export function testTempoConsistency(timer: Timer, tempos: number[]) {
  const results: { tempo: number; calculated: number; diff: number }[] = []

  tempos.forEach(tempo => {
    timer.BPM = tempo
    results.push({
      tempo,
      calculated: timer.BPM,
      diff: Math.abs(tempo - timer.BPM)
    })
  })

  return results
}

/**
 * Helper to test bar wrapping
 */
export function testBarWrapping(timer: Timer, iterations: number) {
  const bars: number[] = []

  for (let i = 0; i < iterations; i++) {
    timer.divisionsElapsed = timer.divisions - 1
    timer.onTick(i * 0.1, i * 0.1, 0, i, i, 0)
    bars.push(timer.currentBar)
  }

  return bars
}

/**
 * BPM test data with expected values
 */
export const BPM_TEST_DATA = [
  { bpm: 60, quarterNoteMs: 1000, description: 'Slow waltz' },
  { bpm: 90, quarterNoteMs: 666.67, description: 'Moderate' },
  { bpm: 120, quarterNoteMs: 500, description: 'Standard dance' },
  { bpm: 140, quarterNoteMs: 428.57, description: 'Fast' },
  { bpm: 180, quarterNoteMs: 333.33, description: 'Very fast' }
]

/**
 * Create a timer in a specific state for testing
 */
export function createTimerInState(state: {
  currentBar?: number
  divisionsElapsed?: number
  totalBarsElapsed?: number
  bpm?: number
  bars?: number
  divisions?: number
}) {
  const timer = new Timer()

  if (state.currentBar !== undefined) timer.currentBar = state.currentBar
  if (state.divisionsElapsed !== undefined) timer.divisionsElapsed = state.divisionsElapsed
  if (state.totalBarsElapsed !== undefined) timer.totalBarsElapsed = state.totalBarsElapsed
  if (state.bpm !== undefined) timer.BPM = state.bpm
  if (state.bars !== undefined) timer.setBars(state.bars)
  if (state.divisions !== undefined) timer.divisions = state.divisions

  return timer
}
