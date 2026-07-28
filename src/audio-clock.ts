export interface AudioClockTimestamp {
	contextTime: number
	performanceTime: number
}

export type MonotonicNow = () => number

/**
 * Keeps Web Audio's seconds-based rendering timeline separate from the
 * browser's milliseconds-based monotonic timeline, and provides the only
 * supported conversion boundary between them.
 */
export default class AudioClock {
	readonly audioContext: AudioContext
	readonly monotonicNow: MonotonicNow

	constructor(
		audioContext: AudioContext,
		monotonicNow: MonotonicNow = () => performance.now()
	) {
		this.audioContext = audioContext
		this.monotonicNow = monotonicNow
	}

	get audioTimeSeconds(): number {
		return this.audioContext.currentTime
	}

	get performanceTimeMs(): number {
		return this.monotonicNow()
	}

	/**
	 * Return a pair of timestamps describing the same output position.
	 *
	 * getOutputTimestamp() is preferred because it maps the AudioContext
	 * rendering timeline to the monotonic clock. Before the context has
	 * rendered, browsers return a zero pair, so use a control-thread snapshot
	 * as a documented lower-accuracy fallback.
	 */
	getTimestampPair(): AudioClockTimestamp {
		const timestamp = this.audioContext.getOutputTimestamp?.()
		const contextTime = timestamp?.contextTime
		const performanceTime = timestamp?.performanceTime

		if (
			typeof contextTime === 'number'
			&& typeof performanceTime === 'number'
			&& Number.isFinite(contextTime)
			&& Number.isFinite(performanceTime)
			&& (contextTime !== 0 || performanceTime !== 0)
		) {
			return {
				contextTime,
				performanceTime,
			}
		}

		return {
			contextTime: this.audioTimeSeconds,
			performanceTime: this.performanceTimeMs,
		}
	}

	performanceToAudioTimeSeconds(performanceTimeMs: number): number {
		const timestamp = this.getTimestampPair()
		return timestamp.contextTime
			+ (performanceTimeMs - timestamp.performanceTime) / 1000
	}

	audioToPerformanceTimeMs(audioTimeSeconds: number): number {
		const timestamp = this.getTimestampPair()
		return timestamp.performanceTime
			+ (audioTimeSeconds - timestamp.contextTime) * 1000
	}
}
