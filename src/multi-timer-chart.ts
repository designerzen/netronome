/**
 * Multi-Timer Performance Chart
 * Displays multiple timer streams on a single canvas
 */

interface ChartDataPoint {
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

interface TimerMetrics {
    currentErrorMs: number
    avgErrorMs: number
    p95ErrorMs: number
    currentJitterMs: number
    avgJitterMs: number
}

export class MultiTimerChart {
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    private data: Map<string, ChartDataPoint[]> = new Map()
    private maxDataPoints = 500
    private colors: Map<string, string> = new Map()
    private padding = { top: 24, right: 220, bottom: 34, left: 64 }
    private panelGap = 26

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement
        if (!this.canvas) {
            throw new Error(`Canvas with id ${canvasId} not found`)
        }

        this.ctx = this.canvas.getContext('2d')!
        this.resizeCanvas()
        window.addEventListener('resize', () => this.resizeCanvas())
        window.addEventListener('colorscheme-change', () => this.draw())
    }

    private resizeCanvas(): void {
        const rect = this.canvas.parentElement!.getBoundingClientRect()
        this.canvas.width = rect.width
        this.canvas.height = rect.height
        this.draw()
    }

    addData(data: ChartDataPoint): void {
        if (!this.data.has(data.id)) {
            this.data.set(data.id, [])
            this.colors.set(data.id, data.color)
        }

        const timerData = this.data.get(data.id)!
        timerData.push(data)

        if (timerData.length > this.maxDataPoints) {
            timerData.shift()
        }

        this.draw()
    }

    clear(): void {
        this.data.clear()
        this.colors.clear()
        this.draw()
    }

    clearTimer(id: string): void {
        this.data.delete(id)
        this.colors.delete(id)
        this.draw()
    }

    private getTextColor(): string {
        const isDark = document.documentElement.style.colorScheme === 'dark'
        return isDark ? '#e0e0e0' : '#333333'
    }

    private getGridColor(): string {
        const isDark = document.documentElement.style.colorScheme === 'dark'
        return isDark ? '#444444' : '#cccccc'
    }

    private draw(): void {
        const width = this.canvas.width
        const height = this.canvas.height
        const isDark = document.documentElement.style.colorScheme === 'dark'
        const panels = this.getPanels(width, height)

        const bgColor = isDark ? '#1e1e1e' : '#ffffff'
        this.ctx.fillStyle = bgColor
        this.ctx.fillRect(0, 0, width, height)

        const errorScale = this.getScaleMax('error')
        const jitterScale = this.getScaleMax('jitter')

        this.drawPanelAxes(width, panels.error, 'Timing Error vs Expected', errorScale)
        this.drawPanelAxes(width, panels.jitter, 'Tick-to-Tick Jitter', jitterScale)

        this.data.forEach((timerData, id) => {
            const color = this.colors.get(id)!
            this.drawTimerData(timerData, color, width, panels.error, errorScale, 'error')
            this.drawTimerData(timerData, color, width, panels.jitter, jitterScale, 'jitter')
        })

        this.drawLegend(width, height)
    }

    private getPanels(width: number, height: number): { error: { top: number; height: number; width: number }; jitter: { top: number; height: number; width: number } } {
        const chartHeight = height - this.padding.top - this.padding.bottom
        const panelHeight = Math.max((chartHeight - this.panelGap) / 2, 60)
        const chartWidth = width - this.padding.left - this.padding.right

        return {
            error: { top: this.padding.top, height: panelHeight, width: chartWidth },
            jitter: { top: this.padding.top + panelHeight + this.panelGap, height: panelHeight, width: chartWidth }
        }
    }

    private drawPanelAxes(width: number, panel: { top: number; height: number; width: number }, title: string, scaleMax: number): void {
        const textColor = this.getTextColor()
        const gridColor = this.getGridColor()
        const bottom = panel.top + panel.height

        this.ctx.strokeStyle = gridColor
        this.ctx.fillStyle = textColor
        this.ctx.font = '12px monospace'
        this.ctx.lineWidth = 1

        const ySteps = 5
        for (let i = 0; i <= ySteps; i++) {
            const y = panel.top + panel.height * (1 - i / ySteps)
            const value = (scaleMax * i) / ySteps

            this.ctx.beginPath()
            this.ctx.moveTo(this.padding.left, y)
            this.ctx.lineTo(width - this.padding.right, y)
            this.ctx.stroke()

            this.ctx.textAlign = 'right'
            this.ctx.textBaseline = 'middle'
            this.ctx.fillText(`${value.toFixed(1)}ms`, this.padding.left - 10, y)
        }

        this.ctx.strokeStyle = textColor
        this.ctx.lineWidth = 2
        this.ctx.beginPath()
        this.ctx.moveTo(this.padding.left, bottom)
        this.ctx.lineTo(width - this.padding.right, bottom)
        this.ctx.stroke()

        this.ctx.beginPath()
        this.ctx.moveTo(this.padding.left, panel.top)
        this.ctx.lineTo(this.padding.left, bottom)
        this.ctx.stroke()

        this.ctx.font = 'bold 14px monospace'
        this.ctx.textAlign = 'left'
        this.ctx.textBaseline = 'bottom'
        this.ctx.fillText(title, this.padding.left, panel.top - 6)

        this.ctx.font = '11px monospace'
        this.ctx.textAlign = 'center'
        this.ctx.textBaseline = 'top'
        this.ctx.fillText('Recent ticks', this.padding.left + panel.width / 2, bottom + 8)
    }

