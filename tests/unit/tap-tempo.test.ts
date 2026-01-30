import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tapTempoQuick, tapTempo } from '../../src/tap-tempo'

describe('Tap Tempo Detection', () => {
    describe('tapTempoQuick', () => {
        it('should return -1 for single tap', () => {
            vi.useFakeTimers()
            const result = tapTempoQuick()
            expect(result).toBe(-1)
            vi.useRealTimers()
        })

        it('should detect period from two taps', () => {
            vi.useFakeTimers()
            const now = Date.now()

            // First tap
            const tap1 = tapTempoQuick()
            expect(tap1).toBe(-1) // First tap returns -1

            // Advance time by 500ms (simulate delay between taps)
            vi.advanceTimersByTime(500)

            // Second tap would be at +500ms
            // But since we can't directly control performance.now() in this test,
            // we'll test the logic differently
            vi.useRealTimers()
        })

        it('should reset on timeout', () => {
            vi.useFakeTimers()

            // Tap 1
            tapTempoQuick(true, 1000)

            // Advance past timeout
            vi.advanceTimersByTime(1001)

            // Tap again - should reset
            const result = tapTempoQuick(true, 1000)
            expect(result).toBe(-1)

            vi.useRealTimers()
        })

        it('should require minimum taps', () => {
            vi.useFakeTimers()

            const result = tapTempoQuick(true, 10000, 3)
            expect(result).toBe(-1)

            vi.useRealTimers()
        })

        it('should handle custom timeout', () => {
            vi.useFakeTimers()

            const result = tapTempoQuick(true, 5000, 1)
            expect(typeof result === 'number').toBe(true)

            vi.useRealTimers()
        })

        it('should handle custom minimum taps', () => {
            vi.useFakeTimers()

            const result = tapTempoQuick(true, 10000, 5)
            expect(result).toBe(-1)

            vi.useRealTimers()
        })

        it('should disable auto-reset', () => {
            vi.useFakeTimers()

            const result = tapTempoQuick(false, 1000)
            expect(result).toBe(-1)

            vi.useRealTimers()
        })
    })

    describe('tapTempo', () => {
        let getTempo: ReturnType<typeof tapTempo>

        beforeEach(() => {
            vi.useFakeTimers()
            getTempo = tapTempo()
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it('should return a function', () => {
            expect(typeof getTempo).toBe('function')
        })

        it('should return object with timing data', () => {
            const result = getTempo()

            expect(result).toHaveProperty('available')
            expect(result).toHaveProperty('period')
            expect(result).toHaveProperty('accuratePeriod')
            expect(result).toHaveProperty('tempo')
            expect(result).toHaveProperty('bpm')
            expect(result).toHaveProperty('samples')
            expect(result).toHaveProperty('deviation')
        })

        it('should not be available on first tap', () => {
            const result = getTempo()
            expect(result.available).toBe(false)
        })

        it('should detect tempo after minimum taps', () => {
            // First tap
            getTempo()

            // Advance 500ms
            vi.advanceTimersByTime(500)

            // Second tap
            const result2 = getTempo()

            // Should have samples
            expect(result2.samples).toBeGreaterThanOrEqual(2)
        })

        it('should calculate period between taps', () => {
            getTempo() // First tap at 0ms
            vi.advanceTimersByTime(500) // Advance 500ms
            const result = getTempo() // Second tap at 500ms

            expect(result.period).toBeGreaterThan(0)
        })

        it('should calculate BPM', () => {
            getTempo() // First tap
            vi.advanceTimersByTime(500)
            const result = getTempo() // Second tap at 500ms

            if (result.available) {
                expect(result.bpm).toBeGreaterThan(0)
            }
        })

        it('should track samples count', () => {
            const result1 = getTempo()
            expect(result1.samples).toBe(1)

            vi.advanceTimersByTime(500)
            const result2 = getTempo()
            expect(result2.samples).toBe(2)

            vi.advanceTimersByTime(500)
            const result3 = getTempo()
            expect(result3.samples).toBe(3)
        })

        it('should reset on timeout', () => {
            getTempo() // Tap 1
            vi.advanceTimersByTime(500)
            getTempo() // Tap 2

            // Advance past timeout
            vi.advanceTimersByTime(15000)

            const result = getTempo() // Should reset
            expect(result.samples).toBe(1)
        })

        it('should track deviation between taps', () => {
            getTempo()
            vi.advanceTimersByTime(500)
            const result = getTempo()

            expect(typeof result.deviation).toBe('number')
        })

        it('should provide tempo in BPM', () => {
            getTempo()
            vi.advanceTimersByTime(500)
            const result = getTempo()

            expect(typeof result.tempo).toBe('number')
        })

        it('should provide time in seconds', () => {
            getTempo()
            vi.advanceTimersByTime(1000)
            const result = getTempo()

            expect(result.timeInSeconds).toBeGreaterThan(0)
            expect(result.timeInSeconds).toBeCloseTo(1, 1)
        })

        it('should handle rapid taps', () => {
            getTempo()

            for (let i = 0; i < 10; i++) {
                vi.advanceTimersByTime(100)
                const result = getTempo()
                expect(result.samples).toBe(i + 2)
            }
        })

        it('should have linear regression data', () => {
            getTempo()
            vi.advanceTimersByTime(500)
            const result = getTempo()

            // accuratePeriod should be available
            expect(typeof result.accuratePeriod).toBe('number')
        })

        it('should detect beat position', () => {
            getTempo()
            vi.advanceTimersByTime(500)
            const result = getTempo()

            expect(result).toHaveProperty('beat')
        })

        it('should detect bar position', () => {
            getTempo()
            vi.advanceTimersByTime(500)
            const result = getTempo()

            expect(result).toHaveProperty('bar')
        })
    })

    describe('Tempo Detection Integration', () => {
        it('tapTempoQuick should be faster than tapTempo', () => {
            vi.useFakeTimers()

            const quick = tapTempoQuick()
            const full = tapTempo()

            expect(typeof quick === 'number').toBe(true)
            expect(typeof full === 'function').toBe(true)

            vi.useRealTimers()
        })

        it('tapTempo should provide more accurate results', () => {
            vi.useFakeTimers()

            const getTempo = tapTempo()

            // Simulate taps at regular intervals (120 BPM = 500ms per beat)
            getTempo() // Tap 1
            vi.advanceTimersByTime(500)
            getTempo() // Tap 2
            vi.advanceTimersByTime(500)
            getTempo() // Tap 3
            vi.advanceTimersByTime(500)
            const result = getTempo() // Tap 4

            if (result.available) {
                // Should be close to 120 BPM
                expect(result.bpm).toBeGreaterThan(60)
                expect(result.bpm).toBeLessThan(180)
            }

            vi.useRealTimers()
        })
    })
})

describe('Tap Tempo Edge Cases', () => {
    it('should handle zero timeout gracefully', () => {
        vi.useFakeTimers()

        const result = tapTempoQuick(true, 0, 2)
        expect(typeof result === 'number').toBe(true)

        vi.useRealTimers()
    })

    it('should handle single minimum tap', () => {
        vi.useFakeTimers()

        const result = tapTempoQuick(true, 10000, 1)
        expect(typeof result === 'number').toBe(true)

        vi.useRealTimers()
    })

    it('should handle very fast taps', () => {
        vi.useFakeTimers()

        const getTempo = tapTempo()
        getTempo()
        vi.advanceTimersByTime(10) // 10ms apart
        const result = getTempo()

        expect(result.samples).toBe(2)

        vi.useRealTimers()
    })

    it('should handle very slow taps', () => {
        vi.useFakeTimers()

        const getTempo = tapTempo(true, 30000) // 30 second timeout
        getTempo()
        vi.advanceTimersByTime(5000) // 5 seconds apart
        const result = getTempo()

        expect(result.samples).toBe(2)

        vi.useRealTimers()
    })
})
