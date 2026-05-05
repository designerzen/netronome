/**
 * Multi-Timer Performance Chart
 * Buffers chart updates on the main thread and renders via an OffscreenCanvas worker.
 */

import PerformanceChartWorker from './workers/performance-chart.worker.ts?worker'

export interface ChartDataPoint {
    id: string
    lag: number
    drift?: number
    timePassed: number
    expected?: number
    elapsed?: number
    interval: number
    timestamp: number
    color: string
}

type WorkerMessage =
    | {
        type: 'init'
        canvas: OffscreenCanvas
        width: number
        height: number
        dpr: number
        isDark: boolean
    }
    | {
        type: 'resize'
        width: number
        height: number
        dpr: number
    }
    | {
        type: 'render'
        isDark: boolean
        payload: Record<string, ChartDataPoint[]>
    }
    | {
        type: 'clear'
    }

export class MultiTimerChart {
    private canvas: HTMLCanvasElement
    private data: Map<string, ChartDataPoint[]> = new Map()
    private maxDataPoints = 500
    private worker: Worker | null = null
    private flushScheduled = false
    private resizeScheduled = false
    private isWorkerReady = false

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement
        if (!this.canvas) {
            throw new Error(`Canvas with id ${canvasId} not found`)
        }

        this.initWorker()
        this.resizeCanvas()
        window.addEventListener('resize', () => this.scheduleResize())
        window.addEventListener('colorscheme-change', () => this.scheduleFlush())
    }

    addData(data: ChartDataPoint): void {
        if (!this.data.has(data.id)) {
            this.data.set(data.id, [])
        }

        const timerData = this.data.get(data.id)!
        timerData.push(data)

        if (timerData.length > this.maxDataPoints) {
            timerData.shift()
        }

        this.scheduleFlush()
    }

    clear(): void {
        this.data.clear()
        if (this.worker && this.isWorkerReady) {
            this.worker.postMessage({ type: 'clear' } satisfies WorkerMessage)
        }
    }

    clearTimer(id: string): void {
        this.data.delete(id)
        this.scheduleFlush()
    }

    private initWorker(): void {
        if (typeof Worker === 'undefined' || typeof this.canvas.transferControlToOffscreen !== 'function') {
            throw new Error('OffscreenCanvas worker rendering is required for the performance monitor')
        }

        const offscreen = this.canvas.transferControlToOffscreen()
        this.worker = new PerformanceChartWorker()
        this.worker.onmessage = () => {
            this.isWorkerReady = true
            this.scheduleFlush()
        }

        const rect = this.canvas.parentElement!.getBoundingClientRect()
        const initMessage: WorkerMessage = {
            type: 'init',
            canvas: offscreen,
            width: rect.width,
            height: rect.height,
            dpr: window.devicePixelRatio || 1,
            isDark: document.documentElement.style.colorScheme === 'dark'
        }

        this.worker.postMessage(initMessage, [offscreen])
    }

    private scheduleResize(): void {
        if (this.resizeScheduled) {
            return
        }

        this.resizeScheduled = true
        requestAnimationFrame(() => {
            this.resizeScheduled = false
            this.resizeCanvas()
        })
    }

    private resizeCanvas(): void {
        const rect = this.canvas.parentElement!.getBoundingClientRect()
        this.canvas.style.width = `${rect.width}px`
        this.canvas.style.height = `${rect.height}px`

        if (this.worker && this.isWorkerReady) {
            this.worker.postMessage({
                type: 'resize',
                width: rect.width,
                height: rect.height,
                dpr: window.devicePixelRatio || 1
            } satisfies WorkerMessage)
        }

        this.scheduleFlush()
    }

    private scheduleFlush(): void {
        if (this.flushScheduled) {
            return
        }

        this.flushScheduled = true
        requestAnimationFrame(() => {
            this.flushScheduled = false
            this.flush()
        })
    }

    private flush(): void {
        if (!this.worker || !this.isWorkerReady) {
            return
        }

        const payload = Object.fromEntries(
            Array.from(this.data.entries()).map(([id, points]) => [id, points])
        )

        this.worker.postMessage({
            type: 'render',
            isDark: document.documentElement.style.colorScheme === 'dark',
            payload
        } satisfies WorkerMessage)
    }
}
