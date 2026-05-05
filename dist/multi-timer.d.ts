/**
 * Multi-Timer Manager
 * Manages multiple timers running simultaneously with individual configurations
 */
import { type TimerType } from '../src/timer-types';
export interface MultiTimerConfig {
    id: string;
    bpm: number;
    swing: number;
    name: string;
    workerType: TimerType;
    color: string;
    startTime?: number;
    epoch?: string;
    metronomeEnabled?: boolean;
}
export interface MultiTimerData {
    id: string;
    lag: number;
    timePassed: number;
    interval: number;
    timestamp: number;
    drift: number;
    expected?: number;
    elapsed?: number;
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
//# sourceMappingURL=multi-timer.d.ts.map