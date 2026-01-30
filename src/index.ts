// Netronome - Timing Experiments
import { startTimer, stopTimer, setTimeBetween } from './timer-global'

interface TimerEvent {
    timePassed: number
    elapsed: number
    expected: number
    drift: number
    level: number
    intervals: number
    lag: number
}

// UI Elements
const feedbackTable = document.getElementById('feedback')!
const startBtn = document.getElementById('start')!
const stopBtn = document.getElementById('stop')!
const resetBtn = document.getElementById('reset')!
const modeSelector = document.getElementById('mode') as HTMLSelectElement
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

startBtn.addEventListener('click', () => {
    if (isRunning) return
    
    reset()
    isRunning = true
    
    startBtn.disabled = true
    stopBtn.disabled = false
    modeSelector.disabled = true
    intervalInput.disabled = true

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
    }, interval)
})


stopBtn.addEventListener('click', () => {
    if (!isRunning) return
    
    stopTimer()
    isRunning = false
    
    startBtn.disabled = false
    stopBtn.disabled = true
    modeSelector.disabled = false
    intervalInput.disabled = false

    const averageLag = lags.length > 0 ? lags.reduce((a, b) => a + b, 0) / lags.length : 0
    const averageDrift = drifts.length > 0 ? drifts.reduce((a, b) => a + b, 0) / drifts.length : 0

    console.log("Stopped", { averageLag, averageDrift, totalTicks: tickCount })
})

resetBtn.addEventListener('click', () => {
    stopTimer()
    isRunning = false
    reset()
    
    startBtn.disabled = false
    stopBtn.disabled = true
    modeSelector.disabled = false
    intervalInput.disabled = false
})

intervalInput.addEventListener('change', (event) => {
    const newInterval = parseInt((event.target as HTMLInputElement).value)
    interval = newInterval
    setTimeBetween(newInterval)
})