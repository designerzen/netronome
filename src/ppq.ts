/** Highest tick resolution the timer and shared transport accept. */
export const MAX_PPQ = 960

/**
 * Common pulses-per-quarter-note resolutions. 24 is the MIDI 1.0 clock; the rest are the
 * resolutions MIDI 2.0 clips declare with a Delta Clockstamp Ticks Per Quarter Note message.
 * Every value divides by four so each sixteenth note lands on a whole tick.
 */
export const PPQ_OPTIONS: readonly number[] = [24, 48, 96, 192, 384, 480, 960]

export const DEFAULT_PPQ = 24

export const isPPQ = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_PPQ
