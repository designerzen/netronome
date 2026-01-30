import Timer from "./timer"

import AUDIOTIMER_WORKLET_URI from './workers/timing.audioworklet.ts?url'
import AUDIOTIMER_PROCESSOR_URI from './workers/timing.audioworklet-processor.ts?url'
// FIXME: 
import AUDIOCONTEXT_WORKER_URI from './workers/timing.audiocontext.worker.ts?url'

interface AudioTimerOptions {
	divisions: number
	type: string
	processor?: string
}

const DEFAULT_AUDIO_TIMER_OPTIONS: AudioTimerOptions = {

	// keep this at 24 to match MIDI1.0 spec
	// where there are 24 ticks per quarternote
	divisions: 24,

	type: AUDIOTIMER_WORKLET_URI,
	processor: AUDIOTIMER_PROCESSOR_URI,
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
	
	constructor(audioContext: AudioContext, worklet: boolean = true){
		const timerOptions: any = {
			audioContext,
			...DEFAULT_AUDIO_TIMER_OPTIONS
		}

		if (!worklet)
		{
			timerOptions.type = AUDIOCONTEXT_WORKER_URI
		}else{
			timerOptions.type = AUDIOTIMER_WORKLET_URI
			timerOptions.processor = AUDIOTIMER_PROCESSOR_URI
		}

		super( timerOptions )
		if (!this.audioContext)
		{
			throw Error('No AudioContext specified')
		}
	}

	/**
	 * 
	 * @param {*} callback 
	 * @param {*} options 
	 */
	startTimer( callback?: Function, options: any = {} ){
		
		// on Safari macOS/iOS, the audioContext is suspended if it's not created
		// in the event handler of a user action: we attempt to resume it.
		if (this.audioContext && this.audioContext.state === 'suspended') 
		{
			this.audioContext.resume()
		}
		super.startTimer(callback, options)
	}
}
