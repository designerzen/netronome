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
export { default as Timer } from './src/timer';
export type { ITimerControl, TimingHandler, TimerCallbackEvent } from './src/timer-interfaces';
export * from './src/timer-types';
export * from './src/timer-options';
export * from './src/timer-event-types';
export * from './src/timer-interfaces';
export * from './src/timer-worker-types';
export * from './src/time-utils';
export { createTimer, startTimer, stopTimer, setTimeBetween, resetTimer, getTimer } from './src/timer-global';
export { default as AudioTimer } from './src/timer-audio';
export { tapTempoQuick, tapTempo } from './src/tap-tempo';
//# sourceMappingURL=index.d.ts.map