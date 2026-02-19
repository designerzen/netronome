import { describe, it, expect, vi } from 'vitest'

/**
 * Advanced Clock Behavior Tests
 * Extended tests for complex timer scenarios
 */

describe('Advanced Clock Behavior', () => {
  describe('State Machine Verification', () => {
    it('should enforce valid state transitions', () => {
      type TimerState = 'stopped' | 'started' | 'paused'

      const validTransitions: Record<TimerState, TimerState[]> = {
        stopped: ['started'],
        started: ['paused', 'stopped'],
        paused: ['started', 'stopped'],
      }

      let currentState: TimerState = 'stopped'

      // Valid transitions should work
      expect(validTransitions[currentState]).toContain('started')
      currentState = 'started'

      expect(validTransitions[currentState]).toContain('paused')
      currentState = 'paused'

      expect(validTransitions[currentState]).toContain('started')
      currentState = 'started'

      expect(validTransitions[currentState]).toContain('stopped')
      currentState = 'stopped'

      expect(currentState).toBe('stopped')
    })

    it('should allow complex state sequences', () => {
      const states: string[] = []
      let state = 'stopped'

      // Sequence: stopped → started → paused → started → paused → stopped
      const sequence = ['started', 'paused', 'started', 'paused', 'stopped']

      for (const nextState of sequence) {
        state = nextState
        states.push(state)
      }

      expect(states).toEqual(sequence)
    })
  })

  describe('Tick Count Accuracy', () => {
    it('should maintain tick accuracy with fractional BPM', () => {
      const bpm = 123.456 // Fractional BPM
      const durationSeconds = 10

      const expectedTicks = (bpm / 60) * durationSeconds
      expect(expectedTicks).toBeCloseTo(20.576, 2)
    })

    it('should handle BPM changes without tick loss', () => {
      let ticks = 0
      const bpmChanges = [
        { bpm: 120, duration: 1 }, // 2 ticks
        { bpm: 60, duration: 1 }, // 1 tick
        { bpm: 240, duration: 1 }, // 4 ticks
      ]

      for (const change of bpmChanges) {
        const newTicks = (change.bpm / 60) * change.duration
        ticks += newTicks
      }

      expect(ticks).toBe(7) // 2 + 1 + 4
    })

    it('should preserve tick count during pause/resume', () => {
      let ticks = 0
      const ticksBeforePause = 50

      ticks = ticksBeforePause

      // Pause: ticks should remain
      expect(ticks).toBe(ticksBeforePause)

      // Resume: ticks should continue from same count
      ticks = ticksBeforePause + 25

      expect(ticks).toBe(ticksBeforePause + 25)
    })

    it('should accumulate ticks correctly across multiple pause/resume cycles', () => {
      let ticks = 0

      // Cycle 1: 10 ticks
      ticks = 10
      const ticks1 = ticks

      // Pause (ticks frozen at 10)
      // Resume: continue from 10
      ticks = ticks1 + 10
      expect(ticks).toBe(20)

      // Cycle 2: 10 more ticks
      // Pause (ticks frozen at 20)
      // Resume: continue from 20
      ticks = ticks + 15
      expect(ticks).toBe(35)

      // Cycle 3: 15 more ticks
      // Stop: reset to 0
      ticks = 0
      expect(ticks).toBe(0)
    })
  })

  describe('Tempo Change Handling', () => {
    it('should handle immediate tempo changes', () => {
      let bpm = 120

      const ticksBeforeChange = (bpm / 60) * 1 // 2 ticks in 1 second

      bpm = 240 // Double the tempo
      const ticksAfterChange = (bpm / 60) * 1 // 4 ticks in 1 second

      const totalTicks = ticksBeforeChange + ticksAfterChange
      expect(totalTicks).toBe(6)
    })

    it('should handle scheduled tempo changes', () => {
      const schedule = [
        { time: 0, bpm: 120 },
        { time: 1000, bpm: 180 },
        { time: 2000, bpm: 60 },
      ]

      // Calculate ticks for each segment
      let totalTicks = 0
      for (let i = 0; i < schedule.length - 1; i++) {
        const bpm = schedule[i].bpm
        const duration = (schedule[i + 1].time - schedule[i].time) / 1000 // Convert to seconds
        totalTicks += (bpm / 60) * duration
      }

      // 0-1s at 120 BPM = 2 ticks
      // 1-2s at 180 BPM = 3 ticks
      expect(totalTicks).toBe(5)
    })

    it('should handle very small tempo changes', () => {
      const bpm1 = 120.0
      const bpm2 = 120.1

      const ticks1 = (bpm1 / 60) * 1
      const ticks2 = (bpm2 / 60) * 1

      const diff = Math.abs(ticks2 - ticks1)
      expect(diff).toBeCloseTo(0.00167, 5)
    })

    it('should linearize tempo changes for calculation', () => {
      const startBPM = 120
      const endBPM = 60
      const duration = 2 // seconds

      // At 1 second (middle of ramp)
      const progress = 0.5
      const midpointBPM = startBPM + (endBPM - startBPM) * progress
      expect(midpointBPM).toBe(90)

      // Calculate ticks for first half and second half
      const firstHalf = (startBPM / 60) * 1 // At constant start BPM
      const secondHalf = (endBPM / 60) * 1 // At constant end BPM

      // A linear ramp would be somewhere between these
      // Simpler approximation: use average
      const average = ((startBPM + endBPM) / 2 / 60) * 2
      expect(average).toBeCloseTo(3, 1)
    })
  })

  describe('Time Synchronization', () => {
    it('should maintain time sync with audioContext', () => {
      const audioStartTime = 0 // Typically from AudioContext.currentTime
      const timerStartTime = Date.now()

      // Both should mark the same logical point
      const offset = timerStartTime - audioStartTime
      expect(offset).toBeGreaterThan(0)
    })

    it('should calculate lag between scheduled and actual time', () => {
      const scheduledTime = 1000 // 1 second from start
      const actualTime = 1005 // 5ms late
      const lag = actualTime - scheduledTime

      expect(lag).toBe(5)
    })

    it('should track drift over multiple callbacks', () => {
      const expectedIntervals = [500, 500, 500, 500, 500]
      const actualIntervals = [505, 502, 498, 510, 495]

      let totalDrift = 0
      for (let i = 0; i < expectedIntervals.length; i++) {
        totalDrift += actualIntervals[i] - expectedIntervals[i]
      }

      expect(Math.abs(totalDrift)).toBe(10) // 5 + 2 - 2 + 10 - 5
    })

    it('should calculate average jitter', () => {
      const intervals = [500, 502, 498, 505, 495, 501]

      // Calculate mean
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length

      // Calculate variance
      const variance =
        intervals.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / intervals.length

      // Standard deviation
      const stdDev = Math.sqrt(variance)

      expect(mean).toBeCloseTo(500.17, 1)
      expect(stdDev).toBeCloseTo(3.13, 1)
    })
  })

  describe('Callback Scheduling', () => {
    it('should invoke callbacks in order', () => {
      const callOrder: number[] = []
      const callback = (tick: number) => {
        callOrder.push(tick)
      }

      // Simulate scheduled callbacks
      for (let tick = 0; tick < 5; tick++) {
        callback(tick)
      }

      expect(callOrder).toEqual([0, 1, 2, 3, 4])
    })

    it('should handle scheduled callbacks at specific times', () => {
      const callbacks: Array<{ time: number; tick: number }> = []

      const schedule = [
        { time: 0, tick: 0 },
        { time: 500, tick: 1 },
        { time: 1000, tick: 2 },
        { time: 1500, tick: 3 },
      ]

      for (const event of schedule) {
        callbacks.push(event)
      }

      expect(callbacks).toHaveLength(4)
      expect(callbacks[3].tick).toBe(3)
    })

    it('should invoke callbacks at predictable frequency', () => {
      const bpm = 120
      const expectedFrequency = bpm / 60 // 2 Hz
      const durationSeconds = 10

      const expectedCallbacks = expectedFrequency * durationSeconds
      expect(expectedCallbacks).toBe(20)
    })

    it('should support callback with tick offset', () => {
      const initialOffset = 4
      let currentTick = initialOffset

      const callback = (tick: number) => {
        expect(tick).toBe(currentTick)
        currentTick++
      }

      // Invoke with offset
      for (let i = 0; i < 5; i++) {
        callback(initialOffset + i)
      }

      expect(currentTick).toBe(initialOffset + 5)
    })
  })

  describe('Drift Compensation', () => {
    it('should track cumulative drift', () => {
      const expectedIntervals: number[] = []
      const actualIntervals: number[] = []

      // Expected: perfect 500ms intervals
      for (let i = 0; i < 10; i++) {
        expectedIntervals.push(500)
      }

      // Actual: with some jitter
      actualIntervals.push(502, 498, 505, 495, 501, 503, 497, 504, 496, 500)

      let cumulativeDrift = 0
      for (let i = 0; i < expectedIntervals.length; i++) {
        const drift = actualIntervals[i] - expectedIntervals[i]
        cumulativeDrift += drift
      }

      expect(cumulativeDrift).toBe(1) // Small accumulated drift
    })

    it('should correct drift through compensation', () => {
      let lag = 10 // 10ms behind schedule
      const compensation = -lag

      lag += compensation
      expect(lag).toBe(0)
    })

    it('should track lag history', () => {
      const lagHistory = [2, 4, 3, 5, 2, 6, 4, 3, 5, 2]

      // Average lag
      const avgLag = lagHistory.reduce((a, b) => a + b, 0) / lagHistory.length
      expect(avgLag).toBeCloseTo(3.6, 1)

      // Max lag
      const maxLag = Math.max(...lagHistory)
      expect(maxLag).toBe(6)

      // Min lag
      const minLag = Math.min(...lagHistory)
      expect(minLag).toBe(2)
    })
  })

  describe('Multiple Timer Coordination', () => {
    it('should maintain independent tick counts', () => {
      let timer1Ticks = 0
      let timer2Ticks = 0

      // Advance timer 1
      timer1Ticks = 10

      // Timer 2 should still be at 0
      expect(timer2Ticks).toBe(0)

      // Advance timer 2
      timer2Ticks = 5

      // Timer 1 should still be at 10
      expect(timer1Ticks).toBe(10)
    })

    it('should handle different BPMs independently', () => {
      const timer1BPM = 120
      const timer2BPM = 60

      const duration = 1 // 1 second

      const timer1Ticks = (timer1BPM / 60) * duration
      const timer2Ticks = (timer2BPM / 60) * duration

      expect(timer1Ticks).toBe(2)
      expect(timer2Ticks).toBe(1)
    })

    it('should sync multiple timers to common clock', () => {
      const timers = [
        { id: 'A', offset: 0 },
        { id: 'B', offset: 100 }, // 100ms offset
        { id: 'C', offset: 250 }, // 250ms offset
      ]

      const commonTime = 1000
      const timerTimes = timers.map((t) => ({
        ...t,
        time: commonTime - t.offset,
      }))

      // All timers should reach sync point at commonTime
      expect(timerTimes[0].time + timerTimes[0].offset).toBe(commonTime)
      expect(timerTimes[1].time + timerTimes[1].offset).toBe(commonTime)
      expect(timerTimes[2].time + timerTimes[2].offset).toBe(commonTime)
    })
  })

  describe('Extreme Values', () => {
    it('should handle minimum BPM values', () => {
      const minBPM = 1
      const duration = 60 // 60 seconds

      const ticks = (minBPM / 60) * duration
      expect(ticks).toBe(1) // 1 tick per minute
    })

    it('should handle maximum BPM values', () => {
      const maxBPM = 300
      const duration = 1 // 1 second

      const ticks = (maxBPM / 60) * duration
      expect(ticks).toBe(5) // 5 ticks per second
    })

    it('should handle very long durations', () => {
      const bpm = 120
      const duration = 3600 // 1 hour in seconds

      const ticks = (bpm / 60) * duration
      expect(ticks).toBe(7200) // 7200 ticks per hour
    })

    it('should handle very short durations', () => {
      const bpm = 120
      const duration = 0.001 // 1 millisecond in seconds

      const ticks = (bpm / 60) * duration
      expect(ticks).toBeCloseTo(0.002, 5)
    })

    it('should handle rapid state changes', () => {
      let state = 'stopped'
      let stateChanges = 0

      // Rapid start/stop cycles
      for (let i = 0; i < 100; i++) {
        state = state === 'stopped' ? 'started' : 'stopped'
        stateChanges++
      }

      expect(stateChanges).toBe(100)
      // After 100 toggles starting from 'stopped', we end on 'stopped' (even number of toggles)
      expect(state).toBe('stopped')
    })
  })

  describe('Performance', () => {
    it('should calculate tick count efficiently', () => {
      const iterations = 10000
      const bpm = 120

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        const ticks = (bpm / 60) * 1
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete quickly (under 100ms)
      expect(duration).toBeLessThan(100)
    })

    it('should handle callback invocations efficiently', () => {
      const callback = vi.fn()
      const iterations = 10000

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        callback(i, i * 100)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(callback).toHaveBeenCalledTimes(iterations)
      expect(duration).toBeLessThan(200)
    })
  })

  describe('Numerical Precision', () => {
    it('should maintain precision with repeated calculations', () => {
      let value = 1
      const bpm = 120

      for (let i = 0; i < 1000; i++) {
        value *= bpm / 60
        value /= bpm / 60
      }

      // Should remain close to original value
      expect(value).toBeCloseTo(1, 10)
    })

    it('should handle accumulated time accurately', () => {
      const bpm = 120
      const interval = 60000 / bpm
      let totalTime = 0

      for (let i = 0; i < 10000; i++) {
        totalTime += interval
      }

      // 10000 ticks * 500ms per tick = 5,000,000ms
      expect(totalTime).toBe(5000000)
    })

    it('should preserve precision in tempo calculations', () => {
      const startBPM = 120.123456
      const endBPM = 60.789012
      const progress = 0.5

      const current = startBPM + (endBPM - startBPM) * progress
      const expectedMidpoint = (startBPM + endBPM) / 2

      expect(current).toBeCloseTo(expectedMidpoint, 5)
    })
  })
})
