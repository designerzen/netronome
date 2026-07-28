type TimingMessage = {
    command?: string;
    event?: string;
    accurateTiming?: boolean;
    interval?: number;
    time?: number;
    intervals?: number;
    contextTimeSeconds?: number;
    scheduledContextTimeSeconds?: number;
    audioFrame?: number;
    sampleRate?: number;
};
/**
 * Wrap the above in a single call
 * @param {AudioContext} context
 * @returns A new TimingAudioWorkletNode instance
 */
export declare const createTimingWorklet: (context: AudioContext) => Promise<TimingAudioWorkletNode>;
/**
 * Gateway to the metronome AudioWorkletProcessor
 * If you add this node to your audio pipeline it
 * should disptch events at the correct times
 */
export default class TimingAudioWorkletNode extends AudioWorkletNode {
    #private;
    static get parameterDescriptors(): {
        name: string;
        defaultValue: number;
        minValue: number;
        maxValue: number;
    }[];
    accurateTiming: boolean;
    onmessage?: (event: MessageEvent<TimingMessage>) => void;
    constructor(audioContext: AudioContext, accurateTiming?: boolean);
    /**
     * Pass message to Processor Worklet
     * @param {Object} data
     * @returns
     */
    postMessage(data: TimingMessage): void;
    start(interval?: number): void;
    stop(): void;
    /**
     * PUBLIC: To match other Worker style APIs
     */
    terminate(): void;
    onMessageReceived(event: MessageEvent<TimingMessage>): void;
}
export {};
//# sourceMappingURL=timing.audioworklet.d.ts.map