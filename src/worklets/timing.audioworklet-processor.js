/**
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

	postTick(scheduledContextTimeSeconds = currentTime) {
		this.postMessage({
			event: EVENT_TICK,
			time: this.elapsed,
			intervals: this.intervals,
			contextTimeSeconds: currentTime,
			scheduledContextTimeSeconds,
			audioFrame: currentFrame,
			sampleRate,
		})
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
		
		this.gap = interval * 0.001

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
		this.postTick(currentTime)
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

			if (input.length === 0) {
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
		const scheduledContextTimeSeconds = this.nextInterval
		this.intervals++
		this.nextInterval = currentTime + compensatedGap
		this.postTick(scheduledContextTimeSeconds)
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
registerProcessor(ID, TimingAudioWorkletProcessor)
