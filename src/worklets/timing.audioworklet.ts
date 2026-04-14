// Interface type for message structure - TypeScript only, stripped from output
type TimingMessage = {
	command?: string
	event?: string
	accurateTiming?: boolean
	interval?: number
	time?: number
	intervals?: number
}

// Lazy-loaded processor URL and cached object URL
let processorURL: string | null = null

// Inline processor code to avoid import resolution issues during bundling
const PROCESSOR_CODE = `/**
 * A timer that uses the AudioWorklet API
 * currentTime is a global variable
 *
 * @class TimingProcessor
 * @extends AudioWorkletProcessor
 */

// Embedded event type constants to make this file self-contained for Blob loading
const CMD_INITIALISE = "init"
const CMD_START = "start"
const CMD_STOP = "stop"
const CMD_UPDATE = "update"
const CMD_ADJUST_DRIFT = "adjust-drift"
const EVENT_READY = "ready"
const EVENT_STARTING = "starting"
const EVENT_STOPPING = "stopping"
const EVENT_TICK = "tick"

class TimingAudioWorkletProcessor extends AudioWorkletProcessor {
 
	isAvailable = false
	isRunning = false
	accurateTiming = true

	startTime = -1
	nextInterval = -1
	gap = 0
	intervals = 0		// loop counter
	cumulativeDrift = 0

	get elapsed() {
		return currentTime - this.startTime
	}

	constructor() {
	  	super()
		this.port.onmessage = this.onmessage.bind(this)
		this.postMessage({ event:EVENT_READY })
	}

	postMessage(message) {
		this.port.postMessage(message)
	}

	reset() {
		this.intervals = 0
	}

	/**
	 * 
	 * @param {Number} interval in milliseconds
	 * @param {*} accurateTiming 
	 */
	start(interval = 250, accurateTiming = true) {
		
		this.gap = interval * 0.001 // 000

		if (!this.isRunning)
		{   
			this.startTime = currentTime
			// work out the next step from this step...
			this.nextInterval = this.startTime + this.gap
			this.isRunning = true
			this.postMessage({event:EVENT_STARTING, time:0, intervals:this.intervals})
		}else{
			// work out the next step from this step...
			this.nextInterval = currentTime + this.gap
		}
	
		// INITIAL tick
		this.postMessage({event:EVENT_TICK, time:this.elapsed, intervals:this.intervals })
	}

	/**
	 * 
	 */
	stop() {
		this.isRunning = false
		this.postMessage({ event:EVENT_STOPPING, time:this.elapsed, intervals:this.intervals })
	}

  	/**
	 * We never want the volume to just drop out so we glide between the values
	 * 
	 * @param {Float32Array(128)} inputs 
	 * @param {Float32Array(128)} outputs 
	 * @param {AudioParam} parameters 
	 * @returns {Boolean} keep alive
	 */
	process(inputs, outputs, parameters) {

		const sourceLimit = Math.min(inputs.length, outputs.length)

		// Wwrite the output into each of the outputs
		// By default, the node has single input and output.
		for (let inputIndex = 0; inputIndex < sourceLimit; ++inputIndex) {
			const input = inputs[inputIndex]
			const output = outputs[inputIndex]

			if (input.length === 0){
				//console.error("Processor:FAIL NO INPUT", {input, inputs, output, outputs, parameters})
				continue
			}

			for (let channel = 0; channel < output.length; ++channel) {
				output[channel].set(input[channel])
			}
		}

		// Apply drift compensation only if accurate timing is enabled
		let compensatedGap = this.gap
		if (this.accurateTiming && this.cumulativeDrift !== 0) {
			// Dampen the drift correction to avoid overcorrection
			// Use only 10% of measured drift to gradually steer back to target
			const dampedDrift = this.cumulativeDrift * 0.1
			compensatedGap = Math.max(this.gap - dampedDrift, 0.001)
		}

		if (this.isRunning && currentTime >= this.nextInterval )
		{
			this.onTick(compensatedGap)
		}
		
		// check to see the time has elapsed
		return true
	}

	/**
	 * 
	 */
	onTick(compensatedGap = this.gap) {
		this.intervals++
		this.nextInterval = currentTime + compensatedGap
		this.postMessage({event:EVENT_TICK, time:this.elapsed, intervals:this.intervals })
	}

	/**
	 * Pass in the WAV data or URL to load via worklet 
	 * @param {Event} event 
	 */
	onmessage(event) {
		
		const data = event.data

		// Handling data from the node.
		switch (data.command) {
			
			// 
			case EVENT_READY:
				break;

			case CMD_INITIALISE:
				// this.accurateTiming = data.accurateTiming ?? false
				// this.start(data.interval)
				break

			case CMD_START:
				this.accurateTiming = data.accurateTiming ?? false
				this.start(data.interval)
				break
	
			case CMD_STOP:
				this.stop()
				break
	
			case CMD_UPDATE:
				this.start(data.interval)
				break

			case CMD_ADJUST_DRIFT:
				if (data.drift !== undefined) {
					this.cumulativeDrift = data.drift
				}
				break

			default:
				console.error("Processor:FAIL NO INPUT", {input, inputs, output, outputs, parameters})
		}
	}
}
  
const ID = "timing-processor"
registerProcessor(ID, TimingAudioWorkletProcessor)`

const getProcessorURL = async (): Promise<string> => {
	if (processorURL) {
		return processorURL
	}
	
	try {
		const blob = new Blob([PROCESSOR_CODE], { type: 'application/javascript' })
		processorURL = URL.createObjectURL(blob)
		return processorURL
	} catch (error) {
		throw error
	}
}

/**
 * Wrap the above in a single call
 * @param {AudioContext} context 
 * @returns A new TimingAudioWorkletNode instance
 */
export const createTimingWorklet = async (context: AudioContext): Promise<TimingAudioWorkletNode> =>{
	try{
		const url = await getProcessorURL()
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
