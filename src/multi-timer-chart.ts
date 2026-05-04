/**
 * Multi-Timer Performance Chart
 * Displays multiple timer streams on a single canvas
 */

interface ChartDataPoint {
    id: string
    lag: number
    timePassed: number
    interval: number
    timestamp: number
    color: string
}

export class MultiTimerChart {
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    private data: Map<string, ChartDataPoint[]> = new Map()
    private maxDataPoints = 500
    private animationId: number | null = null
    private colors: Map<string, string> = new Map()
    private yAxisMax = 50 // milliseconds
    private padding = { top: 40, right: 40, bottom: 40, left: 60 }

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

        // Clear canvas
        const bgColor = isDark ? '#1e1e1e' : '#ffffff'
        this.ctx.fillStyle = bgColor
        this.ctx.fillRect(0, 0, width, height)

        // Draw grid and axes
        this.drawAxes(width, height)

        // Draw data for each timer
        this.data.forEach((timerData, id) => {
            const color = this.colors.get(id)!
            this.drawTimerData(timerData, color, width, height)
        })

        // Draw legend
        this.drawLegend(width, height)
    }

    private drawAxes(width: number, height: number): void {
        const textColor = this.getTextColor()
        const gridColor = this.getGridColor()

        this.ctx.strokeStyle = gridColor
        this.ctx.fillStyle = textColor
        this.ctx.font = '12px monospace'
        this.ctx.lineWidth = 1

        // Y-axis labels (lag in ms)
        const ySteps = 5
        for (let i = 0; i <= ySteps; i++) {
            const y = this.padding.top + (height - this.padding.top - this.padding.bottom) * (1 - i / ySteps)
            const value = (this.yAxisMax * i) / ySteps

            // Grid line
            this.ctx.beginPath()
            this.ctx.moveTo(this.padding.left, y)
            this.ctx.lineTo(width - this.padding.right, y)
            this.ctx.stroke()

            // Y-axis label
            this.ctx.textAlign = 'right'
            this.ctx.textBaseline = 'middle'
            this.ctx.fillText(`${value.toFixed(1)}ms`, this.padding.left - 10, y)
        }

        // X-axis
        this.ctx.strokeStyle = textColor
        this.ctx.lineWidth = 2
        this.ctx.beginPath()
        this.ctx.moveTo(this.padding.left, height - this.padding.bottom)
        this.ctx.lineTo(width - this.padding.right, height - this.padding.bottom)
        this.ctx.stroke()

        // Y-axis
        this.ctx.beginPath()
        this.ctx.moveTo(this.padding.left, this.padding.top)
        this.ctx.lineTo(this.padding.left, height - this.padding.bottom)
        this.ctx.stroke()

        // Axis labels
        this.ctx.font = 'bold 14px monospace'
        this.ctx.textAlign = 'center'
        this.ctx.textBaseline = 'top'
        this.ctx.fillText('Lag (ms)', this.padding.left - 30, this.padding.top / 2)

        this.ctx.textAlign = 'center'
        this.ctx.textBaseline = 'top'
        this.ctx.fillText('Time', width / 2, height - 10)
    }

    private drawTimerData(data: ChartDataPoint[], color: string, width: number, height: number): void {
        if (data.length < 2) return

        const chartWidth = width - this.padding.left - this.padding.right
        const chartHeight = height - this.padding.top - this.padding.bottom

        this.ctx.strokeStyle = color
        this.ctx.lineWidth = 2
        this.ctx.lineCap = 'round'
        this.ctx.lineJoin = 'round'

        this.ctx.beginPath()

        data.forEach((point, index) => {
            const x = this.padding.left + (index / (data.length - 1 || 1)) * chartWidth
            const lagNormalized = Math.min(point.lag, this.yAxisMax) / this.yAxisMax
            const y = this.padding.top + chartHeight * (1 - lagNormalized)

            if (index === 0) {
                this.ctx.moveTo(x, y)
            } else {
                this.ctx.lineTo(x, y)
            }
        })

        this.ctx.stroke()

        // Draw data points (circles)
        this.ctx.fillStyle = color
        const lastPoint = data[data.length - 1]
        const x = this.padding.left + chartWidth
        const lagNormalized = Math.min(lastPoint.lag, this.yAxisMax) / this.yAxisMax
        const y = this.padding.top + chartHeight * (1 - lagNormalized)

        this.ctx.beginPath()
        this.ctx.arc(x, y, 3, 0, Math.PI * 2)
        this.ctx.fill()
    }

    private drawLegend(width: number, height: number): void {
        if (this.data.size === 0) return

        const textColor = this.getTextColor()
        this.ctx.font = '12px monospace'
        this.ctx.textAlign = 'left'
        this.ctx.textBaseline = 'top'

        let legendY = 10
        let legendX = width - 200

        this.data.forEach((timerData, id) => {
            const color = this.colors.get(id)!
            const lastPoint = timerData[timerData.length - 1]

            // Color indicator
            this.ctx.fillStyle = color
            this.ctx.fillRect(legendX, legendY, 12, 12)

            // Label and value
            this.ctx.fillStyle = textColor
            const label = `${id}: ${lastPoint.lag.toFixed(1)}ms`
            this.ctx.fillText(label, legendX + 18, legendY)

            legendY += 18
        })
    }
}
