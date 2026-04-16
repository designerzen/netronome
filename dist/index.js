var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var _interval, _running, _active, _bypassed, _options, _epoch, _synchronizationOffset;
const CMD_INITIALISE = "init";
const CMD_START = "start";
const CMD_STOP = "stop";
const CMD_UPDATE = "update";
const CMD_ADJUST_DRIFT = "adjust-drift";
const EVENT_READY = "ready";
const EVENT_STARTING = "starting";
const EVENT_STOPPING = "stopping";
const EVENT_TICK = "tick";
let beatTimes = [];
const TAP_TIMEOUT = 1e4;
const MINIMUM_TEMPOS = 2;
const tapTempoQuick = (autoReset = true, timeOut = TAP_TIMEOUT, minimumTaps = MINIMUM_TEMPOS) => {
  const currentTime = performance ? performance.now() : Date.now();
  if (autoReset && beatTimes.length > 0 && currentTime - beatTimes[beatTimes.length - 1] > timeOut) {
    beatTimes = [];
  }
  beatTimes.push(currentTime);
  const quantity = beatTimes.length;
  const x = quantity - 1;
  const y = beatTimes[x] - beatTimes[0];
  if (quantity >= minimumTaps) {
    const period = y / x;
    return period;
  }
  return -1;
};
const tapTempo = (autoReset = true, timeOut = TAP_TIMEOUT, minimumTaps = MINIMUM_TEMPOS) => {
  let beatTimes2 = [];
  let xSum = 0;
  let xxSum = 0;
  let ySum = 0;
  let xySum = 0;
  let aPrev = NaN;
  return () => {
    let period = -1;
    const now = Date.now();
    const previous = beatTimes2[beatTimes2.length - 1];
    const deviation = now - previous;
    if (deviation > timeOut) {
      beatTimes2 = [];
      aPrev = NaN;
      xSum = 0;
      xxSum = 0;
      ySum = 0;
      xySum = 0;
    }
    beatTimes2.push(now);
    const samples = beatTimes2.length;
    const x = samples - 1;
    const timeInMillSeconds = beatTimes2[samples - 1] - beatTimes2[0];
    const timeInSeconds = timeInMillSeconds / 1e3;
    xSum += x;
    xxSum += x * x;
    ySum += timeInMillSeconds;
    xySum += x * timeInMillSeconds;
    const tempo = 6e4 * x / timeInMillSeconds;
    const alter = samples < 8 || tempo < 190;
    const bar = alter ? Math.floor(x / 4) : Math.floor(x / 8);
    const beat = alter ? x % 4 : Math.floor(x / 2) % 4 + "." + x % 2 * 5;
    if (samples >= 2) {
      period = timeInMillSeconds / x;
      const xx = samples * xxSum - xSum * xSum;
      const slope = (samples * xySum - xSum * ySum) / xx;
      aPrev = slope;
    }
    const accuratePeriod = aPrev || period;
    const bpm = 6e4 / accuratePeriod;
    return {
      available: samples > 1,
      bar,
      period,
      accuratePeriod,
      beat,
      samples,
      timeInSeconds,
      tempo,
      bpm,
      // now, previous, 
      deviation
    };
  };
};
const SECONDS_PER_MINUTE = 60;
const MICROSECONDS_PER_MINUTE = SECONDS_PER_MINUTE * 1e3;
const Ticks = {
  /** How many ticks pass in "1 whole note" or 4x1/4th notes in a 4/4th beat, independent of tempo. */
  SemiBreve: 15360,
  /** How many ticks pass in 1 quarter note in a 4/4th bar, independent of tempo. */
  Beat: 3840,
  /** How many ticks pass in 1/16th note in a 4/4th bar, independent of tempo. */
  SemiQuaver: 960
};
const convertBPMToPeriod = (bpm) => MICROSECONDS_PER_MINUTE / parseFloat(String(bpm));
const convertPeriodToBPM = (period) => MICROSECONDS_PER_MINUTE / parseFloat(String(period));
const convertMIDIClockIntervalToBPM = (millisecondsPerClockEvent, pulsesPerQuarterNote = 24) => {
  const millisecondsPerQuarterNote = millisecondsPerClockEvent * pulsesPerQuarterNote;
  return convertPeriodToBPM(millisecondsPerQuarterNote);
};
const secondsToTicks = (seconds, bpm, resolution = Ticks.Beat) => {
  const quarterNoteDurationSeconds = SECONDS_PER_MINUTE / bpm;
  const ticksPerSecond = resolution / quarterNoteDurationSeconds;
  return seconds * ticksPerSecond;
};
const timestampCache = /* @__PURE__ */ new Map();
const formatTimeStampFromSeconds = (seconds) => {
  if (timestampCache.has(seconds)) {
    return timestampCache.get(seconds);
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainingSeconds = seconds % 60;
  const milliseconds = (remainingSeconds % 1).toFixed(2).slice(2);
  const string = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(Math.floor(remainingSeconds)).padStart(2, "0")}:${String(milliseconds).padStart(2, "0")}`;
  timestampCache.set(seconds, string);
  return string;
};
const UNIX_EPOCH = 0;
class Epoch {
  constructor() {
    this.referenceEpoch = UNIX_EPOCH;
  }
  /**
   * Get the singleton instance of Epoch
   */
  static getInstance() {
    if (!Epoch.instance) {
      Epoch.instance = new Epoch();
    }
    return Epoch.instance;
  }
  /**
   * Get the current absolute time in milliseconds since UNIX epoch
   */
  getCurrentTime() {
    return Date.now();
  }
  /**
   * Get elapsed time since the UNIX epoch reference point
   */
  getElapsedTime() {
    return Date.now() - this.referenceEpoch;
  }
  /**
   * Calculate the offset to the next tick on the global metronome grid
   * 
   * All metronomes use this to find when their next tick should occur,
   * ensuring they all tick at the same absolute moments in time.
   * 
   * @param tickDuration - Duration of each tick in milliseconds
   * @returns Time offset in ms until the next global tick
   */
  getNextTickOffset(tickDuration) {
    if (tickDuration <= 0) {
      return 0;
    }
    const elapsedTime = this.getElapsedTime();
    const positionInCycle = elapsedTime % tickDuration;
    const offsetToNextTick = tickDuration - positionInCycle;
    return offsetToNextTick === tickDuration ? 0 : offsetToNextTick;
  }
  /**
   * Get the reference epoch timestamp
   */
  getReferenceEpoch() {
    return this.referenceEpoch;
  }
  /**
   * Set the reference epoch (default is UNIX_EPOCH)
   */
  setReferenceEpoch(epochTime) {
    this.referenceEpoch = epochTime;
  }
  /**
   * Synchronize a metronome by returning the delay before its first tick
   * 
   * @param tickDuration - Duration of each tick in milliseconds
   * @returns Delay in ms before first tick should occur
   */
  synchronizeMetronome(tickDuration) {
    return this.getNextTickOffset(tickDuration);
  }
  /**
   * Calculate the absolute time of the next tick on the global grid
   * 
   * @param tickDuration - Duration of each tick in milliseconds
   * @returns Absolute Unix timestamp of the next tick
   */
  getNextTickTime(tickDuration) {
    return this.getCurrentTime() + this.getNextTickOffset(tickDuration);
  }
  /**
   * Get the tick number at a given time on the global grid
   * 
   * @param tickDuration - Duration of each tick in milliseconds
   * @param atTime - Optional time to check (defaults to current time)
   * @returns The tick number
   */
  getTickNumber(tickDuration, atTime) {
    const time = atTime ?? this.getCurrentTime();
    return Math.floor((time - this.referenceEpoch) / tickDuration);
  }
}
const TIMER_TYPE_AUDIO_CONTEXT = "audio-context";
const TIMER_TYPE_AUDIO_WORKLET = "audio-worklet";
const TIMER_TYPE_ROLLING = "rolling";
const TIMER_TYPE_SET_INTERVAL = "set-interval";
const TIMER_TYPE_SET_TIMEOUT = "set-timeout";
const TIMER_TYPES = {
  AUDIO_CONTEXT: TIMER_TYPE_AUDIO_CONTEXT,
  AUDIO_WORKLET: TIMER_TYPE_AUDIO_WORKLET,
  ROLLING: TIMER_TYPE_ROLLING,
  SET_INTERVAL: TIMER_TYPE_SET_INTERVAL,
  SET_TIMEOUT: TIMER_TYPE_SET_TIMEOUT
};
const isValidTimerType = (type) => {
  return type === TIMER_TYPE_AUDIO_CONTEXT || type === TIMER_TYPE_AUDIO_WORKLET || type === TIMER_TYPE_ROLLING || type === TIMER_TYPE_SET_INTERVAL || type === TIMER_TYPE_SET_TIMEOUT;
};
const getTimerTypeDescription = (type) => {
  const descriptions = {
    [TIMER_TYPE_AUDIO_CONTEXT]: "Audio Context Worker",
    [TIMER_TYPE_AUDIO_WORKLET]: "Audio Worklet",
    [TIMER_TYPE_ROLLING]: "Rolling Worker",
    [TIMER_TYPE_SET_INTERVAL]: "SetInterval Worker",
    [TIMER_TYPE_SET_TIMEOUT]: "SetTimeout Worker"
  };
  return descriptions[type];
};
const DEFAULT_TIMER_OPTIONS = {
  accurate: false,
  bars: 16,
  // keep this at 24 to match MIDI1.0 spec
  // where there are 24 ticks per quarternote (one beat)
  divisions: 24,
  bpm: 90,
  contexts: null,
  // Use audio-worklet by default (doesn't need external worker file)
  type: TIMER_TYPE_AUDIO_WORKLET,
  callback: null,
  synch: true
};
const createWorker = (workerPath) => {
  if (typeof window === "undefined") return null;
  return new Worker(workerPath, { type: "module" });
};
const AudioContextWorkerWrapper = null;
const RollingTimeWorkerWrapper = null;
const SetIntervalWorkerWrapper = null;
const SetTimeoutWorkerWrapper = null;
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
const MAX_BARS_ALLOWED = 32;
const resolveTimerType = (timerType) => {
  if (!isValidTimerType(timerType)) {
    return null;
  }
  switch (timerType) {
    case TIMER_TYPE_AUDIO_CONTEXT:
      return AudioContextWorkerWrapper;
    case TIMER_TYPE_ROLLING:
      return RollingTimeWorkerWrapper;
    case TIMER_TYPE_SET_INTERVAL:
      return SetIntervalWorkerWrapper;
    case TIMER_TYPE_SET_TIMEOUT:
      return SetTimeoutWorkerWrapper;
    case TIMER_TYPE_AUDIO_WORKLET:
      return null;
    default:
      return null;
  }
};
class Timer {
  constructor(options = DEFAULT_TIMER_OPTIONS, isWorklet = true) {
    __privateAdd(this, _running);
    __privateAdd(this, _active);
    __privateAdd(this, _bypassed);
    __privateAdd(this, _options);
    __privateAdd(this, _epoch);
    __privateAdd(this, _synchronizationOffset);
    this.startTime = -1;
    this.period = 100;
    this.currentBar = 0;
    this.divisions = 24;
    this.bars = 16;
    this.swingOffset = 0;
    this.divisionsElapsed = 0;
    this.totalBarsElapsed = 0;
    this.lastRecordedTime = 0;
    this.lastRecordedExternalTime = 0;
    __privateSet(this, _running, false);
    __privateSet(this, _active, false);
    __privateSet(this, _bypassed, false);
    this.isCompatible = false;
    this.timingWorkHandler = null;
    __privateSet(this, _epoch, Epoch.getInstance());
    __privateSet(this, _synchronizationOffset, 0);
    this.getNow = () => performance.timeOrigin + performance.now();
    this.onAvailable = () => {
    };
    this.onUnavailable = () => {
    };
    this.loaded = Promise.resolve();
    options = { ...DEFAULT_TIMER_OPTIONS, ...options };
    __privateSet(this, _options, options);
    const optionKeys = Object.keys(options);
    for (let key of optionKeys) {
      switch (key) {
        case "audioContext":
          this.audioContext = options.audioContext;
          this.getNow = () => this.audioContext.currentTime * 1e3;
          break;
        case "contexts":
          if (options.contexts) {
            for (let context in options.contexts) {
              this[context] = options.contexts[context];
            }
          }
          this.getNow = () => this.audioContext ? this.audioContext.currentTime * 1e3 : performance.now();
          break;
        default:
          this[key] = options[key];
      }
    }
    const typeStr = typeof options.type === "string" ? options.type : "";
    if (isWorklet) {
      this.loaded = this.setTimingWorklet(
        typeStr,
        options.processor || "",
        this.audioContext
      );
    } else {
      this.loaded = this.setTimingWorker(options.type || "");
    }
  }
  get options() {
    return __privateGet(this, _options);
  }
  /**
   * Can we use this timing method on this device?
   * @returns boolean is the worker available and compatable
   */
  get isRunning() {
    return __privateGet(this, _running);
  }
  get running() {
    return __privateGet(this, _running);
  }
  /**
   * Can we use this timing method on this device?
   * @returns boolean is the worker available and compatable
   */
  get available() {
    return this.isCompatible;
  }
  get isBypassed() {
    return __privateGet(this, _bypassed);
  }
  /**
   * 
   */
  get isActive() {
    return __privateGet(this, _active);
  }
  /**
   * Accurate time in milliseconds
   * @returns number The current time as of now
   */
  get now() {
    return this.getNow();
  }
  /**
   * Fetch current bar length in milliseconds
   * @returns number bar length in milliseconds
   */
  get timeBetween() {
    return this.period;
  }
  /**
   * Amount of time elapsed since startTimer() in seconds
   * @returns number in seconds
   */
  get timeElapsed() {
    return this.now - this.startTime;
  }
  /**
   * Fetch whole loop length in milliseconds
   * @returns number length in milliseconds
   */
  get totalTime() {
    return this.timePerBar * this.bars;
  }
  /**
   * Fetch current bar
   * @returns number current bar
   */
  get bar() {
    return this.currentBar;
  }
  /**
   * Fetch total bars completed
   * @returns number total bars
   */
  get barsElapsed() {
    return Math.floor(this.totalBarsElapsed / this.bars);
  }
  get elapsedSinceLastTick() {
    return this.now - this.lastRecordedTime;
  }
  /**
   * Fetch total bar quantity
   * @returns number total bars
   */
  get totalBars() {
    return this.bars;
  }
  get totalDivisions() {
    return this.divisions;
  }
  /**
   * Percentage duration of bar progress 0->1
   * @returns number percentage elapsed
   */
  get barProgress() {
    return this.currentBar / this.bars;
  }
  /**
   * Percentage duration of beat progress 0->1
   * @returns number percentage elapsed
   */
  get beatProgress() {
    return this.divisionsElapsed / this.totalDivisions;
  }
  // Bar times
  /**
   * Fetch current bar length in milliseconds
   * @returns number bar length in milliseconds
   */
  get timePerBar() {
    return this.period * this.divisions;
  }
  /**
   * Get the current timing as Beats per minute
   * BPM = 60,000,000 / MicroTempo
   * @returns number BPM
   */
  get BPM() {
    return MICROSECONDS_PER_MINUTE / this.timePerBar;
  }
  get bpm() {
    return this.BPM;
  }
  /**
   * Get the duration of one beat (quarternote) 
   * in microseconds
   * @returns number Microtempo
   */
  get quarterNoteDuration() {
    return MICROSECONDS_PER_MINUTE / this.bpm;
  }
  /**
   * Get the duration of one beat (quarternote) 
   * in seconds
   * @returns number duration in seconds
   */
  get quarterNoteDurationInSeconds() {
    return SECONDS_PER_MINUTE / this.bpm;
  }
  /**
   * Get the current timing as a Microtempo 
   * @returns number Microtempo
   */
  get microTempo() {
    return this.timePerBar * 1e-3;
  }
  /**
   * Get the current timing in Micros per MIDI clock
   * MicrosPerMIDIClock = MicroTempo / 24 (MIDI 1.0 has 24 divisions)
   * @returns number Micros per MIDI clock
   */
  get microsPerMIDIClock() {
    return this.microTempo / this.divisions;
  }
  /**
   * How many Ticks are there every second?
   * @returns number ticks per second
   */
  get ticksPerSecond() {
    return Ticks.Beat / this.quarterNoteDurationInSeconds;
  }
  get swing() {
    return this.swingOffset / this.divisions;
  }
  // Positions & booleans
  get isAtStart() {
    return this.divisionsElapsed === 0;
  }
  get isAtStartOfBar() {
    return this.barProgress === 0;
  }
  get isStartBar() {
    return this.currentBar === 0;
  }
  get isAtMiddleOfBar() {
    return this.barProgress === 0.5;
  }
  get isQuarterNote() {
    return this.beatProgress % 0.25 === 0;
  }
  get isHalfNote() {
    return this.beatProgress % 0.5 === 0;
  }
  get isSwungBeat() {
    return this.divisionsElapsed % this.swingOffset === 0;
  }
  get isUsingExternalTrigger() {
    return __privateGet(this, _bypassed);
  }
  // Setters ------------------------------------------------------
  /**
   * Fetch current bar
   * @param value bar number
   */
  set bar(value) {
    this.currentBar = parseInt(String(value));
  }
  /**
   * Allows a user to set the total number of bars
   * @param value How many bars to have in a measure
   */
  set totalBars(value) {
    this.bars = value < 1 ? 1 : value > MAX_BARS_ALLOWED ? MAX_BARS_ALLOWED : value;
  }
  /**
   * Set the current timing using a BPM where 
   * one beat in milliseconds =  60,000 / BPM
   * 
   * @param value Beats per minute
   */
  set BPM(value) {
    this.timeBetween = 6e4 / Math.max(10, parseFloat(String(value)));
  }
  set bpm(value) {
    this.BPM = value;
  }
  set tempo(value) {
    this.BPM = value;
  }
  /**
   * Using a time in milliseconds, set the amount of time between tick and tock
   * @param time Amount of millieconds between ticks
   */
  set timeBetween(time) {
    const interval = time / this.divisions;
    this.period = interval;
    this.postMessage({
      command: CMD_UPDATE,
      interval,
      time: this.now
    });
  }
  /**
   * Passed in the onBeat callback as a variant
   * to determine when the "beat" should occur
   */
  set swing(value) {
    this.swingOffset = value * this.divisions;
  }
  /**
   * Set the function that gets called on every divixional tick
   * @param callback Method to call when the timer ticks
   */
  setCallback(callback) {
    this.callback = callback;
  }
  /**
   * Allows us to disable the existing route to send our own
   * or to inject them into here 
   * 
   * @param useExternalClock whether to use external clock
   * @returns trigger function
   */
  bypass(useExternalClock = true) {
    const trigger = () => {
      this.externalTrigger();
    };
    if (useExternalClock) {
      if (__privateGet(this, _bypassed)) {
        return trigger;
      }
      __privateSet(this, _bypassed, true);
      if (__privateGet(this, _running)) {
        this.disconnectWorker(this.timingWorkHandler, false);
      }
    } else {
      if (!__privateGet(this, _bypassed)) {
        return trigger;
      }
      __privateSet(this, _bypassed, false);
      if (__privateGet(this, _running)) {
        this.startTimer();
      }
    }
    return trigger;
  }
  // CONVERSIONS --------------------------------------------------------------------------------
  /**
   * Convert seconds to MIDI clock ticks based on current BPM
   * @param seconds Time in seconds
   * @returns Number of MIDI clock ticks (24 ticks per quarter note)
   */
  secondsToTicks(seconds) {
    return seconds * this.ticksPerSecond;
  }
  /**
   * Convert time to ticks using the current tick per second rate
   * @param time in seconds
   * @returns number of ticks
   */
  convertToTicks(time) {
    return time / this.ticksPerSecond;
  }
  createTick(intervals, timePased) {
    const timeBetweenPeriod = this.timeBetween * 1e-3;
    const expected = intervals * timeBetweenPeriod;
    const timePassed = timePased;
    const lag = timePassed % timeBetweenPeriod;
    const drift = timePassed - this.timeElapsed;
    const level = Math.floor(timePassed / this.timeBetween);
    if (__privateGet(this, _running)) {
      this.onTick(timePassed, expected, drift, level, intervals, lag);
    }
  }
  // WORKLET ------------------------------------------------------------------------------------
  /**
   * Set the worklet as the main timing mechanism
   * @param type URL or identifier
   * @param processor processor name
   * @param audioContext audio context
   * @returns the worklet node
   */
  async setTimingWorklet(type, processor, audioContext) {
    let wasRunning = __privateGet(this, _running);
    if (this.timingWorkHandler) {
      await this.unsetTimingWorker();
    }
    try {
      if (isValidTimerType(type) && type !== TIMER_TYPE_AUDIO_WORKLET) {
        const workerClass = resolveTimerType(type);
        if (workerClass) {
          return await this.setTimingWorker(workerClass);
        }
      }
      if (!audioContext) {
        throw new Error("AudioContext is required for AudioWorklet");
      }
      this.timingWorkHandler = await createTimingWorklet(audioContext);
      this.isCompatible = true;
      if (wasRunning) {
        await this.startTimer(this.callback);
      }
      return this.timingWorkHandler;
    } catch (error) {
      this.isCompatible = false;
      throw error;
    }
  }
  // WORKER ------------------------------------------------------------------------------------
  /**
   * Load in the Worker URI
   * @param type URL or identifier
   * @returns the worker instance
   */
  async loadTimingWorker(type) {
    if (typeof Worker === "undefined") {
      throw new Error("Worker is not available in this environment");
    }
    try {
      if (typeof type === "function") {
        return type();
      } else if (typeof type === "string") {
        let workerUrl = type;
        if (!workerUrl.startsWith("http") && !workerUrl.startsWith("blob:")) {
          const baseUrl = `${window.location.origin}${"./"}`;
          workerUrl = new URL(type, baseUrl).href;
        }
        return new Worker(workerUrl, { type: "module" });
      } else {
        throw new Error(`Invalid worker type: expected function or string, got ${typeof type}`);
      }
    } catch (error) {
      throw error;
    }
  }
  /**
   * In the future, we may be able to pass offlineAudioContext to a worker
   * and at that point, we can finally tie in the actual timing by using the 
   * context as the global clock!
   * NB. We NOW CAN! User the setTimingWorklet instead :)
   * @param type URL, identifier, or timer type string constant
   * @returns the worker instance or null if failed
   */
  async setTimingWorker(type) {
    try {
      let wasRunning = __privateGet(this, _running);
      if (this.timingWorkHandler) {
        await this.unsetTimingWorker();
      }
      let workerType = type;
      if (typeof type === "string" && isValidTimerType(type)) {
        const resolved = resolveTimerType(type);
        if (resolved) {
          workerType = resolved;
        }
      }
      this.timingWorkHandler = await this.loadTimingWorker(workerType);
      if (!this.timingWorkHandler) {
        throw Error("Timing Worker failed to load url: type:" + type);
      }
      if (wasRunning) {
        await this.startTimer(this.callback);
      } else {
      }
      return this.timingWorkHandler;
    } catch (error) {
      this.isCompatible = false;
    }
    return null;
  }
  /**
   * Unregister any Worker set
   * @returns boolean success
   */
  async unsetTimingWorker() {
    await this.stopTimer();
    const handler = this.timingWorkHandler;
    if (handler) {
      if ("terminate" in handler) {
        handler.terminate();
      }
      handler.onmessage = null;
      handler.onerror = null;
    }
    this.timingWorkHandler = null;
    return true;
  }
  /**
   * Switch to a different timing worker/worklet type
   * Safely handles switching even if the timer is currently running
   * @param timerType Timer type string constant (e.g., TIMER_TYPE_AUDIO_CONTEXT)
   * @param audioContext Optional AudioContext for worklet types
   * @returns Success status
   * @throws Error if the timer type is invalid or switching fails
   */
  async switchTimerType(timerType, audioContext) {
    try {
      if (!isValidTimerType(timerType)) {
        throw new Error(`Invalid timer type: ${timerType}. Must be one of: ${Object.values(TIMER_TYPES).join(", ")}`);
      }
      const wasRunning = __privateGet(this, _running);
      if (wasRunning) {
        await this.stopTimer();
      }
      if (timerType === TIMER_TYPE_AUDIO_WORKLET) {
        if (!audioContext) {
          throw new Error("AudioContext is required when switching to audio-worklet timer type");
        }
        await this.setTimingWorklet(timerType, "", audioContext);
      } else {
        await this.setTimingWorker(timerType);
      }
      if (wasRunning) {
        await this.startTimer();
      } else {
      }
      return true;
    } catch (error) {
      this.isCompatible = false;
      throw error;
    }
  }
  // SHARED WORKER / WORKLET CDE ------------------------------------------------------------------------------------
  /**
   * Add a worker or worklet into the pipeline
   * and monitor it's events and messages
   * @param worker the worker instance
   */
  connectWorker(worker) {
    if (!worker) {
      throw new Error("Timing Worker was not defined - please check paths " + worker);
    }
    worker.onmessage = (e) => {
      const time = this.now;
      const data = e.data;
      switch (data.event) {
        case EVENT_READY:
          break;
        case EVENT_STARTING:
          this.startTime = time;
          __privateSet(this, _running, true);
          this.resetTimer();
          break;
        case EVENT_TICK:
          this.createTick(data.intervals, data.time);
          break;
      }
    };
    worker.onerror = (event) => {
      const errorMsg = event.message || event.filename || "Unknown error";
      const errorDetails = {
        error: errorMsg,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        time: this.now
      };
      if (worker) {
        worker.postMessage(errorDetails);
      }
    };
  }
  postMessage(payload) {
    this.timingWorkHandler && this.timingWorkHandler.postMessage(payload);
  }
  /**
   * Disconnect the worker from the timer
   * @param worker the worker to disconnect
   * @param setStopped whether to set isRunning to false
   */
  disconnectWorker(worker, setStopped = true) {
    if (!worker) return;
    worker.onmessage = (e) => {
      const data = e.data;
      switch (data.event) {
        // Clean up
        case EVENT_STOPPING:
          if (setStopped) {
            __privateSet(this, _running, false);
          }
          break;
      }
    };
    worker.postMessage({
      command: CMD_STOP,
      time: this.now
    });
  }
  //--------------------------------------------------
  /**
   * Reset the timer and start from the beginning
   */
  resetTimer() {
    this.currentBar = 0;
    this.totalBarsElapsed = 0;
    this.divisionsElapsed = 0;
  }
  async start(callback) {
    return this.startTimer(callback ?? this.callback);
  }
  async stop() {
    return this.stopTimer();
  }
  async toggle() {
    return this.toggleTimer(this.callback);
  }
  /**
   * Starts the timer and begins events being dispatched
   * 
   * @param callback optional callback to call on each tick
   * @param options optional options
   * @returns object with current time and worker/worklet
   */
  async startTimer(callback, options = {}) {
    if (options) {
      __privateSet(this, _options, { ...options, ...__privateGet(this, _options) });
    }
    await this.loaded;
    const currentTime = this.now;
    if (!__privateGet(this, _running)) {
      this.totalBarsElapsed = 0;
    }
    if (callback) {
      this.setCallback(callback);
    }
    if (__privateGet(this, _options).synch) {
      __privateSet(this, _synchronizationOffset, __privateGet(this, _epoch).synchronizeMetronome(this.period));
    }
    if (__privateGet(this, _bypassed)) {
      __privateSet(this, _running, true);
      return {
        time: currentTime,
        interval: -1,
        worker: null
      };
    }
    this.connectWorker(this.timingWorkHandler);
    const payload = {
      command: CMD_START,
      time: currentTime,
      interval: this.period,
      accurateTiming: this.options.accurate,
      synchronizationOffset: __privateGet(this, _synchronizationOffset)
    };
    this.postMessage(payload);
    return {
      time: currentTime,
      interval: this.period,
      worker: this.timingWorkHandler
    };
  }
  /**
   * Stops the timer and prevents events being dispatched
   * @returns object with current time and worker/worklet
   */
  async stopTimer() {
    await this.loaded;
    const currentTime = this.now;
    this.disconnectWorker(this.timingWorkHandler);
    return {
      currentTime,
      worker: this.timingWorkHandler
    };
  }
  /**
   * Start the timer if it is paused...
   * or stop the timer if it is running
   * 
   * @param callback optional callback to call on each tick
   * @param options optional options
   * @returns boolean indicating if timer is running
   */
  async toggleTimer(callback, options = {}) {
    if (__privateGet(this, _bypassed)) {
      return __privateGet(this, _running);
    }
    if (!__privateGet(this, _running)) {
      await this.startTimer(callback, options);
    } else {
      await this.stopTimer();
    }
    return __privateGet(this, _running);
  }
  /**
   * Tap a tempo into the system
   * requires 3 taps to set the tempo
   * @returns the detected tempo in BPM, or -1 if not enough taps
   */
  tapTempo() {
    const tempo = tapTempoQuick();
    if (tempo > -1) {
      this.BPM = tempo;
      return tempo;
    }
    return -1;
  }
  /**
   * Get the current synchronization offset
   * @returns the offset in milliseconds to the next global tick
   */
  getSynchronizationOffset() {
    return __privateGet(this, _synchronizationOffset);
  }
  /**
   * Get the current tick number on the global metronome grid
   * @returns the tick number
   */
  getGlobalTickNumber() {
    return __privateGet(this, _epoch).getTickNumber(this.period);
  }
  /**
   * Enable or disable synchronization for this timer
   * @param enabled whether synchronization should be enabled
   */
  setSynchronized(enabled) {
    __privateGet(this, _options).synch = enabled;
  }
  /**
   * Check if this timer is synch to the global grid
   * @returns whether synchronization is enabled
   */
  isSynchronized() {
    return __privateGet(this, _options).synch ?? true;
  }
  /**
   * Use an external device to send clock signals to and through this timer
   * such as the MIDI clock signal
   * @param advance whether to advance the divisions counter
   */
  externalTrigger(advance = true) {
    const timestamp = this.now;
    this.lastRecordedExternalTime = timestamp;
    const elapsedSinceLastClock = timestamp - this.lastRecordedExternalTime;
    const expected = this.divisionsElapsed * elapsedSinceLastClock;
    const lag = timestamp % elapsedSinceLastClock;
    const drift = timestamp - expected;
    const level = Math.floor(timestamp / elapsedSinceLastClock);
    if (__privateGet(this, _running) && __privateGet(this, _bypassed)) {
      this.onTick(elapsedSinceLastClock, expected, drift, level, this.divisionsElapsed, lag);
    }
    if (advance) {
      this.divisionsElapsed++;
    }
  }
  /**
   * Repeat previous clock tick but do not advance
   */
  retrigger() {
    this.externalTrigger(false);
  }
  /**
   * Occurs 24 times per beat
   * Call the callback with internal flags
   * @param timePassed time passed since start
   * @param expected expected time
   * @param drift timing drift
   * @param level timing level
   * @param intervals number of intervals
   * @param lag timing lag
   */
  onTick(timePassed, expected, drift = 0, level = 0, intervals = 0, lag = 0) {
    this.lastRecordedTime = timePassed;
    if (++this.divisionsElapsed >= this.divisions) {
      ++this.totalBarsElapsed;
      this.currentBar = (this.currentBar + 1) % this.bars;
      this.divisionsElapsed = 0;
    }
    this.divisionsElapsed % this.swingOffset === 0;
    this.callback && this.callback({
      bar: this.currentBar,
      bars: this.totalBars,
      divisionsElapsed: this.divisionsElapsed,
      barsElapsed: this.barsElapsed,
      elapsed: this.timeElapsed,
      //performance
      timePassed,
      expected,
      drift,
      level,
      intervals,
      lag
    });
  }
}
_running = new WeakMap();
_active = new WeakMap();
_bypassed = new WeakMap();
_options = new WeakMap();
_epoch = new WeakMap();
_synchronizationOffset = new WeakMap();
let globalTimer = null;
function startTimer(callback, interval = 1e3, options = {}) {
  if (globalTimer && options.type && globalTimer.timingWorkHandler) {
    globalTimer.stopTimer();
    globalTimer = null;
  }
  if (!globalTimer) {
    globalTimer = new Timer({
      ...options,
      callback
    });
  }
  globalTimer.setCallback(callback);
  globalTimer.BPM = 6e4 / interval;
  globalTimer.start();
  return {
    timer: globalTimer
  };
}
function stopTimer() {
  if (globalTimer) {
    globalTimer.stop();
    return {
      timer: globalTimer
    };
  }
  return { timer: null };
}
function setTimeBetween(interval) {
  if (globalTimer) {
    globalTimer.BPM = 6e4 / interval;
  }
}
function resetTimer() {
  if (globalTimer) {
    globalTimer.resetTimer();
  }
}
function getTimer() {
  return globalTimer;
}
function createTimer(options = {}) {
  return new Timer(options);
}
const DEFAULT_AUDIO_TIMER_OPTIONS = {
  // keep this at 24 to match MIDI1.0 spec
  // where there are 24 ticks per quarternote
  divisions: 24
};
class AudioTimer extends Timer {
  // NB. do *NOT* enable the following line as it will overwrite the var on super()
  // audioContext
  /**
   * Accurate time in milliseconds
   * @returns {Number} The current time as of now
   */
  get now() {
    return this.audioContext ? this.audioContext.currentTime : performance.now();
  }
  /**
   * Create an AudioTimer with an AudioContext
   * Uses AudioWorklet timing if available, falls back to AudioContext worker
   * @param audioContext The AudioContext to use for accurate timing
   * @param useAudioWorklet If true, attempts to use AudioWorklet (recommended). If false, uses AudioContext worker.
   */
  constructor(audioContext, useAudioWorklet = true) {
    const timerOptions = {
      audioContext,
      ...DEFAULT_AUDIO_TIMER_OPTIONS,
      // Use the string type constant - Timer base class handles async initialization
      type: useAudioWorklet ? TIMER_TYPE_AUDIO_WORKLET : TIMER_TYPE_AUDIO_CONTEXT
    };
    super(timerOptions, useAudioWorklet);
    if (!this.audioContext) {
      throw Error("No AudioContext specified");
    }
  }
  /**
   * 
   * @param {Function} callback 
   * @param {*} options 
   */
  async startTimer(callback, options = {}) {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    return await super.startTimer(callback, options);
  }
}
export {
  AudioContextWorkerWrapper,
  AudioTimer,
  CMD_ADJUST_DRIFT,
  CMD_INITIALISE,
  CMD_START,
  CMD_STOP,
  CMD_UPDATE,
  DEFAULT_TIMER_OPTIONS,
  EVENT_READY,
  EVENT_STARTING,
  EVENT_STOPPING,
  EVENT_TICK,
  MICROSECONDS_PER_MINUTE,
  RollingTimeWorkerWrapper,
  SECONDS_PER_MINUTE,
  SetIntervalWorkerWrapper,
  SetTimeoutWorkerWrapper,
  TIMER_TYPES,
  TIMER_TYPE_AUDIO_CONTEXT,
  TIMER_TYPE_AUDIO_WORKLET,
  TIMER_TYPE_ROLLING,
  TIMER_TYPE_SET_INTERVAL,
  TIMER_TYPE_SET_TIMEOUT,
  Ticks,
  Timer,
  convertBPMToPeriod,
  convertMIDIClockIntervalToBPM,
  convertPeriodToBPM,
  createTimer,
  createWorker,
  formatTimeStampFromSeconds,
  getTimer,
  getTimerTypeDescription,
  isValidTimerType,
  resetTimer,
  secondsToTicks,
  setTimeBetween,
  startTimer,
  stopTimer,
  tapTempo,
  tapTempoQuick
};
//# sourceMappingURL=index.js.map
