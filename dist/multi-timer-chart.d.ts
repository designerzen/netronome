/**
 * Multi-Timer Performance Chart
 * Buffers chart updates on the main thread and renders via an OffscreenCanvas worker.
 */
export interface ChartDataPoint {
    id: string;
    lag: number;
    drift?: number;
    timePassed: number;
    expected?: number;
    elapsed?: number;
    interval: number;
    timestamp: number;
    color: string;
}
export declare class MultiTimerChart {
    private canvas;
    private data;
    private maxDataPoints;
    private worker;
    private flushScheduled;
    private resizeScheduled;
    private isWorkerReady;
    constructor(canvasId: string);
    addData(data: ChartDataPoint): void;
    clear(): void;
    clearTimer(id: string): void;
    private initWorker;
    private scheduleResize;
    private resizeCanvas;
    private scheduleFlush;
    private flush;
}
//# sourceMappingURL=multi-timer-chart.d.ts.map