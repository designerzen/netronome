// Netronome - Timing Experiments
import { startTimer, stopTimer, setTimeBetween, createTimer } from './timer-global'

import AUDIOCONTEXT_WORKER_URI from './workers/timing.audiocontext.worker.ts?url'
import ROLLING_WORKER_URI from './workers/timing.rolling.worker.ts?url'
import SETINTERVAL_WORKER_URI from './workers/timing.setinterval.worker.ts?url'
import SETTIMEOUT_WORKER_URI from './workers/timing.settimeout.worker.ts?url'

interface TimerEvent {
    timePassed: number
    elapsed: number
    expected: number
    drift: number
    level: number
    intervals: number
    lag: number
}

// Worker URIs mapping
const WORKER_TYPES: Record<string, string> = {
    audiocontext: AUDIOCONTEXT_WORKER_URI,
    rolling: ROLLING_WORKER_URI,
    setinterval: SETINTERVAL_WORKER_URI,
    settimeout: SETTIMEOUT_WORKER_URI
}

// UI Elements
const feedbackTable = document.getElementById('feedback')!
const startBtn = document.getElementById('start')!
const stopBtn = document.getElementById('stop')!
const resetBtn = document.getElementById('reset')!
const workerTypeSelector = document.getElementById('worker-type') as HTMLSelectElement
const intervalInput = document.getElementById('interval') as HTMLInputElement

// Stats Elements
const statIntervals = document.getElementById('stat-intervals')!
const statDrift = document.getElementById('stat-drift')!
const statLag = document.getElementById('stat-lag')!
const statTicks = document.getElementById('stat-ticks')!

// State
let interval = 1000
let lags: number[] = []
let drifts: number[] = []
let tickCount = 0
let isRunning = false
let currentWorkerType = 'audiocontext'

const reset = () => {
    lags = []
    drifts = []
    tickCount = 0
    statIntervals.textContent = '0'
    statDrift.textContent = '0'
    statLag.textContent = '0'
    statTicks.textContent = '0'
    feedbackTable.innerHTML = '<tr class="empty-state"><td colspan="6">Click Start to begin collecting timing data</td></tr>'
}

startBtn.addEventListener('click', async () => {
    if (isRunning) return
    
    reset()
    isRunning = true
    
    startBtn.disabled = true
    stopBtn.disabled = false
    workerTypeSelector.disabled = true
    intervalInput.disabled = true

    // Get the selected worker type
    const selectedType = workerTypeSelector.value
    currentWorkerType = selectedType
    const workerUri = WORKER_TYPES[selectedType]

    startTimer(({ timePassed, elapsed, expected, drift, level, intervals, lag }: TimerEvent) => {
        tickCount++

        // Clear empty state on first tick
        if (tickCount === 1) {
            feedbackTable.innerHTML = ''
        }

        const row = document.createElement('tr')
        row.innerHTML = `
            <td>${intervals}</td>
            <td>${expected.toFixed(4)}</td>
            <td>${elapsed.toFixed(4)}</td>
            <td>${timePassed.toFixed(4)}</td>
            <td>${drift.toFixed(4)}</td>
            <td>${lag.toFixed(4)}</td>
        `
        feedbackTable.appendChild(row)

        // Keep only last 100 rows for performance
        if (feedbackTable.children.length > 100) {
            feedbackTable.removeChild(feedbackTable.firstChild!)
        }

        lags.push(lag)
        drifts.push(drift)

        // Update stats
        const avgDrift = drifts.reduce((a, b) => a + b, 0) / drifts.length
        const avgLag = lags.reduce((a, b) => a + b, 0) / lags.length
        
        statIntervals.textContent = intervals.toString()
        statDrift.textContent = avgDrift.toFixed(4)
        statLag.textContent = avgLag.toFixed(4)
        statTicks.textContent = tickCount.toString()

        console.log("Tick", { intervals, drift, lag, tickCount })
    }, interval, { type: workerUri })
})


stopBtn.addEventListener('click', () => {
    if (!isRunning) return
    
    stopTimer()
    isRunning = false
    
    startBtn.disabled = false
    stopBtn.disabled = true
    workerTypeSelector.disabled = false
    intervalInput.disabled = false

    const averageLag = lags.length > 0 ? lags.reduce((a, b) => a + b, 0) / lags.length : 0
    const averageDrift = drifts.length > 0 ? drifts.reduce((a, b) => a + b, 0) / drifts.length : 0

    console.log("Stopped with", currentWorkerType, { averageLag, averageDrift, totalTicks: tickCount })
})

resetBtn.addEventListener('click', () => {
    stopTimer()
    isRunning = false
    reset()
    
    startBtn.disabled = false
    stopBtn.disabled = true
    workerTypeSelector.disabled = false
    intervalInput.disabled = false
})

intervalInput.addEventListener('change', (event) => {
    const newInterval = parseInt((event.target as HTMLInputElement).value)
    interval = newInterval
    setTimeBetween(newInterval)
})

workerTypeSelector.addEventListener('change', (event) => {
    const selectedType = (event.target as HTMLSelectElement).value
    currentWorkerType = selectedType
    
    // If timer is running, restart it with new worker type
    if (isRunning) {
        stopTimer()
        isRunning = false
        
        // Small delay to ensure clean shutdown
        setTimeout(() => {
            startBtn.click()
        }, 100)
    }
})