var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var _worker, _buffer, _int32View, _float64View, _interval, _metricsInterval, _hrWorker, _metrics;
import { CMD_INITIALISE, CMD_START, CMD_STOP, CMD_UPDATE, CMD_ADJUST_DRIFT, EVENT_TICK } from "./index.js";
let processorURL = null;
const getProcessorURL = async () => {
  if (processorURL) {
    return processorURL;
  }
  const processorCode = await import("./elastic-timing.audioworklet-processor.js").then((m) => m.default);
  const blob = new Blob([processorCode], { type: "application/javascript" });
  processorURL = URL.createObjectURL(blob);
  return processorURL;
};
const createElasticTimingWorklet = async (context) => {
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
class HRClockWorker {
  constructor() {
    __privateAdd(this, _worker, null);
    __privateAdd(this, _buffer, null);
    __privateAdd(this, _int32View, null);
    __privateAdd(this, _float64View, null);
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
		`;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    __privateSet(this, _worker, new Worker(URL.createObjectURL(blob)));
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
    __privateSet(this, _buffer, new SharedArrayBuffer(32));
    __privateSet(this, _int32View, new Int32Array(__privateGet(this, _buffer)));
    __privateSet(this, _float64View, new Float64Array(__privateGet(this, _buffer)));
    Atomics.store(__privateGet(this, _int32View), 0, 0);
    Atomics.store(__privateGet(this, _int32View), 1, 0);
    Atomics.store(__privateGet(this, _int32View), 2, 0);
    return __privateGet(this, _buffer);
  }
  /**
   * Start the worker
   */
  start() {
    if (!__privateGet(this, _worker) || !__privateGet(this, _buffer)) {
      throw new Error("HRClockWorker not initialized");
    }
    __privateGet(this, _worker).postMessage({
      command: "start",
      buffer: __privateGet(this, _buffer)
    });
  }
  /**
   * Stop the worker
   */
  stop() {
    if (__privateGet(this, _worker)) {
      __privateGet(this, _worker).postMessage({ command: "stop" });
    }
  }
  /**
   * Terminate the worker and clean up
   */
  terminate() {
    if (__privateGet(this, _worker)) {
      __privateGet(this, _worker).terminate();
      __privateSet(this, _worker, null);
    }
  }
  /**
   * Get the shared buffer for passing to AudioWorklet
   */
  getBuffer() {
    return __privateGet(this, _buffer);
  }
}
_worker = new WeakMap();
_buffer = new WeakMap();
_int32View = new WeakMap();
_float64View = new WeakMap();
class ElasticTimingAudioWorkletNode extends AudioWorkletNode {
  constructor(audioContext, accurateTiming = false, enableHRClock = true) {
    super(audioContext, "elastic-timing-processor");
    __privateAdd(this, _interval);
    __privateAdd(this, _metricsInterval);
    __privateAdd(this, _hrWorker);
    __privateAdd(this, _metrics);
    __privateSet(this, _interval, 10);
    __privateSet(this, _metricsInterval, 1e3);
    __privateSet(this, _hrWorker, null);
    __privateSet(this, _metrics, {
      avgRenderTime: 0,
      maxRenderTime: 0,
      cpuLoad: 0,
      underruns: 0
    });
    this.accurateTiming = false;
    this.accurateTiming = accurateTiming;
    this.port.onmessage = this.onMessageReceived.bind(this);
    this.postMessage({ command: CMD_INITIALISE, accurateTiming });
    if (enableHRClock && typeof SharedArrayBuffer !== "undefined") {
      __privateSet(this, _hrWorker, new HRClockWorker());
      const buffer = __privateGet(this, _hrWorker).initializeBuffer();
      this.postMessage({
        command: "set-hr-buffer",
        buffer
      });
    }
  }
  static get parameterDescriptors() {
    return [
      {
        name: "rate",
        defaultValue: 440,
        minValue: 27.5,
        maxValue: 4186.009
      }
    ];
  }
  /**
   * Pass message to Processor Worklet
   */
  postMessage(data) {
    if (data.interval !== void 0) {
      __privateSet(this, _interval, data.interval);
    }
    if (data.metricsInterval !== void 0) {
      __privateSet(this, _metricsInterval, data.metricsInterval);
    }
    return this.port.postMessage(data);
  }
  /**
   * Start the timer with optional high-resolution measurement
   */
  start(interval, metricsInterval) {
    if (interval !== void 0) {
      __privateSet(this, _interval, interval);
    }
    if (metricsInterval !== void 0) {
      __privateSet(this, _metricsInterval, metricsInterval);
    }
    if (__privateGet(this, _hrWorker)) {
      __privateGet(this, _hrWorker).start();
    }
    this.postMessage({
      command: CMD_START,
      interval: __privateGet(this, _interval),
      metricsInterval: __privateGet(this, _metricsInterval),
      accurateTiming: this.accurateTiming
    });
  }
  /**
   * Stop the timer
   */
  stop() {
    if (__privateGet(this, _hrWorker)) {
      __privateGet(this, _hrWorker).stop();
    }
    this.postMessage({ command: CMD_STOP });
  }
  /**
   * Get current performance metrics
   */
  getMetrics() {
    return { ...__privateGet(this, _metrics) };
  }
  /**
   * Update BPM while maintaining accurate timing
   */
  update(interval) {
    this.postMessage({ command: CMD_UPDATE, interval });
  }
  /**
   * Adjust drift compensation
   */
  adjustDrift(drift) {
    this.postMessage({ command: CMD_ADJUST_DRIFT, drift });
  }
  /**
   * Terminate and clean up resources
   */
  terminate() {
    if (__privateGet(this, _hrWorker)) {
      __privateGet(this, _hrWorker).terminate();
      __privateSet(this, _hrWorker, null);
    }
  }
  /**
   * Handle messages from the AudioWorklet processor
   */
  onMessageReceived(event) {
    const data = event.data;
    switch (data.event) {
      case EVENT_TICK:
        break;
      case "underrun":
        const underrunEvent = {
          renderTime: data.renderTime ?? 0,
          targetGap: data.targetGap ?? 0,
          intervals: data.intervals ?? 0
        };
        if (this.onunderrun) {
          this.onunderrun(underrunEvent);
        }
        break;
      case "metrics":
        __privateSet(this, _metrics, {
          avgRenderTime: data.avgRenderTime ?? 0,
          maxRenderTime: data.maxRenderTime ?? 0,
          cpuLoad: data.cpuLoad ?? 0,
          underruns: data.underruns ?? 0
        });
        if (this.onmetrics) {
          this.onmetrics(__privateGet(this, _metrics));
        }
        break;
    }
    if (this.onmessage) {
      this.onmessage(event);
    }
  }
}
_interval = new WeakMap();
_metricsInterval = new WeakMap();
_hrWorker = new WeakMap();
_metrics = new WeakMap();
export {
  createElasticTimingWorklet,
  ElasticTimingAudioWorkletNode as default
};
//# sourceMappingURL=elastic-timing.audioworklet.js.map
