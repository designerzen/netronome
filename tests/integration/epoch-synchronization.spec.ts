import { describe, it, expect, beforeEach } from 'vitest'
import Epoch from '../../src/epoch'

describe('Epoch Synchronization', () => {
  let epoch: Epoch

  beforeEach(() => {
    // Get fresh instance for each test
    epoch = Epoch.getInstance()
    epoch.setReferenceEpoch(0)
  })

  describe('Epoch Instance Management', () => {
    it('should be a singleton', () => {
      const epoch1 = Epoch.getInstance()
      const epoch2 = Epoch.getInstance()
      expect(epoch1).toBe(epoch2)
    })

    it('should initialize with UNIX epoch as reference', () => {
      const newEpoch = Epoch.getInstance()
      expect(newEpoch.getReferenceEpoch()).toBe(0)
    })
  })

  describe('Current Time Tracking', () => {
    it('should return current Unix timestamp', () => {
      const before = Date.now()
      const current = epoch.getCurrentTime()
      const after = Date.now()
      expect(current).toBeGreaterThanOrEqual(before)
      expect(current).toBeLessThanOrEqual(after)
    })

    it('should match Date.now()', () => {
      const epochTime = epoch.getCurrentTime()
      const now = Date.now()
      expect(Math.abs(epochTime - now)).toBeLessThan(10)
    })
  })

  describe('Elapsed Time Calculation', () => {
    it('should calculate time since epoch reference', () => {
      epoch.setReferenceEpoch(0)
      const elapsed = epoch.getElapsedTime()
      expect(elapsed).toBeGreaterThan(0)
    })

    it('should reset with new reference epoch', () => {
      const now = Date.now()
      epoch.setReferenceEpoch(now)
      const elapsed = epoch.getElapsedTime()
      expect(elapsed).toBeLessThan(100) // Should be near 0
    })

    it('should increase over time', () => {
      epoch.setReferenceEpoch(Date.now())
      const elapsed1 = epoch.getElapsedTime()
      
      // Wait 10ms
      const start = Date.now()
      while (Date.now() - start < 10) {}
      
      const elapsed2 = epoch.getElapsedTime()
      expect(elapsed2).toBeGreaterThan(elapsed1)
    })
  })

  describe('Tick Offset Calculation', () => {
    it('should calculate offset to next tick', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 500 // 500ms ticks
      const offset = epoch.getNextTickOffset(tickDuration)
      
      expect(offset).toBeGreaterThan(0)
      expect(offset).toBeLessThanOrEqual(tickDuration)
    })

    it('should handle zero tick duration', () => {
      const offset = epoch.getNextTickOffset(0)
      expect(offset).toBe(0)
    })

    it('should handle negative tick duration', () => {
      const offset = epoch.getNextTickOffset(-100)
      expect(offset).toBe(0)
    })

    it('should distribute ticks evenly', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 1000
      
      // At time 0, offset should be full duration or 0
      const offset1 = epoch.getNextTickOffset(tickDuration)
      expect(offset1).toBeLessThanOrEqual(tickDuration)
      
      // Offset should be deterministic based on current time
      const offset2 = epoch.getNextTickOffset(tickDuration)
      expect(Math.abs(offset1 - offset2)).toBeLessThan(5) // Allow small variance
    })

    it('should handle fractional tick durations', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 333.33 // ~180 BPM
      const offset = epoch.getNextTickOffset(tickDuration)
      
      expect(offset).toBeGreaterThan(0)
      expect(offset).toBeLessThanOrEqual(tickDuration)
    })
  })

  describe('Tick Synchronization', () => {
    it('should return same value as getNextTickOffset', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 500
      
      const offset = epoch.getNextTickOffset(tickDuration)
      const synced = epoch.synchronizeMetronome(tickDuration)
      
      expect(synced).toBe(offset)
    })

    it('should sync multiple metronomes to same grid', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 500
      
      const sync1 = epoch.synchronizeMetronome(tickDuration)
      const sync2 = epoch.synchronizeMetronome(tickDuration)
      
      expect(sync1).toBe(sync2)
    })

    it('should work with different tick durations', () => {
      epoch.setReferenceEpoch(0)
      
      const sync500 = epoch.synchronizeMetronome(500)
      const sync1000 = epoch.synchronizeMetronome(1000)
      
      expect(sync500).toBeGreaterThan(0)
      expect(sync1000).toBeGreaterThan(0)
    })
  })

  describe('Next Tick Time Calculation', () => {
    it('should calculate absolute time of next tick', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 500
      
      const nextTickTime = epoch.getNextTickTime(tickDuration)
      const now = Date.now()
      
      expect(nextTickTime).toBeGreaterThan(now)
      expect(nextTickTime).toBeLessThanOrEqual(now + tickDuration)
    })

    it('should equal current time plus offset', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 1000
      
      const currentTime = epoch.getCurrentTime()
      const offset = epoch.getNextTickOffset(tickDuration)
      const nextTickTime = epoch.getNextTickTime(tickDuration)
      
      expect(nextTickTime).toBeCloseTo(currentTime + offset, 5)
    })

    it('should monotonically increase for same tick duration', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 500
      
      const time1 = epoch.getNextTickTime(tickDuration)
      
      // Wait a bit
      const start = Date.now()
      while (Date.now() - start < 5) {}
      
      const time2 = epoch.getNextTickTime(tickDuration)
      expect(time2).toBeGreaterThanOrEqual(time1)
    })
  })

  describe('Tick Number Calculation', () => {
    it('should calculate tick number at current time', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 1000
      const tickNumber = epoch.getTickNumber(tickDuration)
      
      expect(tickNumber).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(tickNumber)).toBe(true)
    })

    it('should calculate tick number at specific time', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 1000
      
      // 5 seconds = 5 ticks
      const tickNumber = epoch.getTickNumber(tickDuration, 5000)
      expect(tickNumber).toBe(5)
    })

    it('should handle fractional results', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 1000
      
      // 5.5 seconds = 5 ticks (floored)
      const tickNumber = epoch.getTickNumber(tickDuration, 5500)
      expect(tickNumber).toBe(5)
    })

    it('should increment with time progression', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 1000
      
      const tick1 = epoch.getTickNumber(tickDuration, 1000)
      const tick2 = epoch.getTickNumber(tickDuration, 2000)
      const tick3 = epoch.getTickNumber(tickDuration, 3000)
      
      expect(tick1).toBe(1)
      expect(tick2).toBe(2)
      expect(tick3).toBe(3)
    })

    it('should support custom reference epoch', () => {
      const customEpoch = 1000 // Start at 1 second
      epoch.setReferenceEpoch(customEpoch)
      
      const tickNumber = epoch.getTickNumber(1000, customEpoch + 5000)
      expect(tickNumber).toBe(5)
    })

    it('should handle rapid tick durations', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 50 // 50ms ticks
      
      const tick1 = epoch.getTickNumber(tickDuration, 500)
      expect(tick1).toBe(10) // 500ms / 50ms = 10 ticks
    })

    it('should handle slow tick durations', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 5000 // 5 second ticks
      
      const tick1 = epoch.getTickNumber(tickDuration, 25000)
      expect(tick1).toBe(5) // 25s / 5s = 5 ticks
    })
  })

  describe('Reference Epoch Management', () => {
    it('should allow setting reference epoch', () => {
      const customEpoch = 1234567890
      epoch.setReferenceEpoch(customEpoch)
      expect(epoch.getReferenceEpoch()).toBe(customEpoch)
    })

    it('should affect elapsed time calculation', () => {
      const now = Date.now()
      epoch.setReferenceEpoch(now)
      
      const elapsed = epoch.getElapsedTime()
      expect(elapsed).toBeLessThan(50)
    })

    it('should reset tick calculations', () => {
      epoch.setReferenceEpoch(0)
      const tick1 = epoch.getTickNumber(1000)
      
      const newEpoch = Date.now()
      epoch.setReferenceEpoch(newEpoch)
      const tick2 = epoch.getTickNumber(1000)
      
      expect(tick2).toBeLessThan(tick1)
    })
  })

  describe('Multi-Metronome Synchronization', () => {
    it('should sync timers at different BPMs to same grid', () => {
      epoch.setReferenceEpoch(0)
      
      // 120 BPM = 500ms period
      const sync120 = epoch.synchronizeMetronome(500)
      
      // 60 BPM = 1000ms period
      const sync60 = epoch.synchronizeMetronome(1000)
      
      // Both should be valid offsets
      expect(sync120).toBeGreaterThan(0)
      expect(sync60).toBeGreaterThan(0)
      
      // Both should land on the same absolute time eventually
      const nextTick120 = epoch.getCurrentTime() + sync120
      const nextTick60 = epoch.getCurrentTime() + sync60
      
      // They might not be exactly aligned, but should be deterministic
      expect(Number.isFinite(nextTick120)).toBe(true)
      expect(Number.isFinite(nextTick60)).toBe(true)
    })

    it('should handle multiple rapid timers', () => {
      epoch.setReferenceEpoch(0)
      const periods = [100, 200, 250, 333, 500]
      
      const offsets = periods.map(p => epoch.synchronizeMetronome(p))
      
      offsets.forEach((offset, i) => {
        expect(offset).toBeGreaterThan(0)
        expect(offset).toBeLessThanOrEqual(periods[i])
      })
    })
  })

  describe('Consistency & Determinism', () => {
    it('should be deterministic for same input', () => {
      epoch.setReferenceEpoch(1000000)
      const tickDuration = 500
      
      const offset1 = epoch.getNextTickOffset(tickDuration)
      const offset2 = epoch.getNextTickOffset(tickDuration)
      
      expect(offset1).toBe(offset2)
    })

    it('should maintain grid alignment across calls', () => {
      epoch.setReferenceEpoch(0)
      const tickDuration = 1000
      
      const nextTime1 = epoch.getNextTickTime(tickDuration)
      const tickNum = epoch.getTickNumber(tickDuration, nextTime1)
      
      // At the next tick time, tick number should be one more
      const currentTickNum = epoch.getTickNumber(tickDuration)
      expect(tickNum).toBeGreaterThan(currentTickNum)
    })
  })
})
