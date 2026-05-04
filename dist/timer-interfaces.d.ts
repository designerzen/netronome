/**
 * Timer interfaces and types
 */
import type { TimerType } from './timer-types';
/**
 * Worker factory type - returns a new Worker instance
 */
export type WorkerWrapper = () => Worker;
/**
 * Timer method signatures for type checking
 */
export interface ITimerControl {
    /**
     * Switch the timer to a different worker/worklet type
     * Safely handles switching even if timer is running
     */
    switchTimerType(timerType: TimerType | string, audioContext?: AudioContext): Promise<boolean>;
}
/**
 * Timing handler can be a Worker, AudioWorkletNode, or null
 */
export type TimingHandler = Worker | AudioWorkletNode | null;
/**
 * Callback event fired on each timer tick
 */
export interface TimerCallbackEvent {
    bar: number;
    bars: number;
    divisionsElapsed: number;
    barsElapsed: number;
    elapsed: number;
    timePassed: number;
    /** Ideal transport elapsed since timer start. Live tempo changes keep this continuous and only affect future spacing. */
    expected: number;
    drift: number;
    level: number;
    intervals: number;
    lag: number;
}
/**
 * Configuration options for creating a Timer instance
 */
export interface TimerOptions {
    bars?: number;
    divisions?: number;
    bpm?: number;
    accurate?: boolean;
    contexts?: Record<string, unknown> | null;
    type?: string | WorkerWrapper;
    processor?: string;
    callback?: ((event: TimerCallbackEvent) => void) | null;
    audioContext?: AudioContext;
    synch?: boolean;
}
/**
 * Configuration options specific to AudioTimer
 */
export interface AudioTimerOptions {
    divisions: number;
    type?: string | any;
    processor?: string;
    audioContext?: AudioContext;
}
/**
 * Result from tap tempo detection
 */
export interface TapTempoResult {
    available: boolean;
    bar: string | number;
    period: number;
    accuratePeriod: number;
    beat: string | number;
    samples: number;
    timeInSeconds: number;
    tempo: number;
    bpm: number;
    deviation: number;
}
//# sourceMappingURL=timer-interfaces.d.ts.map