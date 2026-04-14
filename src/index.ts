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
export { default as Timer } from './timer.ts'
export type { ITimerControl, TimingHandler, TimerCallbackEvent } from './timer-interfaces.ts'

// Timer configuration and options
export * from './timer-types.ts'
export * from './timer-options.ts'
export * from './timer-event-types.ts'
export * from './timer-interfaces.ts'

// Event types and worker types
export * from './timer-worker-types.ts'

// Time utilities for calculations
export * from './time-utils.ts'

// Global timer functions (singleton pattern)
export { 
  createTimer, 
  startTimer, 
  stopTimer, 
  setTimeBetween, 
  resetTimer, 
  getTimer 
} from './timer-global.ts'

// AudioContext-based timer
export { default as AudioTimer } from './timer-audio.ts'

// Tap tempo detection
export { tapTempoQuick, tapTempo } from './tap-tempo.ts'
