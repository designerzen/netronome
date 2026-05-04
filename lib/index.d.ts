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
export { default as Timer } from './timer.ts';
export type { ITimerControl, TimingHandler, TimerCallbackEvent } from './timer-interfaces.ts';
export * from './timer-types.ts';
export * from './timer-options.ts';
export * from './timer-event-types.ts';
export * from './timer-interfaces.ts';
export * from './timer-worker-types.ts';
export * from './time-utils.ts';
export { createTimer, startTimer, stopTimer, setTimeBetween, resetTimer, getTimer } from './timer-global.ts';
export { default as AudioTimer } from './timer-audio.ts';
export { tapTempoQuick, tapTempo } from './tap-tempo.ts';
//# sourceMappingURL=index.d.ts.map