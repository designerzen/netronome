type ChartDataPoint = {
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

type RenderPayload = Record<string, ChartDataPoint[]>

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
        payload: RenderPayload
    }
    | {
        type: 'clear'
    }

type Panel = { top: number; height: number; width: number }
type TimerMetrics = {
    currentErrorMs: number
    avgErrorMs: number
    p95ErrorMs: number
    currentJitterMs: number
    avgJitterMs: number
}

const padding = { top: 24, right: 220, bottom: 34, left: 64 }
const panelGap = 26

let displayCanvas: OffscreenCanvas | null = null
let displayCtx: OffscreenCanvasRenderingContext2D | null = null
let bufferCanvas: OffscreenCanvas | null = null
let bufferCtx: OffscreenCanvasRenderingContext2D | null = null
let cssWidth = 0
let cssHeight = 0
let dpr = 1

const setCanvasSize = (width: number, height: number, nextDpr: number) => {
    cssWidth = Math.max(1, Math.floor(width))
    cssHeight = Math.max(1, Math.floor(height))
    dpr = Math.max(1, nextDpr || 1)

    if (!displayCanvas || !bufferCanvas) {
        return
    }

    const pixelWidth = Math.max(1, Math.floor(cssWidth * dpr))
    const pixelHeight = Math.max(1, Math.floor(cssHeight * dpr))
    displayCanvas.width = pixelWidth
    displayCanvas.height = pixelHeight
    bufferCanvas.width = pixelWidth
    bufferCanvas.height = pixelHeight
}

const getPanels = (width: number, height: number): { error: Panel; jitter: Panel } => {
    const chartHeight = height - padding.top - padding.bottom
    const panelHeight = Math.max((chartHeight - panelGap) / 2, 60)
    const chartWidth = width - padding.left - padding.right

    return {
        error: { top: padding.top, height: panelHeight, width: chartWidth },
        jitter: { top: padding.top + panelHeight + panelGap, height: panelHeight, width: chartWidth }
    }
}

