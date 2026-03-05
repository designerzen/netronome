import { type TimerType } from './timer-types';
import type { WorkerWrapper } from './vite-env';
import { TimerOptions } from './timer-options';
import type { ITimerControl, TimingHandler, TimerCallbackEvent } from './timer-interfaces';
export declare const MAX_BARS_ALLOWED = 32;
export type { ITimerControl, TimingHandler, TimerCallbackEvent };
/**
 * Resolve a timer type string to its corresponding Worker constructor
 * @param timerType Timer type ID string (e.g., TIMER_TYPE_AUDIO_CONTEXT)
 * @returns Worker constructor or null if not found
 * @example
 * const workerClass = resolveTimerType(TIMER_TYPE_AUDIO_CONTEXT)
 */
export declare const resolveTimerType: (timerType: TimerType | string) => WorkerWrapper | null;
/**
 * Simple boolean test to work out if this is a Worklet
 * or a simple Worker file (not very smart - may break in future)
 * @param file
 * @returns boolean indicating if file is a worklet
 */
export declare const isFileWorklet: (file: string | TimerType) => boolean;
export default class Timer {
    #private;
    startTime: number;
    period: number;
    currentBar: number;
    divisions: number;
    bars: number;
    swingOffset: number;
    divisionsElapsed: number;
    totalBarsElapsed: number;
    lastRecordedTime: number;
    lastRecordedExternalTime: number;
    isCompatible: boolean;
    timingWorkHandler: TimingHandler;
    audioContext?: AudioContext;
    loaded: Promise<void>;
    callback?: (event: TimerCallbackEvent) => void;
    getNow: () => number;
    get options(): TimerOptions;
    /**
     * Can we use this timing method on this device?
     * @returns boolean is the worker available and compatable
     */
    get isRunning(): boolean;
    get running(): boolean;
    /**
     * Can we use this timing method on this device?
     * @returns boolean is the worker available and compatable
     */
    get available(): boolean;
    get isBypassed(): boolean;
    /**
     *
     */
    get isActive(): boolean;
    /**
     * Accurate time in milliseconds
     * @returns number The current time as of now
     */
    get now(): number;
    /**
     * Fetch current bar length in milliseconds
     * @returns number bar length in milliseconds
     */
    get timeBetween(): number;
    /**
     * Amount of time elapsed since startTimer() in seconds
     * @returns number in seconds
     */
    get timeElapsed(): number;
    /**
     * Fetch whole loop length in milliseconds
     * @returns number length in milliseconds
     */
    get totalTime(): number;
    /**
     * Fetch current bar
     * @returns number current bar
     */
    get bar(): number;
    /**
     * Fetch total bars completed
     * @returns number total bars
     */
    get barsElapsed(): number;
    get elapsedSinceLastTick(): number;
    /**
     * Fetch total bar quantity
     * @returns number total bars
     */
    get totalBars(): number;
    get totalDivisions(): number;
    /**
     * Percentage duration of bar progress 0->1
     * @returns number percentage elapsed
     */
    get barProgress(): number;
    /**
     * Percentage duration of beat progress 0->1
     * @returns number percentage elapsed
     */
    get beatProgress(): number;
    /**
     * Fetch current bar length in milliseconds
     * @returns number bar length in milliseconds
     */
    get timePerBar(): number;
    /**
     * Get the current timing as Beats per minute
     * BPM = 60,000,000 / MicroTempo
     * @returns number BPM
     */
    get BPM(): number;
    get bpm(): number;
    /**
     * Get the duration of one beat (quarternote)
     * in microseconds
     * @returns number Microtempo
     */
    get quarterNoteDuration(): number;
    /**
     * Get the duration of one beat (quarternote)
     * in seconds
     * @returns number duration in seconds
     */
    get quarterNoteDurationInSeconds(): number;
    /**
     * Get the current timing as a Microtempo
     * @returns number Microtempo
     */
    get microTempo(): number;
    /**
     * Get the current timing in Micros per MIDI clock
     * MicrosPerMIDIClock = MicroTempo / 24 (MIDI 1.0 has 24 divisions)
     * @returns number Micros per MIDI clock
     */
    get microsPerMIDIClock(): number;
    /**
     * How many Ticks are there every second?
     * @returns number ticks per second
     */
    get ticksPerSecond(): number;
    get swing(): number;
    get isAtStart(): boolean;
    get isAtStartOfBar(): boolean;
    get isStartBar(): boolean;
    get isAtMiddleOfBar(): boolean;
    get isQuarterNote(): boolean;
    get isHalfNote(): boolean;
    get isSwungBeat(): boolean;
    get isUsingExternalTrigger(): boolean;
    /**
     * Fetch current bar
     * @param value bar number
     */
    set bar(value: number | string);
    /**
     * Allows a user to set the total number of bars
     * @param value How many bars to have in a measure
     */
    set totalBars(value: number);
    /**
     * Set the current timing using a BPM where
     * one beat in milliseconds =  60,000 / BPM
     *
     * @param value Beats per minute
     */
    set BPM(value: number | string);
    set bpm(value: number | string);
    set tempo(value: number | string);
    /**
     * Using a time in milliseconds, set the amount of time between tick and tock
     * @param time Amount of millieconds between ticks
     */
    set timeBetween(time: number);
    /**
     * Passed in the onBeat callback as a variant
     * to determine when the "beat" should occur
     */
    set swing(value: number);
    constructor(options?: TimerOptions, isWorklet?: boolean);
    /**
     * Set the function that gets called on every divixional tick
     * @param callback Method to call when the timer ticks
     */
    setCallback(callback: (event: TimerCallbackEvent) => void): void;
    /**
     * Allows us to disable the existing route to send our own
     * or to inject them into here
     *
     * @param useExternalClock whether to use external clock
     * @returns trigger function
     */
    bypass(useExternalClock?: boolean): () => void;
    /**
     * Convert seconds to MIDI clock ticks based on current BPM
     * @param seconds Time in seconds
     * @returns Number of MIDI clock ticks (24 ticks per quarter note)
     */
    secondsToTicks(seconds: number): number;
    /**
     * Convert time to ticks using the current tick per second rate
     * @param time in seconds
     * @returns number of ticks
     */
    convertToTicks(time: number): number;
    createTick(intervals: number, timePased: number): void;
    /**
     * Set the worklet as the main timing mechanism
     * @param type URL or identifier
     * @param processor processor name
     * @param audioContext audio context
     * @returns the worklet node
     */
    setTimingWorklet(type: string, processor: string, audioContext?: AudioContext): Promise<TimingHandler>;
    /**
     * Load in the Worker URI
     * @param type URL or identifier
     * @returns the worker instance
     */
    loadTimingWorker(type: string | WorkerWrapper): Promise<Worker>;
    /**
     * In the future, we may be able to pass offlineAudioContext to a worker
     * and at that point, we can finally tie in the actual timing by using the
     * context as the global clock!
     * NB. We NOW CAN! User the setTimingWorklet instead :)
     * @param type URL, identifier, or timer type string constant
     * @returns the worker instance or null if failed
     */
    setTimingWorker(type: string | WorkerWrapper): Promise<Worker | null>;
    /**
     * Unregister any Worker set
     * @returns boolean success
     */
    unsetTimingWorker(): Promise<boolean>;
    /**
     * Switch to a different timing worker/worklet type
     * Safely handles switching even if the timer is currently running
     * @param timerType Timer type string constant (e.g., TIMER_TYPE_AUDIO_CONTEXT)
     * @param audioContext Optional AudioContext for worklet types
     * @returns Success status
     * @throws Error if the timer type is invalid or switching fails
     */
    switchTimerType(timerType: TimerType | string, audioContext?: AudioContext): Promise<boolean>;
    /**
     * Add a worker or worklet into the pipeline
     * and monitor it's events and messages
     * @param worker the worker instance
     */
    connectWorker(worker: TimingHandler): void;
    postMessage(payload: Record<string, unknown>): void;
    /**
     * Disconnect the worker from the timer
     * @param worker the worker to disconnect
     * @param setStopped whether to set isRunning to false
     */
    disconnectWorker(worker: TimingHandler, setStopped?: boolean): void;
    /**
     * Reset the timer and start from the beginning
     */
    resetTimer(): void;
    start(): Promise<{
        time: number;
        interval: number;
        worker: TimingHandler;
    }>;
    stop(): Promise<{
        currentTime: number;
        worker: TimingHandler;
    }>;
    toggle(): Promise<boolean>;
    /**
     * Starts the timer and begins events being dispatched
     *
     * @param callback optional callback to call on each tick
     * @param options optional options
     * @returns object with current time and worker/worklet
     */
    startTimer(callback?: (event: TimerCallbackEvent) => void, options?: Record<string, unknown>): Promise<{
        time: number;
        interval: number;
        worker: TimingHandler;
    }>;
    /**
     * Stops the timer and prevents events being dispatched
     * @returns object with current time and worker/worklet
     */
    stopTimer(): Promise<{
        currentTime: number;
        worker: TimingHandler;
    }>;
    /**
     * Start the timer if it is paused...
     * or stop the timer if it is running
     *
     * @param callback optional callback to call on each tick
     * @param options optional options
     * @returns boolean indicating if timer is running
     */
    toggleTimer(callback?: (event: TimerCallbackEvent) => void, options?: Record<string, unknown>): Promise<boolean>;
    /**
     * Tap a tempo into the system
     * requires 3 taps to set the tempo
     * @returns the detected tempo in BPM, or -1 if not enough taps
     */
    tapTempo(): number;
    /**
     * Get the current synchronization offset
     * @returns the offset in milliseconds to the next global tick
     */
    getSynchronizationOffset(): number;
    /**
     * Get the current tick number on the global metronome grid
     * @returns the tick number
     */
    getGlobalTickNumber(): number;
    /**
     * Enable or disable synchronization for this timer
     * @param enabled whether synchronization should be enabled
     */
    setSynchronized(enabled: boolean): void;
    /**
     * Check if this timer is synch to the global grid
     * @returns whether synchronization is enabled
     */
    isSynchronized(): boolean;
    /**
     * Use an external device to send clock signals to and through this timer
     * such as the MIDI clock signal
     * @param advance whether to advance the divisions counter
     */
    externalTrigger(advance?: boolean): void;
    /**
     * Repeat previous clock tick but do not advance
     */
    retrigger(): void;
    /**
     * EVENT: Timer is available
     */
    onAvailable: () => void;
    /**
     * EVENT: Timer is unavailable
     */
    onUnavailable: () => void;
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
    onTick(timePassed: number, expected: number, drift?: number, level?: number, intervals?: number, lag?: number): void;
}
export { TIMER_TYPE_AUDIO_CONTEXT, TIMER_TYPE_AUDIO_WORKLET, TIMER_TYPE_ROLLING, TIMER_TYPE_SET_INTERVAL, TIMER_TYPE_SET_TIMEOUT, TIMER_TYPES, isValidTimerType, getTimerTypeDescription, type TimerType, } from './timer-types';
//# sourceMappingURL=timer.d.ts.map