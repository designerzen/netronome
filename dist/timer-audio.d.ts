import Timer from "./timer";
export default class AudioTimer extends Timer {
    audioContext?: AudioContext;
    /**
     * Accurate time in milliseconds
     * @returns {Number} The current time as of now
     */
    get now(): number;
    /**
     * Create an AudioTimer with an AudioContext
     * Uses AudioWorklet timing if available, falls back to AudioContext worker
     * @param audioContext The AudioContext to use for accurate timing
     * @param useAudioWorklet If true, attempts to use AudioWorklet (recommended). If false, uses AudioContext worker.
     */
    constructor(audioContext: AudioContext, useAudioWorklet?: boolean);
    /**
     *
     * @param {Function} callback
     * @param {*} options
     */
    startTimer(callback?: ((event: any) => void), options?: Record<string, unknown>): Promise<{
        time: number;
        interval: number;
        worker: import("./timer-interfaces").TimingHandler;
    }>;
}
//# sourceMappingURL=timer-audio.d.ts.map