    private drawTimerData(
        data: ChartDataPoint[],
        color: string,
        width: number,
        panel: { top: number; height: number; width: number },
        scaleMax: number,
        metric: 'error' | 'jitter'
    ): void {
        if (data.length < 2) return

        const values = this.getMetricSeries(data, metric)
        const bottom = panel.top + panel.height

        this.ctx.strokeStyle = color
        this.ctx.lineWidth = metric === 'error' ? 2.2 : 1.5
        this.ctx.lineCap = 'round'
        this.ctx.lineJoin = 'round'
        this.ctx.setLineDash(metric === 'error' ? [] : [5, 5])

        this.ctx.beginPath()

        values.forEach((value, index) => {
            const x = this.padding.left + (index / (values.length - 1 || 1)) * panel.width
            const normalized = Math.min(value, scaleMax) / scaleMax
            const y = bottom - normalized * panel.height

            if (index === 0) {
                this.ctx.moveTo(x, y)
            } else {
                this.ctx.lineTo(x, y)
            }
        })

        this.ctx.stroke()
        this.ctx.setLineDash([])

        this.ctx.fillStyle = color
        const lastValue = values[values.length - 1]
        const x = this.padding.left + panel.width
        const normalized = Math.min(lastValue, scaleMax) / scaleMax
        const y = bottom - normalized * panel.height

        this.ctx.beginPath()
        this.ctx.arc(x, y, metric === 'error' ? 3.5 : 2.5, 0, Math.PI * 2)
        this.ctx.fill()
    }

    private drawLegend(width: number, height: number): void {
        if (this.data.size === 0) return

        const textColor = this.getTextColor()
        this.ctx.font = '12px monospace'
        this.ctx.textAlign = 'left'
        this.ctx.textBaseline = 'top'

        let legendY = 14
        const legendX = width - this.padding.right + 20

        this.ctx.font = 'bold 12px monospace'
        this.ctx.fillStyle = textColor
        this.ctx.fillText('Useful metrics', legendX, legendY)
        legendY += 20
        this.ctx.font = '11px monospace'

        this.data.forEach((timerData, id) => {
            const color = this.colors.get(id)!
            const metrics = this.summarizeTimer(timerData)

            this.ctx.fillStyle = color
            this.ctx.fillRect(legendX, legendY, 12, 12)

            this.ctx.fillStyle = textColor
            this.ctx.fillText(id, legendX + 18, legendY)
            legendY += 14
            this.ctx.fillText(`err now ${metrics.currentErrorMs.toFixed(2)}ms`, legendX + 18, legendY)
            legendY += 14
            this.ctx.fillText(`err avg ${metrics.avgErrorMs.toFixed(2)}ms`, legendX + 18, legendY)
            legendY += 14
            this.ctx.fillText(`jit avg ${metrics.avgJitterMs.toFixed(2)}ms`, legendX + 18, legendY)
            legendY += 14
            this.ctx.fillText(`err p95 ${metrics.p95ErrorMs.toFixed(2)}ms`, legendX + 18, legendY)
            legendY += 20
        })
    }

    private getMetricSeries(data: ChartDataPoint[], metric: 'error' | 'jitter'): number[] {
        const errorSeries = data.map((point) => this.toErrorMs(point))

        if (metric === 'error') {
            return errorSeries
        }

        return errorSeries.map((value, index) => {
            if (index === 0) {
                return 0
            }

            return Math.abs(value - errorSeries[index - 1]!)
        })
    }

    private toErrorMs(point: ChartDataPoint): number {
        if (typeof point.expected === 'number') {
            return Math.abs(point.timePassed - point.expected) * 1000
        }

        return Math.abs(point.lag) * 1000
    }

    private getScaleMax(metric: 'error' | 'jitter'): number {
        const values = Array.from(this.data.values()).flatMap((timerData) => this.getMetricSeries(timerData, metric))

        if (values.length === 0) {
            return metric === 'error' ? 5 : 2
        }

        const sorted = [...values].sort((a, b) => a - b)
        const percentileIndex = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
        const baseline = sorted[percentileIndex] || 0
        const floor = metric === 'error' ? 5 : 2

        return Math.max(floor, baseline * 1.2, sorted[sorted.length - 1]! * 0.75)
    }

    private summarizeTimer(data: ChartDataPoint[]): TimerMetrics {
        const errors = this.getMetricSeries(data, 'error')
        const jitters = this.getMetricSeries(data, 'jitter')
        const avgErrorMs = errors.reduce((sum, value) => sum + value, 0) / Math.max(errors.length, 1)
        const avgJitterMs = jitters.reduce((sum, value) => sum + value, 0) / Math.max(jitters.length, 1)
        const sortedErrors = [...errors].sort((a, b) => a - b)
        const p95Index = Math.min(sortedErrors.length - 1, Math.floor(sortedErrors.length * 0.95))

        return {
            currentErrorMs: errors[errors.length - 1] || 0,
            avgErrorMs,
            p95ErrorMs: sortedErrors[p95Index] || 0,
            currentJitterMs: jitters[jitters.length - 1] || 0,
            avgJitterMs,
        }
    }
}
