/**
 * Multi-Timer Manager
 * Manages multiple timers running simultaneously with individual configurations
 */

interface MultiTimerConfig {
    id: string
    bpm: number
    name: string
    workerType: string
    color: string
    startTime?: number
    epoch?: string
    metronomeEnabled?: boolean
}

interface MultiTimerData {
    id: string
    lag: number
    timePassed: number
    interval: number
    timestamp: number
    drift: number
}

export class MultiTimerManager {
    private timers: Map<string, MultiTimerConfig> = new Map()
    private timerData: Map<string, MultiTimerData[]> = new Map()
    private listeners: ((data: MultiTimerData[]) => void)[] = []
    private colorPalette = [
        '#FF6B6B', // Red
        '#4ECDC4', // Teal
        '#45B7D1', // Blue
        '#FFA07A', // Light Salmon
        '#98D8C8', // Mint
        '#F7DC6F', // Yellow
        '#BB8FCE', // Purple
        '#85C1E2', // Light Blue
        '#F8B88B', // Peach
        '#A9DFBF'  // Light Green
    ]
    private colorIndex = 0

    addTimer(config: Partial<MultiTimerConfig>): string {
        const id = config.id || `timer-${Date.now()}-${Math.random()}`
        const color = config.color || this.colorPalette[this.colorIndex % this.colorPalette.length]
        this.colorIndex++

        const timerConfig: MultiTimerConfig = {
            id,
            bpm: config.bpm || 120,
            name: config.name || `Timer ${this.timers.size + 1}`,
            workerType: config.workerType || 'audiocontext',
            color
        }

        this.timers.set(id, timerConfig)
        this.timerData.set(id, [])

        return id
    }

    removeTimer(id: string): void {
        this.timers.delete(id)
        this.timerData.delete(id)
    }

    getTimer(id: string): MultiTimerConfig | undefined {
        return this.timers.get(id)
    }

    getAllTimers(): MultiTimerConfig[] {
        return Array.from(this.timers.values())
    }

    updateTimerConfig(id: string, config: Partial<MultiTimerConfig>): void {
        const existing = this.timers.get(id)
        if (existing) {
            this.timers.set(id, { ...existing, ...config })
        }
    }

    addData(timerData: MultiTimerData): void {
        const data = this.timerData.get(timerData.id)
        if (data) {
            data.push(timerData)
            // Keep only last 500 data points per timer
            if (data.length > 500) {
                data.shift()
            }
            this.notifyListeners()
        }
    }

    getData(id: string): MultiTimerData[] {
        return this.timerData.get(id) || []
    }

    getAllData(): MultiTimerData[] {
        const allData: MultiTimerData[] = []
        this.timerData.forEach(data => {
            allData.push(...data)
        })
        return allData.sort((a, b) => a.timestamp - b.timestamp)
    }

    clear(): void {
        this.timerData.forEach(data => data.length = 0)
        this.notifyListeners()
    }

    clearTimer(id: string): void {
        const data = this.timerData.get(id)
        if (data) {
            data.length = 0
        }
        this.notifyListeners()
    }

    subscribe(listener: (data: MultiTimerData[]) => void): () => void {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    private notifyListeners(): void {
        const allData = this.getAllData()
        this.listeners.forEach(listener => listener(allData))
    }
}

export const multiTimerManager = new MultiTimerManager()
