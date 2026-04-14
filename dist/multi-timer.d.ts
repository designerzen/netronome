/**
 * Multi-Timer Manager
 * Manages multiple timers running simultaneously with individual configurations
 */
interface MultiTimerConfig {
    id: string;
    bpm: number;
    name: string;
    workerType: string;
    color: string;
    startTime?: number;
    epoch?: string;
    metronomeEnabled?: boolean;
}
interface MultiTimerData {
    id: string;
    lag: number;
    timePassed: number;
    interval: number;
    timestamp: number;
    drift: number;
}
export declare class MultiTimerManager {
    private timers;
    private timerData;
    private listeners;
    private colorPalette;
    private colorIndex;
    addTimer(config: Partial<MultiTimerConfig>): string;
    removeTimer(id: string): void;
    getTimer(id: string): MultiTimerConfig | undefined;
    getAllTimers(): MultiTimerConfig[];
    updateTimerConfig(id: string, config: Partial<MultiTimerConfig>): void;
    addData(timerData: MultiTimerData): void;
    getData(id: string): MultiTimerData[];
    getAllData(): MultiTimerData[];
    clear(): void;
    clearTimer(id: string): void;
    subscribe(listener: (data: MultiTimerData[]) => void): () => void;
    private notifyListeners;
}
export declare const multiTimerManager: MultiTimerManager;
export {};
//# sourceMappingURL=multi-timer.d.ts.map