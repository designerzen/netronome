import { c as CMD_START, i as _classPrivateFieldInitSpec, l as CMD_STOP, m as EVENT_TICK, n as _classPrivateFieldGet2, o as CMD_ADJUST_DRIFT, s as CMD_INITIALISE, t as _classPrivateFieldSet2, u as CMD_UPDATE } from "./classPrivateFieldSet2.js";
//#region src/worklets/elastic-timing.audioworklet.ts
var processorURL = null;
var getProcessorURL = async () => {
	if (processorURL) return processorURL;
	const processorCode = await import("./elastic-timing.audioworklet-processor.js").then((m) => m.default);
	const blob = new Blob([processorCode], { type: "application/javascript" });
	processorURL = URL.createObjectURL(blob);
	return processorURL;
};
/**
* Create and initialize the elastic timing worklet
* @param {AudioContext} context 
* @returns A new ElasticTimingAudioWorkletNode instance
*/
var createElasticTimingWorklet = async (context) => {
	try {
		const url = await getProcessorURL();
		await context.audioWorklet.addModule(url);
		console.info("ElasticTiming AudioWorklet processor loaded successfully from blob");
	} catch (error) {
		console.error("ElasticTiming AudioWorklet processor failed to load:", error);
		throw new Error(`Failed to load ElasticTiming AudioWorklet processor: ${error instanceof Error ? error.message : String(error)}`);
	}
	return new ElasticTimingAudioWorkletNode(context);
};
var _worker = /* @__PURE__ */ new WeakMap();
var _buffer = /* @__PURE__ */ new WeakMap();
var _int32View = /* @__PURE__ */ new WeakMap();
var _float64View = /* @__PURE__ */ new WeakMap();
/**
* High-Resolution Clock Worker - runs on main thread with access to performance.now()
* Communicates with AudioWorklet via SharedArrayBuffer + Atomics
*/
var HRClockWorker = class {
	constructor() {
		_classPrivateFieldInitSpec(this, _worker, null);
		_classPrivateFieldInitSpec(this, _buffer, null);
		_classPrivateFieldInitSpec(this, _int32View, null);
		_classPrivateFieldInitSpec(this, _float64View, null);
		const blob = new Blob([`
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
		`], { type: "application/javascript" });
		_classPrivateFieldSet2(_worker, this, new Worker(URL.createObjectURL(blob)));
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
	initializeBuffer() {
		_classPrivateFieldSet2(_buffer, this, new SharedArrayBuffer(32));
		_classPrivateFieldSet2(_int32View, this, new Int32Array(_classPrivateFieldGet2(_buffer, this)));
		_classPrivateFieldSet2(_float64View, this, new Float64Array(_classPrivateFieldGet2(_buffer, this)));
		Atomics.store(_classPrivateFieldGet2(_int32View, this), 0, 0);
		Atomics.store(_classPrivateFieldGet2(_int32View, this), 1, 0);
		Atomics.store(_classPrivateFieldGet2(_int32View, this), 2, 0);
		return _classPrivateFieldGet2(_buffer, this);
	}
	/**
	* Start the worker
	*/
	start() {
		if (!_classPrivateFieldGet2(_worker, this) || !_classPrivateFieldGet2(_buffer, this)) throw new Error("HRClockWorker not initialized");
		_classPrivateFieldGet2(_worker, this).postMessage({
			command: "start",
			buffer: _classPrivateFieldGet2(_buffer, this)
		});
	}
	/**
	* Stop the worker
	*/
	stop() {
		if (_classPrivateFieldGet2(_worker, this)) _classPrivateFieldGet2(_worker, this).postMessage({ command: "stop" });
	}
	/**
	* Terminate the worker and clean up
	*/
	terminate() {
		if (_classPrivateFieldGet2(_worker, this)) {
			_classPrivateFieldGet2(_worker, this).terminate();
			_classPrivateFieldSet2(_worker, this, null);
		}
	}
	/**
	* Get the shared buffer for passing to AudioWorklet
	*/
	getBuffer() {
		return _classPrivateFieldGet2(_buffer, this);
	}
};
var _interval = /* @__PURE__ */ new WeakMap();
var _metricsInterval = /* @__PURE__ */ new WeakMap();
var _hrWorker = /* @__PURE__ */ new WeakMap();
var _metrics = /* @__PURE__ */ new WeakMap();
/**
* Gateway to the elastic timing AudioWorkletProcessor
* Provides high-resolution timing with buffer underrun detection
*/
var ElasticTimingAudioWorkletNode = class extends AudioWorkletNode {
	static get parameterDescriptors() {
		return [{
			name: "rate",
			defaultValue: 440,
			minValue: 27.5,
			maxValue: 4186.009
		}];
	}
	constructor(audioContext, accurateTiming = false, enableHRClock = true) {
		super(audioContext, "elastic-timing-processor");
		_classPrivateFieldInitSpec(this, _interval, void 0);
		_classPrivateFieldInitSpec(this, _metricsInterval, void 0);
		_classPrivateFieldInitSpec(this, _hrWorker, void 0);
		_classPrivateFieldInitSpec(this, _metrics, void 0);
		_classPrivateFieldSet2(_interval, this, 10);
		_classPrivateFieldSet2(_metricsInterval, this, 1e3);
		_classPrivateFieldSet2(_hrWorker, this, null);
		_classPrivateFieldSet2(_metrics, this, {
			avgRenderTime: 0,
			maxRenderTime: 0,
			cpuLoad: 0,
			underruns: 0
		});
		this.accurateTiming = false;
		this.accurateTiming = accurateTiming;
		this.port.onmessage = this.onMessageReceived.bind(this);
		this.postMessage({
			command: CMD_INITIALISE,
			accurateTiming
		});
		if (enableHRClock && typeof SharedArrayBuffer !== "undefined") {
			_classPrivateFieldSet2(_hrWorker, this, new HRClockWorker());
			const buffer = _classPrivateFieldGet2(_hrWorker, this).initializeBuffer();
			this.postMessage({
				command: "set-hr-buffer",
				buffer
			});
		}
	}
	/**
	* Pass message to Processor Worklet
	*/
	postMessage(data) {
		if (data.interval !== void 0) _classPrivateFieldSet2(_interval, this, data.interval);
		if (data.metricsInterval !== void 0) _classPrivateFieldSet2(_metricsInterval, this, data.metricsInterval);
		return this.port.postMessage(data);
	}
	/**
	* Start the timer with optional high-resolution measurement
	*/
	start(interval, metricsInterval) {
		if (interval !== void 0) _classPrivateFieldSet2(_interval, this, interval);
		if (metricsInterval !== void 0) _classPrivateFieldSet2(_metricsInterval, this, metricsInterval);
		if (_classPrivateFieldGet2(_hrWorker, this)) _classPrivateFieldGet2(_hrWorker, this).start();
		this.postMessage({
			command: CMD_START,
			interval: _classPrivateFieldGet2(_interval, this),
			metricsInterval: _classPrivateFieldGet2(_metricsInterval, this),
			accurateTiming: this.accurateTiming
		});
	}
	/**
	* Stop the timer
	*/
	stop() {
		if (_classPrivateFieldGet2(_hrWorker, this)) _classPrivateFieldGet2(_hrWorker, this).stop();
		this.postMessage({ command: CMD_STOP });
	}
	/**
	* Get current performance metrics
	*/
	getMetrics() {
		return { ..._classPrivateFieldGet2(_metrics, this) };
	}
	/**
	* Update BPM while maintaining accurate timing
	*/
	update(interval) {
		this.postMessage({
			command: CMD_UPDATE,
			interval
		});
	}
	/**
	* Adjust drift compensation
	*/
	adjustDrift(drift) {
		this.postMessage({
			command: CMD_ADJUST_DRIFT,
			drift
		});
	}
	/**
	* Terminate and clean up resources
	*/
	terminate() {
		if (_classPrivateFieldGet2(_hrWorker, this)) {
			_classPrivateFieldGet2(_hrWorker, this).terminate();
			_classPrivateFieldSet2(_hrWorker, this, null);
		}
	}
	/**
	* Handle messages from the AudioWorklet processor
	*/
	onMessageReceived(event) {
		const data = event.data;
		switch (data.event) {
			case EVENT_TICK: break;
			case "underrun":
				const underrunEvent = {
					renderTime: data.renderTime ?? 0,
					targetGap: data.targetGap ?? 0,
					intervals: data.intervals ?? 0
				};
				if (this.onunderrun) this.onunderrun(underrunEvent);
				break;
			case "metrics":
				_classPrivateFieldSet2(_metrics, this, {
					avgRenderTime: data.avgRenderTime ?? 0,
					maxRenderTime: data.maxRenderTime ?? 0,
					cpuLoad: data.cpuLoad ?? 0,
					underruns: data.underruns ?? 0
				});
				if (this.onmetrics) this.onmetrics(_classPrivateFieldGet2(_metrics, this));
				break;
			default: break;
		}
		if (this.onmessage) this.onmessage(event);
	}
};
//#endregion
export { createElasticTimingWorklet };

//# sourceMappingURL=elastic-timing.audioworklet.js.map