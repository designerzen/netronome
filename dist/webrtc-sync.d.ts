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
export declare class WebRTCSyncController {
    #private;
    readonly timer: Timer;
    readonly role: WebRTCSyncRole;
    onSignal?: (signal: WebRTCSyncSignal) => void;
    onStateChange?: (state: WebRTCSyncState) => void;
    constructor(timer: Timer, options: WebRTCSyncControllerOptions);
    start(): Promise<void>;
    createOfferBundle(): Promise<WebRTCSessionBundle>;
    createAnswerBundle(): Promise<WebRTCSessionBundle>;
    applyOfferBundle(bundle: WebRTCSessionBundle): Promise<void>;
    applyAnswerBundle(bundle: WebRTCSessionBundle): Promise<void>;
    handleSignal(signal: WebRTCSyncSignal): Promise<void>;
    startSynchronized(lookaheadMs?: number): Promise<void>;
    stopSynchronized(): Promise<void>;
    broadcastTempoUpdate(effectiveLeaderTimeMs?: number): void;
    getState(): WebRTCSyncState;
    destroy(): Promise<void>;
}
export declare const createWebRTCSyncController: (timer: Timer, options: WebRTCSyncControllerOptions) => WebRTCSyncController;
export default WebRTCSyncController;
//# sourceMappingURL=webrtc-sync.d.ts.map