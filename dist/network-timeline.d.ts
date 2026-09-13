/** Position is measured in quarter notes; timestamp is in leader performance milliseconds. */
export interface NetworkTransport {
    revision: number;
    playing: boolean;
    timestamp: number;
    position: number;
    bpm: number;
    swing: number;
    divisions: number;
    bars: number;
}
export declare const isNetworkTransport: (value: any) => value is NetworkTransport;
export declare const positionAt: (state: NetworkTransport, timestamp: number) => number;
/** Match Timer's swing convention: delay odd divisions by a fraction of one division. */
export declare const networkTickTime: (state: NetworkTransport, tick: number) => number;
//# sourceMappingURL=network-timeline.d.ts.map