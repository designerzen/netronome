import { describe, expect, it } from 'vitest'

import AudioClock from '../../src/audio-clock'

const createContext = ({
	currentTime = 10,
	contextTime = 8,
	performanceTime = 5_000,
}: {
	currentTime?: number
	contextTime?: number
	performanceTime?: number
} = {}) => ({
	currentTime,
	getOutputTimestamp: () => ({ contextTime, performanceTime }),
}) as AudioContext

describe('AudioClock', () => {
	it('exposes each clock with explicit units', () => {
		const context = createContext({ currentTime: 12 })
		const clock = new AudioClock(context, () => 6_000)

		expect(clock.audioTimeSeconds).toBe(12)
		expect(clock.performanceTimeMs).toBe(6_000)
	})

	it('maps performance milliseconds to AudioContext seconds', () => {
		const clock = new AudioClock(createContext(), () => 6_000)

		expect(clock.performanceToAudioTimeSeconds(5_250)).toBeCloseTo(8.25, 9)
	})

	it('maps AudioContext seconds to performance milliseconds', () => {
		const clock = new AudioClock(createContext(), () => 6_000)

		expect(clock.audioToPerformanceTimeMs(8.25)).toBeCloseTo(5_250, 9)
	})

	it('uses a control-thread snapshot before output timestamps are available', () => {
		const context = createContext({
			currentTime: 1.5,
			contextTime: 0,
			performanceTime: 0,
		})
		const clock = new AudioClock(context, () => 2_000)

		expect(clock.getTimestampPair()).toEqual({
			contextTime: 1.5,
			performanceTime: 2_000,
		})
		expect(clock.performanceToAudioTimeSeconds(2_250)).toBeCloseTo(1.75, 9)
	})
})
