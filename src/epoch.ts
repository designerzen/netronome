/**
 * Epoch - Global synchronization point for all metronomes
 * 
 * Uses absolute Unix time (Date.now()) so all metronomes synchronize
 * even across page reloads and multiple tabs. All metronomes reference
 * the same point in history (UNIX epoch = 0).
 */

export const UNIX_EPOCH: number = 0

export default class Epoch {

  // singleton
  private static instance: Epoch

  /**
   * Get the singleton instance of Epoch
   */
  public static getInstance(): Epoch {
    if (!Epoch.instance) {
      Epoch.instance = new Epoch()
    }
    return Epoch.instance
  }


  private referenceEpoch: number = UNIX_EPOCH

  private constructor() { }

  /**
   * Get the current absolute time in milliseconds since UNIX epoch
   */
  public getCurrentTime(): number {
    return Date.now()
  }

  /**
   * Get elapsed time since the UNIX epoch reference point
   */
  public getElapsedTime(): number {
    return Date.now() - this.referenceEpoch
  }

  /**
   * Calculate the offset to the next tick on the global metronome grid
   * 
   * All metronomes use this to find when their next tick should occur,
   * ensuring they all tick at the same absolute moments in time.
   * 
   * @param tickDuration - Duration of each tick in milliseconds
   * @returns Time offset in ms until the next global tick
   */
  public getNextTickOffset(tickDuration: number): number {
    if (tickDuration <= 0) {
      return 0
    }

    const elapsedTime = this.getElapsedTime();
    const positionInCycle = elapsedTime % tickDuration
    const offsetToNextTick = tickDuration - positionInCycle

    // If we're exactly at a tick boundary, return 0
    return offsetToNextTick === tickDuration ? 0 : offsetToNextTick
  }

  /**
   * Get the reference epoch timestamp
   */
  public getReferenceEpoch(): number {
    return this.referenceEpoch
  }

  /**
   * Set the reference epoch (default is UNIX_EPOCH)
   */
  public setReferenceEpoch(epochTime: number): void {
    this.referenceEpoch = epochTime
  }

  /**
   * Synchronize a metronome by returning the delay before its first tick
   * 
   * @param tickDuration - Duration of each tick in milliseconds
   * @returns Delay in ms before first tick should occur
   */
  public synchronizeMetronome(tickDuration: number): number {
    return this.getNextTickOffset(tickDuration)
  }

  /**
   * Calculate the absolute time of the next tick on the global grid
   * 
   * @param tickDuration - Duration of each tick in milliseconds
   * @returns Absolute Unix timestamp of the next tick
   */
  public getNextTickTime(tickDuration: number): number {
    return this.getCurrentTime() + this.getNextTickOffset(tickDuration)
  }

  /**
   * Get the tick number at a given time on the global grid
   * 
   * @param tickDuration - Duration of each tick in milliseconds
   * @param atTime - Optional time to check (defaults to current time)
   * @returns The tick number
   */
  public getTickNumber(tickDuration: number, atTime?: number): number {
    const time = atTime ?? this.getCurrentTime()
    return Math.floor((time - this.referenceEpoch) / tickDuration)
  }
}
