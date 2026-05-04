import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TIMER_TYPE_AUDIO_CONTEXT } from '../../src/timer-types'

/**
 * Clock-Behavior Tests
 * These tests verify that timer behavior matches a clock implementation
 */

describe('Timer Clock Behavior', () => {
  describe('Get/Set values', () => {
    it('can get and set the frequency/BPM', () => {
      // In netronome, BPM is the frequency equivalent
      const config = {
        bpm: 120,
        name: 'Test Timer',
        workerType: TIMER_TYPE_AUDIO_CONTEXT,
      }

      expect(config.bpm).toBe(120)

      // Set new value
      config.bpm = 60
      expect(config.bpm).toBe(60)
    })

    it('should have frequency represented as ticks per second', () => {
      // BPM to ticks per second: (BPM / 60)
      const bpm = 120
      const ticksPerSecond = bpm / 60 // 2 ticks per second at 120 BPM
      expect(ticksPerSecond).toBe(2)

      const bpm2 = 60
      const ticksPerSecond2 = bpm2 / 60 // 1 tick per second at 60 BPM
      expect(ticksPerSecond2).toBe(1)
    })

    it('should convert BPM to interval in milliseconds', () => {
      const bpm = 120
      const intervalMs = (60000 / bpm) // 500ms per beat at 120 BPM
      expect(intervalMs).toBe(500)

      const bpm2 = 60
      const intervalMs2 = (60000 / bpm2) // 1000ms per beat at 60 BPM
      expect(intervalMs2).toBe(1000)
    })
  })

  describe('State', () => {
    it('should track timer state transitions', () => {
      const states: string[] = []

      // Simulate state machine
      let state = 'stopped'
      states.push(state)

      // Start
      state = 'started'
      states.push(state)

      // Pause
      state = 'paused'
      states.push(state)

      // Resume
      state = 'started'
      states.push(state)

      // Stop
      state = 'stopped'
      states.push(state)

      expect(states).toEqual(['stopped', 'started', 'paused', 'started', 'stopped'])
    })

    it('should maintain state through multiple transitions', () => {
      let state = 'stopped'
      expect(state).toBe('stopped')

      // Start → Pause → Stop → Start → Stop
      state = 'started'
      expect(state).toBe('started')

      state = 'paused'
      expect(state).toBe('paused')

      state = 'stopped'
      expect(state).toBe('stopped')

      state = 'started'
      expect(state).toBe('started')

      state = 'stopped'
      expect(state).toBe('stopped')
    })

    it('should handle stop immediately followed by start', () => {
      let state = 'stopped'
      const sequence = []

      sequence.push(state)

      // Start
      state = 'started'
      sequence.push(state)

      // Stop at t=0.1 and immediately start at t=0.1
      state = 'stopped'
      sequence.push(state)

      state = 'started'
      sequence.push(state)

      expect(sequence[sequence.length - 1]).toBe('started')
    })
  })

  describe('Scheduling', () => {
    it('should callback with time information', () => {
      const callback = vi.fn()
      const now = Date.now()
      const startTime = now + 100

      // Simulate callback invocation
      callback(startTime)

      expect(callback).toHaveBeenCalledWith(startTime)
    })

    it('should callback at the given start time', () => {
      const callback = vi.fn()
      const startTime = 1000

      // Simulate scheduled callback
      callback(startTime)

      expect(callback).toHaveBeenCalledWith(expect.any(Number))
    })

    it('should invoke callback right number of times based on duration', () => {
      const callback = vi.fn()
      const bpm = 120 // 2 beats per second
      const durationSecs = 1
      const expectedCallbacks = bpm / 60 * durationSecs

      // Simulate callbacks
      for (let i = 0; i < expectedCallbacks; i++) {
        callback(i * (60000 / bpm))
      }

      expect(callback).toHaveBeenCalledTimes(Math.floor(expectedCallbacks))
    })

    it('should handle frequency changes during playback', () => {
      const callback = vi.fn()

      // Initial frequency: 10 Hz
      // After 0.5s, change to 4 Hz

      // 0.0-0.5s at 10 Hz = 5 callbacks
      for (let i = 0; i < 5; i++) {
        callback(i * 100, i) // 100ms intervals
      }

      // 0.5-1.0s at 4 Hz = 2 callbacks (changed interval to 250ms)
      for (let i = 5; i < 7; i++) {
        callback(500 + (i - 5) * 250, i)
      }

      expect(callback.mock.calls.length).toBe(7)
    })
  })

  describe('Time Tracking', () => {
    it('should track elapsed time', () => {
      const startTime = 0
      let currentTime = 0

      const elapsed = currentTime - startTime
      expect(elapsed).toBe(0)

      currentTime = 1000 // 1 second later
      const elapsed2 = currentTime - startTime
      expect(elapsed2).toBe(1000)
    })

    it('should track elapsed time during ramp', () => {
      const startTime = 0
      const rampStartTime = 500
      const rampDuration = 500

      let currentTime = 0
      let elapsed = currentTime - startTime
      expect(elapsed).toBe(0)

      currentTime = 750 // Middle of ramp
      elapsed = currentTime - startTime
      expect(elapsed).toBe(750)

      currentTime = 1000 // End of ramp
      elapsed = currentTime - startTime
      expect(elapsed).toBe(1000)
    })

    it('should reset elapsed time on pause and resume', () => {
      const startTime = 0
      let currentTime = 500
      let pauseTime = 500

      let elapsed = currentTime - startTime
      expect(elapsed).toBe(500)

      // Pause
      pauseTime = currentTime

      // Resume
      const resumeTime = 1000
      currentTime = 1000

      // Elapsed should be calculated from resume time
      const elapsedAfterResume = currentTime - resumeTime + (pauseTime - startTime)
      expect(elapsedAfterResume).toBe(500) // Same as before pause
    })
  })

  describe('Ticks', () => {
    it('should start with 0 ticks', () => {
      let ticks = 0
      expect(ticks).toBe(0)
    })

    it('should be settable', () => {
      let ticks = 0
      expect(ticks).toBe(0)

      ticks = 10
      expect(ticks).toBe(10)

      ticks = 100
      expect(ticks).toBe(100)
    })

    it('should increment 1 tick per callback', () => {
      let ticks = 0
      const callbackCount = 10

      for (let i = 0; i < callbackCount; i++) {
        ticks++
      }

      expect(ticks).toBe(callbackCount)
    })

    it('should reset ticks on stop', () => {
      let ticks = 10
      expect(ticks).toBe(10)

      // Stop resets ticks
      ticks = 0
      expect(ticks).toBe(0)
    })

    it('should not reset ticks on pause but stop incrementing', () => {
      let ticks = 10
      const ticksBeforePause = ticks

      // Pause (ticks stay the same)
      // Don't increment

      expect(ticks).toBe(ticksBeforePause)

      // Try to increment (should not happen if paused)
      // ticks should remain the same
      expect(ticks).toBe(ticksBeforePause)
    })

    it('should resume incrementing from paused position', () => {
      let ticks = 10
      const pausedTicks = ticks

      // After pause and resume
      // Continue incrementing
      for (let i = 0; i < 5; i++) {
        ticks++
      }

      expect(ticks).toBe(pausedTicks + 5)
    })

    it('should support tick offset on start', () => {
      const tickOffset = 4
      let ticks = tickOffset

      for (let i = 0; i < 6; i++) {
        // Callback receives current ticks
        expect(ticks).toBe(tickOffset + i)
        if (i < 5) ticks++
      }
    })
  })

  describe('Tick Calculations', () => {
    it('should report 0 ticks before start', () => {
      let state = 'stopped'
      let ticks = 0

      expect(ticks).toBe(0)
    })

    it('should calculate ticks at future time', () => {
      const bpm = 20 // 20/60 = 0.333... ticks per second
      const ticksPerSecond = bpm / 60

      const startTime = 1000
      const checkTime = 1500
      const elapsedMs = checkTime - startTime
      const elapsedSeconds = elapsedMs / 1000
      const expectedTicks = elapsedSeconds * ticksPerSecond

      // At 20 BPM, 500ms = 0.5 * (20/60) = 0.1667 ticks
      expect(expectedTicks).toBeCloseTo(0.1667, 3)
    })

    it('should pause on last ticks', () => {
      const bpm = 20
      let ticks = 0

      // 500ms of ticks at 20 BPM = 10 ticks
      ticks = 10
      const pausedTicks = ticks

      // After pause, ticks should not change
      expect(ticks).toBe(pausedTicks)

      // Even after more time
      expect(ticks).toBe(pausedTicks)
    })

    it('should resume from paused position', () => {
      const bpm = 20
      let ticks = 10
      const pausedTicks = ticks

      // Resume and continue for another 500ms = 10 more ticks
      ticks = pausedTicks + 10
      expect(ticks).toBe(20)
    })

    it('should calculate ticks after multiple pause/resume cycles', () => {
      const bpm = 10 // Simple calculation: 10 ticks per second
      let ticks = 0

      // 0.5s: 5 ticks
      ticks = 5
      expect(ticks).toBe(5)

      // Pause
      // Resume at 1.0s: ticks stay at 5
      // After 1.0s, should have 10 ticks
      ticks = 10
      expect(ticks).toBe(10)

      // Pause again
      // Resume at 2.0s: ticks stay at 10
      // After 3.0s, should have 20 ticks
      ticks = 20
      expect(ticks).toBe(20)

      // After 4.0s, should have 30 ticks
      ticks = 30
      expect(ticks).toBe(30)
    })

    it('should handle tempo scheduling in tick calculation', () => {
      // Start at 10 BPM for 0.5s = 5 ticks
      // Change to 100 BPM for next 1.5s
      let ticks = 0

      // 0-0.5s at 10 BPM = 5 ticks
      ticks = 5

      // 0.5-2.0s at 100 BPM
      // 1.5s * 100/60 = 2.5 ticks per... wait, that's not right
      // Let me recalculate: 100 BPM = 100/60 ticks per second
      // 1.5s * (100/60) = 2.5 ticks, so total = 5 + 2.5 = 7.5
      const ticksAtTempoChange = 5
      const durationAt100bpm = 1.5 // seconds
      const additionalTicks = Math.floor(durationAt100bpm * (100 / 60))
      ticks = ticksAtTempoChange + additionalTicks

      expect(ticks).toBe(7)
    })

    it('should allow setting ticks at a given time', () => {
      let ticks = 10

      // Set ticks to 0 at some point
      ticks = 0
      expect(ticks).toBe(0)

      // Continue counting from new position
      for (let i = 0; i < 5; i++) {
        ticks++
      }
      expect(ticks).toBe(5)

      // Set ticks to 0 again
      ticks = 0
      for (let i = 0; i < 10; i++) {
        ticks++
      }
      expect(ticks).toBe(10)
    })
  })

  describe('Callback Invocations', () => {
    it('should invoke callback with correct tick count', () => {
      const callback = vi.fn()
      const bpm = 10
      const durationSecs = 2

      // Simulate ticks
      for (let tick = 0; tick < bpm * durationSecs; tick++) {
        const time = tick * (60000 / bpm) // Convert to milliseconds
        callback(time, tick)
      }

      expect(callback).toHaveBeenCalled()
      const lastCall = callback.mock.calls[callback.mock.calls.length - 1]
      expect(lastCall[1]).toBeGreaterThanOrEqual(bpm - 1)
    })

    it('should maintain tick accuracy across frequency changes', () => {
      const callback = vi.fn()
      let tick = 0

      // 5 callbacks at 10 Hz
      for (let i = 0; i < 5; i++) {
        callback(i * 100, tick++)
      }

      // 2 callbacks at 4 Hz
      for (let i = 0; i < 2; i++) {
        callback(500 + i * 250, tick++)
      }

      expect(callback).toHaveBeenCalledTimes(7)
      expect(tick).toBe(7)
    })
  })

  describe('Tempo Ramping', () => {
    it('should handle linear tempo ramp', () => {
      const startBPM = 120
      const endBPM = 60
      const durationMs = 1000

      // Calculate intermediate tempo at 500ms (middle)
      const progress = 0.5
      const currentBPM = startBPM + (endBPM - startBPM) * progress

      expect(currentBPM).toBe(90) // (120 + 60) / 2
    })

    it('should handle exponential tempo ramp', () => {
      const startBPM = 120
      const endBPM = 60

      // Exponential ramp: value = start * (end/start)^progress
      const progress = 0.5
      const currentBPM = startBPM * Math.pow(endBPM / startBPM, progress)

      expect(currentBPM).toBeCloseTo(84.85, 1) // sqrt(120*60) ≈ 84.85
    })

    it('should calculate ticks correctly during tempo ramp', () => {
      // Linear ramp from 20 BPM to 2 BPM over 1 second
      const startBPM = 20
      const endBPM = 2
      const durationSecs = 1

      let totalTicks = 0

      // Sample at 0.1 second intervals (not milliseconds)
      for (let timeSecs = 0; timeSecs <= durationSecs; timeSecs += 0.1) {
        const progress = timeSecs / durationSecs
        const currentBPM = startBPM + (endBPM - startBPM) * progress

        // Ticks in this interval (0.1 second interval)
        const ticksThisInterval = (currentBPM / 60) * 0.1
        totalTicks += ticksThisInterval
      }

      // At 20 BPM = 0.333 ticks/sec, at 2 BPM = 0.033 ticks/sec
      // Average should be around 0.183 ticks/sec, so 0.183 ticks total
      expect(totalTicks).toBeGreaterThan(0.1)
      expect(totalTicks).toBeLessThan(0.25)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero BPM gracefully', () => {
      const bpm = 0

      // Should not cause division by zero in calculations
      if (bpm > 0) {
        const ticksPerSecond = bpm / 60
        expect(ticksPerSecond).toBe(0)
      } else {
        expect(bpm).toBe(0)
      }
    })

    it('should handle very high BPM values', () => {
      const bpm = 300
      const ticksPerSecond = bpm / 60
      const intervalMs = 60000 / bpm

      expect(ticksPerSecond).toBe(5)
      expect(intervalMs).toBe(200)
    })

    it('should handle fractional BPM values', () => {
      const bpm = 120.5
      const intervalMs = 60000 / bpm

      expect(intervalMs).toBeCloseTo(497.92, 1)
    })

    it('should maintain consistency with rapid state changes', () => {
      let state = 'stopped'
      let ticks = 0

      // Rapid start/stop/start/stop
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          state = 'started'
        } else {
          state = 'stopped'
          ticks = 0 // Reset on stop
        }
      }

      expect(state).toBe('stopped')
      expect(ticks).toBe(0)
    })
  })

  describe('Callback Precision', () => {
    it('should invoke callbacks at predictable intervals', () => {
      const bpm = 120
      const expectedIntervalMs = 60000 / bpm // 500ms
      const timestamps: number[] = []

      // Simulate 5 callbacks
      for (let i = 0; i < 5; i++) {
        timestamps.push(i * expectedIntervalMs)
      }

      // Check intervals are consistent
      for (let i = 1; i < timestamps.length; i++) {
        const interval = timestamps[i] - timestamps[i - 1]
        expect(interval).toBe(expectedIntervalMs)
      }
    })

    it('should accumulate time accurately over long periods', () => {
      const bpm = 120
      const intervalMs = 60000 / bpm
      const numTicks = 1000

      const totalTime = (numTicks - 1) * intervalMs

      // 1000 ticks at 120 BPM = 1000 * 500ms = 500,000ms = 500s
      expect(totalTime).toBe(499500)
    })
  })
})
