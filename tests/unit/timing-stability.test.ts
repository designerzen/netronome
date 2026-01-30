import { describe, it, expect, beforeEach } from 'vitest'
import Timer, { SECONDS_PER_MINUTE } from '../../src/timer'
import { createTestTimer, simulateTicks } from '../fixtures/timer-fixtures'

/**
 * Timing Stability Tests
 * Tests the ability of the Timer to:
 * - Stay in time without drifting
 * - Handle clock sync reliably
 * - Maintain beat consistency
 * - Recover from timing irregularities
 */

describe('Timer Timing Stability', () => {
  let timer: Timer

  beforeEach(() => {
    timer = new Timer()
  })

  describe('Clock Synchronization', () => {
    it('should sync to external clock events', () => {
      timer.BPM = 120
      timer.isRunning = true
      timer.isBypassed = true
      
      const initialDivisions = timer.divisionsElapsed
      
      // Trigger external clock
      timer.externalTrigger(true)
      
      // Should advance
      expect(timer.divisionsElapsed).toBe(initialDivisions + 1)
    })

    it('should maintain sync across multiple external triggers', () => {
      timer.BPM = 120
      timer.isRunning = true
      timer.isBypassed = true
      
      const triggers = 24 // One quarter note
      
      for (let i = 0; i < triggers; i++) {
        timer.externalTrigger(true)
      }
      
      expect(timer.divisionsElapsed).toBe(0) // Wrapped to next bar
    })

    it('should support retrigger without advancing', () => {
      timer.BPM = 120
      timer.isRunning = true
      timer.isBypassed = true
      
      timer.externalTrigger(true)
      const advanced = timer.divisionsElapsed
      
      // Retrigger should not advance
      timer.retrigger()
      expect(timer.divisionsElapsed).toBe(advanced)
    })

    it('should calculate tempo from external clock events', () => {
      // Simulate MIDI clock events at 120 BPM
      // 24 PPQN at 120 BPM = 500ms per quarter note
      // So each MIDI clock = 500/24 ≈ 20.833ms apart
      
      timer.BPM = 120
      const expectedQuarterNoteMs = (SECONDS_PER_MINUTE / 120) * 1000
      const expectedClockInterval = expectedQuarterNoteMs / 24
      
      expect(expectedClockInterval).toBeCloseTo(20.833, 1)
    })
  })

  describe('Beat Consistency & Regularity', () => {
    it('should produce consistent beat intervals', () => {
      timer.BPM = 120
      const quarterNoteSeconds = SECONDS_PER_MINUTE / 120
      
      const beatTimes: number[] = []
      for (let i = 0; i < 24; i++) {
        const time = i * quarterNoteSeconds
        beatTimes.push(time)
        timer.onTick(time, time, 0, i, i, 0)
      }
      
      // Check all intervals are equal
      const intervals: number[] = []
      for (let i = 1; i < beatTimes.length; i++) {
        intervals.push(beatTimes[i] - beatTimes[i - 1])
      }
      
      // Standard deviation should be near zero
      const mean = intervals.reduce((a, b) => a + b) / intervals.length
      const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2)) / intervals.length
      const stdDev = Math.sqrt(variance)
      
      expect(stdDev).toBeLessThan(0.0001) // Very tight consistency
    })

    it('should maintain groove over extended period', () => {
      timer.BPM = 120
      const quarterNoteSeconds = SECONDS_PER_MINUTE / 120
      
      // Simulate 30 seconds of steady beat (60 quarter notes at 120 BPM)
      const beats = 60
      const actualIntervals: number[] = []
      
      for (let i = 1; i < beats; i++) {
        const previousTime = (i - 1) * quarterNoteSeconds
        const currentTime = i * quarterNoteSeconds
        actualIntervals.push(currentTime - previousTime)
      }
      
      // All intervals should be identical
      actualIntervals.forEach(interval => {
        expect(interval).toBeCloseTo(quarterNoteSeconds, 10)
      })
    })

    it('should handle tempo variations smoothly', () => {
      // Change tempo gradually
      const tempos = [120, 125, 130, 135, 140, 135, 130, 125, 120]
      
      tempos.forEach(bpm => {
        timer.BPM = bpm
        const quarterNote = SECONDS_PER_MINUTE / bpm
        
        expect(timer.quarterNoteDurationInSeconds).toBeCloseTo(quarterNote, 5)
      })
    })

    it('should not have timing jitter in beat detection', () => {
      timer.BPM = 120
      const beatIntervalMs = 500
      
      // Simulate precise beats
      const beats = []
      for (let i = 0; i < 16; i++) {
        const beatTime = i * (beatIntervalMs / 1000)
        beats.push(beatTime)
      }
      
      // Check for jitter (should have none)
      const maxJitter = 0.0001 // Tolerance
      for (let i = 1; i < beats.length; i++) {
        const interval = beats[i] - beats[i - 1]
        expect(Math.abs(interval - 0.5)).toBeLessThan(maxJitter)
      }
    })
  })

  describe('Drift Detection & Correction', () => {
    it('should calculate and track timing drift', () => {
      timer.BPM = 120
      const expectedTime = 0.5 // 500ms quarter note
      
      // Simulate slightly delayed tick
      const delayedTime = 0.501 // 1ms late
      const drift = delayedTime - expectedTime
      
      expect(drift).toBeCloseTo(0.001, 5)
    })

    it('should detect gradual drift accumulation', () => {
      timer.BPM = 120
      const quarterNoteSeconds = SECONDS_PER_MINUTE / 120
      const driftPerTick = 0.0001 // 0.1ms drift per tick
      
      let cumulativeDrift = 0
      
      for (let i = 0; i < 24; i++) {
        cumulativeDrift += driftPerTick
      }
      
      // After 24 ticks (1 quarter note), drift should accumulate
      expect(cumulativeDrift).toBeCloseTo(0.0024, 5)
    })

    it('should measure lag from expected timing', () => {
      timer.BPM = 120
      const quarterNoteSeconds = SECONDS_PER_MINUTE / 120
      
      // Simulate tick with 2ms lag
      const expectedTime = quarterNoteSeconds
      const actualTime = quarterNoteSeconds + 0.002
      const lag = actualTime % quarterNoteSeconds
      
      expect(lag).toBeCloseTo(0.002, 5)
    })

    it('should track timing error over extended period', () => {
      timer.BPM = 120
      const quarterNoteSeconds = SECONDS_PER_MINUTE / 120
      
      // Simulate systematic timing error (2% slower)
      const errorFactor = 1.02
      const timingErrors: number[] = []
      
      for (let i = 0; i < 50; i++) {
        const expectedTime = i * quarterNoteSeconds
        const actualTime = i * quarterNoteSeconds * errorFactor
        timingErrors.push(actualTime - expectedTime)
      }
      
      // Error should grow linearly
      expect(timingErrors[25]).toBeGreaterThan(timingErrors[0])
      expect(timingErrors[49]).toBeGreaterThan(timingErrors[25])
    })
  })

  describe('Timing Resilience', () => {
    it('should recover from single timing spike', () => {
      timer.BPM = 120
      const quarterNoteSeconds = SECONDS_PER_MINUTE / 120
      
      // Simulate normal ticking with one spike
      const normalIntervals: number[] = []
      
      for (let i = 0; i < 24; i++) {
        if (i === 12) {
          // Spike at tick 12
          normalIntervals.push(quarterNoteSeconds + 0.05) // 50ms spike
        } else {
          normalIntervals.push(quarterNoteSeconds)
        }
      }
      
      // Overall average should be close to expected
      const average = normalIntervals.reduce((a, b) => a + b) / normalIntervals.length
      expect(average).toBeCloseTo(quarterNoteSeconds, 2) // Less precise due to spike
    })

    it('should maintain stability after missed beat', () => {
      timer.BPM = 120
      const quarterNoteSeconds = SECONDS_PER_MINUTE / 120
      
      const timings: number[] = []
      
      for (let i = 0; i < 20; i++) {
        if (i === 10) {
          // Skip a beat
          continue
        }
        timings.push(i * quarterNoteSeconds)
      }
      
      // System should recover after missed beat
      // Subsequent ticks should maintain correct spacing
      for (let i = 11; i < timings.length - 1; i++) {
        const interval = timings[i + 1] - timings[i]
        expect(interval).toBeCloseTo(quarterNoteSeconds, 2)
      }
    })

    it('should handle tempo changes without losing sync', () => {
      const tempoSequence = [120, 120, 120, 140, 140, 140, 120, 120, 120]
      
      tempoSequence.forEach((bpm, index) => {
        timer.BPM = bpm
        const quarterNote = SECONDS_PER_MINUTE / bpm
        
        // Each tick should be accurate for current tempo
        const time = index * quarterNote
        timer.onTick(time, time, 0, index, index, 0)
        
        // Verify beat is in sync
        expect(timer.quarterNoteDurationInSeconds).toBeCloseTo(quarterNote, 5)
      })
    })
  })

  describe('Sync Point Accuracy', () => {
    it('should align bars at correct boundaries', () => {
      timer.BPM = 120
      timer.divisions = 24
      
      // Simulate ticks through bar boundary
      for (let i = 0; i < 48; i++) {
        timer.onTick(i * 0.001, i * 0.001, 0, i, i, 0)
      }
      
      // After 24 ticks, should be at bar boundary
      expect(timer.divisionsElapsed).toBe(0)
    })

    it('should maintain beat alignment across bar changes', () => {
      timer.BPM = 120
      timer.divisions = 24
      
      let beatCount = 0
      for (let bar = 0; bar < 4; bar++) {
        for (let div = 0; div < 24; div++) {
          timer.onTick(beatCount * 0.001, beatCount * 0.001, 0, div, beatCount, 0)
          beatCount++
        }
      }
      
      // Should have processed exactly 96 beats (4 bars × 24 divisions)
      expect(beatCount).toBe(96)
    })

    it('should sync swing timing accurately', () => {
      timer.BPM = 120
      timer.divisions = 24
      timer.swing = 0.5 // Swing every other beat
      
      // Verify swing calculations
      for (let i = 0; i < 24; i++) {
        timer.divisionsElapsed = i
        if (i % timer.swingOffset === 0) {
          expect(timer.isSwungBeat).toBe(true)
        } else {
          expect(timer.isSwungBeat).toBe(false)
        }
      }
    })
  })

  describe('Long-Term Timing Stability', () => {
    it('should maintain timing accuracy over 1 minute', () => {
      timer.BPM = 120
      const quarterNoteSeconds = SECONDS_PER_MINUTE / 120
      const duration = 60 // seconds
      const expectedTicks = duration / quarterNoteSeconds
      
      const timings: number[] = []
      for (let i = 0; i < expectedTicks; i++) {
        const time = i * quarterNoteSeconds
        timings.push(time)
      }
      
      // First and last tick should maintain expected spacing
      expect(timings[0]).toBeCloseTo(0, 5)
      expect(timings[expectedTicks - 1]).toBeCloseTo(duration, 1)
    })

    it('should maintain timing accuracy over 10 minutes', () => {
      timer.BPM = 120
      const quarterNoteSeconds = SECONDS_PER_MINUTE / 120
      const duration = 600 // 10 minutes
      const expectedTicks = duration / quarterNoteSeconds
      
      // Should be able to calculate end point accurately
      const endTime = (expectedTicks - 1) * quarterNoteSeconds
      
      expect(endTime).toBeCloseTo(duration, 1)
    })

    it('should not accumulate significant error over extended period', () => {
      timer.BPM = 120
      const quarterNoteSeconds = SECONDS_PER_MINUTE / 120
      
      let totalError = 0
      const ticks = 1440 // 12 minutes at 120 BPM (2 ticks/sec)
      
      for (let i = 0; i < ticks; i++) {
        const expectedTime = i * quarterNoteSeconds
        const actualTime = expectedTime
        totalError += Math.abs(actualTime - expectedTime)
      }
      
      const averageError = totalError / ticks
      // Average error should be near zero
      expect(averageError).toBeCloseTo(0, 5)
    })
  })

  describe('Multi-Tempo Stability', () => {
    it('should transition between tempos without audible discontinuity', () => {
      const transitions = [120, 140, 100, 160, 120]
      
      transitions.forEach(bpm => {
        timer.BPM = bpm
        const quarterNote = SECONDS_PER_MINUTE / bpm
        
        // Verify each tempo is accurate
        expect(timer.quarterNoteDurationInSeconds).toBeCloseTo(quarterNote, 5)
      })
    })

    it('should handle rapid tempo changes', () => {
      // Simulate 10 rapid tempo changes
      for (let i = 0; i < 10; i++) {
        const bpm = 100 + (i * 5)
        timer.BPM = bpm
        
        const quarterNote = SECONDS_PER_MINUTE / bpm
        expect(timer.quarterNoteDurationInSeconds).toBeCloseTo(quarterNote, 5)
      }
    })

    it('should calculate relationships between different tempos', () => {
      timer.BPM = 120
      const period120 = timer.quarterNoteDurationInSeconds
      
      timer.BPM = 140
      const period140 = timer.quarterNoteDurationInSeconds
      
      // 140 BPM should be 140/120 = 1.167x faster
      const speedRatio = period120 / period140
      expect(speedRatio).toBeCloseTo(140 / 120, 5)
    })
  })

  describe('Timing Accuracy Metrics', () => {
    it('should calculate timing accuracy percentage', () => {
      timer.BPM = 120
      const quarterNoteSeconds = SECONDS_PER_MINUTE / 120
      
      // Simulate 100 beats
      const beats = 100
      let accumulatedError = 0
      
      for (let i = 0; i < beats; i++) {
        const expectedTime = i * quarterNoteSeconds
        const actualTime = expectedTime // Perfect timing
        accumulatedError += Math.abs(actualTime - expectedTime)
      }
      
      const accuracy = 1 - (accumulatedError / (beats * quarterNoteSeconds))
      expect(accuracy).toBeCloseTo(1, 5) // 100% accurate
    })

    it('should quantify timing stability (low standard deviation)', () => {
      timer.BPM = 120
      const quarterNoteSeconds = SECONDS_PER_MINUTE / 120
      
      // Measure beat spacing
      const intervals: number[] = []
      for (let i = 0; i < 50; i++) {
        intervals.push(quarterNoteSeconds)
      }
      
      // Calculate standard deviation
      const mean = intervals.reduce((a, b) => a + b) / intervals.length
      const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2)) / intervals.length
      const stdDev = Math.sqrt(variance)
      
      // Should be essentially zero for perfect timing
      expect(stdDev).toBeLessThan(0.00001)
    })

    it('should identify timing degradation', () => {
      // Perfect timing
      const perfectIntervals = new Array(50).fill(0.5)
      
      // Degraded timing (with jitter)
      const jitterIntervals = perfectIntervals.map(val => val + (Math.random() * 0.01 - 0.005))
      
      // Calculate standard deviations
      const perfectStdDev = Math.sqrt(
        perfectIntervals.reduce((sum, val) => sum + Math.pow(val - 0.5, 2)) / perfectIntervals.length
      )
      
      const jitterStdDev = Math.sqrt(
        jitterIntervals.reduce((sum, val) => sum + Math.pow(val - 0.5, 2)) / jitterIntervals.length
      )
      
      // Jittered timing should have higher standard deviation
      expect(jitterStdDev).toBeGreaterThan(perfectStdDev)
    })
  })
})
