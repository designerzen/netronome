import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Timer, {
    convertBPMToPeriod,
    convertPeriodToBPM,
    convertMIDIClockIntervalToBPM,
    secondsToTicks,
    formatTimeStampFromSeconds,
    isFileWorklet,
    SECONDS_PER_MINUTE,
    MICROSECONDS_PER_MINUTE,
    MAX_BARS_ALLOWED
} from '../../src/timer'
import { Ticks } from '../../src/ticks'

describe('Timer Utility Functions', () => {
    describe('convertBPMToPeriod', () => {
        it('should convert BPM to period correctly', () => {
            expect(convertBPMToPeriod(120)).toBe(MICROSECONDS_PER_MINUTE / 120)
        })

        it('should handle common tempos', () => {
            expect(convertBPMToPeriod(60)).toBe(MICROSECONDS_PER_MINUTE / 60)
            expect(convertBPMToPeriod(90)).toBe(MICROSECONDS_PER_MINUTE / 90)
            expect(convertBPMToPeriod(140)).toBe(MICROSECONDS_PER_MINUTE / 140)
        })

        it('should work with decimal BPM', () => {
            const result = convertBPMToPeriod(120.5)
            expect(result).toBeCloseTo(MICROSECONDS_PER_MINUTE / 120.5)
        })

        it('should handle high tempos', () => {
            expect(convertBPMToPeriod(240)).toBe(MICROSECONDS_PER_MINUTE / 240)
        })

        it('should handle low tempos', () => {
            expect(convertBPMToPeriod(30)).toBe(MICROSECONDS_PER_MINUTE / 30)
        })
    })

    describe('convertPeriodToBPM', () => {
        it('should convert period to BPM correctly', () => {
            const period = 500
            expect(convertPeriodToBPM(period)).toBe(MICROSECONDS_PER_MINUTE / period)
        })

        it('should be inverse of convertBPMToPeriod', () => {
            const originalBPM = 120
            const period = convertBPMToPeriod(originalBPM)
            const calculatedBPM = convertPeriodToBPM(period)
            expect(calculatedBPM).toBeCloseTo(originalBPM)
        })

        it('should handle various periods', () => {
            expect(convertPeriodToBPM(250)).toBeCloseTo(MICROSECONDS_PER_MINUTE / 250)
            expect(convertPeriodToBPM(333)).toBeCloseTo(MICROSECONDS_PER_MINUTE / 333)
            expect(convertPeriodToBPM(1000)).toBeCloseTo(MICROSECONDS_PER_MINUTE / 1000)
        })
    })

    describe('convertMIDIClockIntervalToBPM', () => {
        it('should convert MIDI clock interval to BPM', () => {
            // 24 PPQN, so if one clock event is 10ms, quarter note is 240ms
            const millisecondsPerClockEvent = 10
            const expectedQuarterNoteDuration = millisecondsPerClockEvent * 24
            const expectedBPM = convertPeriodToBPM(expectedQuarterNoteDuration)

            const result = convertMIDIClockIntervalToBPM(millisecondsPerClockEvent)
            expect(result).toBeCloseTo(expectedBPM)
        })

        it('should handle custom PPQN', () => {
            const result = convertMIDIClockIntervalToBPM(5, 12)
            const expected = convertPeriodToBPM(5 * 12)
            expect(result).toBeCloseTo(expected)
        })

        it('should work with standard MIDI timing (24 PPQN)', () => {
            // At 120 BPM, quarter note = 500ms
            // So each MIDI clock = 500/24 ≈ 20.833ms
            const periodsPerQuarterNote = 500
            const millisecondsPerClock = periodsPerQuarterNote / 24
            const result = convertMIDIClockIntervalToBPM(millisecondsPerClock)
            expect(result).toBeCloseTo(120)
        })
    })

    describe('secondsToTicks', () => {
        it('should convert seconds to ticks at given BPM', () => {
            const seconds = 1
            const bpm = 120
            const ticks = secondsToTicks(seconds, bpm)

            // At 120 BPM, quarter note is 500ms
            // So 1 second should be 2 quarter notes = 2 * Ticks.Beat
            expect(ticks).toBeCloseTo(2 * Ticks.Beat)
        })

        it('should use custom resolution', () => {
            const seconds = 1
            const bpm = 120
            const customResolution = 1920
            const ticks = secondsToTicks(seconds, bpm, customResolution)

            expect(ticks).toBeCloseTo(customResolution)
        })

        it('should handle default resolution (3840)', () => {
            const result = secondsToTicks(1, 120)
            const expected = secondsToTicks(1, 120, Ticks.Beat)
            expect(result).toBe(expected)
        })

        it('should scale with tempo', () => {
            const ticks60BPM = secondsToTicks(1, 60)
            const ticks120BPM = secondsToTicks(1, 120)

            // 120 BPM is 2x faster than 60 BPM
            expect(ticks120BPM).toBeCloseTo(ticks60BPM * 2)
        })

        it('should scale with time', () => {
            const ticks1s = secondsToTicks(1, 120)
            const ticks2s = secondsToTicks(2, 120)

            expect(ticks2s).toBeCloseTo(ticks1s * 2)
        })
    })

    describe('formatTimeStampFromSeconds', () => {
        it('should format zero seconds', () => {
            expect(formatTimeStampFromSeconds(0)).toBe('00:00:00:00')
        })

        it('should format seconds only', () => {
            expect(formatTimeStampFromSeconds(5)).toBe('00:00:05:00')
        })

        it('should format minutes and seconds', () => {
            expect(formatTimeStampFromSeconds(65)).toBe('00:01:05:00')
        })

        it('should format hours, minutes, seconds', () => {
            expect(formatTimeStampFromSeconds(3665)).toBe('01:01:05:00')
        })

        it('should include milliseconds', () => {
            expect(formatTimeStampFromSeconds(1.5)).toBe('00:00:01:50')
            expect(formatTimeStampFromSeconds(0.25)).toBe('00:00:00:25')
        })

        it('should pad with leading zeros', () => {
            expect(formatTimeStampFromSeconds(61.1)).toBe('00:01:01:10')
        })

        it('should handle large times', () => {
            // 10 hours, 15 minutes, 30 seconds, 50 milliseconds
            const time = 10 * 3600 + 15 * 60 + 30 + 0.5
            expect(formatTimeStampFromSeconds(time)).toBe('10:15:30:50')
        })
    })

    describe('isFileWorklet', () => {
        it('should identify worklet files by extension', () => {
            expect(isFileWorklet('timing.audioworklet.js')).toBe(true)
            expect(isFileWorklet('./src/timing.audioworklet.ts')).toBe(true)
        })

        it('should identify base64 encoded data', () => {
            expect(isFileWorklet('data:text/javascript;base64,Y29uc3QgdGVzdA==')).toBe(true)
        })

        it('should reject regular worker files', () => {
            expect(isFileWorklet('timing.rolling.worker.js')).toBe(false)
            expect(isFileWorklet('./src/timing.rolling.worker.ts')).toBe(false)
        })

        it('should be case insensitive', () => {
            expect(isFileWorklet('TIMING.AUDIOWORKLET.JS')).toBe(true)
        })
    })

    describe('Constants', () => {
        it('should have SECONDS_PER_MINUTE = 60', () => {
            expect(SECONDS_PER_MINUTE).toBe(60)
        })

        it('should have MICROSECONDS_PER_MINUTE = 60000', () => {
            expect(MICROSECONDS_PER_MINUTE).toBe(60000)
        })

        it('should have MAX_BARS_ALLOWED = 32', () => {
            expect(MAX_BARS_ALLOWED).toBe(32)
        })
    })
})

