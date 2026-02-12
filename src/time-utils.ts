// Timing Constants and conversions
export const SECONDS_PER_MINUTE = 60
export const MICROSECONDS_PER_MINUTE = SECONDS_PER_MINUTE * 1_000

export const Ticks = {
    /** How many ticks pass in "1 whole note" or 4x1/4th notes in a 4/4th beat, independent of tempo. */
    SemiBreve: 15360,
    /** How many ticks pass in 1 quarter note in a 4/4th bar, independent of tempo. */
    Beat: 3840,
    /** How many ticks pass in 1/16th note in a 4/4th bar, independent of tempo. */
    SemiQuaver: 960
} as const


/**
 * Convert a BPM to a period in ms
 * @param {Number|String} bpm beats per minute
 * @returns {Number} time in milliseconds
 */
export const convertBPMToPeriod = (bpm: number) => MICROSECONDS_PER_MINUTE / parseFloat(String(bpm))

/**
 * Convert a period in ms to a BPM
 * @param {Number|String} period millisecods
 * @returns {Number} time in milliseconds
 */
export const convertPeriodToBPM = (period: number) => MICROSECONDS_PER_MINUTE / parseFloat(String(period))

/**
 * Convert a midi clock to BPM
 * @param {Number} millisecondsPerClockEvent 
 * @param {Number} pulsesPerQuarterNote  MIDI clock sends 24 pulses per quarter note (PPQN)
 * @returns Number
 */
export const convertMIDIClockIntervalToBPM = (millisecondsPerClockEvent: number, pulsesPerQuarterNote = 24) => {

    // Calculate the time for one quarter note in milliseconds
    // If 1 clock event takes `millisecondsPerClockEvent` ms,
    // then 24 clock events (1 quarter note) take `24 * millisecondsPerClockEvent` ms.
    const millisecondsPerQuarterNote = millisecondsPerClockEvent * pulsesPerQuarterNote

    // Convert milliseconds per quarter note to BPM
    // BPM = (milliseconds in a minute) / (milliseconds per beat)
    // 1 minute = 60,000 milliseconds
    return convertPeriodToBPM(millisecondsPerQuarterNote)
}

/**
 * Converts seconds to ticks at a given bpm.
 * Uses internal tick resolution where 3840 ticks = 1 quarter note
 * @param seconds Time in seconds
 * @param bpm Beats per minute
 * @param resolution Optional: ticks per quarter note (default: 3840)
 * @returns Number of ticks (internal timing units)
 */
export const secondsToTicks = (seconds: number, bpm: number, resolution: number = Ticks.Beat): number => {
    const quarterNoteDurationSeconds = SECONDS_PER_MINUTE / bpm
    const ticksPerSecond = resolution / quarterNoteDurationSeconds
    return seconds * ticksPerSecond
}

/**
 * Pass in a Timer, return a formatted time
 * such as HH:MM:SS
 */
const timestampCache = new Map()
export const formatTimeStampFromSeconds = (seconds: number) => {
    if (timestampCache.has(seconds)){
        return timestampCache.get(seconds)
    }
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = (seconds % 60)
    const milliseconds = (remainingSeconds % 1).toFixed(2).slice(2)
    const string = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(Math.floor(remainingSeconds)).padStart(2, '0')}:${String(milliseconds).padStart(2, '0')}`
    timestampCache.set(seconds, string)
    return string
}