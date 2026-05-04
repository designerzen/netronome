import Timer from "./timer";
import { type TimerType } from './timer-types';
export default class AudioTimer extends Timer {
    audioContext?: AudioContext;
    /**
     * Accurate time in milliseconds
     * @returns {Number} The current time as of now
     */
    get now(): number;
    /**
     * Time Scale factor
     */
    get clockUnitsToSecondsScale(): number;
    /**
     * Create an AudioTimer with an AudioContext
     * Uses AudioWorklet timing if available, falls back to AudioContext worker
     * @param audioContext The AudioContext to use for accurate timing
     * @param timerType If true, attempts to use AudioWorklet (recommended). If false, uses AudioContext worker.
     */
    constructor(audioContext: AudioContext, timerType?: TimerType | boolean);
    /**
     * Start this timer
     * @param {Function} callback
     * @param {Object} options
     */
    startTimer(callback?: ((event: any) => void), options?: Record<string, unknown>): Promise<{
        time: number;
        interval: number;
        worker: import("./timer-interfaces").TimingHandler;
    }>;
}
//# sourceMappingURL=timer-audio.d.ts.map