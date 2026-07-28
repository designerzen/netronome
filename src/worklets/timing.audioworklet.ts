// Interface type for message structure - TypeScript only, stripped from output
type TimingMessage = {
	command?: string
	event?: string
	accurateTiming?: boolean
	interval?: number
	time?: number
	intervals?: number
	contextTimeSeconds?: number
	scheduledContextTimeSeconds?: number
	audioFrame?: number
	sampleRate?: number
}

// Static ?raw import — Vite inlines the file contents as a string at build time,
// so the published library is fully self-contained with no external file dependency
import PROCESSOR_CODE from './timing.audioworklet-processor.js?raw'

// Lazy-loaded cached blob URL
let processorURL: string | null = null

const getProcessorURL = (): string => {
	if (!processorURL) {
		const blob = new Blob([PROCESSOR_CODE], { type: 'application/javascript' })
		processorURL = URL.createObjectURL(blob)
	}
	return processorURL
}

/**
 * Wrap the above in a single call
 * @param {AudioContext} context 
 * @returns A new TimingAudioWorkletNode instance
 */
export const createTimingWorklet = async (context: AudioContext): Promise<TimingAudioWorkletNode> =>{
	try{
		const url = getProcessorURL()
		await context.audioWorklet.addModule(url)
	}catch(error){
		throw new Error(`Failed to load AudioWorklet processor: ${error instanceof Error ? error.message : String(error)}`)
	}

	return new TimingAudioWorkletNode(context)
}

import {
	CMD_INITIALISE,
	CMD_START,CMD_STOP,CMD_UPDATE,
	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from '../timer-event-types'

/**
 * Gateway to the metronome AudioWorkletProcessor
 * If you add this node to your audio pipeline it 
 * should disptch events at the correct times
 */
export default class TimingAudioWorkletNode extends AudioWorkletNode {

	static get parameterDescriptors() {
		return [
			{
				name: "rate",
				defaultValue: 440.0,
				minValue: 27.5,
				maxValue: 4186.009
			}
		]
	}
	
	#interval: number = 10
	accurateTiming: boolean = false
	
	onmessage?: (event: MessageEvent<TimingMessage>) => void

	constructor(audioContext: AudioContext, accurateTiming: boolean = false) 
	{
		super(audioContext, "timing-processor")
		this.accurateTiming = accurateTiming
		this.port.onmessage = this.onMessageReceived.bind(this)
		this.postMessage({command:CMD_INITIALISE, accurateTiming})
		// this.start()
	}

	/**
	 * Pass message to Processor Worklet
	 * @param {Object} data 
	 * @returns 
	 */
	postMessage( data: TimingMessage ): void {
		// Update interval if provided in message
		if (data.interval !== undefined) {
			this.#interval = data.interval
		}
		return this.port.postMessage(data)
	}

	start(interval?: number): void {
		if (interval !== undefined) {
			this.#interval = interval
		}
		this.postMessage({command:CMD_START, interval:this.#interval, accurateTiming:this.accurateTiming })
	}

	stop(): void {
		this.postMessage({command:CMD_STOP})
	}

	/**
	 * PUBLIC: To match other Worker style APIs
	 */
	terminate(): void {
		// FIXME: 
	}

	onMessageReceived(event: MessageEvent<TimingMessage>): void {
		const data = event.data
		
		switch(data.event)
		{
			case EVENT_TICK:
				break

			default:
		}

		if ( this.onmessage )
		{
			this.onmessage(event)
		}
	}
}
