import { a as _checkPrivateRedeclaration, c as CMD_START, d as EVENT_READY, f as EVENT_STARTING, i as _classPrivateFieldInitSpec, l as CMD_STOP, m as EVENT_TICK, n as _classPrivateFieldGet2, o as CMD_ADJUST_DRIFT, p as EVENT_STOPPING, r as _assertClassBrand, s as CMD_INITIALISE, t as _classPrivateFieldSet2, u as CMD_UPDATE } from "./classPrivateFieldSet2.js";
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
var _options$1 = /* @__PURE__ */ new WeakMap();
var _epoch = /* @__PURE__ */ new WeakMap();
var _synchronizationOffset = /* @__PURE__ */ new WeakMap();
var Timer = class {
	get options() {
		return _classPrivateFieldGet2(_options$1, this);
	}
	get syncOptions() {
		return normalizeSyncOptions(_classPrivateFieldGet2(_options$1, this));
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
		_classPrivateFieldInitSpec(this, _options$1, void 0);
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
		_classPrivateFieldSet2(_options$1, this, options);
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
				..._classPrivateFieldGet2(_options$1, this),
				...options
			};
			const normalizedSync = normalizeSyncOptions(options, this.syncOptions);
			_classPrivateFieldSet2(_options$1, this, {
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
		_classPrivateFieldGet2(_options$1, this).sync = sync;
		_classPrivateFieldGet2(_options$1, this).synch = enabled;
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
			sync: {
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
	getEstimate() {
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
		return {
			offsetMs,
			rttMs: bestSamples.reduce((sum, sample) => sum + sample.rttMs, 0) / bestSamples.length,
			jitterMs: Math.sqrt(bestSamples.reduce((sum, sample) => sum + Math.pow(sample.offsetMs - offsetMs, 2), 0) / bestSamples.length),
			sampleCount: _classPrivateFieldGet2(_samples, this).length,
			locked: _classPrivateFieldGet2(_samples, this).length >= _classPrivateFieldGet2(_minSamples, this)
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
//#region \0@oxc-project+runtime@0.130.0/helpers/classPrivateMethodInitSpec.js
function _classPrivateMethodInitSpec(e, a) {
	_checkPrivateRedeclaration(e, a), a.add(e);
}
//#endregion
//#region src/webrtc-sync.ts
var DEFAULT_OPTIONS = {
	role: "leader",
	sampleWindow: 16,
	minSamples: 4,
	pingIntervalMs: 1e3,
	heartbeatIntervalMs: 1e3,
	startLookaheadMs: 1200,
	resyncThresholdMs: 30,
	channelLabel: "netronome-sync"
};
var DEFAULT_RTC_CONFIGURATION = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };
var _options = /* @__PURE__ */ new WeakMap();
var _peerConnection = /* @__PURE__ */ new WeakMap();
var _dataChannel = /* @__PURE__ */ new WeakMap();
var _syncSession = /* @__PURE__ */ new WeakMap();
var _pingIntervalId = /* @__PURE__ */ new WeakMap();
var _heartbeatIntervalId = /* @__PURE__ */ new WeakMap();
var _scheduledTickTimeoutId = /* @__PURE__ */ new WeakMap();
var _leaderStartTimeMs = /* @__PURE__ */ new WeakMap();
var _lastTriggeredTick = /* @__PURE__ */ new WeakMap();
var _isFollowerRunning = /* @__PURE__ */ new WeakMap();
var _transportSnapshot = /* @__PURE__ */ new WeakMap();
var _destroyed = /* @__PURE__ */ new WeakMap();
var _WebRTCSyncController_brand = /* @__PURE__ */ new WeakSet();
var WebRTCSyncController = class {
	constructor(timer, options) {
		_classPrivateMethodInitSpec(this, _WebRTCSyncController_brand);
		_classPrivateFieldInitSpec(this, _options, void 0);
		_classPrivateFieldInitSpec(this, _peerConnection, null);
		_classPrivateFieldInitSpec(this, _dataChannel, null);
		_classPrivateFieldInitSpec(this, _syncSession, void 0);
		_classPrivateFieldInitSpec(this, _pingIntervalId, null);
		_classPrivateFieldInitSpec(this, _heartbeatIntervalId, null);
		_classPrivateFieldInitSpec(this, _scheduledTickTimeoutId, null);
		_classPrivateFieldInitSpec(this, _leaderStartTimeMs, null);
		_classPrivateFieldInitSpec(this, _lastTriggeredTick, -1);
		_classPrivateFieldInitSpec(this, _isFollowerRunning, false);
		_classPrivateFieldInitSpec(this, _transportSnapshot, void 0);
		_classPrivateFieldInitSpec(this, _destroyed, false);
		this.timer = timer;
		_classPrivateFieldSet2(_options, this, {
			...DEFAULT_OPTIONS,
			...options
		});
		this.role = _classPrivateFieldGet2(_options, this).role;
		_classPrivateFieldSet2(_syncSession, this, new SyncSession(_classPrivateFieldGet2(_options, this).sampleWindow, _classPrivateFieldGet2(_options, this).minSamples));
		_classPrivateFieldSet2(_transportSnapshot, this, _assertClassBrand(_WebRTCSyncController_brand, this, _readTransportSnapshot).call(this));
		_assertClassBrand(_WebRTCSyncController_brand, this, _ensurePeerConnection).call(this);
	}
	async start() {
		if (this.role !== "leader") return;
		const peerConnection = _classPrivateFieldGet2(_peerConnection, this);
		if (!peerConnection) throw new Error("RTCPeerConnection is not available in this environment");
		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);
		this.onSignal?.({
			type: "description",
			description: offer
		});
	}
	async createOfferBundle() {
		if (this.role !== "leader") throw new Error("Only the leader can create an offer bundle");
		const peerConnection = _classPrivateFieldGet2(_peerConnection, this);
		if (!peerConnection) throw new Error("RTCPeerConnection is not available in this environment");
		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);
		await _assertClassBrand(_WebRTCSyncController_brand, this, _waitForIceGatheringComplete).call(this);
		if (!peerConnection.localDescription) throw new Error("Failed to gather local offer description");
		return { description: peerConnection.localDescription.toJSON() };
	}
	async createAnswerBundle() {
		const peerConnection = _classPrivateFieldGet2(_peerConnection, this);
		if (!peerConnection) throw new Error("RTCPeerConnection is not available in this environment");
		if (!peerConnection.remoteDescription) throw new Error("Remote offer must be set before creating an answer bundle");
		const answer = await peerConnection.createAnswer();
		await peerConnection.setLocalDescription(answer);
		await _assertClassBrand(_WebRTCSyncController_brand, this, _waitForIceGatheringComplete).call(this);
		if (!peerConnection.localDescription) throw new Error("Failed to gather local answer description");
		return { description: peerConnection.localDescription.toJSON() };
	}
	async applyOfferBundle(bundle) {
		if (this.role !== "follower") throw new Error("Only the follower can apply an offer bundle");
		await this.handleSignal({
			type: "description",
			description: bundle.description
		});
	}
	async applyAnswerBundle(bundle) {
		if (this.role !== "leader") throw new Error("Only the leader can apply an answer bundle");
		await this.handleSignal({
			type: "description",
			description: bundle.description
		});
	}
	async handleSignal(signal) {
		const peerConnection = _classPrivateFieldGet2(_peerConnection, this);
		if (!peerConnection) throw new Error("RTCPeerConnection is not available in this environment");
		if (signal.type === "candidate") {
			await peerConnection.addIceCandidate(signal.candidate);
			return;
		}
		const { description } = signal;
		await peerConnection.setRemoteDescription(description);
		if (description.type === "offer") {
			const answer = await peerConnection.createAnswer();
			await peerConnection.setLocalDescription(answer);
			this.onSignal?.({
				type: "description",
				description: answer
			});
		}
	}
	async startSynchronized(lookaheadMs = _classPrivateFieldGet2(_options, this).startLookaheadMs) {
		if (this.role !== "leader") throw new Error("Only the leader can initiate synchronized start");
		if (this.timer.isRunning) await this.timer.stopTimer();
		_classPrivateFieldSet2(_transportSnapshot, this, _assertClassBrand(_WebRTCSyncController_brand, this, _readTransportSnapshot).call(this));
		_classPrivateFieldSet2(_leaderStartTimeMs, this, _assertClassBrand(_WebRTCSyncController_brand, this, _nowMs).call(this) + Math.max(250, lookaheadMs));
		_assertClassBrand(_WebRTCSyncController_brand, this, _send).call(this, {
			type: "prepare-start",
			leaderStartTimeMs: _classPrivateFieldGet2(_leaderStartTimeMs, this),
			transport: _classPrivateFieldGet2(_transportSnapshot, this)
		});
		const delayMs = Math.max(0, _classPrivateFieldGet2(_leaderStartTimeMs, this) - _assertClassBrand(_WebRTCSyncController_brand, this, _nowMs).call(this));
		globalThis.setTimeout(() => {
			this.timer.startTimer(this.timer.callback);
		}, delayMs);
	}
	async stopSynchronized() {
		if (this.role === "leader") _assertClassBrand(_WebRTCSyncController_brand, this, _send).call(this, {
			type: "stop",
			leaderTimeMs: _assertClassBrand(_WebRTCSyncController_brand, this, _nowMs).call(this)
		});
		_classPrivateFieldSet2(_leaderStartTimeMs, this, null);
		_assertClassBrand(_WebRTCSyncController_brand, this, _clearScheduledTick).call(this);
		_classPrivateFieldSet2(_isFollowerRunning, this, false);
		await this.timer.stopTimer();
	}
	broadcastTempoUpdate(effectiveLeaderTimeMs = _assertClassBrand(_WebRTCSyncController_brand, this, _nowMs).call(this) + _classPrivateFieldGet2(_options, this).startLookaheadMs) {
		if (this.role !== "leader") return;
		_classPrivateFieldSet2(_transportSnapshot, this, _assertClassBrand(_WebRTCSyncController_brand, this, _readTransportSnapshot).call(this));
		_assertClassBrand(_WebRTCSyncController_brand, this, _send).call(this, {
			type: "tempo-update",
			effectiveLeaderTimeMs,
			transport: _classPrivateFieldGet2(_transportSnapshot, this)
		});
	}
	getState() {
		const estimate = _classPrivateFieldGet2(_syncSession, this).getEstimate();
		return {
			role: this.role,
			connected: _classPrivateFieldGet2(_dataChannel, this)?.readyState === "open",
			sampleCount: estimate.sampleCount,
			offsetMs: estimate.offsetMs,
			rttMs: estimate.rttMs,
			jitterMs: estimate.jitterMs,
			locked: estimate.locked
		};
	}
	async destroy() {
		_classPrivateFieldSet2(_destroyed, this, true);
		_assertClassBrand(_WebRTCSyncController_brand, this, _stopPingLoop).call(this);
		_assertClassBrand(_WebRTCSyncController_brand, this, _stopHeartbeatLoop).call(this);
		_assertClassBrand(_WebRTCSyncController_brand, this, _clearScheduledTick).call(this);
		_classPrivateFieldSet2(_isFollowerRunning, this, false);
		if (_classPrivateFieldGet2(_dataChannel, this)) {
			_classPrivateFieldGet2(_dataChannel, this).close();
			_classPrivateFieldSet2(_dataChannel, this, null);
		}
		if (_classPrivateFieldGet2(_peerConnection, this)) {
			_classPrivateFieldGet2(_peerConnection, this).close();
			_classPrivateFieldSet2(_peerConnection, this, null);
		}
	}
};
function _nowMs() {
	return performance.now();
}
function _readTransportSnapshot() {
	return {
		bpm: this.timer.BPM,
		divisions: this.timer.divisions,
		bars: this.timer.bars,
		swing: this.timer.swing,
		periodMs: this.timer.timeBetween
	};
}
function _emitState() {
	const estimate = _classPrivateFieldGet2(_syncSession, this).getEstimate();
	this.onStateChange?.({
		role: this.role,
		connected: _classPrivateFieldGet2(_dataChannel, this)?.readyState === "open",
		sampleCount: estimate.sampleCount,
		offsetMs: estimate.offsetMs,
		rttMs: estimate.rttMs,
		jitterMs: estimate.jitterMs,
		locked: estimate.locked
	});
}
function _ensurePeerConnection() {
	if (_classPrivateFieldGet2(_peerConnection, this) || typeof RTCPeerConnection === "undefined") return;
	const peerConnection = new RTCPeerConnection(_classPrivateFieldGet2(_options, this).rtcConfig ?? DEFAULT_RTC_CONFIGURATION);
	_classPrivateFieldSet2(_peerConnection, this, peerConnection);
	peerConnection.onicecandidate = (event) => {
		if (event.candidate) this.onSignal?.({
			type: "candidate",
			candidate: event.candidate.toJSON()
		});
	};
	peerConnection.ondatachannel = (event) => {
		_assertClassBrand(_WebRTCSyncController_brand, this, _attachDataChannel).call(this, event.channel);
	};
	if (this.role === "leader") {
		const dataChannel = peerConnection.createDataChannel(_classPrivateFieldGet2(_options, this).channelLabel, { ordered: true });
		_assertClassBrand(_WebRTCSyncController_brand, this, _attachDataChannel).call(this, dataChannel);
	}
}
function _attachDataChannel(dataChannel) {
	_classPrivateFieldSet2(_dataChannel, this, dataChannel);
	dataChannel.onopen = () => {
		if (this.role === "follower") _assertClassBrand(_WebRTCSyncController_brand, this, _startPingLoop).call(this);
		else _assertClassBrand(_WebRTCSyncController_brand, this, _startHeartbeatLoop).call(this);
		_assertClassBrand(_WebRTCSyncController_brand, this, _emitState).call(this);
	};
	dataChannel.onclose = () => {
		_assertClassBrand(_WebRTCSyncController_brand, this, _stopPingLoop).call(this);
		_assertClassBrand(_WebRTCSyncController_brand, this, _stopHeartbeatLoop).call(this);
		_assertClassBrand(_WebRTCSyncController_brand, this, _clearScheduledTick).call(this);
		_assertClassBrand(_WebRTCSyncController_brand, this, _emitState).call(this);
	};
	dataChannel.onmessage = (event) => {
		const parsed = JSON.parse(String(event.data));
		_assertClassBrand(_WebRTCSyncController_brand, this, _handleWireMessage).call(this, parsed);
	};
}
function _send(message) {
	if (_classPrivateFieldGet2(_destroyed, this) || !_classPrivateFieldGet2(_dataChannel, this) || _classPrivateFieldGet2(_dataChannel, this).readyState !== "open") return;
	_classPrivateFieldGet2(_dataChannel, this).send(JSON.stringify(message));
}
async function _waitForIceGatheringComplete() {
	const peerConnection = _classPrivateFieldGet2(_peerConnection, this);
	if (!peerConnection || peerConnection.iceGatheringState === "complete") return;
	await new Promise((resolve) => {
		const onStateChange = () => {
			if (!peerConnection || peerConnection.iceGatheringState !== "complete") return;
			peerConnection.removeEventListener("icegatheringstatechange", onStateChange);
			resolve();
		};
		peerConnection.addEventListener("icegatheringstatechange", onStateChange);
	});
}
function _startPingLoop() {
	_assertClassBrand(_WebRTCSyncController_brand, this, _stopPingLoop).call(this);
	const ping = () => {
		const clientSendTimeMs = _assertClassBrand(_WebRTCSyncController_brand, this, _nowMs).call(this);
		_assertClassBrand(_WebRTCSyncController_brand, this, _send).call(this, {
			type: "sync-ping",
			id: `${clientSendTimeMs}-${Math.random()}`,
			clientSendTimeMs
		});
	};
	ping();
	_classPrivateFieldSet2(_pingIntervalId, this, setInterval(ping, _classPrivateFieldGet2(_options, this).pingIntervalMs));
}
function _stopPingLoop() {
	if (_classPrivateFieldGet2(_pingIntervalId, this)) {
		clearInterval(_classPrivateFieldGet2(_pingIntervalId, this));
		_classPrivateFieldSet2(_pingIntervalId, this, null);
	}
}
function _startHeartbeatLoop() {
	_assertClassBrand(_WebRTCSyncController_brand, this, _stopHeartbeatLoop).call(this);
	const beat = () => {
		_classPrivateFieldSet2(_transportSnapshot, this, _assertClassBrand(_WebRTCSyncController_brand, this, _readTransportSnapshot).call(this));
		_assertClassBrand(_WebRTCSyncController_brand, this, _send).call(this, {
			type: "heartbeat",
			leaderNowMs: _assertClassBrand(_WebRTCSyncController_brand, this, _nowMs).call(this),
			transport: _classPrivateFieldGet2(_transportSnapshot, this),
			leaderStartTimeMs: _classPrivateFieldGet2(_leaderStartTimeMs, this)
		});
	};
	beat();
	_classPrivateFieldSet2(_heartbeatIntervalId, this, setInterval(beat, _classPrivateFieldGet2(_options, this).heartbeatIntervalMs));
}
function _stopHeartbeatLoop() {
	if (_classPrivateFieldGet2(_heartbeatIntervalId, this)) {
		clearInterval(_classPrivateFieldGet2(_heartbeatIntervalId, this));
		_classPrivateFieldSet2(_heartbeatIntervalId, this, null);
	}
}
function _handleWireMessage(message) {
	switch (message.type) {
		case "sync-ping": {
			if (this.role !== "leader") return;
			const leaderReceiveTimeMs = _assertClassBrand(_WebRTCSyncController_brand, this, _nowMs).call(this);
			const leaderSendTimeMs = _assertClassBrand(_WebRTCSyncController_brand, this, _nowMs).call(this);
			_assertClassBrand(_WebRTCSyncController_brand, this, _send).call(this, {
				type: "sync-pong",
				id: message.id,
				clientSendTimeMs: message.clientSendTimeMs,
				leaderReceiveTimeMs,
				leaderSendTimeMs
			});
			break;
		}
		case "sync-pong":
			if (this.role !== "follower") return;
			_classPrivateFieldGet2(_syncSession, this).addSample({
				clientSendTimeMs: message.clientSendTimeMs,
				leaderReceiveTimeMs: message.leaderReceiveTimeMs,
				leaderSendTimeMs: message.leaderSendTimeMs,
				clientReceiveTimeMs: _assertClassBrand(_WebRTCSyncController_brand, this, _nowMs).call(this)
			});
			_assertClassBrand(_WebRTCSyncController_brand, this, _emitState).call(this);
			if (_classPrivateFieldGet2(_leaderStartTimeMs, this) !== null && _classPrivateFieldGet2(_isFollowerRunning, this)) _assertClassBrand(_WebRTCSyncController_brand, this, _scheduleNextFollowerTick).call(this);
			break;
		case "prepare-start":
			if (this.role !== "follower") return;
			_classPrivateFieldSet2(_transportSnapshot, this, message.transport);
			_classPrivateFieldSet2(_leaderStartTimeMs, this, message.leaderStartTimeMs);
			_assertClassBrand(_WebRTCSyncController_brand, this, _prepareFollowerStart).call(this);
			break;
		case "heartbeat":
			if (this.role !== "follower") return;
			_classPrivateFieldSet2(_transportSnapshot, this, message.transport);
			_classPrivateFieldSet2(_leaderStartTimeMs, this, message.leaderStartTimeMs);
			if (_classPrivateFieldGet2(_isFollowerRunning, this)) _assertClassBrand(_WebRTCSyncController_brand, this, _scheduleNextFollowerTick).call(this, message.leaderNowMs);
			break;
		case "tempo-update":
			if (this.role !== "follower") return;
			_classPrivateFieldSet2(_transportSnapshot, this, message.transport);
			this.timer.bars = message.transport.bars;
			this.timer.divisions = message.transport.divisions;
			this.timer.swing = message.transport.swing;
			this.timer.BPM = message.transport.bpm;
			if (_classPrivateFieldGet2(_isFollowerRunning, this)) {
				const localEffectiveTime = _classPrivateFieldGet2(_syncSession, this).leaderToLocalTime(message.effectiveLeaderTimeMs);
				globalThis.setTimeout(() => {
					_assertClassBrand(_WebRTCSyncController_brand, this, _scheduleNextFollowerTick).call(this);
				}, Math.max(0, localEffectiveTime - _assertClassBrand(_WebRTCSyncController_brand, this, _nowMs).call(this)));
			}
			break;
		case "stop":
			this.stopSynchronized();
			break;
	}
}
async function _prepareFollowerStart() {
	this.timer.bars = _classPrivateFieldGet2(_transportSnapshot, this).bars;
	this.timer.divisions = _classPrivateFieldGet2(_transportSnapshot, this).divisions;
	this.timer.swing = _classPrivateFieldGet2(_transportSnapshot, this).swing;
	this.timer.BPM = _classPrivateFieldGet2(_transportSnapshot, this).bpm;
	this.timer.bypass(true);
	this.timer.resetTimer();
	_classPrivateFieldSet2(_lastTriggeredTick, this, -1);
	_classPrivateFieldSet2(_isFollowerRunning, this, true);
	await this.timer.startTimer(this.timer.callback);
	_assertClassBrand(_WebRTCSyncController_brand, this, _scheduleNextFollowerTick).call(this);
}
function _clearScheduledTick() {
	if (_classPrivateFieldGet2(_scheduledTickTimeoutId, this)) {
		clearTimeout(_classPrivateFieldGet2(_scheduledTickTimeoutId, this));
		_classPrivateFieldSet2(_scheduledTickTimeoutId, this, null);
	}
}
function _getTickDurationMs() {
	return 6e4 / (_classPrivateFieldGet2(_transportSnapshot, this).bpm * _classPrivateFieldGet2(_transportSnapshot, this).divisions);
}
function _scheduleNextFollowerTick(leaderNowMs = _classPrivateFieldGet2(_syncSession, this).localToLeaderTime(_assertClassBrand(_WebRTCSyncController_brand, this, _nowMs).call(this))) {
	if (!_classPrivateFieldGet2(_isFollowerRunning, this) || _classPrivateFieldGet2(_leaderStartTimeMs, this) === null) return;
	_assertClassBrand(_WebRTCSyncController_brand, this, _clearScheduledTick).call(this);
	const tickDurationMs = _assertClassBrand(_WebRTCSyncController_brand, this, _getTickDurationMs).call(this);
	const leaderElapsedMs = leaderNowMs - _classPrivateFieldGet2(_leaderStartTimeMs, this);
	const nextTickIndex = Math.max(_classPrivateFieldGet2(_lastTriggeredTick, this) + 1, leaderElapsedMs <= 0 ? 0 : Math.ceil(leaderElapsedMs / tickDurationMs));
	const targetLeaderTimeMs = _classPrivateFieldGet2(_leaderStartTimeMs, this) + nextTickIndex * tickDurationMs;
	const targetLocalTimeMs = _classPrivateFieldGet2(_syncSession, this).leaderToLocalTime(targetLeaderTimeMs);
	const delayMs = Math.max(0, targetLocalTimeMs - _assertClassBrand(_WebRTCSyncController_brand, this, _nowMs).call(this));
	_classPrivateFieldSet2(_scheduledTickTimeoutId, this, setTimeout(() => {
		const actualLeaderTimeMs = _classPrivateFieldGet2(_syncSession, this).localToLeaderTime(_assertClassBrand(_WebRTCSyncController_brand, this, _nowMs).call(this));
		const phaseErrorMs = actualLeaderTimeMs - targetLeaderTimeMs;
		if (Math.abs(phaseErrorMs) > _classPrivateFieldGet2(_options, this).resyncThresholdMs) {
			_assertClassBrand(_WebRTCSyncController_brand, this, _scheduleNextFollowerTick).call(this, actualLeaderTimeMs);
			return;
		}
		_classPrivateFieldSet2(_lastTriggeredTick, this, nextTickIndex);
		this.timer.externalTrigger(true);
		_assertClassBrand(_WebRTCSyncController_brand, this, _scheduleNextFollowerTick).call(this);
	}, delayMs));
}
var createWebRTCSyncController = (timer, options) => new WebRTCSyncController(timer, options);
//#endregion
export { AudioClock, AudioContextWorkerWrapper, AudioTimer, CMD_ADJUST_DRIFT, CMD_INITIALISE, CMD_START, CMD_STOP, CMD_UPDATE, DEFAULT_SYNC_OPTIONS, DEFAULT_SYNC_SESSION_SAMPLE_WINDOW, DEFAULT_TIMER_OPTIONS, EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK, MICROSECONDS_PER_MINUTE, RollingTimeWorkerWrapper, SECONDS_PER_MINUTE, SetIntervalWorkerWrapper, SetTimeoutWorkerWrapper, SyncSession, TIMER_TYPES, TIMER_TYPE_AUDIO_CONTEXT, TIMER_TYPE_AUDIO_WORKLET, TIMER_TYPE_ELASTIC_AUDIO_WORKLET, TIMER_TYPE_OPTIONS, TIMER_TYPE_ROLLING, TIMER_TYPE_SET_INTERVAL, TIMER_TYPE_SET_TIMEOUT, Ticks, Timer, WORKLET_TIMER_TYPES, WebRTCSyncController, convertBPMToPeriod, convertMIDIClockIntervalToBPM, convertPeriodToBPM, createTimer, createWebRTCSyncController, formatTimeStampFromSeconds, getTimer, getTimerTypeDescription, isValidTimerType, isWorkletTimerType, resetTimer, secondsToTicks, setTimeBetween, startTimer, stopTimer, tapTempo, tapTempoQuick };

//# sourceMappingURL=index.js.map