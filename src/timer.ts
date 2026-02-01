/**
 * Instance based version of timing
 * To allow hybrid timing events and for multiple
 * clocks to run at different rates
 */
import {
    CMD_START, CMD_STOP, CMD_UPDATE,
    EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from './timer-event-types'

import { AUDIOCONTEXT_WORKER_URI, AUDIOCONTEXT_WORKLET_URI } from './timer-worker-types'

import { tapTempoQuick } from './tap-tempo'
import { Ticks, MICROSECONDS_PER_MINUTE, SECONDS_PER_MINUTE } from './time-utils'
import { WorkerWrapper } from './vite-env'

export const MAX_BARS_ALLOWED = 32

interface TimerOptions {
    bars?: number
    divisions?: number
    bpm?: number
    accurate?:boolean
    contexts?: Record<string, unknown> | null
    type?: string|WorkerWrapper
    processor?: string
    callback?: ((event: TimerCallbackEvent) => void) | null
    audioContext?: AudioContext
}

type TimingHandler = Worker | AudioWorkletNode | null

interface TimerCallbackEvent {
    bar: number
    bars: number
    divisionsElapsed: number
    barsElapsed: number
    elapsed: number
    timePassed: number
    expected: number
    drift: number
    level: number
    intervals: number
    lag: number
}

const DEFAULT_TIMER_OPTIONS: TimerOptions = {
    
    accurate:false,

    bars: 16,
    
    // keep this at 24 to match MIDI1.0 spec
    // where there are 24 ticks per quarternote (one beat)
    divisions: 24,

    bpm: 90,

    contexts: null,

    // can be base64 encoded too
    type: AUDIOCONTEXT_WORKER_URI,
    // type:AUDIOTIMER_WORKLET_URI,
    // processor:AUDIOTIMER_PROCESSOR_URI,

    callback: null
}

/**
 * Simple boolean test to work out if this is a Worklet
 * or a simple Worker file (not very smart - may break in future)
 * @param file
 * @returns boolean indicating if file is a worklet
 */
export const isFileWorklet = (file: string): boolean => {

    if (typeof file === "function") {
        return false
    }
    if (file.indexOf("orklet") > -1) {
        return true
    }
    if (file.indexOf("data:text/javascript;base64,") > -1) {
        return true
    }
    return false
}


export default class Timer {

    startTime: number = -1
    period: number = 100

    // for time formatting...
    currentBar: number = 0

    divisions: number = 24	// 24 quarter notes in a bar
    bars: number = 16		// 16 bars in a measure
    swingOffset: number = 0	// from 0 -> divisions

    divisionsElapsed: number = 0
    totalBarsElapsed: number = 0

    lastRecordedTime: number = 0
    lastRecordedExternalTime: number = 0

    #running: boolean = false
    #active: boolean = false
    #bypassed: boolean = false
    isCompatible: boolean = false

    timingWorkHandler: TimingHandler = null
    audioContext?: AudioContext

    loaded: Promise<void>

    #options:TimerOptions

    callback?: (event: TimerCallbackEvent) => void

    // we overwrite this with an audioContext if available
    getNow = (): number => performance.timeOrigin + performance.now()

    get options(){
        return this.#options
    }

    /**
     * Can we use this timing method on this device?
     * @returns boolean is the worker available and compatable
     */
    get isRunning():boolean{
        return this.#running
    }
    get running(): boolean {
        return this.#running
    }

    /**
     * Can we use this timing method on this device?
     * @returns boolean is the worker available and compatable
     */
    get available(): boolean {
        return this.isCompatible
    }

    get isBypassed():boolean {
        return this.#bypassed
    }
    
    /**
     * 
     */
    get isActive(): boolean {
        return this.#active
    }

    /**
     * Accurate time in milliseconds
     * @returns number The current time as of now
     */
    get now(): number {
        return this.getNow()
    }

    /**
     * Fetch current bar length in milliseconds
     * @returns number bar length in milliseconds
     */
    get timeBetween(): number {
        return this.period
    }

    /**
     * Amount of time elapsed since startTimer() in seconds
     * @returns number in seconds
     */
    get timeElapsed(): number {
        // How long has elapsed according to audio context
        return (this.now - this.startTime)// * 0.001 
    }

    /**
     * Fetch whole loop length in milliseconds
     * @returns number length in milliseconds
     */
    get totalTime(): number {
        return this.timePerBar * this.bars
    }

    /**
     * Fetch current bar
     * @returns number current bar
     */
    get bar(): number {
        return this.currentBar
    }

    /**
     * Fetch total bars completed
     * @returns number total bars
     */
    get barsElapsed(): number {
        return Math.floor(this.totalBarsElapsed / this.bars)
    }

    get elapsedSinceLastTick(): number {
        return this.now - this.lastRecordedTime
    }

    /**
     * Fetch total bar quantity
     * @returns number total bars
     */
    get totalBars(): number {
        return this.bars
    }

    get totalDivisions(): number {
        return this.divisions
    }

    /**
     * Percentage duration of bar progress 0->1
     * @returns number percentage elapsed
     */
    get barProgress(): number {
        return this.currentBar / this.bars
    }

    /**
     * Percentage duration of beat progress 0->1
     * @returns number percentage elapsed
     */
    get beatProgress(): number {
        return this.divisionsElapsed / this.totalDivisions
    }


    // Bar times

    /**
     * Fetch current bar length in milliseconds
     * @returns number bar length in milliseconds
     */
    get timePerBar(): number {
        return this.period * this.divisions
    }

    /**
     * Get the current timing as Beats per minute
     * BPM = 60,000,000 / MicroTempo
     * @returns number BPM
     */
    get BPM(): number {
        return MICROSECONDS_PER_MINUTE / this.timePerBar
    }
    get bpm(): number {
        return this.BPM
    }

    /**
     * Get the duration of one beat (quarternote) 
     * in microseconds
     * @returns number Microtempo
     */
    get quarterNoteDuration(): number {
        return MICROSECONDS_PER_MINUTE / this.bpm
    }

    /**
     * Get the duration of one beat (quarternote) 
     * in seconds
     * @returns number duration in seconds
     */
    get quarterNoteDurationInSeconds(): number {
        return SECONDS_PER_MINUTE / this.bpm
    }

    /**
     * Get the current timing as a Microtempo 
     * @returns number Microtempo
     */
    get microTempo(): number {
        return this.timePerBar * 0.001
    }

    /**
     * Get the current timing in Micros per MIDI clock
     * MicrosPerMIDIClock = MicroTempo / 24 (MIDI 1.0 has 24 divisions)
     * @returns number Micros per MIDI clock
     */
    get microsPerMIDIClock(): number {
        return this.microTempo / this.divisions
    }

    /**
     * How many Ticks are there every second?
     * @returns number ticks per second
     */
    get ticksPerSecond(): number {
        return Ticks.Beat / this.quarterNoteDurationInSeconds
    }

    get swing(): number {
        return this.swingOffset / this.divisions
    }


    // Positions & booleans

    get isAtStartOfBar(): boolean {
        return this.barProgress === 0
    }
    get isStartBar(): boolean {
        return this.currentBar === 0
    }
    get isAtStart(): boolean {
        return this.divisionsElapsed === 0
    }
    get isAtMiddleOfBar(): boolean {
        return this.barProgress === 0.5
    }
    get isQuarterNote(): boolean {
        return this.beatProgress % 0.25 === 0
    }
    get isHalfNote(): boolean {
        return this.beatProgress % 0.5 === 0
    }
    get isSwungBeat(): boolean {
        return this.divisionsElapsed % this.swingOffset === 0
    }
    get isUsingExternalTrigger(): boolean {
        return this.#bypassed
    }

    // Setters ------------------------------------------------------

    /**
     * Fetch current bar
     * @param value bar number
     */
    set bar(value: number | string) {
        this.currentBar = parseInt(String(value))
    }

    /**
     * Allows a user to set the total number of bars
     * @param value How many bars to have in a measure
     */
    set totalBars(value: number) {
        this.bars = value < 1 ? 1 : value > MAX_BARS_ALLOWED ? MAX_BARS_ALLOWED : value
    }

    /**
     * Set the current timing using a BPM where 
     * one beat in milliseconds =  60,000 / BPM
     * 
     * @param value Beats per minute
     */
    set BPM(value: number | string) {
        this.timeBetween = 60000 / Math.max(10, parseFloat(String(value)))
    }
    set bpm(value: number | string) {
        this.BPM = value
    }
    set tempo(value: number | string) {
        this.BPM = value
    }

    /**
     * Using a time in milliseconds, set the amount of time between tick and tock
     * @param time Amount of millieconds between ticks
     */
    set timeBetween(time: number) {

        const interval = time / this.divisions
        // we want 16 notes
        this.period = interval

        // TODO
        // FIXME
        // if it is running, stop and restart it?
        //interval = newInterval
        this.postMessage({
            command: CMD_UPDATE,
            interval,
            time: this.now
        })
    }

    /**
     * Passed in the onBeat callback as a variant
     * to determine when the "beat" should occur
     */
    set swing(value: number) {
        this.swingOffset = value * this.divisions
    }

    constructor(options: TimerOptions = DEFAULT_TIMER_OPTIONS) {
        this.loaded = Promise.resolve()
        
        options = { ...DEFAULT_TIMER_OPTIONS, ...options }        
        this.#options = options

        const optionKeys = Object.keys(options)
        // const { contexts, type=AUDIOTIMER_WORKLET_URI, divisions=DIVISIONS, processor=AUDIOTIMER_PROCESSOR_URI} = options

        for (let key of optionKeys) {
            switch (key) {
                case "audioContext":
                    this.audioContext = options.audioContext as AudioContext
                    this.getNow = (): number => (this.audioContext!.currentTime * 1000)

                    break

                case "contexts":
                    if (options.contexts) {
                        for (let context in options.contexts) {
                            (this as Record<string, unknown>)[context] = options.contexts[context]
                        }
                    }
                    this.getNow = (): number => this.audioContext ? this.audioContext.currentTime * 1000 : performance.now()
                    break

                default:
                    (this as Record<string, unknown>)[key] = (options as Record<string, unknown>)[key]
                    console.warn("Timer option", key, (options as Record<string, unknown>)[key])
            }
        }

        // 
        const isWorklet = isFileWorklet(options.type || '')
        console.info("Timer:", options.type, this.timingWorkHandler, { isWorklet, options })

        if (isWorklet) {
            this.loaded = this.setTimingWorklet(
                options.type || '',
                options.processor || '',
                this.audioContext
            ) as any
        } else {
            this.loaded = this.setTimingWorker(options.type || '') as any
        }
    }

    /**
     * Set the function that gets called on every divixional tick
     * @param callback Method to call when the timer ticks
     */
    setCallback(callback: (event: TimerCallbackEvent) => void): void {
        this.callback = callback
    }

    /**
     * Allows us to disable the existing route to send our own
     * or to inject them into here 
     * 
     * @param useExternalClock whether to use external clock
     * @returns trigger function
     */
    bypass(useExternalClock: boolean = true): () => void {

        const trigger = (): void => {
            // call callback
            this.externalTrigger()
        }

        if (useExternalClock) {
            if (this.#bypassed) {
                return trigger
            }
            // we want to bypass the worker's work
            this.#bypassed = true
            if (this.#running) {
                // disconnect but don't destroy
                this.disconnectWorker(this.timingWorkHandler, false)
                console.info("timer runinng, bypassing... ")
            } else {
                console.info("bypassing... ignored")
            }

        } else {
            if (!this.#bypassed) {
                return trigger
            }
            this.#bypassed = false
            if (this.#running) {
                this.startTimer()
                console.info("restarting timer... ")
            } else {
                console.info("undoing bypass... ignored")
            }
        }

        return trigger
    }

    // CONVERSIONS --------------------------------------------------------------------------------

    /**
     * Convert seconds to MIDI clock ticks based on current BPM
     * @param seconds Time in seconds
     * @returns Number of MIDI clock ticks (24 ticks per quarter note)
     */
    secondsToTicks(seconds: number): number {
        return seconds * this.ticksPerSecond
    }

    /**
     * Convert time to ticks using the current tick per second rate
     * @param time in seconds
     * @returns number of ticks
     */
    convertToTicks(time: number): number {
        return time / this.ticksPerSecond
    }

    createTick(intervals: number, timePased: number): void {
        const timeBetweenPeriod = this.timeBetween * 0.001
        // Expected time stamp
        const expected = intervals * timeBetweenPeriod
        // How long has elapsed according to our worker
        const timePassed = timePased
        // how much spill over the expected timestamp is there
        const lag = timePassed % timeBetweenPeriod
        // should be 0 if the timer is working...
        const drift = timePassed - this.timeElapsed
        // deterministic intervals not neccessary
        const level = Math.floor(timePassed / this.timeBetween)
        // elapsed should === time
        if (this.#running) {
            this.onTick(timePassed, expected, drift, level, intervals, lag)
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
    async setTimingWorklet(type: string, processor: string, audioContext?: AudioContext): Promise<TimingHandler> {

        let wasRunning = this.#running

        // destroy any existing worklet
        if (this.timingWorkHandler) {
            await this.unsetTimingWorker()
        }

        // const imports = await import(type)
        const imports = await import('./workers/timing.audioworklet.ts')
        const Worklet = imports.default
        const { createTimingProcessor } = imports

        try {
            this.timingWorkHandler = await createTimingProcessor(audioContext as AudioContext)
            // this.timingWorkHandler = new Worklet( audioContext )

            // console.error(type, "timer.audioworklet", {module, audioContext}, this.timingWorker ) 
            if (wasRunning) {
                this.startTimer()
            }
            return this.timingWorkHandler
        } catch (error) {
            console.error("Failed to initialize AudioWorklet timer:", error)
            throw error
        }
    }

    // WORKER ------------------------------------------------------------------------------------

    /**
     * Load in the Worker URI
     * @param type URL or identifier
     * @returns the worker instance
     */
    async loadTimingWorker(type: string|WorkerWrapper): Promise<Worker> {
        if (typeof Worker === 'undefined') {
            throw new Error('Worker is not available in this environment')
        }
        
        try {
            // Handle Worker constructor (from ?worker imports)
            if (typeof type === 'function') {
                return new type()
            }
            // Handle URL strings
            else if (typeof type === 'string') {
                // Resolve relative to the app base path for GitHub Pages compatibility
                const baseUrl = `${window.location.origin}${import.meta.env.BASE_URL}`
                const url = new URL(type, baseUrl).href
                return new Worker(url, { type: 'module' })
            }
            else {
                throw new Error(`Invalid worker type: expected function or string, got ${typeof type}`)
            }
        } catch (error) {
            console.error('Failed to create worker:', type, error)
            throw error
        }
    }

    /**
     * In the future, we may be able to pass offlineAudioContext to a worker
     * and at that point, we can finally tie in the actual timing by using the 
     * context as the global clock!
     * NB. We NOW CAN! User the setTimingWorklet instead :)
     * @param type URL or identifier
     * @returns the worker instance or null if failed
     */
    async setTimingWorker(type: string): Promise<Worker | null> {
        try {

            let wasRunning = this.#running

            // destroy any existing worker
            if (this.timingWorkHandler) {
                await this.unsetTimingWorker()
            }

            this.timingWorkHandler = await this.loadTimingWorker(type)

            if (!this.timingWorkHandler) {
                throw Error("Timing Worker failed to load url: type:" + type)
            }


            if (wasRunning) {
                console.info("Starting timer worker", type, this.timingWorkHandler)
                this.startTimer()
            } else {
                console.info("Awaiting timer worker", type, this.timingWorkHandler)
            }

            return this.timingWorkHandler

        } catch (error) {

            this.isCompatible = false
            console.error("Timing WORKER FAILED TO LOAD", type, error)
        }
        return null
    }

    /**
     * Unregister any Worker set
     * @returns boolean success
     */
    async unsetTimingWorker(): Promise<boolean> {
        // TODO: clone the methods into new worker
        await this.stopTimer()
        const handler = this.timingWorkHandler
        if (handler) {
            if ('terminate' in handler) {
                (handler as Worker).terminate()
            }
            (handler as any).onmessage = null;
            (handler as any).onerror = null
        }
        this.timingWorkHandler = null
        return true
    }

    // SHARED WORKER / WORKLET CDE ------------------------------------------------------------------------------------

    /**
     * Add a worker or worklet into the pipeline
     * and monitor it's events and messages
     * @param worker the worker instance
     */
    connectWorker(worker: TimingHandler): void {

        if (!worker) {
            throw new Error("Timing Worker was not defined - please check paths " + worker)
        }

        // now hook into our worker bee and watch for timing changes
        (worker as any).onmessage = (e: MessageEvent<any>) => {

            const time = this.now
            const data = e.data

            switch (data.event) {
                case EVENT_READY:
                    //console.log("EVENT_READY", {time, data}) 
                    break

                case EVENT_STARTING:
                    // save start time
                    this.startTime = time
                    this.#running = true
                    this.resetTimer()
                    //console.log("EVENT_STARTING", {time:data.time, startTime})
                    break

                case EVENT_TICK:
                    // const timeBetweenPeriod = this.timeBetween * 0.001
                    // // How many ticks have occured yet
                    // const intervals = data.intervals
                    // // Expected time stamp
                    // const expected = intervals * timeBetweenPeriod

                    // // How long has elapsed according to our worker
                    // const timePassed = data.time
                    // // how much spill over the expected timestamp is there
                    // const lag = timePassed % timeBetweenPeriod
                    // // should be 0 if the timer is working...
                    // const drift = timePassed - this.timeElapsed
                    // // deterministic intervals not neccessary
                    // const level = Math.floor(timePassed / this.timeBetween)
                    // // elapsed should === time
                    // this.onTick(timePassed,expected, drift, level, intervals, lag)

                    // timingWorker.postMessage({command:CMD_UPDATE, time:currentTime, interval})
                    this.createTick(data.intervals, data.time)
                    break

                default:
                    console.log("message: ", e, time)
            }
        }

        // Worker Loading Error!
        (worker as any).onerror = (event: ErrorEvent) => {
            const payload = { error: event.message || 'Unknown error', time: this.now }
            console.error("Timer:Worker error", event, payload)
            if (worker) {
                (worker as any).postMessage(payload)
            }
        }
    }

    postMessage(payload: Record<string, unknown>): void {
        this.timingWorkHandler && (this.timingWorkHandler as any).postMessage(payload)
    }

    /**
     * Disconnect the worker from the timer
     * @param worker the worker to disconnect
     * @param setStopped whether to set isRunning to false
     */
    disconnectWorker(worker: TimingHandler, setStopped: boolean = true): void {
        if (!worker) return
        (worker as any).onmessage = (e: MessageEvent<any>) => {
            const data = e.data as Record<string, unknown>
            switch (data.event) {
                // Clean up
                case EVENT_STOPPING:
                    // destroy contexts and unsubscribe from events
                    if (setStopped) {
                        this.#running = false
                    }
                    break
            }
        }

        (worker as any).postMessage({
            command: CMD_STOP,
            time: this.now
        })
    }

    //--------------------------------------------------

    /**
     * Reset the timer and start from the beginning
     */
    resetTimer(): void {
        this.currentBar = 0
        this.totalBarsElapsed = 0
        this.divisionsElapsed = 0
    }

    async start(): Promise<{ time: number; interval: number; worker: TimingHandler }> {
        return this.startTimer(this.callback)
    }
    async stop(): Promise<{ currentTime: number; worker: TimingHandler }> {
        return this.stopTimer()
    }
    async toggle(): Promise<boolean> {
        return this.toggleTimer(this.callback)
    }

    /**
     * Starts the timer and begins events being dispatched
     * 
     * @param callback optional callback to call on each tick
     * @param options optional options
     * @returns object with current time and worker/worklet
     */
    async startTimer(
        callback?: (event: TimerCallbackEvent) => void,
        options: Record<string, unknown> = {}
    ): Promise<{ time: number; interval: number; worker: TimingHandler }> {

        await this.loaded

        const currentTime = this.now

        if (!this.#running) {
            // FIXME: Alter this behaviour for rolling count
            this.totalBarsElapsed = 0
        }

        if (callback) {
            this.setCallback(callback)
        }

        // if we are using an external clock
        // we try and determine the tempo ourselves
        if (this.#bypassed) {
            this.#running = true
            return {
                time: currentTime,
                interval: -1,
                worker: null
            }
        }

        this.connectWorker(this.timingWorkHandler)

        const payload = {
            command: CMD_START,
            time: currentTime,
            interval: this.period,
            accurateTiming: this.options.accurate
        }
        // send command to worker... options
        this.postMessage(payload)

        // console.log("Timer Starting...", { payload, timingWorker: this.timingWorkHandler} )

        return {
            time: currentTime,
            interval: this.period,
            worker: this.timingWorkHandler
        }
    }

    /**
     * Stops the timer and prevents events being dispatched
     * @returns object with current time and worker/worklet
     */
    async stopTimer(): Promise<{ currentTime: number; worker: TimingHandler }> {

        await this.loaded

        const currentTime = this.now
        // cancel the thing thrugh the workers first
        // cancel any scheduled quie noises
        this.disconnectWorker(this.timingWorkHandler)

        return {
            currentTime,
            worker: this.timingWorkHandler
        }
    }

    /**
     * Start the timer if it is paused...
     * or stop the timer if it is running
     * 
     * @param callback optional callback to call on each tick
     * @param options optional options
     * @returns boolean indicating if timer is running
     */
    async toggleTimer(
        callback?: (event: TimerCallbackEvent) => void,
        options: Record<string, unknown> = {}
    ): Promise<boolean> {
        if (this.#bypassed) {
            // we are using an external timer!
            return this.#running
        }
        if (!this.#running) {
            await this.startTimer(callback, options)
        } else {
            await this.stopTimer()
        }
        return this.#running
    }

    /**
     * Tap a tempo into the system
     * requires 3 taps to set the tempo
     * @returns the detected tempo in BPM, or -1 if not enough taps
     */
    tapTempo(): number {
        const tempo = tapTempoQuick()
        if (tempo > -1) {
            this.BPM = tempo
            return tempo
        }
        return -1
    }

    /**
     * Use an external device to send clock signals to and through this timer
     * such as the MIDI clock signal
     * @param advance whether to advance the divisions counter
     */
    externalTrigger(advance: boolean = true): void {
        // How long has elapsed according to our clock
        const timestamp = this.now
        this.lastRecordedExternalTime = timestamp

        // work out the BPOM from the clock...
        // const BPM = convertPeriodToBPM( period * 24 )

        // const period = tapTempo(true, 10000, 3)
        const elapsedSinceLastClock = timestamp - this.lastRecordedExternalTime
        // Expected time stamp
        const expected = this.divisionsElapsed * elapsedSinceLastClock
        // how much spill over the expected timestamp is there
        const lag = timestamp % elapsedSinceLastClock
        // should be 0 if the timer is working...
        const drift = timestamp - expected
        // deterministic intervals not neccessary
        const level = Math.floor(timestamp / elapsedSinceLastClock)

        // console.log("MIDI CLOCK", BPM, period, elapsedSinceLastClock, timestamp )

        if (this.#running && this.#bypassed) {
            this.onTick(elapsedSinceLastClock, expected, drift, level, this.divisionsElapsed, lag)
        }
        if (advance) {
            this.divisionsElapsed++
        }
    }


    /**
     * Repeat previous clock tick but do not advance
     */
    retrigger(): void {
        this.externalTrigger(false)
        // this.createTick( data.intervals, data.time )			
    }

    // EVENTS =============================================================================

    /**
     * EVENT: Timer is available
     */
    onAvailable = (): void => {
        // console.info("Timer is available")
    }

    /**
     * EVENT: Timer is unavailable
     */
    onUnavailable = (): void => {
        // console.error("Timer is unavailable")
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
    onTick(
        timePassed: number,
        expected: number,
        drift: number = 0,
        level: number = 0,
        intervals: number = 0,
        lag: number = 0
    ): void {

        //console.info("Timer:onTick", {timePassed, expected, drift, level, intervals, lag} )
        this.lastRecordedTime = timePassed

        // check if bar has completed
        if (++this.divisionsElapsed >= this.divisions) {
            ++this.totalBarsElapsed
            this.currentBar = (this.currentBar + 1) % this.bars
            this.divisionsElapsed = 0
        }

        // let us determine if we are on a swung beat
        const swung = this.divisionsElapsed % this.swingOffset === 0

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
        })
    }
}