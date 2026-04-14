/**
 * Timer type constants for selecting which worker/worklet to use
 * Pass these string IDs to Timer constructor as the 'type' option
 */
export declare const TIMER_TYPE_AUDIO_CONTEXT = "audio-context";
export declare const TIMER_TYPE_AUDIO_WORKLET = "audio-worklet";
export declare const TIMER_TYPE_ROLLING = "rolling";
export declare const TIMER_TYPE_SET_INTERVAL = "set-interval";
export declare const TIMER_TYPE_SET_TIMEOUT = "set-timeout";
export type TimerType = typeof TIMER_TYPE_AUDIO_CONTEXT | typeof TIMER_TYPE_AUDIO_WORKLET | typeof TIMER_TYPE_ROLLING | typeof TIMER_TYPE_SET_INTERVAL | typeof TIMER_TYPE_SET_TIMEOUT;
export declare const TIMER_TYPES: {
    readonly AUDIO_CONTEXT: "audio-context";
    readonly AUDIO_WORKLET: "audio-worklet";
    readonly ROLLING: "rolling";
    readonly SET_INTERVAL: "set-interval";
    readonly SET_TIMEOUT: "set-timeout";
};
export declare const isValidTimerType: (type: unknown) => type is TimerType;
export declare const getTimerTypeDescription: (type: TimerType) => string;
//# sourceMappingURL=timer-types.d.ts.map