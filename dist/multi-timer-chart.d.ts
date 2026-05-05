/**
 * Multi-Timer Performance Chart
 * Displays multiple timer streams on a single canvas
 */
interface ChartDataPoint {
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
    private ctx;
    private data;
    private maxDataPoints;
    private colors;
    private padding;
    private panelGap;
    constructor(canvasId: string);
    private resizeCanvas;
    addData(data: ChartDataPoint): void;
    clear(): void;
    clearTimer(id: string): void;
    private getTextColor;
    private getGridColor;
    private draw;
    private getPanels;
    private drawPanelAxes;
    private drawTimerData;
    private drawLegend;
    private getMetricSeries;
    private toErrorMs;
    private getScaleMax;
    private summarizeTimer;
}
export {};
//# sourceMappingURL=multi-timer-chart.d.ts.map