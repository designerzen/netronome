var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var _interval;
import { CMD_INITIALISE, CMD_START, CMD_STOP } from "./index.js";
const PROCESSOR_CODE = '/**\n * A timer that uses the AudioWorklet API\n * currentTime is a global variable\n *\n * @class TimingProcessor\n * @extends AudioWorkletProcessor\n */\n\n// Embedded event type constants to make this file self-contained for Blob loading\nconst CMD_INITIALISE = "init"\nconst CMD_START = "start"\nconst CMD_STOP = "stop"\nconst CMD_UPDATE = "update"\nconst CMD_ADJUST_DRIFT = "adjust-drift"\nconst EVENT_READY = "ready"\nconst EVENT_STARTING = "starting"\nconst EVENT_STOPPING = "stopping"\nconst EVENT_TICK = "tick"\n\nclass TimingAudioWorkletProcessor extends AudioWorkletProcessor {\n \n	isAvailable = false\n	isRunning = false\n	accurateTiming = true\n\n	startTime = -1\n	nextInterval = -1\n	gap = 0\n	intervals = 0		// loop counter\n	cumulativeDrift = 0\n\n	get elapsed() {\n		return currentTime - this.startTime\n	}\n\n	constructor() {\n	  	super()\n		this.port.onmessage = this.onmessage.bind(this)\n		this.postMessage({ event:EVENT_READY })\n	}\n\n	postMessage(message) {\n		this.port.postMessage(message)\n	}\n\n	reset() {\n		this.intervals = 0\n	}\n\n	/**\n	 * \n	 * @param {Number} interval in milliseconds\n	 * @param {*} accurateTiming \n	 */\n	start(interval = 250, accurateTiming = true) {\n		\n		this.gap = interval * 0.001\n\n		if (!this.isRunning)\n		{   \n			this.startTime = currentTime\n			// work out the next step from this step...\n			this.nextInterval = this.startTime + this.gap\n			this.isRunning = true\n			this.postMessage({event:EVENT_STARTING, time:0, intervals:this.intervals})\n		}else{\n			// work out the next step from this step...\n			this.nextInterval = currentTime + this.gap\n		}\n	\n		// INITIAL tick\n		this.postMessage({event:EVENT_TICK, time:this.elapsed, intervals:this.intervals })\n	}\n\n	/**\n	 * \n	 */\n	stop() {\n		this.isRunning = false\n		this.postMessage({ event:EVENT_STOPPING, time:this.elapsed, intervals:this.intervals })\n	}\n\n  	/**\n	 * We never want the volume to just drop out so we glide between the values\n	 * \n	 * @param {Float32Array(128)} inputs \n	 * @param {Float32Array(128)} outputs \n	 * @param {AudioParam} parameters \n	 * @returns {Boolean} keep alive\n	 */\n	process(inputs, outputs, parameters) {\n\n		const sourceLimit = Math.min(inputs.length, outputs.length)\n\n		// Wwrite the output into each of the outputs\n		// By default, the node has single input and output.\n		for (let inputIndex = 0; inputIndex < sourceLimit; ++inputIndex) {\n			const input = inputs[inputIndex]\n			const output = outputs[inputIndex]\n\n			if (input.length === 0) {\n				continue\n			}\n\n			for (let channel = 0; channel < output.length; ++channel) {\n				output[channel].set(input[channel])\n			}\n		}\n\n		// Apply drift compensation only if accurate timing is enabled\n		let compensatedGap = this.gap\n		if (this.accurateTiming && this.cumulativeDrift !== 0) {\n			// Dampen the drift correction to avoid overcorrection\n			// Use only 10% of measured drift to gradually steer back to target\n			const dampedDrift = this.cumulativeDrift * 0.1\n			compensatedGap = Math.max(this.gap - dampedDrift, 0.001)\n		}\n\n		if (this.isRunning && currentTime >= this.nextInterval )\n		{\n			this.onTick(compensatedGap)\n		}\n		\n		// check to see the time has elapsed\n		return true\n	}\n\n	/**\n	 * \n	 */\n	onTick(compensatedGap = this.gap) {\n		this.intervals++\n		this.nextInterval = currentTime + compensatedGap\n		this.postMessage({event:EVENT_TICK, time:this.elapsed, intervals:this.intervals })\n	}\n\n	/**\n	 * Pass in the WAV data or URL to load via worklet \n	 * @param {Event} event \n	 */\n	onmessage(event) {\n		\n		const data = event.data\n\n		// Handling data from the node.\n		switch (data.command) {\n			\n			// \n			case EVENT_READY:\n				break;\n\n			case CMD_INITIALISE:\n				// this.accurateTiming = data.accurateTiming ?? false\n				// this.start(data.interval)\n				break\n\n			case CMD_START:\n				this.accurateTiming = data.accurateTiming ?? false\n				this.start(data.interval)\n				break\n	\n			case CMD_STOP:\n				this.stop()\n				break\n	\n			case CMD_UPDATE:\n				this.start(data.interval)\n				break\n\n			case CMD_ADJUST_DRIFT:\n				if (data.drift !== undefined) {\n					this.cumulativeDrift = data.drift\n				}\n				break\n\n			default:\n				console.error("Processor:FAIL NO INPUT", {input, inputs, output, outputs, parameters})\n		}\n	}\n}\n  \nconst ID = "timing-processor"\nregisterProcessor(ID, TimingAudioWorkletProcessor)\n';
let processorURL = null;
const getProcessorURL = () => {
  if (!processorURL) {
    const blob = new Blob([PROCESSOR_CODE], { type: "application/javascript" });
    processorURL = URL.createObjectURL(blob);
  }
  return processorURL;
};
const createTimingWorklet = async (context) => {
  try {
    const url = getProcessorURL();
    await context.audioWorklet.addModule(url);
  } catch (error) {
    throw new Error(`Failed to load AudioWorklet processor: ${error instanceof Error ? error.message : String(error)}`);
  }
  return new TimingAudioWorkletNode(context);
};
class TimingAudioWorkletNode extends AudioWorkletNode {
  constructor(audioContext, accurateTiming = false) {
    super(audioContext, "timing-processor");
    __privateAdd(this, _interval);
    __privateSet(this, _interval, 10);
    this.accurateTiming = false;
    this.accurateTiming = accurateTiming;
    this.port.onmessage = this.onMessageReceived.bind(this);
    this.postMessage({ command: CMD_INITIALISE, accurateTiming });
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
   * @param {Object} data 
   * @returns 
   */
  postMessage(data) {
    if (data.interval !== void 0) {
      __privateSet(this, _interval, data.interval);
    }
    return this.port.postMessage(data);
  }
  start(interval) {
    if (interval !== void 0) {
      __privateSet(this, _interval, interval);
    }
    this.postMessage({ command: CMD_START, interval: __privateGet(this, _interval), accurateTiming: this.accurateTiming });
  }
  stop() {
    this.postMessage({ command: CMD_STOP });
  }
  /**
   * PUBLIC: To match other Worker style APIs
   */
  terminate() {
  }
  onMessageReceived(event) {
    const data = event.data;
    switch (data.event) {
    }
    if (this.onmessage) {
      this.onmessage(event);
    }
  }
}
_interval = new WeakMap();
export {
  createTimingWorklet,
  TimingAudioWorkletNode as default
};
//# sourceMappingURL=timing.audioworklet.js.map
