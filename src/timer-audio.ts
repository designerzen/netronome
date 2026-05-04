import Timer from "./timer"

import { TIMER_TYPE_AUDIO_CONTEXT, TIMER_TYPE_AUDIO_WORKLET, TIMER_TYPE_ELASTIC_AUDIO_WORKLET, isWorkletTimerType, type TimerType } from './timer-types'
import type { AudioTimerOptions } from './timer-interfaces'

const DEFAULT_AUDIO_TIMER_OPTIONS: AudioTimerOptions = {

	// keep this at 24 to match MIDI1.0 spec
	// where there are 24 ticks per quarternote
	divisions: 24
}

export default class AudioTimer extends Timer {
	
	audioContext?: AudioContext
	
	// NB. do *NOT* enable the following line as it will overwrite the var on super()
	// audioContext

	/**
	 * Accurate time in milliseconds
	 * @returns {Number} The current time as of now
	 */
	get now(): number { 
		return this.audioContext ? this.audioContext.currentTime : performance.now() 
	}

	get clockUnitsToSecondsScale(): number {
		return 1
	}
	
	/**
	 * Create an AudioTimer with an AudioContext
	 * Uses AudioWorklet timing if available, falls back to AudioContext worker
	 * @param audioContext The AudioContext to use for accurate timing
	 * @param timerType If true, attempts to use AudioWorklet (recommended). If false, uses AudioContext worker.
	 */
	constructor(audioContext: AudioContext, timerType: TimerType | boolean = true){
		const resolvedTimerType = typeof timerType === 'boolean'
			? (timerType ? TIMER_TYPE_AUDIO_WORKLET : TIMER_TYPE_AUDIO_CONTEXT)
			: timerType
		const timerOptions: AudioTimerOptions = {
			audioContext,
			...DEFAULT_AUDIO_TIMER_OPTIONS,
			// Use the string type constant - Timer base class handles async initialization
			type: resolvedTimerType
		}

		super( timerOptions, isWorkletTimerType(resolvedTimerType) || resolvedTimerType === TIMER_TYPE_ELASTIC_AUDIO_WORKLET )
		if (!this.audioContext)
		{
			throw Error('No AudioContext specified')
		}
	}

	/**
	 * 
	 * @param {Function} callback 
	 * @param {*} options 
	 */
	async startTimer( callback?: ((event: any) => void), options: Record<string, unknown> = {} ){
		
		// on Safari macOS/iOS, the audioContext is suspended if it's not created
		// in the event handler of a user action: we attempt to resume it.
		if (this.audioContext && this.audioContext.state === 'suspended') 
		{
			await this.audioContext.resume()
		}
		return await super.startTimer(callback, options)
	}
}
