/**
 * High-Resolution Clock Timer - Elastic Timing with AudioWorklet
 * Based on the worklet-clock pattern from openDAW
 * Provides buffer underrun detection and precise render time measurement
 */
type ElasticTimingMessage = {
    command?: string;
    event?: string;
    accurateTiming?: boolean;
    interval?: number;
    metricsInterval?: number;
    time?: number;
    intervals?: number;
    buffer?: SharedArrayBuffer;
    drift?: number;
    renderTime?: number;
    targetGap?: number;
    avgRenderTime?: number;
    maxRenderTime?: number;
    cpuLoad?: number;
    underruns?: number;
};
/**
 * Create and initialize the elastic timing worklet
 * @param {AudioContext} context
 * @returns A new ElasticTimingAudioWorkletNode instance
 */
export declare const createElasticTimingWorklet: (context: AudioContext) => Promise<ElasticTimingAudioWorkletNode>;
/**
 * Performance metrics from the AudioWorklet
 */
export interface PerformanceMetrics {
    avgRenderTime: number;
    maxRenderTime: number;
    cpuLoad: number;
    underruns: number;
}
/**
 * Underrun event details
 */
export interface UnderrunEvent {
    renderTime: number;
    targetGap: number;
    intervals: number;
}
/**
 * Gateway to the elastic timing AudioWorkletProcessor
 * Provides high-resolution timing with buffer underrun detection
 */
export default class ElasticTimingAudioWorkletNode extends AudioWorkletNode {
    #private;
    static get parameterDescriptors(): {
        name: string;
        defaultValue: number;
        minValue: number;
        maxValue: number;
    }[];
    accurateTiming: boolean;
    onmessage?: (event: MessageEvent<ElasticTimingMessage>) => void;
    onunderrun?: (event: UnderrunEvent) => void;
    onmetrics?: (metrics: PerformanceMetrics) => void;
    constructor(audioContext: AudioContext, accurateTiming?: boolean, enableHRClock?: boolean);
    /**
     * Pass message to Processor Worklet
     */
    postMessage(data: ElasticTimingMessage): void;
    /**
     * Start the timer with optional high-resolution measurement
     */
    start(interval?: number, metricsInterval?: number): void;
    /**
     * Stop the timer
     */
    stop(): void;
    /**
     * Get current performance metrics
     */
    getMetrics(): PerformanceMetrics;
    /**
     * Update BPM while maintaining accurate timing
     */
    update(interval: number): void;
    /**
     * Adjust drift compensation
     */
    adjustDrift(drift: number): void;
    /**
     * Terminate and clean up resources
     */
    terminate(): void;
    /**
     * Handle messages from the AudioWorklet processor
     */
    private onMessageReceived;
}
export {};
//# sourceMappingURL=elastic-timing.audioworklet.d.ts.map