/**
 * Multi-Timer Performance Chart
 * Displays multiple timer streams on a single canvas
 */
interface ChartDataPoint {
    id: string;
    lag: number;
    timePassed: number;
    interval: number;
    timestamp: number;
    color: string;
}
export declare class MultiTimerChart {
    private canvas;
    private ctx;
    private data;
    private maxDataPoints;
    private animationId;
    private colors;
    private yAxisMax;
    private padding;
    constructor(canvasId: string);
    private resizeCanvas;
    addData(data: ChartDataPoint): void;
    clear(): void;
    clearTimer(id: string): void;
    private getTextColor;
    private getGridColor;
    private draw;
    private drawAxes;
    private drawTimerData;
    private drawLegend;
}
export {};
//# sourceMappingURL=multi-timer-chart.d.ts.map