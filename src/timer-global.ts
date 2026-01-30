/**
 * Public API wrapper for the Timer class
 */
import Timer from './timer'

let globalTimer: Timer | null = null

/**
 * Start a timer with a callback
 * @param callback - Function to call on each tick
 * @param interval - Interval in milliseconds
 * @param options - Timer options (can include 'type' for worker URI)
 * @returns Timer instance
 */
export function startTimer(
  callback: (event: any) => void,
  interval: number = 1000,
  options: any = {}
) {
  // If worker type changed, recreate timer with new worker
  if (globalTimer && options.type && globalTimer.timingWorkHandler) {
    globalTimer.stopTimer()
    globalTimer = null
  }

  if (!globalTimer) {
    globalTimer = new Timer({
      ...options,
      callback
    })
  }

  globalTimer.setCallback(callback)
  globalTimer.BPM = (60000 / interval) // Convert ms interval to BPM
  globalTimer.start()

  return {
    timer: globalTimer
  }
}

/**
 * Stop the current timer
 * @returns Timer instance
 */
export function stopTimer() {
  if (globalTimer) {
    globalTimer.stop()
    return {
      timer: globalTimer
    }
  }
  return { timer: null }
}

/**
 * Set the time between ticks
 * @param interval - Interval in milliseconds
 */
export function setTimeBetween(interval: number) {
  if (globalTimer) {
    globalTimer.BPM = (60000 / interval)
  }
}

/**
 * Reset the global timer
 */
export function resetTimer() {
  if (globalTimer) {
    globalTimer.resetTimer()
  }
}

/**
 * Get the global timer instance
 */
export function getTimer(): Timer | null {
  return globalTimer
}

/**
 * Create a new timer instance
 */
export function createTimer(options: any = {}): Timer {
  return new Timer(options)
}

export default Timer
