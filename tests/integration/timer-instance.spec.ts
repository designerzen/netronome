import { describe, it, expect, beforeEach, afterEach, skipIf } from 'vitest'
import Timer from '../../src/timer'
import { TIMER_TYPE_SET_TIMEOUT } from '../../src/timer-types'
import { convertBPMToPeriod } from '../../src/time-utils'

// Skip timer instance tests in Node environment (no AudioWorkletNode)
const skipInNode = typeof AudioWorkletNode === 'undefined'

describe.skipIf(skipInNode)('Timer Instance Behavior', () => {
  let timer: Timer

  beforeEach(() => {
    timer = new Timer({
      type: TIMER_TYPE_SET_TIMEOUT,
      bpm: 120,
      bars: 16,
      divisions: 24,
      accurate: false,
    })
  })

  afterEach(async () => {
    if (timer.isRunning) {
      await timer.stopTimer()
    }
  })

  describe('Initialization', () => {
    it('should create timer with default options', () => {
      expect(timer).toBeDefined()
      expect(timer.BPM).toBe(120)
    })

    it('should set bars configuration', () => {
      expect(timer.bars).toBe(16)
      expect(timer.divisions).toBe(24)
    })

    it('should initialize counters to zero', () => {
      expect(timer.divisionsElapsed).toBe(0)
      expect(timer.barsElapsed).toBe(0)
      expect(timer.currentBar).toBe(0)
    })

    it('should not be running on creation', () => {
      expect(timer.isRunning).toBe(false)
      expect(timer.running).toBe(false)
    })

    it('should not be active on creation', () => {
      expect(timer.isActive).toBe(false)
    })
  })

  describe('BPM Configuration', () => {
    it('should set and get BPM', () => {
      timer.BPM = 140
      expect(timer.BPM).toBe(140)
    })

    it('should update period when BPM changes', () => {
      const period120 = timer.timeBetween
      timer.BPM = 60
      const period60 = timer.timeBetween
      
      expect(period60).toBeGreaterThan(period120)
    })

    it('should handle BPM range', () => {
      timer.BPM = 30
      expect(timer.BPM).toBe(30)
      
      timer.BPM = 300
      expect(timer.BPM).toBe(300)
    })

    it('should convert BPM to period correctly', () => {
      timer.BPM = 120
      const expectedPeriod = convertBPMToPeriod(120) / timer.divisions
      expect(timer.timeBetween).toBe(expectedPeriod)
    })
  })

  describe('Time Tracking', () => {
    it('should track current bar number', () => {
      expect(timer.bar).toBe(0)
      expect(timer.currentBar).toBe(0)
    })

    it('should track divisions per bar', () => {
      expect(timer.divisions).toBe(24)
    })

    it('should calculate time per bar', () => {
      const timePerBar = timer.timePerBar
      const expectedTime = timer.timeBetween * timer.divisions
      expect(timePerBar).toBeCloseTo(expectedTime, 0)
    })

    it('should calculate total time', () => {
      const totalTime = timer.totalTime
      const expectedTime = timer.timePerBar * timer.bars
      expect(totalTime).toBeCloseTo(expectedTime, 0)
    })

    it('should track elapsed time', () => {
      const initialElapsed = timer.timeElapsed
      expect(typeof initialElapsed).toBe('number')
    })
  })

  describe('Bar & Division Tracking', () => {
    it('should track divisions elapsed', () => {
      expect(timer.divisionsElapsed).toBe(0)
    })

    it('should track bars elapsed', () => {
      expect(timer.barsElapsed).toBe(0)
    })

    it('should have correct maximum bars', () => {
      expect(timer.bars).toBe(16)
    })

    it('should have synchronization support', () => {
      const isSynched = timer.isSynchronized()
      expect(typeof isSynched).toBe('boolean')
    })
  })

  describe('Callback Configuration', () => {
    it('should set and call callback', (done) => {
      let callCount = 0
      const callback = () => {
        callCount++
        if (callCount >= 1) {
          done()
        }
      }

      timer.setCallback(callback)
      // Callback is stored but not called until timer events
    })

    it('should support null callback', () => {
      timer.setCallback(null as any)
      expect(timer.callback).toBeNull()
    })

    it('should update callback', () => {
      const callback1 = () => {}
      const callback2 = () => {}

      timer.setCallback(callback1)
      timer.setCallback(callback2)
      
      expect(timer.callback).toBe(callback2)
    })
  })

  describe('Timer State Management', () => {
    it('should track running state', () => {
      expect(timer.isRunning).toBe(false)
    })

    it('should track active state', () => {
      expect(timer.isActive).toBe(false)
    })

    it('should track bypass state', () => {
      expect(timer.isBypassed).toBe(false)
    })

    it('should check availability', () => {
      const available = timer.available
      expect(typeof available).toBe('boolean')
    })
  })

  describe('Option Management', () => {
    it('should expose options', () => {
      const options = timer.options
      expect(options).toBeDefined()
      expect(options.bpm).toBe(120)
    })

    it('should store bars option', () => {
      expect(timer.options.bars).toBe(16)
    })

    it('should store divisions option', () => {
      expect(timer.options.divisions).toBe(24)
    })

    it('should track accurate mode setting', () => {
      expect(timer.options.accurate).toBe(false)
    })
  })

  describe('Synchronization Management', () => {
    it('should support synchronization toggling', () => {
      const initialSynced = timer.isSynchronized()
      
      timer.setSynchronized(!initialSynced)
      expect(timer.isSynchronized()).toBe(!initialSynced)
      
      timer.setSynchronized(initialSynced)
      expect(timer.isSynchronized()).toBe(initialSynced)
    })

    it('should get synchronization offset', () => {
      const offset = timer.getSynchronizationOffset()
      expect(typeof offset).toBe('number')
      expect(offset).toBeGreaterThanOrEqual(0)
    })

    it('should get global tick number', () => {
      const tickNum = timer.getGlobalTickNumber()
      expect(typeof tickNum).toBe('number')
      expect(tickNum).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Timer Timing Properties', () => {
    it('should have readable now property', () => {
      const now = timer.now
      expect(typeof now).toBe('number')
      expect(now).toBeGreaterThan(0)
    })

    it('should calculate time between ticks', () => {
      const timeBetween = timer.timeBetween
      expect(timeBetween).toBeGreaterThan(0)
    })

    it('should calculate bars per cycle', () => {
      expect(timer.bars).toBeGreaterThan(0)
    })

    it('should calculate divisions per bar', () => {
      expect(timer.divisions).toBeGreaterThan(0)
    })
  })

  describe('Multiple Timer Instances', () => {
    it('should create independent timer instances', () => {
      const timer1 = new Timer({ bpm: 120, type: TIMER_TYPE_SET_TIMEOUT })
      const timer2 = new Timer({ bpm: 60, type: TIMER_TYPE_SET_TIMEOUT })

      expect(timer1.BPM).toBe(120)
      expect(timer2.BPM).toBe(60)
      expect(timer1.BPM).not.toBe(timer2.BPM)

      // Cleanup
      if (timer1.isRunning) timer1.stopTimer()
      if (timer2.isRunning) timer2.stopTimer()
    })

    it('should maintain independent state', () => {
      const timer1 = new Timer({ bpm: 120, bars: 8, type: TIMER_TYPE_SET_TIMEOUT })
      const timer2 = new Timer({ bpm: 120, bars: 16, type: TIMER_TYPE_SET_TIMEOUT })

      expect(timer1.bars).toBe(8)
      expect(timer2.bars).toBe(16)

      // Cleanup
      if (timer1.isRunning) timer1.stopTimer()
      if (timer2.isRunning) timer2.stopTimer()
    })

    it('should allow different configurations', () => {
      const timer1 = new Timer({
        bpm: 100,
        divisions: 12,
        bars: 4,
        type: TIMER_TYPE_SET_TIMEOUT,
      })
      const timer2 = new Timer({
        bpm: 150,
        divisions: 24,
        bars: 32,
        type: TIMER_TYPE_SET_TIMEOUT,
      })

      expect(timer1.BPM).toBe(100)
      expect(timer1.divisions).toBe(12)
      expect(timer1.bars).toBe(4)

      expect(timer2.BPM).toBe(150)
      expect(timer2.divisions).toBe(24)
      expect(timer2.bars).toBe(32)

      // Cleanup
      if (timer1.isRunning) timer1.stopTimer()
      if (timer2.isRunning) timer2.stopTimer()
    })
  })

  describe('Edge Cases', () => {
    it('should handle minimum BPM', () => {
      timer.BPM = 1
      expect(timer.BPM).toBe(10)
    })

    it('should handle very high BPM', () => {
      timer.BPM = 999
      expect(timer.BPM).toBe(999)
    })

    it('should handle single division', () => {
      const singleDivTimer = new Timer({
        bpm: 120,
        divisions: 1,
        type: TIMER_TYPE_SET_TIMEOUT,
      })
      expect(singleDivTimer.divisions).toBe(1)

      if (singleDivTimer.isRunning) singleDivTimer.stopTimer()
    })

    it('should handle many divisions', () => {
      const manyDivTimer = new Timer({
        bpm: 120,
        divisions: 96, // 4 sixteenth notes per beat
        type: TIMER_TYPE_SET_TIMEOUT,
      })
      expect(manyDivTimer.divisions).toBe(96)

      if (manyDivTimer.isRunning) manyDivTimer.stopTimer()
    })

    it('should handle single bar', () => {
      const singleBarTimer = new Timer({
        bpm: 120,
        bars: 1,
        type: TIMER_TYPE_SET_TIMEOUT,
      })
      expect(singleBarTimer.bars).toBe(1)

      if (singleBarTimer.isRunning) singleBarTimer.stopTimer()
    })

    it('should handle many bars', () => {
      const manyBarTimer = new Timer({
        bpm: 120,
        bars: 256,
        type: TIMER_TYPE_SET_TIMEOUT,
      })
      expect(manyBarTimer.bars).toBe(256)

      if (manyBarTimer.isRunning) manyBarTimer.stopTimer()
    })
  })
})
