import Timer from "./timer"

import { 
	AudioContextWorkerWrapper,
	createTimingWorklet
} from './timer-worker-types'

interface AudioTimerOptions {
	divisions: number
	type?: string | any
	processor?: string
	audioContext?: AudioContext
}

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
	
	constructor(audioContext: AudioContext, isWorklet: boolean = true){
		const timerOptions: AudioTimerOptions = {
			audioContext,
			...DEFAULT_AUDIO_TIMER_OPTIONS
		}

		if (!isWorklet)
		{
			timerOptions.type = AudioContextWorkerWrapper
		}else{
			timerOptions.type = createTimingWorklet( audioContext )
		}

		super( timerOptions, isWorklet )
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
