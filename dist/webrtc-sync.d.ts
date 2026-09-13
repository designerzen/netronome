import Timer from './timer';
export type WebRTCSyncRole = 'leader' | 'follower';
export type WebRTCSyncSignal = {
    type: 'description';
    description: RTCSessionDescriptionInit;
} | {
    type: 'candidate';
    candidate: RTCIceCandidateInit;
};
export interface WebRTCSessionBundle {
    description: RTCSessionDescriptionInit;
}
export interface WebRTCSyncControllerOptions {
    role: WebRTCSyncRole;
    rtcConfig?: RTCConfiguration;
    sampleWindow?: number;
    minSamples?: number;
    pingIntervalMs?: number;
    heartbeatIntervalMs?: number;
    startLookaheadMs?: number;
    resyncThresholdMs?: number;
    channelLabel?: string;
}
export interface WebRTCSyncState {
    role: WebRTCSyncRole;
    connected: boolean;
    sampleCount: number;
    offsetMs: number;
    rttMs: number;
    jitterMs: number;
    locked: boolean;
}
/** Single-peer compatibility facade. Use NetworkSession for rooms and multiple transports. */
export declare class WebRTCSyncController {
    readonly timer: Timer;
    readonly role: WebRTCSyncRole;
    onSignal?: (signal: WebRTCSyncSignal) => void;
    onStateChange?: (state: WebRTCSyncState) => void;
    private pc;
    private channel;
    private session?;
    private sessionReady?;
    private candidates;
    private destroyed;
    private iceWaits;
    private readonly options;
    constructor(timer: Timer, options: WebRTCSyncControllerOptions);
    private peer;
    private attach;
    private ensureSession;
    start(): Promise<void>;
    private gather;
    createOfferBundle(): Promise<WebRTCSessionBundle>;
    applyOfferBundle(bundle: WebRTCSessionBundle): Promise<void>;
    createAnswerBundle(): Promise<WebRTCSessionBundle>;
    applyAnswerBundle(bundle: WebRTCSessionBundle): Promise<void>;
    handleSignal(signal: WebRTCSyncSignal): Promise<void>;
    startSynchronized(lookaheadMs?: number | undefined): Promise<void>;
    stopSynchronized(): Promise<void>;
    broadcastTempoUpdate(effectiveLeaderTimeMs?: number): void;
    getState(): WebRTCSyncState;
    destroy(): Promise<void>;
}
export declare const createWebRTCSyncController: (timer: Timer, options: WebRTCSyncControllerOptions) => WebRTCSyncController;
export default WebRTCSyncController;
//# sourceMappingURL=webrtc-sync.d.ts.map