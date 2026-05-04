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
export { default as Timer } from './src/timer'
export type { ITimerControl, TimingHandler, TimerCallbackEvent } from './src/timer-interfaces'

// Timer configuration and options
export * from './src/timer-types'
export * from './src/timer-options'
export * from './src/timer-event-types'
export * from './src/timer-interfaces'

// Event types and worker types
export * from './src/timer-worker-types'

// Time utilities for calculations
export * from './src/time-utils'

// Global timer functions (singleton pattern)
export { 
  createTimer, 
  startTimer, 
  stopTimer, 
  setTimeBetween, 
  resetTimer, 
  getTimer 
} from './src/timer-global'

// AudioContext-based timer
export { default as AudioTimer } from './src/timer-audio'

// Tap tempo detection
export { tapTempoQuick, tapTempo } from './src/tap-tempo'