export declare const SECONDS_PER_MINUTE = 60;
export declare const MICROSECONDS_PER_MINUTE: number;
export declare const Ticks: {
    /** How many ticks pass in "1 whole note" or 4x1/4th notes in a 4/4th beat, independent of tempo. */
    readonly SemiBreve: 15360;
    /** How many ticks pass in 1 quarter note in a 4/4th bar, independent of tempo. */
    readonly Beat: 3840;
    /** How many ticks pass in 1/16th note in a 4/4th bar, independent of tempo. */
    readonly SemiQuaver: 960;
};
/**
 * Convert a BPM to a period in ms
 * @param {Number|String} bpm beats per minute
 * @returns {Number} time in milliseconds
 */
export declare const convertBPMToPeriod: (bpm: number) => number;
/**
 * Convert a period in ms to a BPM
 * @param {Number|String} period millisecods
 * @returns {Number} time in milliseconds
 */
export declare const convertPeriodToBPM: (period: number) => number;
/**
 * Convert a midi clock to BPM
 * @param {Number} millisecondsPerClockEvent
 * @param {Number} pulsesPerQuarterNote  MIDI clock sends 24 pulses per quarter note (PPQN)
 * @returns Number
 */
export declare const convertMIDIClockIntervalToBPM: (millisecondsPerClockEvent: number, pulsesPerQuarterNote?: number) => number;
/**
 * Converts seconds to ticks at a given bpm.
 * Uses internal tick resolution where 3840 ticks = 1 quarter note
 * @param seconds Time in seconds
 * @param bpm Beats per minute
 * @param resolution Optional: ticks per quarter note (default: 3840)
 * @returns Number of ticks (internal timing units)
 */
export declare const secondsToTicks: (seconds: number, bpm: number, resolution?: number) => number;
export declare const formatTimeStampFromSeconds: (seconds: number) => any;
//# sourceMappingURL=time-utils.d.ts.map