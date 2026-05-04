/**
 * Timer type constants for selecting which worker/worklet to use
 * Pass these string IDs to Timer constructor as the 'type' option
 */
export declare const TIMER_TYPE_AUDIO_CONTEXT = "audio-context";
export declare const TIMER_TYPE_AUDIO_WORKLET = "audio-worklet";
export declare const TIMER_TYPE_ELASTIC_AUDIO_WORKLET = "elastic-audio-worklet";
export declare const TIMER_TYPE_ROLLING = "rolling";
export declare const TIMER_TYPE_SET_INTERVAL = "set-interval";
export declare const TIMER_TYPE_SET_TIMEOUT = "set-timeout";
export type TimerType = typeof TIMER_TYPE_AUDIO_CONTEXT | typeof TIMER_TYPE_AUDIO_WORKLET | typeof TIMER_TYPE_ELASTIC_AUDIO_WORKLET | typeof TIMER_TYPE_ROLLING | typeof TIMER_TYPE_SET_INTERVAL | typeof TIMER_TYPE_SET_TIMEOUT;
export declare const TIMER_TYPES: {
    readonly AUDIO_CONTEXT: "audio-context";
    readonly AUDIO_WORKLET: "audio-worklet";
    readonly ELASTIC_AUDIO_WORKLET: "elastic-audio-worklet";
    readonly ROLLING: "rolling";
    readonly SET_INTERVAL: "set-interval";
    readonly SET_TIMEOUT: "set-timeout";
};
export declare const WORKLET_TIMER_TYPES: readonly ["audio-worklet", "elastic-audio-worklet"];
export declare const TIMER_TYPE_OPTIONS: readonly ["audio-context", "audio-worklet", "elastic-audio-worklet", "rolling", "set-interval", "set-timeout"];
export declare const isWorkletTimerType: (type: unknown) => type is (typeof WORKLET_TIMER_TYPES)[number];
export declare const isValidTimerType: (type: unknown) => type is TimerType;
export declare const getTimerTypeDescription: (type: TimerType) => string;
//# sourceMappingURL=timer-types.d.ts.map