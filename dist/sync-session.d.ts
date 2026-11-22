export interface SyncSample {
    offsetMs: number;
    rttMs: number;
    receivedAtMs: number;
}
export interface SyncEstimate {
    offsetMs: number;
    rttMs: number;
    jitterMs: number;
    /** Leader clock rate relative to ours, in parts per million. */
    driftPpm: number;
    sampleCount: number;
    locked: boolean;
}
export interface PingSampleInput {
    clientSendTimeMs: number;
    leaderReceiveTimeMs: number;
    leaderSendTimeMs: number;
    clientReceiveTimeMs: number;
}
/** About one minute of history at the default 250 ms ping interval. */
export declare const DEFAULT_SYNC_SESSION_SAMPLE_WINDOW = 240;
/**
 * Estimates a leader clock as a line (offset plus drift) through the
 * fastest round trips, so the estimate stays accurate between pings and a
 * long window averages out network noise without lagging behind drift.
 */
export declare class SyncSession {
    #private;
    constructor(sampleWindow?: number, minSamples?: number);
    addSample(input: PingSampleInput): SyncSample;
    clear(): void;
    getEstimate(nowMs?: number): SyncEstimate;
    leaderToLocalTime(leaderTimeMs: number): number;
    localToLeaderTime(localTimeMs: number): number;
}
export default SyncSession;
//# sourceMappingURL=sync-session.d.ts.map