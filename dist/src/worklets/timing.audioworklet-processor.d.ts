/**
* A timer that uses the AudioWorklet API
* currentTime is a global variable
*
* @class TimingProcessor
* @extends AudioWorkletProcessor
*/
declare const CMD_INITIALISE = "init";
declare const CMD_START = "start";
declare const CMD_STOP = "stop";
declare const CMD_UPDATE = "update";
declare const CMD_ADJUST_DRIFT = "adjust-drift";
declare const EVENT_READY = "ready";
declare const EVENT_STARTING = "starting";
declare const EVENT_STOPPING = "stopping";
declare const EVENT_TICK = "tick";
interface ProcessorMessage {
    event?: string;
    command?: string;
    interval?: number;
    accurateTiming?: boolean;
    time?: number;
    intervals?: number;
    drift?: number;
}
declare const currentTime: number;
declare function registerProcessor(name: string, processorConstructor: typeof AudioWorkletProcessor): void;
declare class AudioWorkletProcessor {
    port: MessagePort;
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
declare class TimingAudioWorkletProcessor extends AudioWorkletProcessor {
    isAvailable: boolean;
    isRunning: boolean;
    accurateTiming: boolean;
    startTime: number;
    nextInterval: number;
    gap: number;
    intervals: number;
    cumulativeDrift: number;
    port: MessagePort;
    get elapsed(): number;
    constructor();
    postMessage(message: ProcessorMessage): void;
    reset(): void;
    /**
     *
     * @param {Number} interval in milliseconds
     * @param {*} accurateTiming
     */
    start(interval?: number, accurateTiming?: boolean): void;
    /**
     *
     */
    stop(): void;
    /**
     * We never want the volume to just drop out so we glide between the values
     *
     * @param {Float32Array(128)} inputs
     * @param {Float32Array(128)} outputs
     * @param {AudioParam} parameters
     * @returns {Boolean} keep alive
     */
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
    /**
     *
     */
    onTick(compensatedGap?: number): void;
    /**
     * Pass in the WAV data or URL to load via worklet
     * @param {Event} event
     */
    onmessage(event: MessageEvent<ProcessorMessage>): void;
}
declare const ID = "timing-processor";
//# sourceMappingURL=timing.audioworklet-processor.d.ts.map