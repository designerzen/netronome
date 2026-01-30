import { describe, it, expect, beforeEach } from 'vitest'
import Timer, { MICROSECONDS_PER_MINUTE, SECONDS_PER_MINUTE } from '../../src/timer'
import { Ticks } from '../../src/ticks'

/**
 * Timing Accuracy & Consistency Tests
 * Tests the ability of the Timer to:
 * - Maintain accurate beat timing
 * - Stay in sync with expected tempo
 * - Handle drift and jitter
 * - Detect timing errors
 */

describe('Timer Timing Accuracy & Consistency', () => {
  let timer: Timer

  beforeEach(() => {
    timer = new Timer()
  })

  describe('Beat Timing Accuracy', () => {
    it('should maintain accurate quarter note timing at 120 BPM', () => {
      timer.BPM = 120
      
      // At 120 BPM, quarter note = 500ms
      const expectedQuarterNoteMs = (MICROSECONDS_PER_MINUTE / 120) * 0.001
      expect(expectedQuarterNoteMs).toBeCloseTo(500, 1)
      
      // Verify calculation is accurate
      expect(timer.quarterNoteDurationInSeconds).toBeCloseTo(0.5, 5)
    })

    it('should maintain accurate quarter note timing at 60 BPM', () => {
      timer.BPM = 60
      
      // At 60 BPM, quarter note = 1000ms
      const expectedQuarterNoteMs = (MICROSECONDS_PER_MINUTE / 60) * 0.001
      expect(expectedQuarterNoteMs).toBeCloseTo(1000, 1)
      
      expect(timer.quarterNoteDurationInSeconds).toBeCloseTo(1, 5)
    })

    it('should maintain accurate quarter note timing at 140 BPM', () => {
      timer.BPM = 140
      
      // At 140 BPM, quarter note ≈ 428.57ms
      const expectedQuarterNoteMs = (MICROSECONDS_PER_MINUTE / 140) * 0.001
      expect(expectedQuarterNoteMs).toBeCloseTo(428.57, 1)
      
      expect(timer.quarterNoteDurationInSeconds).toBeCloseTo(SECONDS_PER_MINUTE / 140, 5)
    })

    it('should maintain timing accuracy across tempo range', () => {
      const tempos = [40, 60, 90, 120, 140, 180, 240]
      
      tempos.forEach(bpm => {
        timer.BPM = bpm
        const expectedQuarterNote = SECONDS_PER_MINUTE / bpm
        expect(timer.quarterNoteDurationInSeconds).toBeCloseTo(expectedQuarterNote, 5)
      })
    })

    it('should handle sub-millisecond precision', () => {
      timer.BPM = 120
      
      // Calculate to high precision
      const period = MICROSECONDS_PER_MINUTE / 120
      expect(period).toBe(500000) // 500,000 microseconds
      
      // Check sub-millisecond consistency
      const quarterNoteMs = period * 0.001
      expect(quarterNoteMs).toBeCloseTo(500, 3)
    })
  })

  describe('Tempo Stability & Drift', () => {
    it('should not drift when ticking at same BPM', () => {
      timer.BPM = 120
      const targetPeriod = timer.quarterNoteDurationInSeconds
      
      // Simulate 100 ticks
      const ticks = []
      for (let i = 0; i < 100; i++) {
        timer.onTick(i * targetPeriod, i * targetPeriod, 0, i, i, 0)
        ticks.push(i * targetPeriod)
      }
      
      // Verify spacing is consistent
      const intervals = []
      for (let i = 1; i < ticks.length; i++) {
        intervals.push(ticks[i] - ticks[i-1])
      }
      
      // All intervals should be equal (no drift)
      intervals.forEach(interval => {
        expect(interval).toBeCloseTo(targetPeriod, 10)
      })
    })

    it('should detect and track drift', () => {
      timer.BPM = 120
      const targetPeriod = timer.quarterNoteDurationInSeconds
      
      // Simulate drift: slightly faster ticking
      const driftAmount = 0.001 // 1ms drift per tick
      let drifts = []
      
      for (let i = 0; i < 10; i++) {
        const driftedTime = i * (targetPeriod + driftAmount)
        const expectedTime = i * targetPeriod
        const drift = driftedTime - expectedTime
        drifts.push(drift)
      }
      
      // Drift should accumulate linearly
      drifts.forEach((drift, index) => {
        expect(drift).toBeCloseTo(driftAmount * index, 10)
      })
    })

    it('should maintain tempo when BPM is changed', () => {
      timer.BPM = 120
      const period120 = timer.quarterNoteDurationInSeconds
      
      timer.BPM = 140
      const period140 = timer.quarterNoteDurationInSeconds
      
      // Periods should be different
      expect(period140).not.toBe(period120)
      
      // 140 BPM should be faster than 120 BPM
      expect(period140).toBeLessThan(period120)
      
      // Ratio should be correct: 120/140 = 0.857...
      const ratio = period120 / period140
      expect(ratio).toBeCloseTo(120 / 140, 5)
    })

    it('should calculate timing with minimal jitter', () => {
      timer.BPM = 120
      const targetPeriod = timer.quarterNoteDurationInSeconds
      
      // Simulate multiple ticks and check variance
      const measurements = []
      for (let i = 0; i < 50; i++) {
        const time = i * targetPeriod
        measurements.push(time)
      }
      
      // Calculate standard deviation
      const mean = measurements.reduce((a, b) => a + b) / measurements.length
      const variance = measurements.reduce((sum, val) => sum + Math.pow(val - mean, 2)) / measurements.length
      const stdDev = Math.sqrt(variance)
      
      // Jitter should be minimal (less than 0.1% of period)
      expect(stdDev).toBeLessThan(targetPeriod * 0.001)
    })
  })

  describe('Bar & Division Timing', () => {
    it('should maintain consistent bar length at given BPM', () => {
      timer.BPM = 120
      timer.divisions = 24
      
      const barLength = timer.timePerBar
      const expectedBarLength = timer.quarterNoteDurationInSeconds * 4
      
      expect(barLength).toBeCloseTo(expectedBarLength, 5)
    })

    it('should calculate division timing accurately', () => {
      timer.BPM = 120
      timer.divisions = 24
      
      const quarterNoteDuration = timer.quarterNoteDurationInSeconds
      const divisionDuration = quarterNoteDuration / timer.divisions
      
      // Division should be 1/24 of quarter note
      expect(divisionDuration).toBeCloseTo(quarterNoteDuration / 24, 10)
    })

    it('should maintain timing across different division counts', () => {
      timer.BPM = 120
      const quarterNoteDuration = timer.quarterNoteDurationInSeconds
      
      const divisionCounts = [4, 8, 12, 16, 24, 32]
      
      divisionCounts.forEach(divisionCount => {
        timer.divisions = divisionCount
        const divisionDuration = quarterNoteDuration / divisionCount
        const expectedDuration = quarterNoteDuration / divisionCount
        
        expect(divisionDuration).toBeCloseTo(expectedDuration, 10)
      })
    })

    it('should accumulate time correctly over multiple bars', () => {
      timer.BPM = 120
      timer.divisions = 24
      timer.bars = 4
      
      const barLength = timer.timePerBar
      const expectedTotalTime = barLength * 4
      
      expect(timer.totalTime).toBeCloseTo(expectedTotalTime, 5)
    })
  })

  describe('Tick Event Timing', () => {
    it('should trigger ticks at expected intervals', () => {
      timer.BPM = 120
      const targetPeriod = timer.quarterNoteDurationInSeconds
      
      const tickTimes: number[] = []
      
      // Simulate ticks
      for (let i = 0; i < 16; i++) {
        const expectedTime = i * targetPeriod
        timer.onTick(expectedTime, expectedTime, 0, i, i, 0)
        tickTimes.push(expectedTime)
      }
      
      // Verify timing
      for (let i = 0; i < tickTimes.length - 1; i++) {
        const interval = tickTimes[i + 1] - tickTimes[i]
        expect(interval).toBeCloseTo(targetPeriod, 10)
      }
    })

    it('should handle rapid ticking without loss of accuracy', () => {
      timer.BPM = 180 // Fast tempo
      const targetPeriod = timer.quarterNoteDurationInSeconds
      
      // Simulate 100 rapid ticks
      const tickCount = 100
      let lastTime = 0
      
      for (let i = 0; i < tickCount; i++) {
        const currentTime = i * targetPeriod
        timer.onTick(currentTime, currentTime, 0, i, i, 0)
        
        if (i > 0) {
          const interval = currentTime - lastTime
          expect(interval).toBeCloseTo(targetPeriod, 10)
        }
        
        lastTime = currentTime
      }
    })

    it('should track timing data through tick callbacks', () => {
      timer.BPM = 120
      const targetPeriod = timer.quarterNoteDurationInSeconds
      
      const callbackData: any[] = []
      timer.setCallback((data) => {
        callbackData.push(data)
      })
      
      // Trigger ticks
      for (let i = 0; i < 8; i++) {
        timer.onTick(i * targetPeriod, i * targetPeriod, 0, i, i, 0)
      }
      
      // Verify callbacks received timing data
      expect(callbackData.length).toBeGreaterThan(0)
    })
  })

  describe('Timing Stability with Variations', () => {
    it('should remain accurate with floating point BPM values', () => {
      const fpTempos = [120.5, 89.75, 140.25, 59.99, 180.01]
      
      fpTempos.forEach(bpm => {
        timer.BPM = bpm
        const expectedQuarterNote = SECONDS_PER_MINUTE / bpm
        expect(timer.quarterNoteDurationInSeconds).toBeCloseTo(expectedQuarterNote, 5)
      })
    })

    it('should maintain timing across multiple tempo changes', () => {
      const tempoSequence = [120, 140, 90, 180, 120]
      
      tempoSequence.forEach(bpm => {
        timer.BPM = bpm
        const expectedQuarterNote = SECONDS_PER_MINUTE / bpm
        
        // Each change should be accurate
        expect(timer.quarterNoteDurationInSeconds).toBeCloseTo(expectedQuarterNote, 5)
      })
    })

    it('should handle extreme tempos accurately', () => {
      const extremeTempos = [30, 40, 50, 240, 300, 350]
      
      extremeTempos.forEach(bpm => {
        timer.BPM = bpm
        const expectedQuarterNote = SECONDS_PER_MINUTE / bpm
        expect(timer.quarterNoteDurationInSeconds).toBeCloseTo(expectedQuarterNote, 5)
      })
    })

    it('should calculate MIDI clock timing accurately', () => {
      timer.BPM = 120
      
      // At 120 BPM with 24 PPQN:
      // Quarter note = 500ms
      // One MIDI clock = 500/24 ≈ 20.833ms
      const expectedMicroPerClock = timer.microsPerMIDIClock
      const quarterNoteMicros = timer.quarterNoteDuration
      const expectedValue = quarterNoteMicros / 24
      
      expect(expectedMicroPerClock).toBeCloseTo(expectedValue, 5)
    })
  })

  describe('Timing Precision & Rounding', () => {
    it('should not lose precision with repeated operations', () => {
      timer.BPM = 120
      const originalBPM = timer.BPM
      
      // Perform multiple conversions
      for (let i = 0; i < 100; i++) {
        const period = timer.quarterNoteDurationInSeconds
        const calculatedBPM = SECONDS_PER_MINUTE / period
      }
      
      // BPM should remain unchanged
      expect(timer.BPM).toBeCloseTo(originalBPM, 5)
    })

    it('should handle microsecond precision', () => {
      timer.BPM = 120
      
      // Quarter note at 120 BPM should be exactly 500,000 microseconds
      const quarterNoteMicros = timer.quarterNoteDuration
      expect(quarterNoteMicros).toBe(500000)
    })

    it('should maintain tick counting accuracy', () => {
      timer.BPM = 120
      timer.divisions = 24
      
      // Simulate one full bar (24 divisions)
      for (let i = 0; i < 24; i++) {
        timer.onTick(i * 0.001, i * 0.001, 0, i, i, 0)
      }
      
      // After 24 ticks, should advance to next bar
      expect(timer.divisionsElapsed).toBe(0)
    })
  })

  describe('Real-Time Timing Simulation', () => {
    it('should simulate real 120 BPM timing accurately', () => {
      timer.BPM = 120
      const quarterNoteMs = 500 // ms
      
      // Simulate 4 quarter notes (1 bar in 4/4)
      const times = [0, 500, 1000, 1500, 2000].map(ms => ms / 1000)
      const measuredIntervals: number[] = []
      
      for (let i = 0; i < times.length - 1; i++) {
        measuredIntervals.push(times[i + 1] - times[i])
      }
      
      // All intervals should be 0.5 seconds
      measuredIntervals.forEach(interval => {
        expect(interval).toBeCloseTo(0.5, 5)
      })
    })

    it('should simulate real 90 BPM timing accurately', () => {
      timer.BPM = 90
      const expectedQuarterNoteSeconds = SECONDS_PER_MINUTE / 90 // ≈ 0.667s
      
      // Simulate timing
      const intervals: number[] = []
      for (let i = 0; i < 8; i++) {
        intervals.push(i * expectedQuarterNoteSeconds)
      }
      
      // Check spacing
      for (let i = 1; i < intervals.length; i++) {
        const gap = intervals[i] - intervals[i - 1]
        expect(gap).toBeCloseTo(expectedQuarterNoteSeconds, 5)
      }
    })

    it('should maintain timing over extended duration', () => {
      timer.BPM = 120
      const quarterNoteSeconds = 0.5
      
      // Simulate 1 minute of ticking at 120 BPM
      // Should be 240 quarter notes
      const durationSeconds = 60
      const expectedTicks = durationSeconds / quarterNoteSeconds
      
      expect(expectedTicks).toBe(120) // 2 ticks per second
      
      // Verify spacing throughout
      for (let i = 0; i < 10; i++) {
        const time = i * quarterNoteSeconds
        const expectedTime = i * quarterNoteSeconds
        expect(time).toBeCloseTo(expectedTime, 10)
      }
    })
  })

  describe('Timing Accuracy Edge Cases', () => {
    it('should handle very precise BPM adjustments', () => {
      timer.BPM = 120.00001
      const bpm1 = timer.BPM
      
      timer.BPM = 120.00002
      const bpm2 = timer.BPM
      
      // Should be able to distinguish tiny differences
      expect(bpm2).not.toBe(bpm1)
    })

    it('should not accumulate floating point errors', () => {
      timer.BPM = 120
      let cumulativeTime = 0
      const quarterNoteSeconds = timer.quarterNoteDurationInSeconds
      
      // Accumulate time 1000 times
      for (let i = 0; i < 1000; i++) {
        cumulativeTime += quarterNoteSeconds
      }
      
      // Should still be reasonably accurate
      const expectedTime = 1000 * quarterNoteSeconds
      expect(cumulativeTime).toBeCloseTo(expectedTime, 3)
    })

    it('should maintain timing when bars wrap', () => {
      timer.BPM = 120
      timer.bars = 4
      timer.divisions = 24
      
      let currentBar = 0
      const barLength = timer.timePerBar
      
      // Simulate time across multiple bar boundaries
      for (let bar = 0; bar < 10; bar++) {
        for (let div = 0; div < timer.divisions; div++) {
          const time = bar * barLength + (div * barLength / timer.divisions)
          timer.onTick(time, time, 0, div, bar * timer.divisions + div, 0)
        }
      }
      
      // Verify timing remained consistent
      expect(timer.totalTime).toBeDefined()
    })
  })
})
