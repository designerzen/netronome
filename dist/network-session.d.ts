import type Timer from './timer';
import { type NetworkScheduler } from './network-audio-scheduler';
import { type NetworkTransport } from './network-timeline';
export type TransportChange = Partial<Pick<NetworkTransport, 'playing' | 'bpm' | 'swing' | 'position' | 'quantum' | 'divisions'>>;
export interface TransportBoundary {
    position: number;
    leaderTimeMs: number;
    localTimeMs: number;
}
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
    /** Beats per bar used until the transport carries its own; defaults to 4. */
    quantum?: number;
    /** Output delay the browser does not report, such as Bluetooth or MIDI hardware. */
    outputLatencyMs?: number;
    /** Leader only: decide whether a follower's requestTransport() is applied. Without it, proposals are ignored. */
    acceptProposal?: (peerId: string, change: TransportChange) => boolean;
    /** How long playback continues without a measurable leader clock; defaults to 10 s. */
    leaderGraceMs?: number;
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
    private leaderId;
    /**
     * Set while the timeline is in a clock we cannot measure: the leader left,
     * or a new leader's clock has not locked yet. Playback free-runs on the
     * last good offset for up to leaderGraceMs.
     */
    private freeRun?;
    /** Set by a handover: the new leader's timeline replaces ours once, even where revisions differ. */
    private rebasing;
    private latencyMs;
    constructor(timer: Timer, options: NetworkSessionOptions);
    get isLeader(): boolean;
    get currentLeaderId(): string;
    get outputLatencyMs(): number;
    set outputLatencyMs(value: number);
    private get lookahead();
    start(): Promise<void>;
    private initialize;
    addPeer(id: string): void;
    removePeer(id: string): void;
    /**
     * Hand the transport to another peer without stopping playback. Every peer
     * must make the same call; the new leader keeps the timeline, converted to
     * its own clock, and followers adopt its copy.
     */
    setLeader(id: string): void;
    private shiftTimeline;
    /** The leader's clock became measurable again: move the timeline onto it and stop free-running. */
    private resumeFromFreeRun;
    private send;
    private current;
    private offset;
    private locked;
    /** Convert a time on the leader's clock to this machine's clock. */
    toLocalTime(leaderTimeMs: number): number;
    /** Convert a time on this machine's clock to the leader's clock. */
    toLeaderTime(localTimeMs: number): number;
    /**
     * The first bar line (a multiple of quantum beats) at least minLeadMs
     * away. Stamp a cue with it and every peer applies the cue together.
     * While stopped, the boundary is simply minLeadMs from now.
     */
    nextBoundary(quantum?: number, minLeadMs?: number): TransportBoundary;
    private boundaryAfter;
    private applyTransport;
    private updateScheduler;
    private poll;
    private sendState;
    receive(id: string, message: any): void;
    /** Ask the leader to change the transport; the leader applies it directly. */
    requestTransport(change: TransportChange): void;
    /** Coalesce edits onto the same future bar; preserve position under tempo changes. */
    setTransport(change: TransportChange, effectiveTimeMs?: number): NetworkTransport;
    getState(): {
        role: string;
        ready: boolean;
        status: string;
        playing: boolean;
        position: number;
        bpm: number;
        swing: number;
        divisions: number;
        quantum: number;
        peers: {
            offsetMs: number;
            rttMs: number;
            jitterMs: number;
            driftPpm: number;
            sampleCount: number;
            locked: boolean;
            id: string;
        }[];
    };
    private emit;
    destroy(): Promise<void>;
}
//# sourceMappingURL=network-session.d.ts.map