import type Timer from './timer';
import { type NetworkScheduler } from './network-audio-scheduler';
import { type NetworkTransport } from './network-timeline';
export interface NetworkSessionOptions {
    peerId: string;
    leaderId: string;
    send: (peerId: string, message: unknown) => void;
    now?: () => number;
    lookaheadMs?: number;
    sampleWindow?: number;
    minSamples?: number;
    pollIntervalMs?: number;
    onStateChange?: (state: ReturnType<NetworkSession['getState']>) => void;
    onTransport?: (state: NetworkTransport) => void;
    scheduler?: NetworkScheduler;
}
/** One transport and one audio scheduler per machine, independent of WS/WebRTC routing. */
export declare class NetworkSession {
    readonly timer: Timer;
    readonly options: NetworkSessionOptions;
    private scheduler?;
    private peers;
    private timeline;
    private interval?;
    private destroyed;
    private activeRevision;
    private sequence;
    private now;
    private ready;
    private starting?;
    private ownsTimer;
    constructor(timer: Timer, options: NetworkSessionOptions);
    get isLeader(): boolean;
    start(): Promise<void>;
    private initialize;
    addPeer(id: string): void;
    removePeer(id: string): void;
    private send;
    private current;
    private offset;
    private locked;
    private applyTransport;
    private updateScheduler;
    private poll;
    private sendState;
    receive(id: string, message: any): void;
    /** Coalesce edits onto the same future bar; preserve position under tempo changes. */
    setTransport(change: Partial<Pick<NetworkTransport, 'playing' | 'bpm' | 'swing' | 'position'>>, effectiveTimeMs?: number): NetworkTransport;
    getState(): {
        role: string;
        ready: boolean;
        status: string;
        playing: boolean;
        position: number;
        bpm: number;
        swing: number;
        peers: {
            offsetMs: number;
            rttMs: number;
            jitterMs: number;
            sampleCount: number;
            locked: boolean;
            id: string;
        }[];
    };
    private emit;
    destroy(): Promise<void>;
}
//# sourceMappingURL=network-session.d.ts.map