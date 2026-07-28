export interface AudioClockTimestamp {
    contextTime: number;
    performanceTime: number;
}
export type MonotonicNow = () => number;
/**
 * Keeps Web Audio's seconds-based rendering timeline separate from the
 * browser's milliseconds-based monotonic timeline, and provides the only
 * supported conversion boundary between them.
 */
export default class AudioClock {
    readonly audioContext: AudioContext;
    readonly monotonicNow: MonotonicNow;
    constructor(audioContext: AudioContext, monotonicNow?: MonotonicNow);
    get audioTimeSeconds(): number;
    get performanceTimeMs(): number;
    /**
     * Return a pair of timestamps describing the same output position.
     *
     * getOutputTimestamp() is preferred because it maps the AudioContext
     * rendering timeline to the monotonic clock. Before the context has
     * rendered, browsers return a zero pair, so use a control-thread snapshot
     * as a documented lower-accuracy fallback.
     */
    getTimestampPair(): AudioClockTimestamp;
    performanceToAudioTimeSeconds(performanceTimeMs: number): number;
    audioToPerformanceTimeMs(audioTimeSeconds: number): number;
}
//# sourceMappingURL=audio-clock.d.ts.map