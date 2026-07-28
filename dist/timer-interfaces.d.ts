/**
 * Timer interfaces and types
 */
import type { TimerType } from './timer-types';
/**
 * Worker factory type - returns a new Worker instance
 */
export type WorkerWrapper = () => Worker;
/**
 * Timer method signatures for type checking
 */
export interface ITimerControl {
    /**
     * Switch the timer to a different worker/worklet type
     * Safely handles switching even if timer is running
     */
    switchTimerType(timerType: TimerType | string, audioContext?: AudioContext): Promise<boolean>;
}
/**
 * Timing handler can be a Worker, AudioWorkletNode, or null
 */
export type TimingHandler = Worker | AudioWorkletNode | null;
export type SyncMode = 'off' | 'local-grid' | 'system-epoch-grid' | 'network-leader' | 'network-follower';
export type SyncJoinMode = 'immediate' | 'next-tick' | 'next-beat' | 'next-bar';
export type SyncStatus = 'free' | 'probing' | 'locking' | 'armed' | 'locked' | 'degraded';
export interface SyncOptionsBase {
    join?: SyncJoinMode;
    beatsPerBar?: number;
}
export interface SyncOffOptions extends SyncOptionsBase {
    mode: 'off';
}
export interface LocalGridSyncOptions extends SyncOptionsBase {
    mode: 'local-grid';
}
export interface SystemEpochGridSyncOptions extends SyncOptionsBase {
    mode: 'system-epoch-grid';
    referenceEpochMs: number;
}
export interface NetworkLeaderSyncOptions extends SyncOptionsBase {
    mode: 'network-leader';
    sessionId: string;
    networkLookaheadMs?: number;
    minSamples?: number;
    smallErrorMs?: number;
    largeErrorMs?: number;
    maxTempoNudgePct?: number;
}
export interface NetworkFollowerSyncOptions extends SyncOptionsBase {
    mode: 'network-follower';
    sessionId: string;
    leaderId: string;
    networkLookaheadMs?: number;
    minSamples?: number;
    smallErrorMs?: number;
    largeErrorMs?: number;
    maxTempoNudgePct?: number;
}
export type TimerSyncOptions = SyncOffOptions | LocalGridSyncOptions | SystemEpochGridSyncOptions | NetworkLeaderSyncOptions | NetworkFollowerSyncOptions;
export interface TimerSyncMetadata {
    mode: SyncMode;
    status: SyncStatus;
    join?: SyncJoinMode;
    referenceEpochMs?: number;
    phaseErrorMs?: number;
    clockOffsetMs?: number;
    clockJitterMs?: number;
    transportRevision?: number;
    leaderTimeMs?: number;
}
/**
 * Timing captured by an AudioWorklet before its tick message crosses to the
 * main thread. All context times are AudioContext seconds.
 */
export interface AudioTickTiming {
    /** Context time of the render quantum that emitted the tick. */
    contextTimeSeconds?: number;
    /** Intended transport-grid time before render-quantum/message latency. */
    scheduledContextTimeSeconds?: number;
    /** First audio sample frame of the render quantum. */
    audioFrame?: number;
    sampleRate?: number;
}
/**
 * Callback event fired on each timer tick
 */
export interface TimerCallbackEvent {
    bar: number;
    bars: number;
    divisionsElapsed: number;
    barsElapsed: number;
    elapsed: number;
    timePassed: number;
    /** Ideal transport elapsed since timer start. Live tempo changes keep this continuous and only affect future spacing. */
    expected: number;
    drift: number;
    level: number;
    intervals: number;
    lag: number;
    sync?: TimerSyncMetadata;
    contextTimeSeconds?: number;
    scheduledContextTimeSeconds?: number;
    audioFrame?: number;
    sampleRate?: number;
}
/**
 * Configuration options for creating a Timer instance
 */
export interface TimerOptions {
    bars?: number;
    divisions?: number;
    bpm?: number;
    accurate?: boolean;
    contexts?: Record<string, unknown> | null;
    type?: string | WorkerWrapper;
    processor?: string;
    callback?: ((event: TimerCallbackEvent) => void) | null;
    audioContext?: AudioContext;
    sync?: TimerSyncOptions;
    synch?: boolean;
}
/**
 * Configuration options specific to AudioTimer
 */
export interface AudioTimerOptions {
    divisions: number;
    type?: string | any;
    processor?: string;
    audioContext?: AudioContext;
}
/**
 * Result from tap tempo detection
 */
export interface TapTempoResult {
    available: boolean;
    bar: string | number;
    period: number;
    accuratePeriod: number;
    beat: string | number;
    samples: number;
    timeInSeconds: number;
    tempo: number;
    bpm: number;
    deviation: number;
}
//# sourceMappingURL=timer-interfaces.d.ts.map