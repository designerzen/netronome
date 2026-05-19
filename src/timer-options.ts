import type { TimerOptions, TimerSyncOptions } from "./timer-interfaces"
import { TIMER_TYPE_AUDIO_WORKLET } from "./timer-types"

// Re-export for backward compatibility
export type { TimerOptions }

export const DEFAULT_SYNC_OPTIONS: TimerSyncOptions = {
    mode: 'local-grid',
    join: 'next-bar',
    beatsPerBar: 4
}

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

    sync: DEFAULT_SYNC_OPTIONS,
    synch: true
}
