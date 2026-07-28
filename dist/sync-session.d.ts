export interface SyncSample {
    offsetMs: number;
    rttMs: number;
    receivedAtMs: number;
}
export interface SyncEstimate {
    offsetMs: number;
    rttMs: number;
    jitterMs: number;
    sampleCount: number;
    locked: boolean;
}
export interface PingSampleInput {
    clientSendTimeMs: number;
    leaderReceiveTimeMs: number;
    leaderSendTimeMs: number;
    clientReceiveTimeMs: number;
}
export declare const DEFAULT_SYNC_SESSION_SAMPLE_WINDOW = 16;
export declare class SyncSession {
    #private;
    constructor(sampleWindow?: number, minSamples?: number);
    addSample(input: PingSampleInput): SyncSample;
    clear(): void;
    getEstimate(): SyncEstimate;
    leaderToLocalTime(leaderTimeMs: number): number;
    localToLeaderTime(localTimeMs: number): number;
}
export default SyncSession;
//# sourceMappingURL=sync-session.d.ts.map