describe('Timer Class', () => {
    let timer: Timer

    beforeEach(() => {
        timer = new Timer()
    })

    describe('Initialization', () => {
        it('should be instantiable with defaults', () => {
            expect(timer).toBeDefined()
            expect(timer).toBeInstanceOf(Timer)
        })

        it('should have default values', () => {
            expect(timer.bars).toBe(16)
            expect(timer.divisions).toBe(24)
            expect(timer.period).toBe(100)
            expect(timer.available).toBe(false)
            expect(timer.running).toBe(false)
        })

        it('should have default timing values', () => {
            expect(timer.isRunning).toBe(false)
            expect(timer.isCompatible).toBe(false)
            expect(timer.isBypassed).toBe(false)
            expect(timer.isActive).toBe(false)
        })

        it('should initialize counters to zero', () => {
            expect(timer.currentBar).toBe(0)
            expect(timer.divisionsElapsed).toBe(0)
            expect(timer.totalBarsElapsed).toBe(0)
        })
    })

    describe('Getters - Time Calculations', () => {
        it('should calculate timePerBar', () => {
            timer.period = 250
            expect(timer.timePerBar).toBe(250 * 24)
        })

        it('should calculate BPM from period', () => {
            timer.period = 250
            const expectedBPM = MICROSECONDS_PER_MINUTE / (250 * 24)
            expect(timer.BPM).toBeCloseTo(expectedBPM)
        })

        it('should have quarterNoteDuration in microseconds', () => {
            timer.period = 250
            expect(timer.quarterNoteDuration).toBeCloseTo(MICROSECONDS_PER_MINUTE / timer.BPM)
        })

        it('should have quarterNoteDurationInSeconds', () => {
            timer.period = 250
            expect(timer.quarterNoteDurationInSeconds).toBeCloseTo(SECONDS_PER_MINUTE / timer.BPM)
        })

        it('should calculate microTempo', () => {
            timer.period = 250
            expect(timer.microTempo).toBeCloseTo(timer.timePerBar * 0.001)
        })

        it('should calculate microsPerMIDIClock', () => {
            timer.period = 250
            expect(timer.microsPerMIDIClock).toBeCloseTo(timer.microTempo / timer.divisions)
        })

        it('should calculate ticksPerSecond', () => {
            timer.period = 250
            expect(timer.ticksPerSecond).toBeCloseTo(Ticks.Beat / timer.quarterNoteDurationInSeconds)
        })
    })

    describe('Getters - Progress Tracking', () => {
        it('should track current bar', () => {
            timer.currentBar = 5
            expect(timer.bar).toBe(5)
        })

        it('should calculate barProgress 0->1', () => {
            timer.currentBar = 0
            timer.bars = 16
            expect(timer.barProgress).toBe(0)

            timer.currentBar = 8
            expect(timer.barProgress).toBe(0.5)

            timer.currentBar = 15
            expect(timer.barProgress).toBeCloseTo(0.9375)
        })

        it('should calculate beatProgress 0->1', () => {
            timer.divisionsElapsed = 0
            timer.divisions = 24
            expect(timer.beatProgress).toBe(0)

            timer.divisionsElapsed = 12
            expect(timer.beatProgress).toBe(0.5)

            timer.divisionsElapsed = 23
            expect(timer.beatProgress).toBeCloseTo(0.958333)
        })

        it('should calculate barsElapsed', () => {
            timer.totalBarsElapsed = 35
            timer.bars = 16
            expect(timer.barsElapsed).toBe(2)
        })
    })

    describe('Getters - State Detection', () => {
        it('should detect start of bar', () => {
            timer.currentBar = 0
            timer.divisionsElapsed = 0
            expect(timer.isAtStartOfBar).toBe(true)

            timer.divisionsElapsed = 1
            expect(timer.isAtStartOfBar).toBe(false)
        })

        it('should detect start bar (bar 0)', () => {
            timer.currentBar = 0
            expect(timer.isStartBar).toBe(true)

            timer.currentBar = 1
            expect(timer.isStartBar).toBe(false)
        })

        it('should detect at start (division 0)', () => {
            timer.divisionsElapsed = 0
            expect(timer.isAtStart).toBe(true)

            timer.divisionsElapsed = 5
            expect(timer.isAtStart).toBe(false)
        })

        it('should detect middle of bar', () => {
            timer.currentBar = 8
            timer.bars = 16
            expect(timer.isAtMiddleOfBar).toBe(true)

            timer.currentBar = 0
            expect(timer.isAtMiddleOfBar).toBe(false)
        })

        it('should detect quarter notes', () => {
            timer.divisionsElapsed = 0
            timer.divisions = 24
            expect(timer.isQuarterNote).toBe(true)

            timer.divisionsElapsed = 6
            expect(timer.isQuarterNote).toBe(true)

            timer.divisionsElapsed = 1
            expect(timer.isQuarterNote).toBe(false)
        })

        it('should detect half notes', () => {
            timer.divisionsElapsed = 0
            timer.divisions = 24
            expect(timer.isHalfNote).toBe(true)

            timer.divisionsElapsed = 12
            expect(timer.isHalfNote).toBe(true)

            timer.divisionsElapsed = 1
            expect(timer.isHalfNote).toBe(false)
        })

        it('should detect swung beats', () => {
            timer.swingOffset = 6 // Every 6 divisions
            timer.divisionsElapsed = 0
            expect(timer.isSwungBeat).toBe(true)

            timer.divisionsElapsed = 6
            expect(timer.isSwungBeat).toBe(true)

            timer.divisionsElapsed = 1
            expect(timer.isSwungBeat).toBe(false)
        })

        it('should detect external trigger mode', () => {
            expect(timer.isUsingExternalTrigger).toBe(false)

            timer.isBypassed = true
            expect(timer.isUsingExternalTrigger).toBe(true)
        })
    })

    describe('Setters', () => {
        it('should set bar', () => {
            timer.bar = 5
            expect(timer.currentBar).toBe(5)
        })

        it('should set BPM', () => {
            timer.BPM = 120
            expect(timer.BPM).toBeCloseTo(120)
        })

        it('should set bpm (alias)', () => {
            timer.bpm = 90
            expect(timer.bpm).toBeCloseTo(90)
        })

        it('should set tempo (alias)', () => {
            timer.tempo = 140
            expect(timer.BPM).toBeCloseTo(140)
        })

        it('should prevent BPM below 10', () => {
            timer.BPM = 5
            expect(timer.BPM).toBeGreaterThanOrEqual(10)
        })

        it('should set timeBetween', () => {
            timer.timeBetween = 250
            expect(timer.period).toBeLessThanOrEqual(250)
        })

        it('should set swing', () => {
            timer.swing = 0.25
            expect(timer.swingOffset).toBeCloseTo(0.25 * timer.divisions)
        })

        it('should set bars', () => {
            const result = timer.setBars(10)
            expect(result).toBe(10)
        })

        it('should prevent bars from being too high', () => {
            const result = timer.setBars(50)
            expect(result).toBe(MAX_BARS_ALLOWED)
        })

        it('should prevent bars from being too low', () => {
            const result = timer.setBars(0)
            expect(result).toBe(1)
        })
    })

    describe('Control Methods', () => {
        it('should reset timer', () => {
            timer.currentBar = 5
            timer.totalBarsElapsed = 10
            timer.divisionsElapsed = 12

            timer.resetTimer()

            expect(timer.currentBar).toBe(0)
            expect(timer.totalBarsElapsed).toBe(0)
            expect(timer.divisionsElapsed).toBe(0)
        })

        it('should set callback', () => {
            const callback = vi.fn()
            timer.setCallback(callback)
            expect(timer.callback).toBe(callback)
        })

        it('should convert time to ticks', () => {
            timer.period = 250 // Quarter note = 250ms
            const ticks = timer.convertToTicks(0.25) // 250ms
            expect(ticks).toBeCloseTo(Ticks.Beat)
        })
    })

    describe('Bypass Mode (External Clock)', () => {
        it('should support bypass mode', () => {
            expect(timer.isBypassed).toBe(false)

            const trigger = timer.bypass(true)
            expect(timer.isBypassed).toBe(true)
            expect(trigger).toBeDefined()
        })

        it('should toggle bypass mode', () => {
            timer.bypass(true)
            expect(timer.isBypassed).toBe(true)

            timer.bypass(false)
            expect(timer.isBypassed).toBe(false)
        })
    })

    describe('External Trigger', () => {
        it('should handle external trigger', () => {
            timer.isRunning = true
            timer.isBypassed = true

            const startDivisionsElapsed = timer.divisionsElapsed
            timer.externalTrigger(true)

            expect(timer.divisionsElapsed).toBe(startDivisionsElapsed + 1)
        })

        it('should support retrigger without advancing', () => {
            timer.isRunning = true
            timer.isBypassed = true

            const divisionsElapsed = timer.divisionsElapsed
            timer.retrigger()

            // Retrigger should not advance
            expect(timer.divisionsElapsed).toBe(divisionsElapsed)
        })
    })

    describe('Tap Tempo', () => {
        it('should support tap tempo method', () => {
            const result = timer.tapTempo()
            // Initial tap returns -1 or a value
            expect(typeof result === 'number').toBe(true)
        })
    })

    describe('on/create Tick', () => {
        it('should create tick event', () => {
            timer.divisionsElapsed = 0
            timer.totalBarsElapsed = 0
            timer.currentBar = 0

            timer.onTick(0.1, 0.1, 0, 0, 0, 0)

            expect(timer.divisionsElapsed).toBe(1)
        })

        it('should increment bars when divisions reach limit', () => {
            timer.divisionsElapsed = 23
            timer.divisions = 24
            timer.currentBar = 5
            timer.bars = 16
            timer.totalBarsElapsed = 5

            timer.onTick(0.1, 0.1, 0, 0, 0, 0)

            expect(timer.divisionsElapsed).toBe(0)
            expect(timer.totalBarsElapsed).toBe(6)
            expect(timer.currentBar).toBe(6)
        })

        it('should call callback on tick', () => {
            const callback = vi.fn()
            timer.setCallback(callback)

            timer.onTick(0.1, 0.1, 0, 0, 1, 0)

            expect(callback).toHaveBeenCalled()
        })

        it('should wrap bar around when at max', () => {
            timer.divisionsElapsed = 23
            timer.divisions = 24
            timer.currentBar = 15
            timer.bars = 16
            timer.totalBarsElapsed = 15

            timer.onTick(0.1, 0.1, 0, 0, 0, 0)

            expect(timer.currentBar).toBe(0) // Wrapped around
            expect(timer.totalBarsElapsed).toBe(16)
        })
    })

    describe('Total values', () => {
        it('should calculate total time', () => {
            timer.period = 250
            timer.bars = 16
            const total = timer.totalTime
            expect(total).toBe(timer.timePerBar * timer.bars)
        })

        it('should return total bars', () => {
            timer.bars = 32
            expect(timer.totalBars).toBe(32)
        })

        it('should return total divisions', () => {
            timer.divisions = 24
            expect(timer.totalDivisions).toBe(24)
        })
    })

    describe('Elapsed time tracking', () => {
        it('should track last recorded time', () => {
            timer.onTick(0.5, 0.5, 0, 0, 1, 0)
            expect(timer.lastRecordedTime).toBe(0.5)
        })

        it('should calculate elapsed since last tick', () => {
            timer.lastRecordedTime = 0.5
            // Note: this depends on getNow() which returns performance time
            const elapsed = timer.elapsedSinceLastTick
            expect(typeof elapsed === 'number').toBe(true)
        })
    })

    describe('Time synchronization', () => {
        it('should provide now() getter', () => {
            const now = timer.now
            expect(typeof now === 'number').toBe(true)
            expect(now).toBeGreaterThan(0)
        })

        it('should calculate timeElapsed', () => {
            timer.startTime = 100
            // timeElapsed should be now - startTime
            const elapsed = timer.timeElapsed
            expect(typeof elapsed === 'number').toBe(true)
        })
    })
})

