import { describe, it, expect, beforeEach } from 'vitest'
import {
  convertBPMToPeriod,
  convertPeriodToBPM,
  convertMIDIClockIntervalToBPM,
  secondsToTicks,
  formatTimeStampFromSeconds,
  Ticks,
  SECONDS_PER_MINUTE,
  MICROSECONDS_PER_MINUTE,
} from '../../src/time-utils'

describe('Time Calculations & Conversions', () => {
  describe('BPM to Period Conversions', () => {
    it('should convert standard BPM values to periods', () => {
      expect(convertBPMToPeriod(60)).toBe(MICROSECONDS_PER_MINUTE / 60)
      expect(convertBPMToPeriod(120)).toBe(MICROSECONDS_PER_MINUTE / 120)
      expect(convertBPMToPeriod(140)).toBeCloseTo(MICROSECONDS_PER_MINUTE / 140)
    })

    it('should convert 120 BPM to 500ms period', () => {
      const period = convertBPMToPeriod(120)
      expect(period).toBe(500)
    })

    it('should convert 60 BPM to 1000ms period', () => {
      const period = convertBPMToPeriod(60)
      expect(period).toBe(1000)
    })

    it('should handle decimal BPM values', () => {
      const period = convertBPMToPeriod(120.5)
      expect(period).toBeCloseTo(MICROSECONDS_PER_MINUTE / 120.5)
    })

    it('should handle string BPM input', () => {
      const period = convertBPMToPeriod('120' as any)
      expect(period).toBe(500)
    })
  })

  describe('Period to BPM Conversions', () => {
    it('should convert periods back to BPM', () => {
      expect(convertPeriodToBPM(500)).toBe(120)
      expect(convertPeriodToBPM(1000)).toBe(60)
    })

    it('should be inverse of BPM to Period', () => {
      const bpm = 95
      const period = convertBPMToPeriod(bpm)
      const recoveredBpm = convertPeriodToBPM(period)
      expect(recoveredBpm).toBeCloseTo(bpm, 5)
    })

    it('should handle various period values', () => {
      const testCases = [250, 333.33, 500, 666.67, 1000, 1500, 2000]
      for (const period of testCases) {
        const bpm = convertPeriodToBPM(period)
        const recoveredPeriod = convertBPMToPeriod(bpm)
        expect(recoveredPeriod).toBeCloseTo(period, 2)
      }
    })
  })

  describe('MIDI Clock Interval to BPM', () => {
    it('should convert MIDI clock intervals to BPM', () => {
      // MIDI sends 24 pulses per quarter note
      // At 120 BPM, quarter note = 500ms
      // So each clock event = 500ms / 24 = ~20.83ms
      const clockInterval = 500 / 24
      const bpm = convertMIDIClockIntervalToBPM(clockInterval)
      expect(bpm).toBeCloseTo(120, 1)
    })

    it('should use 24 PPQN as default', () => {
      const clockInterval = 20.833333
      const bpm = convertMIDIClockIntervalToBPM(clockInterval)
      expect(bpm).toBeCloseTo(120, 0)
    })

    it('should support custom PPQN values', () => {
      // 96 PPQN (common in MIDI 2.0)
      const clockInterval = 500 / 96
      const bpm = convertMIDIClockIntervalToBPM(clockInterval, 96)
      expect(bpm).toBeCloseTo(120, 0)
    })

    it('should handle fast tempos', () => {
      // 200 BPM, quarter note = 300ms
      // Clock interval = 300 / 24 = 12.5ms
      const bpm = convertMIDIClockIntervalToBPM(12.5)
      expect(bpm).toBeCloseTo(200, 1)
    })

    it('should handle slow tempos', () => {
      // 40 BPM, quarter note = 1500ms
      // Clock interval = 1500 / 24 = 62.5ms
      const bpm = convertMIDIClockIntervalToBPM(62.5)
      expect(bpm).toBeCloseTo(40, 1)
    })
  })

  describe('Seconds to Ticks Conversion', () => {
    it('should convert seconds to ticks at given BPM', () => {
      // At 60 BPM, quarter note = 1 second
      // With 3840 ticks per quarter note
      const ticks = secondsToTicks(1, 60)
      expect(ticks).toBe(Ticks.Beat)
    })

    it('should handle 120 BPM timing', () => {
      // At 120 BPM, quarter note = 0.5 seconds
      const ticks = secondsToTicks(0.5, 120)
      expect(ticks).toBeCloseTo(Ticks.Beat, 0)
    })

    it('should scale with tempo changes', () => {
      const ticks60 = secondsToTicks(1, 60)
      const ticks120 = secondsToTicks(1, 120)
      expect(ticks120).toBeCloseTo(ticks60 * 2, 0)
    })

    it('should support custom resolutions', () => {
      // Test with 960 ticks per quarter note (lower resolution)
      const ticks = secondsToTicks(1, 60, 960)
      expect(ticks).toBe(960)
    })

    it('should calculate fractional seconds', () => {
      const ticks = secondsToTicks(0.25, 60, Ticks.Beat)
      expect(ticks).toBeCloseTo(Ticks.Beat / 4, 0)
    })

    it('should calculate full bars', () => {
      // 4 quarter notes per bar
      const ticks = secondsToTicks(4, 60, Ticks.Beat)
      expect(ticks).toBeCloseTo(Ticks.Beat * 4, 0)
    })
  })

  describe('Time Formatting', () => {
    it('should format seconds as HH:MM:SS:MS', () => {
      expect(formatTimeStampFromSeconds(0)).toBe('00:00:00:00')
      expect(formatTimeStampFromSeconds(1)).toBe('00:00:01:00')
      expect(formatTimeStampFromSeconds(60)).toBe('00:01:00:00')
      expect(formatTimeStampFromSeconds(3600)).toBe('01:00:00:00')
    })

    it('should handle millisecond precision', () => {
      expect(formatTimeStampFromSeconds(1.5)).toBe('00:00:01:50')
      expect(formatTimeStampFromSeconds(1.25)).toBe('00:00:01:25')
      expect(formatTimeStampFromSeconds(1.05)).toBe('00:00:01:05')
    })

    it('should format complex times', () => {
      const time = 1 * 3600 + 23 * 60 + 45.67 // 1:23:45:67
      const formatted = formatTimeStampFromSeconds(time)
      expect(formatted).toMatch(/^01:23:45:\d{2}$/)
    })

    it('should pad all fields correctly', () => {
      expect(formatTimeStampFromSeconds(3661.01)).toBe('01:01:01:01')
      expect(formatTimeStampFromSeconds(0.01)).toBe('00:00:00:01')
    })

    it('should cache formatted results', () => {
      const time = 12345.6789
      const format1 = formatTimeStampFromSeconds(time)
      const format2 = formatTimeStampFromSeconds(time)
      expect(format1).toBe(format2)
    })

    it('should handle large times', () => {
      const largeTime = 10 * 3600 + 59 * 60 + 59.99
      const formatted = formatTimeStampFromSeconds(largeTime)
      expect(formatted).toMatch(/^10:59:59:\d{2}$/)
    })
  })

  describe('Tick Constants', () => {
    it('should have correct tick values', () => {
      expect(Ticks.SemiBreve).toBe(15360)
      expect(Ticks.Beat).toBe(3840)
      expect(Ticks.SemiQuaver).toBe(960)
    })

    it('should have correct relationships', () => {
      expect(Ticks.SemiBreve).toBe(Ticks.Beat * 4)
      expect(Ticks.Beat).toBe(Ticks.SemiQuaver * 4)
    })

    it('should represent musical note values correctly', () => {
      // SemiBreve = whole note
      // Beat = quarter note
      // SemiQuaver = 16th note
      expect(Ticks.SemiBreve / Ticks.Beat).toBe(4) // 4 quarter notes per whole note
      expect(Ticks.Beat / Ticks.SemiQuaver).toBe(4) // 4 16ths per quarter note
    })
  })

  describe('Time Constants', () => {
    it('should have correct second values', () => {
      expect(SECONDS_PER_MINUTE).toBe(60)
      expect(MICROSECONDS_PER_MINUTE).toBe(60000)
    })

    it('should use correct microseconds conversion', () => {
      // microseconds = milliseconds (period)
      expect(MICROSECONDS_PER_MINUTE / 60).toBe(1000)
      expect(MICROSECONDS_PER_MINUTE / 120).toBe(500)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very fast tempos', () => {
      const period = convertBPMToPeriod(300)
      const bpm = convertPeriodToBPM(period)
      expect(bpm).toBeCloseTo(300, 5)
    })

    it('should handle very slow tempos', () => {
      const period = convertBPMToPeriod(20)
      const bpm = convertPeriodToBPM(period)
      expect(bpm).toBeCloseTo(20, 5)
    })

    it('should handle fractional BPM values', () => {
      const bpm = 127.5
      const period = convertBPMToPeriod(bpm)
      const recovered = convertPeriodToBPM(period)
      expect(recovered).toBeCloseTo(bpm, 5)
    })

    it('should handle very small time values', () => {
      const ticks = secondsToTicks(0.001, 120)
      expect(ticks).toBeGreaterThan(0)
      expect(ticks).toBeLessThan(Ticks.Beat)
    })

    it('should handle very large time values', () => {
      const ticks = secondsToTicks(3600, 120) // 1 hour
      expect(ticks).toBeGreaterThan(Ticks.Beat * 1000)
    })
  })
})