const getMetricSeries = (data: ChartDataPoint[], metric: 'error' | 'jitter'): number[] => {
    const errorSeries = data.map((point) => {
        if (typeof point.expected === 'number') {
            return Math.abs(point.timePassed - point.expected) * 1000
        }
        return Math.abs(point.lag) * 1000
    })

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

const getScaleMax = (payload: RenderPayload, metric: 'error' | 'jitter'): number => {
    const values = Object.values(payload).flatMap((timerData) => getMetricSeries(timerData, metric))

    if (values.length === 0) {
        return metric === 'error' ? 5 : 2
    }

    const sorted = [...values].sort((a, b) => a - b)
    const percentileIndex = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
    const baseline = sorted[percentileIndex] || 0
    const floor = metric === 'error' ? 5 : 2

    return Math.max(floor, baseline * 1.2, sorted[sorted.length - 1]! * 0.75)
}

const summarizeTimer = (data: ChartDataPoint[]): TimerMetrics => {
    const errors = getMetricSeries(data, 'error')
    const jitters = getMetricSeries(data, 'jitter')
    const avgErrorMs = errors.reduce((sum, value) => sum + value, 0) / Math.max(errors.length, 1)
    const avgJitterMs = jitters.reduce((sum, value) => sum + value, 0) / Math.max(jitters.length, 1)
    const sortedErrors = [...errors].sort((a, b) => a - b)
    const p95Index = Math.min(sortedErrors.length - 1, Math.floor(sortedErrors.length * 0.95))

    return {
        currentErrorMs: errors[errors.length - 1] || 0,
        avgErrorMs,
        p95ErrorMs: sortedErrors[p95Index] || 0,
        currentJitterMs: jitters[jitters.length - 1] || 0,
        avgJitterMs
    }
}

const drawPanelAxes = (
    ctx: OffscreenCanvasRenderingContext2D,
    width: number,
    panel: Panel,
    title: string,
    scaleMax: number,
    textColor: string,
    gridColor: string
) => {
    const bottom = panel.top + panel.height
    const gridPath = new Path2D()

    ctx.strokeStyle = gridColor
    ctx.fillStyle = textColor
    ctx.font = '12px monospace'
    ctx.lineWidth = 1

    const ySteps = 5
    for (let i = 0; i <= ySteps; i++) {
        const y = panel.top + panel.height * (1 - i / ySteps)
        const value = (scaleMax * i) / ySteps

        gridPath.moveTo(padding.left, y)
        gridPath.lineTo(width - padding.right, y)

        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${value.toFixed(1)}ms`, padding.left - 10, y)
    }
    ctx.stroke(gridPath)

    const axisPath = new Path2D()
    axisPath.moveTo(padding.left, bottom)
    axisPath.lineTo(width - padding.right, bottom)
    axisPath.moveTo(padding.left, panel.top)
    axisPath.lineTo(padding.left, bottom)

    ctx.strokeStyle = textColor
    ctx.lineWidth = 2
    ctx.stroke(axisPath)

    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText(title, padding.left, panel.top - 6)

    ctx.font = '11px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('Recent ticks', padding.left + panel.width / 2, bottom + 8)
}

const drawTimerSeries = (
    ctx: OffscreenCanvasRenderingContext2D,
    data: ChartDataPoint[],
    panel: Panel,
    scaleMax: number,
    color: string,
    metric: 'error' | 'jitter'
) => {
    if (data.length < 2) {
        return
    }

    const values = getMetricSeries(data, metric)
    const bottom = panel.top + panel.height
    const path = new Path2D()

    values.forEach((value, index) => {
        const x = padding.left + (index / (values.length - 1 || 1)) * panel.width
        const normalized = Math.min(value, scaleMax) / scaleMax
        const y = bottom - normalized * panel.height

        if (index === 0) {
            path.moveTo(x, y)
        } else {
            path.lineTo(x, y)
        }
    })

    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = metric === 'error' ? 2.2 : 1.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (metric === 'jitter') {
        ctx.setLineDash([5, 5])
    }
    ctx.stroke(path)
    ctx.restore()

    const lastValue = values[values.length - 1]
    const x = padding.left + panel.width
    const normalized = Math.min(lastValue, scaleMax) / scaleMax
    const y = bottom - normalized * panel.height
    const marker = new Path2D()
    marker.arc(x, y, metric === 'error' ? 3.5 : 2.5, 0, Math.PI * 2)

    ctx.fillStyle = color
    ctx.fill(marker)
}

const drawLegend = (
    ctx: OffscreenCanvasRenderingContext2D,
    payload: RenderPayload,
    width: number,
    textColor: string
) => {
    const ids = Object.keys(payload)
    if (ids.length === 0) {
        return
    }

    let legendY = 14
    const legendX = width - padding.right + 20

    ctx.font = 'bold 12px monospace'
    ctx.fillStyle = textColor
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('Useful metrics', legendX, legendY)
    legendY += 20
    ctx.font = '11px monospace'

    for (const id of ids) {
        const timerData = payload[id] || []
        if (timerData.length === 0) {
            continue
        }

        const color = timerData[timerData.length - 1]!.color
        const metrics = summarizeTimer(timerData)

        ctx.fillStyle = color
        ctx.fillRect(legendX, legendY, 12, 12)

        ctx.fillStyle = textColor
        ctx.fillText(id, legendX + 18, legendY)
        legendY += 14
        ctx.fillText(`err now ${metrics.currentErrorMs.toFixed(2)}ms`, legendX + 18, legendY)
        legendY += 14
        ctx.fillText(`err avg ${metrics.avgErrorMs.toFixed(2)}ms`, legendX + 18, legendY)
        legendY += 14
        ctx.fillText(`jit avg ${metrics.avgJitterMs.toFixed(2)}ms`, legendX + 18, legendY)
        legendY += 14
        ctx.fillText(`err p95 ${metrics.p95ErrorMs.toFixed(2)}ms`, legendX + 18, legendY)
        legendY += 20
    }
}

const render = (payload: RenderPayload, isDark: boolean) => {
    if (!displayCtx || !bufferCtx || !displayCanvas || !bufferCanvas) {
        return
    }

    const width = cssWidth
    const height = cssHeight
    const textColor = isDark ? '#e0e0e0' : '#333333'
    const gridColor = isDark ? '#444444' : '#cccccc'
    const bgColor = isDark ? '#1e1e1e' : '#ffffff'
    const panels = getPanels(width, height)
    const errorScale = getScaleMax(payload, 'error')
    const jitterScale = getScaleMax(payload, 'jitter')

    bufferCtx.save()
    bufferCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    bufferCtx.clearRect(0, 0, width, height)
    bufferCtx.fillStyle = bgColor
    bufferCtx.fillRect(0, 0, width, height)

    drawPanelAxes(bufferCtx, width, panels.error, 'Timing Error vs Expected', errorScale, textColor, gridColor)
    drawPanelAxes(bufferCtx, width, panels.jitter, 'Tick-to-Tick Jitter', jitterScale, textColor, gridColor)

    for (const timerData of Object.values(payload)) {
        if (timerData.length === 0) {
            continue
        }
        const color = timerData[timerData.length - 1]!.color
        drawTimerSeries(bufferCtx, timerData, panels.error, errorScale, color, 'error')
        drawTimerSeries(bufferCtx, timerData, panels.jitter, jitterScale, color, 'jitter')
    }

    drawLegend(bufferCtx, payload, width, textColor)
    bufferCtx.restore()

    displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height)
    displayCtx.drawImage(bufferCanvas, 0, 0)
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const data = event.data

    switch (data.type) {
        case 'init': {
            displayCanvas = data.canvas
            displayCtx = displayCanvas.getContext('2d')
            bufferCanvas = new OffscreenCanvas(1, 1)
            bufferCtx = bufferCanvas.getContext('2d')

            if (!displayCtx || !bufferCtx) {
                throw new Error('2D canvas context unavailable for performance chart worker')
            }

            setCanvasSize(data.width, data.height, data.dpr)
            render({}, data.isDark)
            self.postMessage({ type: 'ready' })
            break
        }
        case 'resize':
            setCanvasSize(data.width, data.height, data.dpr)
            break
        case 'render':
            render(data.payload, data.isDark)
            break
        case 'clear':
            render({}, false)
            break
        default:
            break
    }
}
