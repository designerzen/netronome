/**
 * Public API wrapper for the Timer class
 */
import Timer from './timer';
/**
 * Start a timer with a callback
 * @param callback - Function to call on each tick
 * @param interval - Interval in milliseconds
 * @param options - Timer options (can include 'type' for worker URI)
 * @returns Timer instance
 */
export declare function startTimer(callback: (event: any) => void, interval?: number, options?: any): {
    timer: Timer;
};
/**
 * Stop the current timer
 * @returns Timer instance
 */
export declare function stopTimer(): {
    timer: Timer;
} | {
    timer: null;
};
/**
 * Set the time between ticks
 * @param interval - Interval in milliseconds
 */
export declare function setTimeBetween(interval: number): void;
/**
 * Reset the global timer
 */
export declare function resetTimer(): void;
/**
 * Get the global timer instance
 */
export declare function getTimer(): Timer | null;
/**
 * Create a new timer instance
 */
export declare function createTimer(options?: any): Timer;
export default Timer;
//# sourceMappingURL=timer-global.d.ts.map