import type Timer from './timer';
import type { NetworkTransport } from './network-timeline';
export interface NetworkScheduler {
    /** latencyMs plays everything that much earlier, for output delay the browser cannot see. */
    setTimeline(states: NetworkTransport[], offsetMs: number, latencyMs?: number): void;
    clear(): void;
    destroy(): void;
}
export declare function createNetworkAudioScheduler(timer: Timer, onTransport: (state: NetworkTransport) => void): Promise<NetworkScheduler>;
//# sourceMappingURL=network-audio-scheduler.d.ts.map