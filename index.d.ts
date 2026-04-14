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
export { default as Timer } from './src/timer.ts';
export type { ITimerControl, TimingHandler, TimerCallbackEvent } from './src/timer-interfaces.ts';
export * from './src/timer-types.ts';
export * from './src/timer-options.ts';
export * from './src/timer-event-types.ts';
export * from './src/timer-interfaces.ts';
export * from './src/timer-worker-types.ts';
export * from './src/time-utils.ts';
export { createTimer, startTimer, stopTimer, setTimeBetween, resetTimer, getTimer } from './src/timer-global.ts';
export { default as AudioTimer } from './src/timer-audio.ts';
export { tapTempoQuick, tapTempo } from './src/tap-tempo.ts';
//# sourceMappingURL=index.d.ts.map