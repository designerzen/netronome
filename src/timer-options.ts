import type { TimerOptions } from "./timer-interfaces"
import { TIMER_TYPE_AUDIO_WORKLET } from "./timer-types"

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

    // Use audio-worklet by default (doesn't need external worker file)
    type: TIMER_TYPE_AUDIO_WORKLET,

    callback: null,

    synch: true
}