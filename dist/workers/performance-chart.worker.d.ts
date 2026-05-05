type ChartDataPoint = {
    id: string;
    lag: number;
    drift?: number;
    timePassed: number;
    expected?: number;
    elapsed?: number;
    interval: number;
    timestamp: number;
    color: string;
};
type RenderPayload = Record<string, ChartDataPoint[]>;
type WorkerMessage = {
    type: 'init';
    canvas: OffscreenCanvas;
    width: number;
    height: number;
    dpr: number;
    isDark: boolean;
} | {
    type: 'resize';
    width: number;
    height: number;
    dpr: number;
} | {
    type: 'render';
    isDark: boolean;
    payload: RenderPayload;
} | {
    type: 'clear';
};
type Panel = {
    top: number;
    height: number;
    width: number;
};
type TimerMetrics = {
    currentErrorMs: number;
    avgErrorMs: number;
    p95ErrorMs: number;
    currentJitterMs: number;
    avgJitterMs: number;
};
declare const padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
};
declare const panelGap = 26;
declare let displayCanvas: OffscreenCanvas | null;
declare let displayCtx: OffscreenCanvasRenderingContext2D | null;
declare let bufferCanvas: OffscreenCanvas | null;
declare let bufferCtx: OffscreenCanvasRenderingContext2D | null;
declare let cssWidth: number;
declare let cssHeight: number;
declare let dpr: number;
declare const setCanvasSize: (width: number, height: number, nextDpr: number) => void;
declare const getPanels: (width: number, height: number) => {
    error: Panel;
    jitter: Panel;
};
declare const getMetricSeries: (data: ChartDataPoint[], metric: "error" | "jitter") => number[];
declare const getScaleMax: (payload: RenderPayload, metric: "error" | "jitter") => number;
declare const summarizeTimer: (data: ChartDataPoint[]) => TimerMetrics;
declare const drawPanelAxes: (ctx: OffscreenCanvasRenderingContext2D, width: number, panel: Panel, title: string, scaleMax: number, textColor: string, gridColor: string) => void;
declare const drawTimerSeries: (ctx: OffscreenCanvasRenderingContext2D, data: ChartDataPoint[], panel: Panel, scaleMax: number, color: string, metric: "error" | "jitter") => void;
declare const drawLegend: (ctx: OffscreenCanvasRenderingContext2D, payload: RenderPayload, width: number, textColor: string) => void;
declare const render: (payload: RenderPayload, isDark: boolean) => void;
//# sourceMappingURL=performance-chart.worker.d.ts.map