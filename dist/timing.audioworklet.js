import { c as CMD_START, i as _classPrivateFieldInitSpec, l as CMD_STOP, m as EVENT_TICK, n as _classPrivateFieldGet2, s as CMD_INITIALISE, t as _classPrivateFieldSet2 } from "./classPrivateFieldSet2.js";
//#region src/worklets/timing.audioworklet-processor.js?raw
var timing_audioworklet_processor_default = "/**\r\n * A timer that uses the AudioWorklet API\r\n * currentTime is a global variable\r\n *\r\n * @class TimingProcessor\r\n * @extends AudioWorkletProcessor\r\n */\r\n\r\n// Embedded event type constants to make this file self-contained for Blob loading\r\nconst CMD_INITIALISE = \"init\"\r\nconst CMD_START = \"start\"\r\nconst CMD_STOP = \"stop\"\r\nconst CMD_UPDATE = \"update\"\r\nconst CMD_ADJUST_DRIFT = \"adjust-drift\"\r\nconst EVENT_READY = \"ready\"\r\nconst EVENT_STARTING = \"starting\"\r\nconst EVENT_STOPPING = \"stopping\"\r\nconst EVENT_TICK = \"tick\"\r\n\r\nclass TimingAudioWorkletProcessor extends AudioWorkletProcessor {\r\n \r\n	isAvailable = false\r\n	isRunning = false\r\n	accurateTiming = true\r\n\r\n	startTime = -1\r\n	nextInterval = -1\r\n	gap = 0\r\n	intervals = 0		// loop counter\r\n	cumulativeDrift = 0\r\n\r\n	get elapsed() {\r\n		return currentTime - this.startTime\r\n	}\r\n\r\n	constructor() {\r\n	  	super()\r\n		this.port.onmessage = this.onmessage.bind(this)\r\n		this.postMessage({ event:EVENT_READY })\r\n	}\r\n\r\n	postMessage(message) {\r\n		this.port.postMessage(message)\r\n	}\r\n\r\n	postTick(scheduledContextTimeSeconds = currentTime) {\r\n		this.postMessage({\r\n			event: EVENT_TICK,\r\n			time: this.elapsed,\r\n			intervals: this.intervals,\r\n			contextTimeSeconds: currentTime,\r\n			scheduledContextTimeSeconds,\r\n			audioFrame: currentFrame,\r\n			sampleRate,\r\n		})\r\n	}\r\n\r\n	reset() {\r\n		this.intervals = 0\r\n	}\r\n\r\n	/**\r\n	 * \r\n	 * @param {Number} interval in milliseconds\r\n	 * @param {*} accurateTiming \r\n	 */\r\n	start(interval = 250, accurateTiming = true) {\r\n		\r\n		this.gap = interval * 0.001\r\n\r\n		if (!this.isRunning)\r\n		{   \r\n			this.startTime = currentTime\r\n			// work out the next step from this step...\r\n			this.nextInterval = this.startTime + this.gap\r\n			this.isRunning = true\r\n			this.postMessage({event:EVENT_STARTING, time:0, intervals:this.intervals})\r\n		}else{\r\n			// work out the next step from this step...\r\n			this.nextInterval = currentTime + this.gap\r\n		}\r\n	\r\n		// INITIAL tick\r\n		this.postTick(currentTime)\r\n	}\r\n\r\n	/**\r\n	 * \r\n	 */\r\n	stop() {\r\n		this.isRunning = false\r\n		this.postMessage({ event:EVENT_STOPPING, time:this.elapsed, intervals:this.intervals })\r\n	}\r\n\r\n  	/**\r\n	 * We never want the volume to just drop out so we glide between the values\r\n	 * \r\n	 * @param {Float32Array(128)} inputs \r\n	 * @param {Float32Array(128)} outputs \r\n	 * @param {AudioParam} parameters \r\n	 * @returns {Boolean} keep alive\r\n	 */\r\n	process(inputs, outputs, parameters) {\r\n\r\n		const sourceLimit = Math.min(inputs.length, outputs.length)\r\n\r\n		// Wwrite the output into each of the outputs\r\n		// By default, the node has single input and output.\r\n		for (let inputIndex = 0; inputIndex < sourceLimit; ++inputIndex) {\r\n			const input = inputs[inputIndex]\r\n			const output = outputs[inputIndex]\r\n\r\n			if (input.length === 0) {\r\n				continue\r\n			}\r\n\r\n			for (let channel = 0; channel < output.length; ++channel) {\r\n				output[channel].set(input[channel])\r\n			}\r\n		}\r\n\r\n		// Apply drift compensation only if accurate timing is enabled\r\n		let compensatedGap = this.gap\r\n		if (this.accurateTiming && this.cumulativeDrift !== 0) {\r\n			// Dampen the drift correction to avoid overcorrection\r\n			// Use only 10% of measured drift to gradually steer back to target\r\n			const dampedDrift = this.cumulativeDrift * 0.1\r\n			compensatedGap = Math.max(this.gap - dampedDrift, 0.001)\r\n		}\r\n\r\n		if (this.isRunning && currentTime >= this.nextInterval )\r\n		{\r\n			this.onTick(compensatedGap)\r\n		}\r\n		\r\n		// check to see the time has elapsed\r\n		return true\r\n	}\r\n\r\n	/**\r\n	 * \r\n	 */\r\n	onTick(compensatedGap = this.gap) {\r\n		const scheduledContextTimeSeconds = this.nextInterval\r\n		this.intervals++\r\n		this.nextInterval = currentTime + compensatedGap\r\n		this.postTick(scheduledContextTimeSeconds)\r\n	}\r\n\r\n	/**\r\n	 * Pass in the WAV data or URL to load via worklet \r\n	 * @param {Event} event \r\n	 */\r\n	onmessage(event) {\r\n		\r\n		const data = event.data\r\n\r\n		// Handling data from the node.\r\n		switch (data.command) {\r\n			\r\n			// \r\n			case EVENT_READY:\r\n				break;\r\n\r\n			case CMD_INITIALISE:\r\n				// this.accurateTiming = data.accurateTiming ?? false\r\n				// this.start(data.interval)\r\n				break\r\n\r\n			case CMD_START:\r\n				this.accurateTiming = data.accurateTiming ?? false\r\n				this.start(data.interval)\r\n				break\r\n	\r\n			case CMD_STOP:\r\n				this.stop()\r\n				break\r\n	\r\n			case CMD_UPDATE:\r\n				this.start(data.interval)\r\n				break\r\n\r\n			case CMD_ADJUST_DRIFT:\r\n				if (data.drift !== undefined) {\r\n					this.cumulativeDrift = data.drift\r\n				}\r\n				break\r\n\r\n			default:\r\n				console.error(\"Processor:FAIL NO INPUT\", {input, inputs, output, outputs, parameters})\r\n		}\r\n	}\r\n}\r\n  \r\nconst ID = \"timing-processor\"\r\nregisterProcessor(ID, TimingAudioWorkletProcessor)\r\n";
//#endregion
//#region src/worklets/timing.audioworklet.ts
var processorURL = null;
var getProcessorURL = () => {
	if (!processorURL) {
		const blob = new Blob([timing_audioworklet_processor_default], { type: "application/javascript" });
		processorURL = URL.createObjectURL(blob);
	}
	return processorURL;
};
/**
* Wrap the above in a single call
* @param {AudioContext} context 
* @returns A new TimingAudioWorkletNode instance
*/
var createTimingWorklet = async (context) => {
	try {
		const url = getProcessorURL();
		await context.audioWorklet.addModule(url);
	} catch (error) {
		throw new Error(`Failed to load AudioWorklet processor: ${error instanceof Error ? error.message : String(error)}`);
	}
	return new TimingAudioWorkletNode(context);
};
var _interval = /* @__PURE__ */ new WeakMap();
/**
* Gateway to the metronome AudioWorkletProcessor
* If you add this node to your audio pipeline it 
* should disptch events at the correct times
*/
var TimingAudioWorkletNode = class extends AudioWorkletNode {
	static get parameterDescriptors() {
		return [{
			name: "rate",
			defaultValue: 440,
			minValue: 27.5,
			maxValue: 4186.009
		}];
	}
	constructor(audioContext, accurateTiming = false) {
		super(audioContext, "timing-processor");
		_classPrivateFieldInitSpec(this, _interval, void 0);
		_classPrivateFieldSet2(_interval, this, 10);
		this.accurateTiming = false;
		this.accurateTiming = accurateTiming;
		this.port.onmessage = this.onMessageReceived.bind(this);
		this.postMessage({
			command: CMD_INITIALISE,
			accurateTiming
		});
	}
	/**
	* Pass message to Processor Worklet
	* @param {Object} data 
	* @returns 
	*/
	postMessage(data) {
		if (data.interval !== void 0) _classPrivateFieldSet2(_interval, this, data.interval);
		return this.port.postMessage(data);
	}
	start(interval) {
		if (interval !== void 0) _classPrivateFieldSet2(_interval, this, interval);
		this.postMessage({
			command: CMD_START,
			interval: _classPrivateFieldGet2(_interval, this),
			accurateTiming: this.accurateTiming
		});
	}
	stop() {
		this.postMessage({ command: CMD_STOP });
	}
	/**
	* PUBLIC: To match other Worker style APIs
	*/
	terminate() {}
	onMessageReceived(event) {
		switch (event.data.event) {
			case EVENT_TICK: break;
			default:
		}
		if (this.onmessage) this.onmessage(event);
	}
};
//#endregion
export { createTimingWorklet };

//# sourceMappingURL=timing.audioworklet.js.map