import type { TimerOptions } from "./timer-interfaces"
import { AudioContextWorkerWrapper } from "./timer-worker-types"

// Re-export for backward compatibility
export type { TimerOptions }

export const DEFAULT_TIMER_OPTIONS: TimerOptions = {
    
    accurate:false,

    bars: 16,
    
    // keep this at 24 to match MIDI1.0 spec
    // where there are 24 ticks per quarternote (one beat)
    divisions: 24,

    bpm: 90,

    contexts: null,

    // can be base64 encoded too
    type: AudioContextWorkerWrapper,
    // type:AUDIOTIMER_WORKLET_URI,
    // processor:AUDIOTIMER_PROCESSOR_URI,

    callback: null,

    synch: true
}