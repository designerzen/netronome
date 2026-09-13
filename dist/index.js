import { a as CMD_INITIALISE, c as CMD_UPDATE, d as EVENT_STOPPING, f as EVENT_TICK, i as CMD_ADJUST_DRIFT, l as EVENT_READY, n as _classPrivateFieldGet2, o as CMD_START, r as _classPrivateFieldInitSpec, s as CMD_STOP, t as _classPrivateFieldSet2, u as EVENT_STARTING } from "./classPrivateFieldSet2.js";
//#region src/tap-tempo.ts
/**
* TODO: Implement lienar regression like nayuki
* https://www.nayuki.io/page/tap-to-measure-tempo-javascript
* Converts a series of method calls into a tempo estimate.
* @param {Boolean} autoReset Start a new estimation session if timeout reached
* @param {Number} timeOut Time frame before ignoring the event and starting a fresh estimation session
* @param {Number} minimumTaps Requires at least x taps before estimate set
* @returns {Number} New Period
*/
var beatTimes = [];
var TAP_TIMEOUT = 1e4;
var MINIMUM_TEMPOS = 2;
var tapTempoQuick = (autoReset = true, timeOut = TAP_TIMEOUT, minimumTaps = MINIMUM_TEMPOS) => {
	const currentTime = performance ? performance.now() : Date.now();
	const previousTime = beatTimes[beatTimes.length - 1];
	if (beatTimes.length > 0 && previousTime !== void 0 && currentTime <= previousTime) beatTimes = [];
	if (autoReset && beatTimes.length > 0 && currentTime - beatTimes[beatTimes.length - 1] > timeOut) beatTimes = [];
	beatTimes.push(currentTime);
	const quantity = beatTimes.length;
	const x = quantity - 1;
	const y = beatTimes[x] - beatTimes[0];
	if (quantity >= minimumTaps) return y / x;
	return -1;
};
var tapTempo = (autoReset = true, timeOut = TAP_TIMEOUT, minimumTaps = MINIMUM_TEMPOS) => {
	let beatTimes = [];
	let xSum = 0;
	let xxSum = 0;
	let ySum = 0;
	let yySum = 0;
	let xySum = 0;
	let periodPrev = NaN;
	let aPrev = NaN;
	let bPrev = NaN;
	return () => {
		let period = -1;
		const now = Date.now();
		const deviation = now - beatTimes[beatTimes.length - 1];
		if (deviation > timeOut) {
			beatTimes = [];
			periodPrev = NaN;
			aPrev = NaN;
			bPrev = NaN;
			xSum = 0;
			xxSum = 0;
			ySum = 0;
			yySum = 0;
			xySum = 0;
		}
		beatTimes.push(now);
		const samples = beatTimes.length;
		const x = samples - 1;
		const timeInMillSeconds = beatTimes[samples - 1] - beatTimes[0];
		const timeInSeconds = timeInMillSeconds / 1e3;
		xSum += x;
		xxSum += x * x;
		ySum += timeInMillSeconds;
		yySum += timeInMillSeconds * timeInMillSeconds;
		xySum += x * timeInMillSeconds;
		const tempo = 6e4 * x / timeInMillSeconds;
		const alter = samples < 8 || tempo < 190;
		const bar = alter ? Math.floor(x / 4) : Math.floor(x / 8);
		const beat = alter ? x % 4 : Math.floor(x / 2) % 4 + "." + x % 2 * 5;
		if (samples >= 2) {
			period = timeInMillSeconds / x;
			const xx = samples * xxSum - xSum * xSum;
			const slope = (samples * xySum - xSum * ySum) / xx;
			const intercept = (ySum * xxSum - xSum * xySum) / xx;
			if (samples >= minimumTaps) {
				periodPrev * x - timeInMillSeconds;
				aPrev * x + bPrev - timeInMillSeconds;
			}
			periodPrev = period;
			aPrev = slope;
			bPrev = intercept;
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
			deviation
		};
	};
};
//#endregion
//#region src/time-utils.ts
var SECONDS_PER_MINUTE = 60;
var MICROSECONDS_PER_MINUTE = 60 * 1e3;
var Ticks = {
	/** How many ticks pass in "1 whole note" or 4x1/4th notes in a 4/4th beat, independent of tempo. */
	SemiBreve: 15360,
	/** How many ticks pass in 1 quarter note in a 4/4th bar, independent of tempo. */
	Beat: 3840,
	/** How many ticks pass in 1/16th note in a 4/4th bar, independent of tempo. */
	SemiQuaver: 960
};
/**
* Convert a BPM to a period in ms
* @param {Number|String} bpm beats per minute
* @returns {Number} time in milliseconds
*/
var convertBPMToPeriod = (bpm) => MICROSECONDS_PER_MINUTE / parseFloat(String(bpm));
/**
* Convert a period in ms to a BPM
* @param {Number|String} period millisecods
* @returns {Number} time in milliseconds
*/
var convertPeriodToBPM = (period) => MICROSECONDS_PER_MINUTE / parseFloat(String(period));
/**
* Convert a midi clock to BPM
* @param {Number} millisecondsPerClockEvent 
* @param {Number} pulsesPerQuarterNote  MIDI clock sends 24 pulses per quarter note (PPQN)
* @returns Number
*/
var convertMIDIClockIntervalToBPM = (millisecondsPerClockEvent, pulsesPerQuarterNote = 24) => {
	return convertPeriodToBPM(millisecondsPerClockEvent * pulsesPerQuarterNote);
};
/**
* Converts seconds to ticks at a given bpm.
* Uses internal tick resolution where 3840 ticks = 1 quarter note
* @param seconds Time in seconds
* @param bpm Beats per minute
* @param resolution Optional: ticks per quarter note (default: 3840)
* @returns Number of ticks (internal timing units)
*/
var secondsToTicks = (seconds, bpm, resolution = Ticks.Beat) => {
	return seconds * (resolution / (60 / bpm));
};
/**
* Pass in a Timer, return a formatted time
* such as HH:MM:SS
*/
var timestampCache = /* @__PURE__ */ new Map();
var formatTimeStampFromSeconds = (seconds) => {
	if (timestampCache.has(seconds)) return timestampCache.get(seconds);
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor(seconds % 3600 / 60);
	const remainingSeconds = seconds % 60;
	const milliseconds = (remainingSeconds % 1).toFixed(2).slice(2);
	const string = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(Math.floor(remainingSeconds)).padStart(2, "0")}:${String(milliseconds).padStart(2, "0")}`;
	timestampCache.set(seconds, string);
	return string;
};
var Epoch = class Epoch {
	/**
	* Get the singleton instance of Epoch
	*/
	static getInstance() {
		if (!Epoch.instance) Epoch.instance = new Epoch();
		return Epoch.instance;
	}
	constructor() {
		this.referenceEpoch = 0;
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
		if (tickDuration <= 0) return 0;
		const offsetToNextTick = tickDuration - this.getElapsedTime() % tickDuration;
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
};
//#endregion
//#region src/timer-types.ts
/**
* Timer type constants for selecting which worker/worklet to use
* Pass these string IDs to Timer constructor as the 'type' option
*/
var TIMER_TYPE_AUDIO_CONTEXT = "audio-context";
var TIMER_TYPE_AUDIO_WORKLET = "audio-worklet";
var TIMER_TYPE_ELASTIC_AUDIO_WORKLET = "elastic-audio-worklet";
var TIMER_TYPE_ROLLING = "rolling";
var TIMER_TYPE_SET_INTERVAL = "set-interval";
var TIMER_TYPE_SET_TIMEOUT = "set-timeout";
var TIMER_TYPES = {
	AUDIO_CONTEXT: TIMER_TYPE_AUDIO_CONTEXT,
	AUDIO_WORKLET: TIMER_TYPE_AUDIO_WORKLET,
	ELASTIC_AUDIO_WORKLET: TIMER_TYPE_ELASTIC_AUDIO_WORKLET,
	ROLLING: TIMER_TYPE_ROLLING,
	SET_INTERVAL: TIMER_TYPE_SET_INTERVAL,
	SET_TIMEOUT: TIMER_TYPE_SET_TIMEOUT
};
var WORKLET_TIMER_TYPES = [TIMER_TYPE_AUDIO_WORKLET, TIMER_TYPE_ELASTIC_AUDIO_WORKLET];
var TIMER_TYPE_OPTIONS = [
	TIMER_TYPE_AUDIO_CONTEXT,
	TIMER_TYPE_AUDIO_WORKLET,
	TIMER_TYPE_ELASTIC_AUDIO_WORKLET,
	TIMER_TYPE_ROLLING,
	TIMER_TYPE_SET_INTERVAL,
	TIMER_TYPE_SET_TIMEOUT
];
var isWorkletTimerType = (type) => {
	return type === "audio-worklet" || type === "elastic-audio-worklet";
};
var isValidTimerType = (type) => {
	return type === "audio-context" || type === "audio-worklet" || type === "elastic-audio-worklet" || type === "rolling" || type === "set-interval" || type === "set-timeout";
};
var getTimerTypeDescription = (type) => {
	return {
		[TIMER_TYPE_AUDIO_CONTEXT]: "Audio Context Worker",
		[TIMER_TYPE_AUDIO_WORKLET]: "Audio Worklet",
		[TIMER_TYPE_ELASTIC_AUDIO_WORKLET]: "Elastic Audio Worklet (SharedArrayBuffer)",
		[TIMER_TYPE_ROLLING]: "Rolling Worker",
		[TIMER_TYPE_SET_INTERVAL]: "SetInterval Worker",
		[TIMER_TYPE_SET_TIMEOUT]: "SetTimeout Worker"
	}[type];
};
//#endregion
//#region src/timer-options.ts
var DEFAULT_SYNC_OPTIONS = {
	mode: "local-grid",
	join: "next-bar",
	beatsPerBar: 4
};
var DEFAULT_TIMER_OPTIONS = {
	accurate: false,
	bars: 16,
	divisions: 24,
	bpm: 90,
	contexts: null,
	type: TIMER_TYPE_AUDIO_WORKLET,
	callback: null,
	sync: DEFAULT_SYNC_OPTIONS,
	synch: true
};
//#endregion
//#region src/timer-worker-types.ts
var baseUrl = () => {
	const url = import.meta.url;
	return url.substring(0, url.lastIndexOf("/") + 1);
};
var AudioContextWorkerWrapper = () => new Worker(baseUrl() + "workers/timing.audiocontext.worker.js", { type: "module" });
var RollingTimeWorkerWrapper = () => new Worker(baseUrl() + "workers/timing.rolling.worker.js", { type: "module" });
var SetIntervalWorkerWrapper = () => new Worker(baseUrl() + "workers/timing.setinterval.worker.js", { type: "module" });
var SetTimeoutWorkerWrapper = () => new Worker(baseUrl() + "workers/timing.settimeout.worker.js", { type: "module" });
var NETWORK_SYNC_MODES = ["network-leader", "network-follower"];
var hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
var normalizeSyncOptions = (options, fallback = DEFAULT_SYNC_OPTIONS) => {
	if (hasOwn(options, "sync") && options.sync) return {
		...DEFAULT_SYNC_OPTIONS,
		...options.sync
	};
	if (hasOwn(options, "synch")) return options.synch === false ? {
		mode: "off",
		join: DEFAULT_SYNC_OPTIONS.join,
		beatsPerBar: DEFAULT_SYNC_OPTIONS.beatsPerBar
	} : { ...DEFAULT_SYNC_OPTIONS };
	return { ...fallback };
};
/**
* Resolve a timer type string to its corresponding Worker constructor
* @param timerType Timer type ID string (e.g., TIMER_TYPE_AUDIO_CONTEXT)
* @returns Worker constructor or null if not found
* @example
* const workerClass = resolveTimerType(TIMER_TYPE_AUDIO_CONTEXT)
*/
var resolveTimerType = (timerType) => {
	if (!isValidTimerType(timerType)) return null;
	switch (timerType) {
		case TIMER_TYPE_AUDIO_CONTEXT: return AudioContextWorkerWrapper;
		case TIMER_TYPE_ROLLING: return RollingTimeWorkerWrapper;
		case TIMER_TYPE_SET_INTERVAL: return SetIntervalWorkerWrapper;
		case TIMER_TYPE_SET_TIMEOUT: return SetTimeoutWorkerWrapper;
		case TIMER_TYPE_AUDIO_WORKLET:
		case TIMER_TYPE_ELASTIC_AUDIO_WORKLET: return null;
		default: return null;
	}
};
/**
* Simple boolean test to work out if this is a Worklet
* or a simple Worker file (not very smart - may break in future)
* @param file
* @returns boolean indicating if file is a worklet
*/
var isFileWorklet = (file) => {
	const normalized = typeof file === "string" ? file.toLowerCase() : file;
	if (typeof file === "function") return false;
	if (typeof normalized === "string" && normalized === "audio-worklet") return true;
	if (typeof normalized === "string" && normalized.indexOf("orklet") > -1) return true;
	if (typeof normalized === "string" && normalized.indexOf("data:text/javascript;base64,") > -1) return true;
	return false;
};
var _expectedAtTempoChange = /* @__PURE__ */ new WeakMap();
var _intervalsAtTempoChange = /* @__PURE__ */ new WeakMap();
var _lastTickIntervals = /* @__PURE__ */ new WeakMap();
var _transportAnchorExpected = /* @__PURE__ */ new WeakMap();
var _transportAnchorClockTime = /* @__PURE__ */ new WeakMap();
var _clockTimeToElapsedScale = /* @__PURE__ */ new WeakMap();
var _running = /* @__PURE__ */ new WeakMap();
var _active = /* @__PURE__ */ new WeakMap();
var _bypassed = /* @__PURE__ */ new WeakMap();
var _options = /* @__PURE__ */ new WeakMap();
var _epoch = /* @__PURE__ */ new WeakMap();
var _synchronizationOffset = /* @__PURE__ */ new WeakMap();
var Timer = class {
	get options() {
		return _classPrivateFieldGet2(_options, this);
	}
	get syncOptions() {
		return normalizeSyncOptions(_classPrivateFieldGet2(_options, this));
	}
	get syncMode() {
		return this.syncOptions.mode;
	}
	usesSynchronization() {
		return this.syncMode !== "off";
	}
	usesNetworkSynchronization() {
		return NETWORK_SYNC_MODES.includes(this.syncMode);
	}
	get syncReferenceEpochMs() {
		const syncOptions = this.syncOptions;
		return syncOptions.mode === "system-epoch-grid" ? syncOptions.referenceEpochMs : void 0;
	}
	applySyncConfiguration() {
		const referenceEpoch = this.syncReferenceEpochMs ?? 0;
		_classPrivateFieldGet2(_epoch, this).setReferenceEpoch(referenceEpoch);
	}
	/**
	* Can we use this timing method on this device?
	* @returns boolean is the worker available and compatable
	*/
	get isRunning() {
		return _classPrivateFieldGet2(_running, this);
	}
	set isRunning(value) {
		_classPrivateFieldSet2(_running, this, value);
	}
	get running() {
		return _classPrivateFieldGet2(_running, this);
	}
	/**
	* Can we use this timing method on this device?
	* @returns boolean is the worker available and compatable
	*/
	get available() {
		return this.isCompatible;
	}
	get isBypassed() {
		return _classPrivateFieldGet2(_bypassed, this);
	}
	set isBypassed(value) {
		_classPrivateFieldSet2(_bypassed, this, value);
	}
	/**
	* 
	*/
	get isActive() {
		return _classPrivateFieldGet2(_active, this);
	}
	/**
	* Accurate time in milliseconds
	* @returns number The current time as of now
	*/
	get now() {
		return this.getNow();
	}
	/** 
	* Time conversion factor
	*/
	get clockUnitsToSecondsScale() {
		return .001;
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
		return 60 / this.bpm;
	}
	/**
	* Get the current timing as a Microtempo 
	* @returns number Microtempo
	*/
	get microTempo() {
		return this.timePerBar * .001;
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
	get elapsedSinceLastTick() {
		return this.now - this.lastRecordedTime;
	}
	get swing() {
		return this.swingOffset;
	}
	get isAtStart() {
		return this.divisionsElapsed === 0;
	}
	get isAtStartOfBar() {
		return this.divisionsElapsed === 0;
	}
	get isStartBar() {
		return this.currentBar === 0;
	}
	get isAtMiddleOfBar() {
		return this.barProgress === .5;
	}
	get isQuarterNote() {
		return this.beatProgress % .25 === 0;
	}
	get isHalfNote() {
		return this.beatProgress % .5 === 0;
	}
	get isSwungBeat() {
		return this.swingOffset > 0 && this.divisionsElapsed % 2 === 1;
	}
	get isUsingExternalTrigger() {
		return _classPrivateFieldGet2(_bypassed, this);
	}
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
		this.bars = value < 1 ? 1 : value > 32 ? 32 : value;
	}
	setBars(value) {
		this.totalBars = value;
		return this.bars;
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
		if (_classPrivateFieldGet2(_running, this)) this.captureTempoChangeAnchor();
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
		this.swingOffset = Math.min(1, Math.max(0, value));
	}
	constructor(options = DEFAULT_TIMER_OPTIONS, isWorklet) {
		_classPrivateFieldInitSpec(this, _expectedAtTempoChange, void 0);
		_classPrivateFieldInitSpec(this, _intervalsAtTempoChange, void 0);
		_classPrivateFieldInitSpec(this, _lastTickIntervals, void 0);
		_classPrivateFieldInitSpec(this, _transportAnchorExpected, void 0);
		_classPrivateFieldInitSpec(this, _transportAnchorClockTime, void 0);
		_classPrivateFieldInitSpec(this, _clockTimeToElapsedScale, void 0);
		_classPrivateFieldInitSpec(this, _running, void 0);
		_classPrivateFieldInitSpec(this, _active, void 0);
		_classPrivateFieldInitSpec(this, _bypassed, void 0);
		_classPrivateFieldInitSpec(this, _options, void 0);
		_classPrivateFieldInitSpec(this, _epoch, void 0);
		_classPrivateFieldInitSpec(this, _synchronizationOffset, void 0);
		this.startTime = -1;
		this.period = 100;
		_classPrivateFieldSet2(_expectedAtTempoChange, this, 0);
		_classPrivateFieldSet2(_intervalsAtTempoChange, this, 0);
		_classPrivateFieldSet2(_lastTickIntervals, this, 0);
		_classPrivateFieldSet2(_transportAnchorExpected, this, 0);
		_classPrivateFieldSet2(_transportAnchorClockTime, this, -1);
		_classPrivateFieldSet2(_clockTimeToElapsedScale, this, 0);
		this.currentBar = 0;
		this.divisions = 24;
		this.bars = 16;
		this.swingOffset = 0;
		this.divisionsElapsed = 0;
		this.totalBarsElapsed = 0;
		this.lastRecordedTime = 0;
		this.lastRecordedExternalTime = 0;
		_classPrivateFieldSet2(_running, this, false);
		_classPrivateFieldSet2(_active, this, false);
		_classPrivateFieldSet2(_bypassed, this, false);
		this.isCompatible = false;
		this.timingWorkHandler = null;
		_classPrivateFieldSet2(_epoch, this, Epoch.getInstance());
		_classPrivateFieldSet2(_synchronizationOffset, this, 0);
		this.getNow = () => performance.timeOrigin + performance.now();
		this.onAvailable = () => {};
		this.onUnavailable = () => {};
		this.loaded = Promise.resolve();
		const normalizedSync = normalizeSyncOptions(options);
		options = {
			...DEFAULT_TIMER_OPTIONS,
			...options,
			sync: normalizedSync,
			synch: normalizedSync.mode !== "off"
		};
		_classPrivateFieldSet2(_options, this, options);
		this.applySyncConfiguration();
		const optionKeys = Object.keys(options);
		const contextOptionKeys = optionKeys.filter((key) => key === "contexts" || key === "audioContext");
		const remainingOptionKeys = optionKeys.filter((key) => key !== "contexts" && key !== "audioContext");
		const orderedOptionKeys = [...contextOptionKeys, ...remainingOptionKeys];
		for (let key of orderedOptionKeys) switch (key) {
			case "audioContext":
				this.audioContext = options.audioContext;
				this.getNow = () => this.audioContext.currentTime * 1e3;
				break;
			case "contexts":
				if (options.contexts) for (let context in options.contexts) this[context] = options.contexts[context];
				this.getNow = () => this.audioContext ? this.audioContext.currentTime * 1e3 : performance.now();
				break;
			default: this[key] = options[key];
		}
		const typeStr = typeof options.type === "string" ? options.type : "";
		const prefersWorklet = isWorklet ?? (isWorkletTimerType(typeStr) || isFileWorklet(typeStr));
		if (prefersWorklet && this.audioContext) this.loaded = this.setTimingWorklet(typeStr, options.processor || "", this.audioContext);
		else if (prefersWorklet) this.loaded = Promise.resolve(null);
		else this.loaded = this.setTimingWorker(options.type || "");
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
			if (_classPrivateFieldGet2(_bypassed, this)) return trigger;
			_classPrivateFieldSet2(_bypassed, this, true);
			if (_classPrivateFieldGet2(_running, this)) this.disconnectWorker(this.timingWorkHandler, false);
		} else {
			if (!_classPrivateFieldGet2(_bypassed, this)) return trigger;
			_classPrivateFieldSet2(_bypassed, this, false);
			if (_classPrivateFieldGet2(_running, this)) this.startTimer();
		}
		return trigger;
	}
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
		return time * this.ticksPerSecond;
	}
	getSwingDelay(period = this.getCurrentPeriodInSeconds()) {
		return this.swingOffset > 0 ? period * this.swingOffset : 0;
	}
	getSwingAdjustment(intervals, period = this.getCurrentPeriodInSeconds()) {
		return this.swingOffset > 0 && intervals % 2 === 1 ? this.getSwingDelay(period) : 0;
	}
	getExpectedElapsed(intervals) {
		const period = this.getCurrentPeriodInSeconds();
		const relativeIntervals = Math.max(0, intervals - _classPrivateFieldGet2(_intervalsAtTempoChange, this));
		const anchorAdjustment = this.getSwingAdjustment(_classPrivateFieldGet2(_intervalsAtTempoChange, this), period);
		const intervalAdjustment = this.getSwingAdjustment(intervals, period);
		return _classPrivateFieldGet2(_expectedAtTempoChange, this) + relativeIntervals * period + (intervalAdjustment - anchorAdjustment);
	}
	getCurrentPeriodInSeconds() {
		return this.timeBetween * .001;
	}
	updateElapsedScale(timePassed) {
		const localElapsed = this.now - this.startTime;
		if (localElapsed > 0 && timePassed > 0) _classPrivateFieldSet2(_clockTimeToElapsedScale, this, timePassed / localElapsed);
	}
	getTransportElapsedNow() {
		if (_classPrivateFieldGet2(_transportAnchorClockTime, this) < 0) return _classPrivateFieldGet2(_transportAnchorExpected, this);
		const elapsedSinceAnchor = this.now - _classPrivateFieldGet2(_transportAnchorClockTime, this);
		if (elapsedSinceAnchor <= 0) return _classPrivateFieldGet2(_transportAnchorExpected, this);
		const scale = _classPrivateFieldGet2(_clockTimeToElapsedScale, this) || this.clockUnitsToSecondsScale;
		return _classPrivateFieldGet2(_transportAnchorExpected, this) + Math.max(0, elapsedSinceAnchor * scale);
	}
	resetTransportTiming(anchorClockTime = this.now) {
		_classPrivateFieldSet2(_expectedAtTempoChange, this, 0);
		_classPrivateFieldSet2(_intervalsAtTempoChange, this, _classPrivateFieldGet2(_running, this) ? _classPrivateFieldGet2(_lastTickIntervals, this) : 0);
		_classPrivateFieldSet2(_transportAnchorExpected, this, 0);
		_classPrivateFieldSet2(_transportAnchorClockTime, this, anchorClockTime);
		if (!_classPrivateFieldGet2(_running, this)) {
			_classPrivateFieldSet2(_lastTickIntervals, this, 0);
			_classPrivateFieldSet2(_clockTimeToElapsedScale, this, 0);
		}
	}
	captureTempoChangeAnchor(anchorClockTime = this.now) {
		if (!_classPrivateFieldGet2(_running, this)) return;
		const transportElapsed = this.getTransportElapsedNow();
		_classPrivateFieldSet2(_expectedAtTempoChange, this, transportElapsed);
		_classPrivateFieldSet2(_intervalsAtTempoChange, this, _classPrivateFieldGet2(_lastTickIntervals, this));
		_classPrivateFieldSet2(_transportAnchorExpected, this, transportElapsed);
		_classPrivateFieldSet2(_transportAnchorClockTime, this, anchorClockTime);
	}
	createTick(intervals, timePased, audioTiming = {}) {
		if (_classPrivateFieldGet2(_bypassed, this)) return;
		const timeBetweenPeriod = this.getCurrentPeriodInSeconds();
		const expected = this.getExpectedElapsed(intervals);
		const timePassed = timePased;
		const lag = this.swingOffset > 0 ? timePassed - expected : timePassed % timeBetweenPeriod;
		const drift = timePassed - this.timeElapsed;
		const level = Math.floor(timePassed / this.timeBetween);
		if (_classPrivateFieldGet2(_running, this)) {
			_classPrivateFieldSet2(_lastTickIntervals, this, intervals);
			_classPrivateFieldSet2(_transportAnchorExpected, this, expected);
			_classPrivateFieldSet2(_transportAnchorClockTime, this, this.now);
			this.updateElapsedScale(timePassed);
			this.onTick(timePassed, expected, drift, level, intervals, lag, true, audioTiming);
		}
	}
	/**
	* Set the worklet as the main timing mechanism
	* @param type URL or identifier
	* @param processor processor name
	* @param audioContext audio context
	* @returns the worklet node
	*/
	async setTimingWorklet(type, processor, audioContext) {
		let wasRunning = _classPrivateFieldGet2(_running, this);
		if (this.timingWorkHandler) await this.unsetTimingWorker();
		try {
			if (isValidTimerType(type) && type !== "audio-worklet") {
				const workerClass = resolveTimerType(type);
				if (workerClass) return await this.setTimingWorker(workerClass);
			}
			const createWorklet = type === "elastic-audio-worklet" ? (await import("./elastic-timing.audioworklet.js")).createElasticTimingWorklet : (await import("./timing.audioworklet.js")).createTimingWorklet;
			if (!audioContext) throw new Error("AudioContext is required for AudioWorklet");
			this.timingWorkHandler = await createWorklet(audioContext);
			this.timingWorkHandler = await createWorklet(audioContext);
			this.isCompatible = true;
			if (wasRunning) await this.startTimer(this.callback);
			return this.timingWorkHandler;
		} catch (error) {
			this.isCompatible = false;
			throw error;
		}
	}
	/**
	* Load in the Worker URI
	* @param type URL or identifier
	* @returns the worker instance
	*/
	async loadTimingWorker(type) {
		if (typeof Worker === "undefined") throw new Error("Worker is not available in this environment");
		try {
			if (typeof type === "function") return type();
			else if (typeof type === "string") {
				let workerUrl = type;
				if (!workerUrl.startsWith("http") && !workerUrl.startsWith("blob:")) {
					const baseUrl = `${window.location.origin}/`;
					workerUrl = new URL(type, baseUrl).href;
				}
				return new Worker(workerUrl, { type: "module" });
			} else throw new Error(`Invalid worker type: expected function or string, got ${typeof type}`);
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
			let wasRunning = _classPrivateFieldGet2(_running, this);
			if (this.timingWorkHandler) await this.unsetTimingWorker();
			let workerType = type;
			if (typeof type === "string" && isValidTimerType(type)) {
				const resolved = resolveTimerType(type);
				if (resolved) workerType = resolved;
			}
			this.timingWorkHandler = await this.loadTimingWorker(workerType);
			if (!this.timingWorkHandler) throw Error("Timing Worker failed to load url: type:" + type);
			if (wasRunning) await this.startTimer(this.callback);
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
			if ("terminate" in handler) handler.terminate();
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
			if (!isValidTimerType(timerType)) throw new Error(`Invalid timer type: ${timerType}. Must be one of: ${Object.values(TIMER_TYPES).join(", ")}`);
			const wasRunning = _classPrivateFieldGet2(_running, this);
			if (wasRunning) await this.stopTimer();
			if (isWorkletTimerType(timerType)) {
				if (!audioContext) throw new Error("AudioContext is required when switching to audio-worklet timer type");
				await this.setTimingWorklet(timerType, "", audioContext);
			} else await this.setTimingWorker(timerType);
			if (wasRunning) await this.startTimer();
			return true;
		} catch (error) {
			this.isCompatible = false;
			throw error;
		}
	}
	/**
	* Add a worker or worklet into the pipeline
	* and monitor it's events and messages
	* @param worker the worker instance
	*/
	connectWorker(worker) {
		if (!worker) throw new Error("Timing Worker was not defined - please check paths " + worker);
		worker.onmessage = (e) => {
			const time = this.now;
			const data = e.data;
			switch (data.event) {
				case EVENT_READY: break;
				case EVENT_STARTING:
					this.startTime = time;
					_classPrivateFieldSet2(_running, this, true);
					this.resetTimer();
					break;
				case EVENT_TICK:
					this.createTick(data.intervals, data.time, {
						contextTimeSeconds: data.contextTimeSeconds,
						scheduledContextTimeSeconds: data.scheduledContextTimeSeconds,
						audioFrame: data.audioFrame,
						sampleRate: data.sampleRate
					});
					break;
				default:
			}
		};
		worker.onerror = (event) => {
			const errorDetails = {
				error: event.message || event.filename || "Unknown error",
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
				stack: event.error?.stack,
				time: this.now
			};
			if (worker) worker.postMessage(errorDetails);
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
			switch (e.data.event) {
				case EVENT_STOPPING:
					if (setStopped) {
						_classPrivateFieldSet2(_running, this, false);
						this.resetTransportTiming(this.now);
					}
					break;
			}
		};
		worker.postMessage({
			command: CMD_STOP,
			time: this.now
		});
	}
	/**
	* Reset the timer and start from the beginning
	*/
	resetTimer() {
		this.currentBar = 0;
		this.totalBarsElapsed = 0;
		this.divisionsElapsed = 0;
		this.resetTransportTiming();
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
			const nextOptions = {
				..._classPrivateFieldGet2(_options, this),
				...options
			};
			const normalizedSync = normalizeSyncOptions(options, this.syncOptions);
			_classPrivateFieldSet2(_options, this, {
				...nextOptions,
				sync: normalizedSync,
				synch: normalizedSync.mode !== "off"
			});
			this.applySyncConfiguration();
		}
		await this.loaded;
		const currentTime = this.now;
		if (!_classPrivateFieldGet2(_running, this)) {
			this.totalBarsElapsed = 0;
			this.resetTransportTiming(currentTime);
		}
		if (callback) this.setCallback(callback);
		if (this.usesSynchronization()) _classPrivateFieldSet2(_synchronizationOffset, this, _classPrivateFieldGet2(_epoch, this).synchronizeMetronome(this.period));
		else _classPrivateFieldSet2(_synchronizationOffset, this, 0);
		if (_classPrivateFieldGet2(_bypassed, this)) {
			_classPrivateFieldSet2(_running, this, true);
			this.resetTransportTiming(currentTime);
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
			synchronizationOffset: _classPrivateFieldGet2(_synchronizationOffset, this)
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
		if (_classPrivateFieldGet2(_bypassed, this)) return _classPrivateFieldGet2(_running, this);
		if (!_classPrivateFieldGet2(_running, this)) await this.startTimer(callback, options);
		else await this.stopTimer();
		return _classPrivateFieldGet2(_running, this);
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
		return _classPrivateFieldGet2(_synchronizationOffset, this);
	}
	/**
	* Get the current tick number on the global metronome grid
	* @returns the tick number
	*/
	getGlobalTickNumber() {
		this.applySyncConfiguration();
		return _classPrivateFieldGet2(_epoch, this).getTickNumber(this.period);
	}
	/**
	* Enable or disable synchronization for this timer
	* @param enabled whether synchronization should be enabled
	*/
	setSynchronized(enabled) {
		const sync = enabled ? this.syncMode === "off" ? { ...DEFAULT_SYNC_OPTIONS } : this.syncOptions : {
			mode: "off",
			join: this.syncOptions.join,
			beatsPerBar: this.syncOptions.beatsPerBar
		};
		_classPrivateFieldGet2(_options, this).sync = sync;
		_classPrivateFieldGet2(_options, this).synch = enabled;
		this.applySyncConfiguration();
	}
	/**
	* Check if this timer is synch to the global grid
	* @returns whether synchronization is enabled
	*/
	isSynchronized() {
		return this.usesSynchronization();
	}
	/**
	* Use an external device to send clock signals to and through this timer
	* such as the MIDI clock signal
	* @param advance whether to advance the divisions counter
	*/
	externalTrigger(advance = true) {
		const timestamp = this.now;
		const previousRecordedExternalTime = this.lastRecordedExternalTime;
		this.lastRecordedExternalTime = timestamp;
		const elapsedSinceLastClock = previousRecordedExternalTime > 0 ? (timestamp - previousRecordedExternalTime) * this.clockUnitsToSecondsScale : this.getCurrentPeriodInSeconds();
		const elapsedTimestamp = timestamp * this.clockUnitsToSecondsScale;
		const expected = this.divisionsElapsed * elapsedSinceLastClock;
		const lag = elapsedSinceLastClock > 0 ? elapsedTimestamp % elapsedSinceLastClock : 0;
		const drift = elapsedTimestamp - expected;
		const level = elapsedSinceLastClock > 0 ? Math.floor(elapsedTimestamp / elapsedSinceLastClock) : 0;
		if (_classPrivateFieldGet2(_running, this) && _classPrivateFieldGet2(_bypassed, this)) this.onTick(elapsedSinceLastClock, expected, drift, level, this.divisionsElapsed, lag, advance);
	}
	/**
	* Repeat previous clock tick but do not advance
	*/
	retrigger() {
		this.externalTrigger(false);
	}
	/** Apply an absolute network pulse without deriving musical position from packet arrival. */
	networkTick(tick, audioTiming) {
		if (!_classPrivateFieldGet2(_running, this) || !_classPrivateFieldGet2(_bypassed, this) || !Number.isSafeInteger(tick) || tick < 0) return;
		this.divisionsElapsed = tick % this.divisions;
		this.totalBarsElapsed = Math.floor(tick / this.divisions);
		this.currentBar = this.totalBarsElapsed % this.bars;
		this.lastRecordedExternalTime = this.now;
		const scheduled = audioTiming.scheduledContextTimeSeconds ?? this.now * this.clockUnitsToSecondsScale;
		this.onTick(scheduled, scheduled, 0, tick, tick, 0, false, audioTiming);
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
	onTick(timePassed, expected, drift = 0, level = 0, intervals = 0, lag = 0, advanceDivisions = true, audioTiming = {}) {
		this.lastRecordedTime = timePassed;
		if (advanceDivisions) {
			if (++this.divisionsElapsed >= this.divisions) {
				++this.totalBarsElapsed;
				this.currentBar = (this.currentBar + 1) % this.bars;
				this.divisionsElapsed = 0;
			}
		}
		this.callback && this.callback({
			bar: this.currentBar,
			bars: this.totalBars,
			divisionsElapsed: this.divisionsElapsed,
			barsElapsed: this.barsElapsed,
			elapsed: this.timeElapsed,
			timePassed,
			expected,
			drift,
			level,
			intervals,
			lag,
			...audioTiming,
			sync: this.networkSync ?? {
				mode: this.syncMode,
				status: this.usesNetworkSynchronization() ? "probing" : this.usesSynchronization() ? "locked" : "free",
				join: this.syncOptions.join,
				referenceEpochMs: this.syncReferenceEpochMs
			}
		});
	}
};
//#endregion
//#region src/timer-global.ts
/**
* Public API wrapper for the Timer class
*/
var globalTimer = null;
/**
* Start a timer with a callback
* @param callback - Function to call on each tick
* @param interval - Interval in milliseconds
* @param options - Timer options (can include 'type' for worker URI)
* @returns Timer instance
*/
function startTimer(callback, interval = 1e3, options = {}) {
	if (globalTimer && options.type && globalTimer.timingWorkHandler) {
		globalTimer.stopTimer();
		globalTimer = null;
	}
	if (!globalTimer) globalTimer = new Timer({
		...options,
		callback
	});
	globalTimer.setCallback(callback);
	globalTimer.BPM = 6e4 / interval;
	globalTimer.start();
	return { timer: globalTimer };
}
/**
* Stop the current timer
* @returns Timer instance
*/
function stopTimer() {
	if (globalTimer) {
		globalTimer.stop();
		return { timer: globalTimer };
	}
	return { timer: null };
}
/**
* Set the time between ticks
* @param interval - Interval in milliseconds
*/
function setTimeBetween(interval) {
	if (globalTimer) globalTimer.BPM = 6e4 / interval;
}
/**
* Reset the global timer
*/
function resetTimer() {
	if (globalTimer) globalTimer.resetTimer();
}
/**
* Get the global timer instance
*/
function getTimer() {
	return globalTimer;
}
/**
* Create a new timer instance
*/
function createTimer(options = {}) {
	return new Timer(options);
}
//#endregion
//#region src/audio-clock.ts
/**
* Keeps Web Audio's seconds-based rendering timeline separate from the
* browser's milliseconds-based monotonic timeline, and provides the only
* supported conversion boundary between them.
*/
var AudioClock = class {
	constructor(audioContext, monotonicNow = () => performance.now()) {
		this.audioContext = audioContext;
		this.monotonicNow = monotonicNow;
	}
	get audioTimeSeconds() {
		return this.audioContext.currentTime;
	}
	get performanceTimeMs() {
		return this.monotonicNow();
	}
	/**
	* Return a pair of timestamps describing the same output position.
	*
	* getOutputTimestamp() is preferred because it maps the AudioContext
	* rendering timeline to the monotonic clock. Before the context has
	* rendered, browsers return a zero pair, so use a control-thread snapshot
	* as a documented lower-accuracy fallback.
	*/
	getTimestampPair() {
		const timestamp = this.audioContext.getOutputTimestamp?.();
		const contextTime = timestamp?.contextTime;
		const performanceTime = timestamp?.performanceTime;
		if (typeof contextTime === "number" && typeof performanceTime === "number" && Number.isFinite(contextTime) && Number.isFinite(performanceTime) && (contextTime !== 0 || performanceTime !== 0)) return {
			contextTime,
			performanceTime
		};
		return {
			contextTime: this.audioTimeSeconds,
			performanceTime: this.performanceTimeMs
		};
	}
	performanceToAudioTimeSeconds(performanceTimeMs) {
		const timestamp = this.getTimestampPair();
		return timestamp.contextTime + (performanceTimeMs - timestamp.performanceTime) / 1e3;
	}
	audioToPerformanceTimeMs(audioTimeSeconds) {
		const timestamp = this.getTimestampPair();
		return timestamp.performanceTime + (audioTimeSeconds - timestamp.contextTime) * 1e3;
	}
};
//#endregion
//#region src/timer-audio.ts
var DEFAULT_AUDIO_TIMER_OPTIONS = { divisions: 24 };
var AudioTimer = class extends Timer {
	/**
	* Audio transport time in seconds.
	*/
	get now() {
		return this.audioTimeSeconds;
	}
	get audioTimeSeconds() {
		return this.audioContext.currentTime;
	}
	get performanceTimeMs() {
		return this.clock.performanceTimeMs;
	}
	/**
	* Convert a DOMHighResTimeStamp (milliseconds) to AudioContext seconds.
	*/
	performanceToAudioTimeSeconds(performanceTimeMs) {
		return this.clock.performanceToAudioTimeSeconds(performanceTimeMs);
	}
	/**
	* Convert AudioContext seconds to a DOMHighResTimeStamp (milliseconds).
	*/
	audioToPerformanceTimeMs(audioTimeSeconds) {
		return this.clock.audioToPerformanceTimeMs(audioTimeSeconds);
	}
	/**
	* Time Scale factor
	*/
	get clockUnitsToSecondsScale() {
		return 1;
	}
	/**
	* Create an AudioTimer with an AudioContext
	* Uses AudioWorklet timing if available, falls back to AudioContext worker
	* @param audioContext The AudioContext to use for accurate timing
	* @param timerType If true, attempts to use AudioWorklet (recommended). If false, uses AudioContext worker.
	*/
	constructor(audioContext, timerType = true) {
		const resolvedTimerType = typeof timerType === "boolean" ? timerType ? TIMER_TYPE_AUDIO_WORKLET : TIMER_TYPE_AUDIO_CONTEXT : timerType;
		const timerOptions = {
			audioContext,
			...DEFAULT_AUDIO_TIMER_OPTIONS,
			type: resolvedTimerType
		};
		super(timerOptions, isWorkletTimerType(resolvedTimerType));
		const resolvedAudioContext = this.audioContext;
		if (!resolvedAudioContext) throw Error("No AudioContext specified");
		this.clock = new AudioClock(resolvedAudioContext);
	}
	/**
	* Start this timer
	* @param {Function} callback 
	* @param {Object} options 
	*/
	async startTimer(callback, options = {}) {
		if (this.audioContext && this.audioContext.state === "suspended") await this.audioContext.resume();
		return await super.startTimer(callback, options);
	}
};
//#endregion
//#region src/sync-session.ts
var DEFAULT_SYNC_SESSION_SAMPLE_WINDOW = 16;
var _samples = /* @__PURE__ */ new WeakMap();
var _sampleWindow = /* @__PURE__ */ new WeakMap();
var _minSamples = /* @__PURE__ */ new WeakMap();
var SyncSession = class {
	constructor(sampleWindow = 16, minSamples = 4) {
		_classPrivateFieldInitSpec(this, _samples, []);
		_classPrivateFieldInitSpec(this, _sampleWindow, void 0);
		_classPrivateFieldInitSpec(this, _minSamples, void 0);
		_classPrivateFieldSet2(_sampleWindow, this, Math.max(3, sampleWindow));
		_classPrivateFieldSet2(_minSamples, this, Math.max(1, minSamples));
	}
	addSample(input) {
		if (!Object.values(input).every(Number.isFinite) || input.clientReceiveTimeMs < input.clientSendTimeMs || input.leaderSendTimeMs < input.leaderReceiveTimeMs) throw new Error("Invalid clock sample");
		const rttMs = input.clientReceiveTimeMs - input.clientSendTimeMs - (input.leaderSendTimeMs - input.leaderReceiveTimeMs);
		const sample = {
			offsetMs: (input.leaderReceiveTimeMs - input.clientSendTimeMs + (input.leaderSendTimeMs - input.clientReceiveTimeMs)) / 2,
			rttMs: Math.max(0, rttMs),
			receivedAtMs: input.clientReceiveTimeMs
		};
		_classPrivateFieldGet2(_samples, this).push(sample);
		if (_classPrivateFieldGet2(_samples, this).length > _classPrivateFieldGet2(_sampleWindow, this)) _classPrivateFieldGet2(_samples, this).shift();
		return sample;
	}
	clear() {
		_classPrivateFieldSet2(_samples, this, []);
	}
	getEstimate(nowMs) {
		if (_classPrivateFieldGet2(_samples, this).length === 0) return {
			offsetMs: 0,
			rttMs: 0,
			jitterMs: 0,
			sampleCount: 0,
			locked: false
		};
		const sortedByRtt = [..._classPrivateFieldGet2(_samples, this)].sort((a, b) => a.rttMs - b.rttMs);
		const sliceLength = Math.max(1, Math.ceil(sortedByRtt.length / 2));
		const bestSamples = sortedByRtt.slice(0, sliceLength);
		const offsetMs = bestSamples.reduce((sum, sample) => sum + sample.offsetMs, 0) / bestSamples.length;
		const rttMs = bestSamples.reduce((sum, sample) => sum + sample.rttMs, 0) / bestSamples.length;
		const jitterMs = Math.sqrt(bestSamples.reduce((sum, sample) => sum + Math.pow(sample.offsetMs - offsetMs, 2), 0) / bestSamples.length);
		return {
			offsetMs,
			rttMs,
			jitterMs,
			sampleCount: _classPrivateFieldGet2(_samples, this).length,
			locked: _classPrivateFieldGet2(_samples, this).length >= _classPrivateFieldGet2(_minSamples, this) && jitterMs <= 10 && rttMs <= 250 && (nowMs === void 0 || nowMs - _classPrivateFieldGet2(_samples, this)[_classPrivateFieldGet2(_samples, this).length - 1].receivedAtMs <= 3e3)
		};
	}
	leaderToLocalTime(leaderTimeMs) {
		return leaderTimeMs - this.getEstimate().offsetMs;
	}
	localToLeaderTime(localTimeMs) {
		return localTimeMs + this.getEstimate().offsetMs;
	}
};
//#endregion
//#region src/worklets/network-timing-processor.js?raw
var network_timing_processor_default = "// Shared transport anchors are converted to audio seconds before reaching this worklet.\nclass NetworkTimingProcessor extends AudioWorkletProcessor {\n    states = []\n    revision = -1\n    tick = -1\n    constructor() {\n        super()\n        this.port.onmessage = ({ data }) => {\n            if (data.type === 'clear') {\n                this.states = []\n                this.revision = -1\n                this.tick = -1\n            } else if (data.type === 'timeline') {\n                this.states = data.states\n            }\n        }\n    }\n    process() {\n        let state\n        for (const candidate of this.states) {\n            if (candidate.audioTime <= currentTime) state = candidate\n        }\n        if (!state) return true\n        const interval = 60 / (state.bpm * state.divisions)\n        if (this.revision !== state.revision) {\n            this.revision = state.revision\n            // Late joins skip elapsed ticks and retain absolute musical position.\n            this.tick = Math.max(Math.ceil(state.position * state.divisions - 1e-7),\n                Math.floor(state.position * state.divisions + (currentTime - state.audioTime) / interval) - 1) - 1\n            this.port.postMessage({ state, scheduledContextTimeSeconds: state.audioTime + 0.1 })\n        }\n        if (!state.playing) return true\n        // A suspended context must never replay a backlog of musical events.\n        let next = Math.max(this.tick + 1,\n            Math.floor(state.position * state.divisions + (currentTime - state.audioTime) / interval) - 1)\n        for (let count = 0; count < 4; count++, next++) {\n            const scheduled = state.audioTime + (next - state.position * state.divisions\n                + (next % 2 ? state.swing : 0)) * interval\n            if (scheduled > currentTime + 1e-7) break\n            this.tick = next\n            if (scheduled < currentTime - 256 / sampleRate) continue\n            this.port.postMessage({ state, tick: next, scheduledContextTimeSeconds: scheduled + 0.1,\n                contextTimeSeconds: currentTime, audioFrame: currentFrame, sampleRate })\n        }\n        return true\n    }\n}\nregisterProcessor('netronome-network-timing', NetworkTimingProcessor)\n";
//#endregion
//#region src/network-audio-scheduler.ts
var modules = /* @__PURE__ */ new WeakMap();
async function createNetworkAudioScheduler(timer, onTransport) {
	const context = timer.audioContext;
	if (!context?.audioWorklet) throw new Error("Network timing requires an AudioWorklet-capable audio context");
	let module = modules.get(context);
	if (!module) {
		const url = URL.createObjectURL(new Blob([network_timing_processor_default], { type: "application/javascript" }));
		module = context.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
		modules.set(context, module);
		module.catch(() => modules.delete(context));
	}
	await module;
	const node = new AudioWorkletNode(context, "netronome-network-timing", {
		numberOfInputs: 0,
		outputChannelCount: [1]
	});
	node.connect(context.destination);
	const audioClock = new AudioClock(context);
	let alive = true;
	let enabled = false;
	let revisions = /* @__PURE__ */ new Set();
	node.port.onmessage = ({ data }) => {
		if (!alive || !enabled || !timer.isUsingExternalTrigger) return;
		if (!revisions.has(data.state?.revision)) return;
		if (context.currentTime - data.scheduledContextTimeSeconds > .1) return;
		onTransport(data.state);
		if (data.tick !== void 0) timer.networkTick(data.tick, data);
	};
	return {
		setTimeline(states, offsetMs) {
			if (!alive) return;
			enabled = true;
			revisions = new Set(states.map((state) => state.revision));
			const pair = audioClock.getTimestampPair();
			const audioOrigin = pair.contextTime - pair.performanceTime / 1e3;
			node.port.postMessage({
				type: "timeline",
				states: states.map((state) => ({
					...state,
					audioTime: audioOrigin + (state.timestamp - offsetMs) / 1e3 - .1
				}))
			});
		},
		clear() {
			enabled = false;
			node.port.postMessage({ type: "clear" });
		},
		destroy() {
			alive = false;
			enabled = false;
			node.port.onmessage = null;
			node.port.close();
			node.disconnect();
		}
	};
}
//#endregion
//#region src/network-timeline.ts
var isNetworkTransport = (value) => Boolean(value && Number.isSafeInteger(value.revision) && value.revision >= 0 && typeof value.playing === "boolean" && Number.isFinite(value.timestamp) && Number.isFinite(value.position) && value.position >= 0 && Number.isFinite(value.bpm) && value.bpm >= 10 && value.bpm <= 300 && Number.isFinite(value.swing) && value.swing >= 0 && value.swing <= 1 && Number.isInteger(value.divisions) && value.divisions >= 1 && value.divisions <= 96 && Number.isInteger(value.bars) && value.bars >= 1 && value.bars <= 32);
var positionAt = (state, timestamp) => state.position + (state.playing ? Math.max(0, timestamp - state.timestamp) * state.bpm / 6e4 : 0);
/** Match Timer's swing convention: delay odd divisions by a fraction of one division. */
var networkTickTime = (state, tick) => state.timestamp + (tick / state.divisions - state.position + (tick % 2 ? state.swing / state.divisions : 0)) * 6e4 / state.bpm;
//#endregion
//#region src/network-session.ts
/** One transport and one audio scheduler per machine, independent of WS/WebRTC routing. */
var NetworkSession = class {
	constructor(timer, options) {
		this.peers = /* @__PURE__ */ new Map();
		this.timeline = [];
		this.destroyed = false;
		this.activeRevision = -1;
		this.sequence = 0;
		this.ready = false;
		this.ownsTimer = false;
		this.timer = timer;
		this.options = options;
		this.now = options.now ?? (() => performance.now());
	}
	get isLeader() {
		return this.options.peerId === this.options.leaderId;
	}
	start() {
		if (this.destroyed) return Promise.reject(/* @__PURE__ */ new Error("Session has been destroyed"));
		return this.starting ?? (this.starting = this.initialize());
	}
	async initialize() {
		const scheduler = this.options.scheduler ?? await createNetworkAudioScheduler(this.timer, (state) => this.applyTransport(state));
		if (this.destroyed) {
			scheduler.destroy();
			return;
		}
		this.scheduler = scheduler;
		await this.timer.loaded;
		if (this.destroyed) return;
		this.timer.bypass(true);
		this.ownsTimer = true;
		await this.timer.startTimer(this.timer.callback, { sync: { mode: "off" } });
		if (this.destroyed) return;
		this.ready = true;
		this.interval = setInterval(() => this.poll(), Math.max(100, this.options.pollIntervalMs ?? 250));
		this.updateScheduler();
		this.poll();
	}
	addPeer(id) {
		if (id === this.options.peerId || this.peers.has(id)) return;
		this.peers.set(id, {
			clock: new SyncSession(this.options.sampleWindow, this.options.minSamples),
			pending: /* @__PURE__ */ new Set(),
			lastSeen: this.now()
		});
		this.poll();
	}
	removePeer(id) {
		this.peers.delete(id);
		if (id === this.options.leaderId) this.scheduler?.clear();
		this.emit();
	}
	send(id, data) {
		if (!this.destroyed) this.options.send(id, {
			protocol: "netronome/1",
			...data
		});
	}
	current(at = this.now()) {
		const leaderTime = at + this.offset();
		const states = this.timeline.filter((state) => state.timestamp <= leaderTime);
		return states[states.length - 1];
	}
	offset() {
		return this.isLeader ? 0 : this.peers.get(this.options.leaderId)?.clock.getEstimate(this.now()).offsetMs ?? 0;
	}
	locked() {
		return this.isLeader || Boolean(this.peers.get(this.options.leaderId)?.clock.getEstimate(this.now()).locked);
	}
	applyTransport(state) {
		if (this.activeRevision >= state.revision) return;
		this.activeRevision = state.revision;
		this.timer.BPM = state.bpm;
		this.timer.swing = state.swing;
		this.timer.divisions = state.divisions;
		this.timer.bars = state.bars;
		this.options.onTransport?.(state);
	}
	updateScheduler() {
		if (!this.ready) return;
		const estimate = this.peers.get(this.options.leaderId)?.clock.getEstimate(this.now());
		this.timer.networkSync = {
			mode: this.isLeader ? "network-leader" : "network-follower",
			status: this.locked() ? "locked" : "probing",
			clockOffsetMs: this.offset(),
			clockJitterMs: estimate?.jitterMs ?? 0,
			transportRevision: this.current()?.revision,
			leaderTimeMs: this.now() + this.offset()
		};
		if (!this.locked()) {
			this.scheduler?.clear();
			return;
		}
		this.scheduler?.setTimeline(this.timeline, this.offset());
		const state = this.current();
		if (state) this.applyTransport(state);
	}
	poll() {
		if (this.destroyed) return;
		const now = this.now();
		for (const [id, peer] of this.peers) {
			for (const stamp of peer.pending) if (now - stamp > 5e3) peer.pending.delete(stamp);
			peer.pending.add(now);
			this.send(id, {
				type: "ping",
				timestamp: now
			});
			this.sendState(id);
		}
		this.updateScheduler();
		this.emit();
	}
	sendState(id) {
		const state = this.current();
		this.send(id, {
			type: "state",
			leaderId: this.options.leaderId,
			timestamp: this.now(),
			playing: state?.playing ?? false,
			position: state ? positionAt(state, this.now() + this.offset()) : 0,
			bpm: state?.bpm ?? this.timer.BPM,
			swing: state?.swing ?? this.timer.swing,
			timeline: this.isLeader ? this.timeline : [],
			locked: this.locked()
		});
	}
	receive(id, message) {
		if (this.destroyed || !message || message.protocol !== "netronome/1") return;
		const peer = this.peers.get(id);
		if (!peer) return;
		const now = this.now();
		if (message.type === "ping" && Number.isFinite(message.timestamp)) this.send(id, {
			type: "pong",
			timestamp: message.timestamp,
			received: now,
			sent: this.now()
		});
		else if (message.type === "pong" && peer.pending.delete(message.timestamp) && Number.isFinite(message.received) && Number.isFinite(message.sent)) {
			try {
				peer.clock.addSample({
					clientSendTimeMs: message.timestamp,
					clientReceiveTimeMs: now,
					leaderReceiveTimeMs: message.received,
					leaderSendTimeMs: message.sent
				});
			} catch {
				return;
			}
			peer.lastSeen = now;
			this.updateScheduler();
		} else if (message.type === "state" && !this.isLeader && id === this.options.leaderId && message.leaderId === id && Array.isArray(message.timeline) && message.timeline.length > 0 && message.timeline.length <= 2 && message.timeline.every(isNetworkTransport)) {
			const incoming = message.timeline;
			if (incoming.some((state, index) => index > 0 && (state.revision <= incoming[index - 1].revision || state.timestamp < incoming[index - 1].timestamp))) return;
			if (incoming[incoming.length - 1].revision < (this.timeline[this.timeline.length - 1]?.revision ?? -1)) return;
			for (const state of incoming) {
				const existing = this.timeline.find((item) => item.revision === state.revision);
				if (existing && JSON.stringify(existing) !== JSON.stringify(state)) return;
			}
			this.timeline = incoming;
			peer.lastSeen = now;
			this.updateScheduler();
		}
		this.emit();
	}
	/** Coalesce edits onto the same future bar; preserve position under tempo changes. */
	setTransport(change, effectiveTimeMs) {
		if (!this.isLeader) throw new Error("Only the host can change shared transport");
		if (this.destroyed || !this.ready) throw new Error("Session is not ready");
		const now = this.now();
		const current = this.current();
		const pending = this.timeline.find((state) => state.timestamp > now);
		const base = pending ?? current;
		let timestamp = pending?.timestamp ?? now + Math.max(500, this.options.lookaheadMs ?? 600);
		let position = current ? positionAt(current, timestamp) : 0;
		if (!pending && current?.playing) {
			position = Math.ceil(position / 4) * 4;
			timestamp = current.timestamp + (position - current.position) * 6e4 / current.bpm;
		}
		if (pending) position = pending.position;
		if (effectiveTimeMs !== void 0) {
			if (!Number.isFinite(effectiveTimeMs) || effectiveTimeMs < now + 200) throw new Error("Transport changes need at least 200 ms of scheduling headroom");
			timestamp = effectiveTimeMs;
			position = current ? positionAt(current, timestamp) : 0;
		}
		const state = {
			revision: ++this.sequence,
			playing: base?.playing ?? false,
			timestamp,
			position,
			bpm: base?.bpm ?? this.timer.BPM,
			swing: base?.swing ?? this.timer.swing,
			divisions: this.timer.divisions,
			bars: this.timer.bars,
			...change
		};
		if (!isNetworkTransport(state)) throw new Error("Invalid shared transport");
		this.timeline = current ? [current, state] : [state];
		this.updateScheduler();
		for (const id of this.peers.keys()) this.sendState(id);
		this.emit();
		return state;
	}
	getState() {
		const state = this.current();
		const locked = this.locked();
		return {
			role: this.isLeader ? "leader" : "follower",
			ready: this.ready,
			status: !this.isLeader && !this.peers.has(this.options.leaderId) ? "disconnected" : !locked ? "synchronizing" : this.timeline.some((s) => s.timestamp > this.now() + this.offset()) ? "armed" : "locked",
			playing: state?.playing ?? false,
			position: state ? positionAt(state, this.now() + this.offset()) : 0,
			bpm: state?.bpm ?? this.timer.BPM,
			swing: state?.swing ?? this.timer.swing,
			peers: [...this.peers].map(([id, peer]) => ({
				id,
				...peer.clock.getEstimate(this.now())
			}))
		};
	}
	emit() {
		this.options.onStateChange?.(this.getState());
	}
	async destroy() {
		this.destroyed = true;
		clearInterval(this.interval);
		this.scheduler?.destroy();
		try {
			await this.starting;
		} catch {}
		this.peers.clear();
		this.timeline = [];
		if (this.ownsTimer) {
			await this.timer.stopTimer();
			this.timer.isRunning = false;
			this.timer.networkSync = void 0;
			this.timer.bypass(false);
			this.ownsTimer = false;
		}
		this.ready = false;
	}
};
//#endregion
//#region src/webrtc-sync.ts
/** Single-peer compatibility facade. Use NetworkSession for rooms and multiple transports. */
var WebRTCSyncController = class {
	constructor(timer, options) {
		this.pc = null;
		this.channel = null;
		this.candidates = [];
		this.destroyed = false;
		this.iceWaits = /* @__PURE__ */ new Set();
		this.timer = timer;
		this.options = options;
		this.role = options.role;
		if (typeof RTCPeerConnection === "undefined") return;
		const pc = new RTCPeerConnection(options.rtcConfig ?? { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
		this.pc = pc;
		pc.onicecandidate = ({ candidate }) => {
			if (candidate) this.onSignal?.({
				type: "candidate",
				candidate: candidate.toJSON()
			});
		};
		pc.ondatachannel = ({ channel }) => this.attach(channel);
		if (this.role === "leader") this.attach(pc.createDataChannel(options.channelLabel ?? "netronome-sync", { ordered: true }));
	}
	peer() {
		if (this.destroyed || !this.pc) throw new Error("RTCPeerConnection is not available");
		return this.pc;
	}
	attach(channel) {
		this.channel = channel;
		channel.onopen = () => {
			this.ensureSession().then(() => this.onStateChange?.(this.getState())).catch(() => {
				channel.close();
				this.onStateChange?.(this.getState());
			});
		};
		channel.onclose = () => {
			this.session?.removePeer(this.role === "leader" ? "follower" : "leader");
			this.onStateChange?.(this.getState());
		};
		channel.onmessage = ({ data }) => {
			if (typeof data !== "string" || data.length > 32768) return;
			try {
				this.session?.receive(this.role === "leader" ? "follower" : "leader", JSON.parse(data));
			} catch {}
		};
	}
	async ensureSession() {
		if (this.destroyed) throw new Error("Controller has been destroyed");
		if (!this.session) {
			this.session = new NetworkSession(this.timer, {
				peerId: this.role,
				leaderId: "leader",
				lookaheadMs: this.options.startLookaheadMs,
				sampleWindow: this.options.sampleWindow,
				minSamples: this.options.minSamples,
				pollIntervalMs: this.options.pingIntervalMs ?? this.options.heartbeatIntervalMs,
				send: (_id, message) => {
					if (this.channel?.readyState === "open") this.channel.send(JSON.stringify(message));
				},
				onStateChange: () => this.onStateChange?.(this.getState())
			});
			this.sessionReady = this.session.start();
		}
		await this.sessionReady;
		if (this.channel?.readyState === "open") this.session.addPeer(this.role === "leader" ? "follower" : "leader");
	}
	async start() {
		if (this.role !== "leader") return;
		const pc = this.peer();
		await pc.setLocalDescription(await pc.createOffer());
		this.onSignal?.({
			type: "description",
			description: pc.localDescription.toJSON()
		});
	}
	async gather() {
		const pc = this.peer();
		if (pc.iceGatheringState !== "complete") await new Promise((resolve, reject) => {
			const cleanup = () => {
				clearTimeout(timeout);
				pc.removeEventListener("icegatheringstatechange", check);
				this.iceWaits.delete(cancel);
			};
			const cancel = () => {
				cleanup();
				reject(/* @__PURE__ */ new Error("ICE gathering cancelled"));
			};
			const check = () => {
				if (pc.iceGatheringState === "complete") {
					cleanup();
					resolve();
				}
			};
			const timeout = setTimeout(() => {
				cleanup();
				reject(/* @__PURE__ */ new Error("ICE gathering timed out"));
			}, 1e4);
			this.iceWaits.add(cancel);
			pc.addEventListener("icegatheringstatechange", check);
			check();
		});
		return { description: this.peer().localDescription.toJSON() };
	}
	async createOfferBundle() {
		if (this.role !== "leader") throw new Error("Only the leader can create an offer");
		await this.start();
		return this.gather();
	}
	async applyOfferBundle(bundle) {
		if (this.role !== "follower") throw new Error("Only the follower can apply an offer");
		await this.handleSignal({
			type: "description",
			description: bundle.description
		});
	}
	async createAnswerBundle() {
		if (this.role !== "follower" || !this.peer().remoteDescription) throw new Error("Apply an offer first");
		return this.gather();
	}
	async applyAnswerBundle(bundle) {
		if (this.role !== "leader") throw new Error("Only the leader can apply an answer");
		await this.handleSignal({
			type: "description",
			description: bundle.description
		});
	}
	async handleSignal(signal) {
		const pc = this.peer();
		if (signal.type === "candidate") {
			if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate);
			else if (this.candidates.length < 100) this.candidates.push(signal.candidate);
			return;
		}
		await pc.setRemoteDescription(signal.description);
		for (const candidate of this.candidates.splice(0)) await pc.addIceCandidate(candidate);
		if (signal.description.type === "offer") {
			await pc.setLocalDescription(await pc.createAnswer());
			this.onSignal?.({
				type: "description",
				description: pc.localDescription.toJSON()
			});
		}
	}
	async startSynchronized(lookaheadMs = this.options.startLookaheadMs) {
		if (this.role !== "leader") throw new Error("Only the leader can initiate synchronized start");
		if (lookaheadMs !== void 0) this.options.startLookaheadMs = lookaheadMs;
		await this.ensureSession();
		if (lookaheadMs !== void 0) this.session.options.lookaheadMs = lookaheadMs;
		this.session.setTransport({
			playing: true,
			position: 0
		});
	}
	async stopSynchronized() {
		if (this.role === "leader" && this.session) this.session.setTransport({ playing: false });
		else await this.destroy();
	}
	broadcastTempoUpdate(effectiveLeaderTimeMs) {
		if (this.role !== "leader" || !this.session) return;
		const bpm = this.timer.BPM, swing = this.timer.swing;
		const current = this.session.getState();
		this.timer.BPM = current.bpm;
		this.timer.swing = current.swing;
		this.session.setTransport({
			bpm,
			swing
		}, effectiveLeaderTimeMs);
	}
	getState() {
		const peer = (this.session?.getState())?.peers[0];
		return {
			role: this.role,
			connected: this.channel?.readyState === "open",
			sampleCount: peer?.sampleCount ?? 0,
			offsetMs: peer?.offsetMs ?? 0,
			rttMs: peer?.rttMs ?? 0,
			jitterMs: peer?.jitterMs ?? 0,
			locked: peer?.locked ?? false
		};
	}
	async destroy() {
		this.destroyed = true;
		for (const cancel of [...this.iceWaits]) cancel();
		await this.session?.destroy();
		this.channel?.close();
		this.channel = null;
		this.pc?.close();
		this.pc = null;
	}
};
var createWebRTCSyncController = (timer, options) => new WebRTCSyncController(timer, options);
//#endregion
export { AudioClock, AudioContextWorkerWrapper, AudioTimer, CMD_ADJUST_DRIFT, CMD_INITIALISE, CMD_START, CMD_STOP, CMD_UPDATE, DEFAULT_SYNC_OPTIONS, DEFAULT_SYNC_SESSION_SAMPLE_WINDOW, DEFAULT_TIMER_OPTIONS, EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK, MICROSECONDS_PER_MINUTE, NetworkSession, RollingTimeWorkerWrapper, SECONDS_PER_MINUTE, SetIntervalWorkerWrapper, SetTimeoutWorkerWrapper, SyncSession, TIMER_TYPES, TIMER_TYPE_AUDIO_CONTEXT, TIMER_TYPE_AUDIO_WORKLET, TIMER_TYPE_ELASTIC_AUDIO_WORKLET, TIMER_TYPE_OPTIONS, TIMER_TYPE_ROLLING, TIMER_TYPE_SET_INTERVAL, TIMER_TYPE_SET_TIMEOUT, Ticks, Timer, WORKLET_TIMER_TYPES, WebRTCSyncController, convertBPMToPeriod, convertMIDIClockIntervalToBPM, convertPeriodToBPM, createTimer, createWebRTCSyncController, formatTimeStampFromSeconds, getTimer, getTimerTypeDescription, isNetworkTransport, isValidTimerType, isWorkletTimerType, networkTickTime, positionAt, resetTimer, secondsToTicks, setTimeBetween, startTimer, stopTimer, tapTempo, tapTempoQuick };

//# sourceMappingURL=index.js.map