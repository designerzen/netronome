/** Highest tick resolution the timer and shared transport accept. */
export declare const MAX_PPQ = 960;
/**
 * Common pulses-per-quarter-note resolutions. 24 is the MIDI 1.0 clock; the rest are the
 * resolutions MIDI 2.0 clips declare with a Delta Clockstamp Ticks Per Quarter Note message.
 * Every value divides by four so each sixteenth note lands on a whole tick.
 */
export declare const PPQ_OPTIONS: readonly number[];
export declare const DEFAULT_PPQ = 24;
export declare const isPPQ: (value: unknown) => value is number;
//# sourceMappingURL=ppq.d.ts.map