describe('Timer Configuration', () => {
    it('should accept constructor options', () => {
        const options = {
            bars: 32,
            divisions: 12,
            bpm: 140
        }
        const timer = new Timer(options)

        expect(timer.bars).toBe(32)
        expect(timer.divisions).toBe(12)
    })

    it('should merge with default options', () => {
        const timer = new Timer({ bars: 8 })

        expect(timer.bars).toBe(8)
        expect(timer.divisions).toBe(24) // Default
    })
})

describe('Timer Edge Cases', () => {
    let timer: Timer

    beforeEach(() => {
        timer = new Timer()
    })

    it('should handle zero period edge case', () => {
        timer.period = 0.0001 // Very small
        expect(timer.timePerBar).toBeGreaterThan(0)
    })

    it('should handle very high BPM', () => {
        timer.BPM = 999
        expect(timer.BPM).toBeLessThanOrEqual(999)
    })

    it('should handle alternating bar wrapping', () => {
        timer.currentBar = 15
        timer.bars = 16
        timer.divisionsElapsed = 23
        timer.divisions = 24

        // Simulate multiple ticks
        for (let i = 0; i < 40; i++) {
            timer.onTick(i * 0.01, i * 0.01, 0, 0, i, 0)
        }

        // Should have cycled through bars
        expect(timer.currentBar).toBeLessThan(16)
        expect(timer.currentBar).toBeGreaterThanOrEqual(0)
    })

    it('should maintain consistent timing ratios', () => {
        const period1 = timer.timePerBar
        timer.BPM = 120
        const period2 = timer.timePerBar

        expect(period1).not.toBe(period2)
    })
})
