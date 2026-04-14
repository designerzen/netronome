/**
 * High-Resolution Clock Timer - Elastic Timing with AudioWorklet
 * Based on the worklet-clock pattern from openDAW
 * Provides buffer underrun detection and precise render time measurement
 */

type ElasticTimingMessage = {
	command?: string
	event?: string
	accurateTiming?: boolean
	interval?: number
	metricsInterval?: number
	time?: number
	intervals?: number
	buffer?: SharedArrayBuffer
	drift?: number
	renderTime?: number
	targetGap?: number
	avgRenderTime?: number
	maxRenderTime?: number
	cpuLoad?: number
	underruns?: number
}

// Lazy-loaded processor URL and cached object URL
let processorURL: string | null = null

const getProcessorURL = async (): Promise<string> => {
	if (processorURL) {
		return processorURL
	}
	
	// Dynamically import and get raw code
	const processorCode = await import('./elastic-timing.audioworklet-processor.js?raw').then(m => m.default)
	const blob = new Blob([processorCode], { type: 'application/javascript' })
	processorURL = URL.createObjectURL(blob)
	return processorURL
}

/**
 * Create and initialize the elastic timing worklet
 * @param {AudioContext} context 
 * @returns A new ElasticTimingAudioWorkletNode instance
 */
export const createElasticTimingWorklet = async (context: AudioContext): Promise<ElasticTimingAudioWorkletNode> => {
	try {
		const url = await getProcessorURL()
		await context.audioWorklet.addModule(url)
		console.info("ElasticTiming AudioWorklet processor loaded successfully from blob")
	} catch (error) {
		console.error("ElasticTiming AudioWorklet processor failed to load:", error)
		throw new Error(`Failed to load ElasticTiming AudioWorklet processor: ${error instanceof Error ? error.message : String(error)}`)
	}

	return new ElasticTimingAudioWorkletNode(context)
}

