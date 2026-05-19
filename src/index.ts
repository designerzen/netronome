/**
 * Netronome - High-precision JavaScript timing library
 * 
 * This library provides multiple timing backends (AudioContext, Web Workers, etc.)
 * for achieving sub-millisecond timing accuracy. Perfect for music production,
 * sequencers, metronomes, and any application requiring precise temporal control.
 * 
 * @example
 * ```typescript
 * import { Timer, TimerEvent } from 'netronome'
 * 
 * const timer = new Timer({ bpm: 120, divisions: 24 })
 * await timer.startTimer((event: TimerEvent) => {
 *   console.log('Tick', event.divisionsElapsed)
 * })
 * ```
 */

// Main Timer class and types
export { default as Timer } from './timer'
export type { ITimerControl, TimingHandler, TimerCallbackEvent } from './timer-interfaces'

// Timer configuration and options
export * from './timer-types'
export * from './timer-options'
export * from './timer-event-types'
export * from './timer-interfaces'

// Event types and worker types
export * from './timer-worker-types'

// Time utilities for calculations
export * from './time-utils'

// Global timer functions (singleton pattern)
export { 
  createTimer, 
  startTimer, 
  stopTimer, 
  setTimeBetween, 
  resetTimer, 
  getTimer 
} from './timer-global'

// AudioContext-based timer
export { default as AudioTimer } from './timer-audio'

// Tap tempo detection
export { tapTempoQuick, tapTempo } from './tap-tempo'

// Sync helpers
export { default as SyncSession } from './sync-session'
export * from './sync-session'
export { default as WebRTCSyncController, createWebRTCSyncController } from './webrtc-sync'
export * from './webrtc-sync'
