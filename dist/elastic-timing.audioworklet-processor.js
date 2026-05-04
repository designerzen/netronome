const elasticTiming_audioworkletProcessor = `/**
 * High-Resolution Clock AudioWorklet Processor with Buffer Underrun Detection
 * Implements the worklet-clock pattern from openDAW
 * Uses SharedArrayBuffer + Atomics for cross-thread high-resolution timing
 * 
 * @class ElasticTimingAudioWorkletProcessor
 * @extends AudioWorkletProcessor
 */

// Embedded event type constants
const CMD_INITIALISE = "init"
const CMD_START = "start"
const CMD_STOP = "stop"
const CMD_UPDATE = "update"
const CMD_ADJUST_DRIFT = "adjust-drift"
const CMD_SET_HR_BUFFER = "set-hr-buffer"
const EVENT_READY = "ready"
const EVENT_STARTING = "starting"
const EVENT_STOPPING = "stopping"
const EVENT_TICK = "tick"
const EVENT_UNDERRUN = "underrun"
const EVENT_METRICS = "metrics"

class ElasticTimingAudioWorkletProcessor extends AudioWorkletProcessor {
	
	isAvailable = false
	isRunning = false
	accurateTiming = true
	
	startTime = -1
	nextInterval = -1
	gap = 0
	intervals = 0
	cumulativeDrift = 0
	
	// High-resolution clock members
	#hrBuffer = null
	#int32View = null
	#float64View = null
	#lastSeenRequestCounter = 0
	#prevStartCounter = 0
	#prevEndCounter = 0
	#prevStartTs = 0
	#prevEndTs = 0
	
	// Performance metrics
	#perfBuffer = new Float32Array(256)
	#perfWriteIndex = 0
	#underrunCount = 0
	#maxRenderTime = 0
	#metricsInterval = 0
	#metricsNextReport = 0
	
	get elapsed() {
		return currentTime - this.startTime
	}
	
	constructor() {
		super()
		this.port.onmessage = this.onmessage.bind(this)
		this.postMessage({ event: EVENT_READY })
	}
	
	postMessage(message) {
		this.port.postMessage(message)
	}
	
	reset() {
		this.intervals = 0
		this.#underrunCount = 0
		this.#maxRenderTime = 0
		this.#perfWriteIndex = 0
		this.#perfBuffer.fill(0)
	}
	
	/**
	 * Initialize the high-resolution buffer from the worker
	 * @param {SharedArrayBuffer} buffer - Shared buffer from worker
	 */
	setHRBuffer(buffer) {
		this.#hrBuffer = buffer
		this.#int32View = new Int32Array(buffer)
		this.#float64View = new Float64Array(buffer)
		this.#lastSeenRequestCounter = this.#int32View[0]
	}
	
	/**
	 * Request timestamps from high-resolution worker
	 * Increments request counter to signal worker
	 */
	#signalHRWorker() {
		if (!this.#int32View) return
		Atomics.add(this.#int32View, 0, 1)
	}
	
	/**
	 * Get high-resolution start timestamp from previous render
	 * Returns elapsed time of the previous render or 0 if invalid
	 */
	#getHRTimestamp() {
		if (!this.#int32View) return 0
		
		// Read current response counters
		const startCounter = Atomics.load(this.#int32View, 1)
		const endCounter = Atomics.load(this.#int32View, 2)
		const startTs = this.#float64View[2]
		const endTs = this.#float64View[3]
		
		// Validate that we have matching start/end pair from same render
		let elapsed = 0
		if (this.#prevStartCounter > 0 && this.#prevEndCounter === this.#prevStartCounter + 1) {
			elapsed = this.#prevEndTs - this.#prevStartTs
			if (elapsed > this.#maxRenderTime) {
				this.#maxRenderTime = elapsed
			}
		} else if (this.#prevStartCounter > 0) {
			// Mismatched counters indicate underrun
			this.#underrunCount++
		}
		
		// Store current for next frame
		this.#prevStartCounter = startCounter
		this.#prevEndCounter = endCounter
		this.#prevStartTs = startTs
		this.#prevEndTs = endTs
		
		return elapsed
	}
	
	/**
	 * Update performance metrics and detect underruns
	 * @param {number} elapsed - Render time in seconds
	 */
	#recordMetrics(elapsed) {
		const elapsedMs = elapsed * 1000
		this.#perfBuffer[this.#perfWriteIndex] = elapsedMs
		this.#perfWriteIndex = (this.#perfWriteIndex + 1) % this.#perfBuffer.length
		
		// Report metrics periodically (every ~1 second at 48kHz)
		if (this.accurateTiming && this.#metricsInterval > 0) {
			if (currentTime >= this.#metricsNextReport) {
				this.#reportMetrics()
				this.#metricsNextReport = currentTime + this.#metricsInterval
			}
		}
	}
	
	/**
	 * Calculate and report performance metrics
	 */
	#reportMetrics() {
		const avgElapsed = this.#perfBuffer.reduce((a, b) => a + b, 0) / this.#perfBuffer.length
		const cpuLoad = (avgElapsed / (128 / 48000)) * 100 // Assuming 48kHz, 128 sample buffer
		
		this.postMessage({
			event: EVENT_METRICS,
			avgRenderTime: avgElapsed,
			maxRenderTime: this.#maxRenderTime,
			cpuLoad: Math.min(cpuLoad, 100),
			underruns: this.#underrunCount
		})
	}
	
	/**
	 * Start the timer with optional metrics reporting
	 * @param {Number} interval in milliseconds
	 * @param {Boolean} accurateTiming 
	 * @param {Number} metricsInterval optional interval for metrics (0 = disabled)
	 */
	start(interval = 250, accurateTiming = true, metricsInterval = 0) {
		this.gap = interval * 0.001
		this.#metricsInterval = metricsInterval * 0.001 // Convert to seconds
		
		if (!this.isRunning) {
			this.startTime = currentTime
			this.nextInterval = this.startTime + this.gap
			this.isRunning = true
			this.#metricsNextReport = currentTime + this.#metricsInterval
			this.postMessage({ event: EVENT_STARTING, time: 0, intervals: this.intervals })
		} else {
			this.nextInterval = currentTime + this.gap
		}
		
		// Signal worker for initial timestamp
		if (this.#hrBuffer) {
			this.#signalHRWorker()
		}
		
		this.postMessage({ event: EVENT_TICK, time: this.elapsed, intervals: this.intervals })
	}
	
	/**
	 * Stop the timer
	 */
	stop() {
		this.isRunning = false
		this.postMessage({ event: EVENT_STOPPING, time: this.elapsed, intervals: this.intervals })
		
		// Report final metrics
		if (this.#hrBuffer) {
			this.#reportMetrics()
		}
	}
	
	/**
	 * AudioWorklet process callback - called per render quantum (128 samples)
	 */
	process(inputs, outputs, parameters) {
		const sourceLimit = Math.min(inputs.length, outputs.length)
		
		// Pass audio through
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
		
		// Get high-resolution timing if available
		const hrElapsed = this.#getHRTimestamp()
		if (this.#hrBuffer) {
			this.#recordMetrics(hrElapsed)
		}
		
		// Apply drift compensation
		let compensatedGap = this.gap
		if (this.accurateTiming && this.cumulativeDrift !== 0) {
			const dampedDrift = this.cumulativeDrift * 0.1
			compensatedGap = Math.max(this.gap - dampedDrift, 0.001)
		}
		
		// Detect underrun: if render took longer than gap, we've fallen behind
		if (this.#hrBuffer && hrElapsed > 0 && hrElapsed > this.gap) {
			this.postMessage({
				event: EVENT_UNDERRUN,
				renderTime: hrElapsed,
				targetGap: this.gap,
				intervals: this.intervals
			})
		}
		
		// Process timing ticks
		if (this.isRunning && currentTime >= this.nextInterval) {
			this.onTick(compensatedGap)
		}
		
		return true
	}
	
	/**
	 * Handle timing tick
	 */
	onTick(compensatedGap = this.gap) {
		this.intervals++
		this.nextInterval = currentTime + compensatedGap
		
		// Signal worker for new timestamp
		if (this.#hrBuffer) {
			this.#signalHRWorker()
		}
		
		this.postMessage({ event: EVENT_TICK, time: this.elapsed, intervals: this.intervals })
	}
	
	/**
	 * Handle messages from main thread
	 */
	onmessage(event) {
		const data = event.data
		
		switch (data.command) {
			case EVENT_READY:
				break
			
			case CMD_INITIALISE:
				break
			
			case CMD_START:
				this.accurateTiming = data.accurateTiming ?? false
				this.start(data.interval, this.accurateTiming, data.metricsInterval)
				break
			
			case CMD_STOP:
				this.stop()
				break
			
			case CMD_UPDATE:
				this.start(data.interval, this.accurateTiming, data.metricsInterval)
				break
			
			case CMD_ADJUST_DRIFT:
				if (data.drift !== undefined) {
					this.cumulativeDrift = data.drift
				}
				break
			
			case CMD_SET_HR_BUFFER:
				if (data.buffer instanceof SharedArrayBuffer) {
					this.setHRBuffer(data.buffer)
				}
				break
			
			default:
				console.error("ElasticTimingAudioWorkletProcessor: Unknown message", data.command)
		}
	}
}

const ID = "elastic-timing-processor"
registerProcessor(ID, ElasticTimingAudioWorkletProcessor)
`;
export {
  elasticTiming_audioworkletProcessor as default
};
//# sourceMappingURL=elastic-timing.audioworklet-processor.js.map