import {
	CMD_ADJUST_DRIFT,
	CMD_INITIALISE,
	CMD_START, CMD_STOP, CMD_UPDATE,
	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from '../timer-event-types'

/**
 * Performance metrics from the AudioWorklet
 */
export interface PerformanceMetrics {
	avgRenderTime: number      // Average render time in ms
	maxRenderTime: number      // Peak render time in ms
	cpuLoad: number            // Estimated CPU load (0-100)
	underruns: number          // Number of detected buffer underruns
}

/**
 * Underrun event details
 */
export interface UnderrunEvent {
	renderTime: number         // How long the render actually took (seconds)
	targetGap: number          // How long we expected it to take (seconds)
	intervals: number          // Which interval this occurred at
}

/**
 * High-Resolution Clock Worker - runs on main thread with access to performance.now()
 * Communicates with AudioWorklet via SharedArrayBuffer + Atomics
 */
class HRClockWorker {
	#worker: Worker | null = null
	#buffer: SharedArrayBuffer | null = null
	#int32View: Int32Array | null = null
	#float64View: Float64Array | null = null

	constructor() {
		// Create inline worker
		const workerCode = `
		const BUFFER_SIZE = 32; // 4 ints (0-3) + 2 floats (2-3)
		let buffer = null;
		let int32View = null;
		let float64View = null;
		let lastSeenRequest = 0;

		self.onmessage = (event) => {
			const { command, buffer: sharedBuffer } = event.data;

			if (command === 'init' && sharedBuffer instanceof SharedArrayBuffer) {
				buffer = sharedBuffer;
				int32View = new Int32Array(buffer);
				float64View = new Float64Array(buffer);
				lastSeenRequest = Atomics.load(int32View, 0);
				self.postMessage({ event: 'ready' });
			} else if (command === 'start') {
				// Worker loop: wait for signals from AudioWorklet
				self.postMessage({ event: 'started' });
				workerLoop();
			} else if (command === 'stop') {
				self.postMessage({ event: 'stopped' });
			}
		};

		function workerLoop() {
			while (true) {
				// Wait for AudioWorklet to signal (increment counter at int32[0])
				Atomics.wait(int32View, 0, lastSeenRequest);
				lastSeenRequest = Atomics.load(int32View, 0);

				// Determine if this is a start (odd) or end (even) signal
				const isStart = (lastSeenRequest & 1) === 1;

				// Write high-resolution timestamp
				const timestamp = performance.now();
				
				if (isStart) {
					// Start signal - write to slot 2
					float64View[2] = timestamp;
					Atomics.store(int32View, 1, lastSeenRequest); // Record which request this is for
				} else {
					// End signal - write to slot 3
					float64View[3] = timestamp;
					Atomics.store(int32View, 2, lastSeenRequest); // Record which request this is for
				}
			}
		}
		`

		const blob = new Blob([workerCode], { type: 'application/javascript' })
		this.#worker = new Worker(URL.createObjectURL(blob))
	}

	/**
	 * Initialize the shared buffer (32 bytes)
	 * Layout:
	 *  int32[0]: request counter
	 *  int32[1]: start response counter
	 *  int32[2]: end response counter
	 *  float64[2]: start timestamp
	 *  float64[3]: end timestamp
	 */
	initializeBuffer(): SharedArrayBuffer {
		// Create a 4-int32 + 2-float64 buffer (32 bytes)
		this.#buffer = new SharedArrayBuffer(32)
		this.#int32View = new Int32Array(this.#buffer)
		this.#float64View = new Float64Array(this.#buffer)

		// Initialize counters to 0
		Atomics.store(this.#int32View, 0, 0) // Request counter
		Atomics.store(this.#int32View, 1, 0) // Start response counter
		Atomics.store(this.#int32View, 2, 0) // End response counter

		return this.#buffer
	}

	/**
	 * Start the worker
	 */
	start(): void {
		if (!this.#worker || !this.#buffer) {
			throw new Error("HRClockWorker not initialized")
		}
		this.#worker.postMessage({
			command: 'start',
			buffer: this.#buffer
		})
	}

	/**
	 * Stop the worker
	 */
	stop(): void {
		if (this.#worker) {
			this.#worker.postMessage({ command: 'stop' })
		}
	}

	/**
	 * Terminate the worker and clean up
	 */
	terminate(): void {
		if (this.#worker) {
			this.#worker.terminate()
			this.#worker = null
		}
	}

	/**
	 * Get the shared buffer for passing to AudioWorklet
	 */
	getBuffer(): SharedArrayBuffer | null {
		return this.#buffer
	}
}

/**
 * Gateway to the elastic timing AudioWorkletProcessor
 * Provides high-resolution timing with buffer underrun detection
 */
export default class ElasticTimingAudioWorkletNode extends AudioWorkletNode {

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
	#metricsInterval: number = 1000
	#hrWorker: HRClockWorker | null = null
	#metrics: PerformanceMetrics = {
		avgRenderTime: 0,
		maxRenderTime: 0,
		cpuLoad: 0,
		underruns: 0
	}

	accurateTiming: boolean = false
	
	onmessage?: (event: MessageEvent<ElasticTimingMessage>) => void
	onunderrun?: (event: UnderrunEvent) => void
	onmetrics?: (metrics: PerformanceMetrics) => void

	constructor(audioContext: AudioContext, accurateTiming: boolean = false, enableHRClock: boolean = true) {
		super(audioContext, "elastic-timing-processor")
		this.accurateTiming = accurateTiming

		this.port.onmessage = this.onMessageReceived.bind(this)
		this.postMessage({ command: CMD_INITIALISE, accurateTiming })

		// Initialize high-resolution clock if enabled
		if (enableHRClock && typeof SharedArrayBuffer !== 'undefined') {
			this.#hrWorker = new HRClockWorker()
			const buffer = this.#hrWorker.initializeBuffer()
			this.postMessage({
				command: 'set-hr-buffer',
				buffer
			})
		}
	}

	/**
	 * Pass message to Processor Worklet
	 */
	postMessage(data: ElasticTimingMessage): void {
		if (data.interval !== undefined) {
			this.#interval = data.interval
		}
		if (data.metricsInterval !== undefined) {
			this.#metricsInterval = data.metricsInterval
		}
		return this.port.postMessage(data)
	}

	/**
	 * Start the timer with optional high-resolution measurement
	 */
	start(interval?: number, metricsInterval?: number): void {
		if (interval !== undefined) {
			this.#interval = interval
		}
		if (metricsInterval !== undefined) {
			this.#metricsInterval = metricsInterval
		}

		// Start the HR worker if available
		if (this.#hrWorker) {
			this.#hrWorker.start()
		}

		this.postMessage({
			command: CMD_START,
			interval: this.#interval,
			metricsInterval: this.#metricsInterval,
			accurateTiming: this.accurateTiming
		})
	}

	/**
	 * Stop the timer
	 */
	stop(): void {
		if (this.#hrWorker) {
			this.#hrWorker.stop()
		}
		this.postMessage({ command: CMD_STOP })
	}

	/**
	 * Get current performance metrics
	 */
	getMetrics(): PerformanceMetrics {
		return { ...this.#metrics }
	}

	/**
	 * Update BPM while maintaining accurate timing
	 */
	update(interval: number): void {
		this.postMessage({ command: CMD_UPDATE, interval })
	}

	/**
	 * Adjust drift compensation
	 */
	adjustDrift(drift: number): void {
		this.postMessage({ command: CMD_ADJUST_DRIFT, drift })
	}

	/**
	 * Terminate and clean up resources
	 */
	terminate(): void {
		if (this.#hrWorker) {
			this.#hrWorker.terminate()
			this.#hrWorker = null
		}
	}

	/**
	 * Handle messages from the AudioWorklet processor
	 */
	private onMessageReceived(event: MessageEvent<ElasticTimingMessage>): void {
		const data = event.data

		switch (data.event) {
			case EVENT_TICK:
				break

			case 'underrun':
				const underrunEvent: UnderrunEvent = {
					renderTime: data.renderTime ?? 0,
					targetGap: data.targetGap ?? 0,
					intervals: data.intervals ?? 0
				}
				if (this.onunderrun) {
					this.onunderrun(underrunEvent)
				}
				break

			case 'metrics':
				this.#metrics = {
					avgRenderTime: data.avgRenderTime ?? 0,
					maxRenderTime: data.maxRenderTime ?? 0,
					cpuLoad: data.cpuLoad ?? 0,
					underruns: data.underruns ?? 0
				}
				if (this.onmetrics) {
					this.onmetrics(this.#metrics)
				}
				break

			default:
				break
		}

		if (this.onmessage) {
			this.onmessage(event)
		}
	}
}
