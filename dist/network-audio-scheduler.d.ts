import type Timer from './timer';
import type { NetworkTransport } from './network-timeline';
export interface NetworkScheduler {
    setTimeline(states: NetworkTransport[], offsetMs: number): void;
    clear(): void;
    destroy(): void;
}
export declare function createNetworkAudioScheduler(timer: Timer, onTransport: (state: NetworkTransport) => void): Promise<NetworkScheduler>;
//# sourceMappingURL=network-audio-scheduler.d.ts.map