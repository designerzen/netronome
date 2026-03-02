/**
 * Epoch - Global synchronization point for all metronomes
 *
 * Uses absolute Unix time (Date.now()) so all metronomes synchronize
 * even across page reloads and multiple tabs. All metronomes reference
 * the same point in history (UNIX epoch = 0).
 */
export declare const UNIX_EPOCH: number;
export default class Epoch {
    private static instance;
    /**
     * Get the singleton instance of Epoch
     */
    static getInstance(): Epoch;
    private referenceEpoch;
    private constructor();
    /**
     * Get the current absolute time in milliseconds since UNIX epoch
     */
    getCurrentTime(): number;
    /**
     * Get elapsed time since the UNIX epoch reference point
     */
    getElapsedTime(): number;
    /**
     * Calculate the offset to the next tick on the global metronome grid
     *
     * All metronomes use this to find when their next tick should occur,
     * ensuring they all tick at the same absolute moments in time.
     *
     * @param tickDuration - Duration of each tick in milliseconds
     * @returns Time offset in ms until the next global tick
     */
    getNextTickOffset(tickDuration: number): number;
    /**
     * Get the reference epoch timestamp
     */
    getReferenceEpoch(): number;
    /**
     * Set the reference epoch (default is UNIX_EPOCH)
     */
    setReferenceEpoch(epochTime: number): void;
    /**
     * Synchronize a metronome by returning the delay before its first tick
     *
     * @param tickDuration - Duration of each tick in milliseconds
     * @returns Delay in ms before first tick should occur
     */
    synchronizeMetronome(tickDuration: number): number;
    /**
     * Calculate the absolute time of the next tick on the global grid
     *
     * @param tickDuration - Duration of each tick in milliseconds
     * @returns Absolute Unix timestamp of the next tick
     */
    getNextTickTime(tickDuration: number): number;
    /**
     * Get the tick number at a given time on the global grid
     *
     * @param tickDuration - Duration of each tick in milliseconds
     * @param atTime - Optional time to check (defaults to current time)
     * @returns The tick number
     */
    getTickNumber(tickDuration: number, atTime?: number): number;
}
//# sourceMappingURL=epoch.d.ts.map