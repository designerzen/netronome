/**
 * Multi-Timer Frontend
 * Manages UI and orchestrates multiple timers with shared chart
 */

import { createTimer } from '../src/timer.ts'
import {
    AudioContextWorkerWrapper,
    TimingWorkletNode,
    createTimingWorklet,
    RollingTimeWorkerWrapper,
    SetIntervalWorkerWrapper,
    SetTimeoutWorkerWrapper
} from '../src/timer-worker-types.js'
import { MultiTimerManager } from '../public/multi-timer.ts'
import { MultiTimerChart } from '../public/multi-timer-chart.ts'

const WORKER_TYPES: Record<string, string> = {
    audiocontext: AudioContextWorkerWrapper,
    audioworklet: TimingWorkletNode,
    rolling: RollingTimeWorkerWrapper,
    setinterval: SetIntervalWorkerWrapper,
    settimeout: SetTimeoutWorkerWrapper
}

interface RunningTimer {
    id: string
    timer: any // Timer instance from createTimer
    stats: {
        ticks: number
        lags: number[]
        drifts: number[]
    }
    isRunning: boolean
}

// UI Elements
const timersContainer = document.getElementById('timers-container')!
const addTimerBtn = document.getElementById('add-timer')!
const startAllBtn = document.getElementById('start-all')!
const stopAllBtn = document.getElementById('stop-all')!
const resetAllBtn = document.getElementById('reset-all')!
const statsTable = document.getElementById('stats-table')!
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement

// State
const multiTimerManager = new MultiTimerManager()
const runningTimers = new Map<string, RunningTimer>()
const chart = new MultiTimerChart('multi-timer-chart')
let isAnyRunning = false

// Initialize theme
const initTheme = () => {
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = savedTheme === 'dark' || (savedTheme === null && prefersDark)

    if (isDark) {
        document.documentElement.style.colorScheme = 'dark'
        themeToggle.textContent = '☀️ Light'
    } else {
        document.documentElement.style.colorScheme = 'light'
        themeToggle.textContent = '🌙 Dark'
    }
}

themeToggle.addEventListener('click', () => {
    const currentScheme = document.documentElement.style.colorScheme
    const isDark = currentScheme === 'dark'
    const newScheme = isDark ? 'light' : 'dark'

    document.documentElement.style.colorScheme = newScheme
    localStorage.setItem('theme', newScheme)

    themeToggle.textContent = isDark ? '🌙 Dark' : '☀️ Light'
    window.dispatchEvent(new Event('colorscheme-change'))
})

initTheme()

// Render timer card
const renderTimerCard = (timerId: string) => {
    const timerConfig = multiTimerManager.getTimer(timerId)
    if (!timerConfig) return

    const running = runningTimers.get(timerId)?.isRunning || false
    const stats = runningTimers.get(timerId)?.stats

    const card = document.createElement('div')
    card.className = 'timer-card'
    card.id = `timer-${timerId}`
    card.innerHTML = `
        <div class="timer-card-header">
            <div class="timer-color-indicator" style="background: ${timerConfig.color}"></div>
            <div class="timer-card-title">${timerConfig.name}</div>
        </div>

        <div class="timer-controls-row">
            <div class="timer-control-group" style="flex: 1;">
                <label>Tempo (BPM)</label>
                <input type="number" class="timer-bpm" value="${timerConfig.bpm}" min="20" max="300" ${running ? 'disabled' : ''} />
            </div>
            <div class="timer-control-group" style="flex: 1;">
                <label>Worker Type</label>
                <select class="timer-worker-type" ${running ? 'disabled' : ''}>
                    <option value="audiocontext" ${timerConfig.workerType === 'audiocontext' ? 'selected' : ''}>AudioContext</option>
                    <option value="audioworklet" ${timerConfig.workerType === 'audioworklet' ? 'selected' : ''}>AudioWorklet</option>
                    <option value="rolling" ${timerConfig.workerType === 'rolling' ? 'selected' : ''}>Rolling</option>
                    <option value="setinterval" ${timerConfig.workerType === 'setinterval' ? 'selected' : ''}>SetInterval</option>
                    <option value="settimeout" ${timerConfig.workerType === 'settimeout' ? 'selected' : ''}>SetTimeout</option>
                </select>
            </div>
        </div>

        <div class="timer-stats">
            <div class="timer-stat">
                <div class="timer-stat-label">Avg Lag</div>
                <div class="timer-stat-value">${stats?.lags.length ? (stats.lags.reduce((a, b) => a + b) / stats.lags.length).toFixed(2) : '0.00'}ms</div>
            </div>
            <div class="timer-stat">
                <div class="timer-stat-label">Avg Drift</div>
                <div class="timer-stat-value">${stats?.drifts.length ? (stats.drifts.reduce((a, b) => a + b) / stats.drifts.length).toFixed(2) : '0.00'}ms</div>
            </div>
            <div class="timer-stat">
                <div class="timer-stat-label">Ticks</div>
                <div class="timer-stat-value">${stats?.ticks || 0}</div>
            </div>
            <div class="timer-stat">
                <div class="timer-stat-label">Status</div>
                <div class="timer-stat-value">${running ? '▶ Running' : '⏸ Stopped'}</div>
            </div>
        </div>

        <div class="timer-actions">
            <button class="timer-start" ${running ? 'disabled' : ''}>Start</button>
            <button class="timer-stop" ${!running ? 'disabled' : ''}>Stop</button>
            <button class="timer-clear" ${!stats?.ticks ? 'disabled' : ''}>Clear</button>
            <button class="timer-remove remove">Remove</button>
        </div>
    `

    // Add event listeners
    const bpmInput = card.querySelector('.timer-bpm') as HTMLInputElement
    const workerTypeSelect = card.querySelector('.timer-worker-type') as HTMLSelectElement
    const startBtn = card.querySelector('.timer-start') as HTMLButtonElement
    const stopBtn = card.querySelector('.timer-stop') as HTMLButtonElement
    const clearBtn = card.querySelector('.timer-clear') as HTMLButtonElement
    const removeBtn = card.querySelector('.timer-remove') as HTMLButtonElement

    bpmInput.addEventListener('change', (e) => {
        const bpm = parseInt((e.target as HTMLInputElement).value)
        multiTimerManager.updateTimerConfig(timerId, { bpm })
        // Update interval if timer is running
        const running = runningTimers.get(timerId)
        if (running) {
            const interval = 60000 / bpm
            running.timer.setTimeBetween?.(interval)
        }
    })

    workerTypeSelect.addEventListener('change', (e) => {
        const workerType = (e.target as HTMLSelectElement).value
        multiTimerManager.updateTimerConfig(timerId, { workerType })
    })

    startBtn.addEventListener('click', () => startTimer(timerId))
    stopBtn.addEventListener('click', () => stopTimer(timerId))
    clearBtn.addEventListener('click', () => clearTimer(timerId))
    removeBtn.addEventListener('click', () => removeTimer(timerId))

    return card
}

// Start a timer
const startTimer = async (timerId: string) => {
    const config = multiTimerManager.getTimer(timerId)
    if (!config) return

    if (runningTimers.has(timerId)) {
        const running = runningTimers.get(timerId)!
        if (running.isRunning) return
    }

    try {
        const interval = 60000 / config.bpm
        const workerUri = WORKER_TYPES[config.workerType]

        const timer = createTimer({
            interval,
            type: workerUri
        })

        const stats = {
            ticks: 0,
            lags: [] as number[],
            drifts: [] as number[]
        }

        const callback = ({ timePassed, elapsed, expected, drift, lag }: any) => {
            stats.ticks++
            stats.lags.push(lag)
            stats.drifts.push(drift)

            // Keep only last 500 data points
            if (stats.lags.length > 500) stats.lags.shift()
            if (stats.drifts.length > 500) stats.drifts.shift()

            multiTimerManager.addData({
                id: timerId,
                lag,
                timePassed,
                interval,
                timestamp: Date.now(),
                drift
            })

            chart.addData({
                id: timerId,
                lag,
                timePassed,
                interval,
                timestamp: Date.now(),
                color: config.color
            })
        }

        // Start the timer
        await timer.startTimer(callback, {
            type: workerUri
        })

        runningTimers.set(timerId, {
            id: timerId,
            timer,
            stats,
            isRunning: true
        })

        isAnyRunning = true
        updateUI()
    } catch (error) {
        console.error(`Error starting timer ${timerId}:`, error)
    }
}

// Stop a timer
const stopTimer = async (timerId: string) => {
    const running = runningTimers.get(timerId)
    if (!running) return

    try {
        await running.timer.stopTimer?.()
        running.isRunning = false
        isAnyRunning = Array.from(runningTimers.values()).some(t => t.isRunning)
        updateUI()
    } catch (error) {
        console.error(`Error stopping timer ${timerId}:`, error)
    }
}

// Clear timer data
const clearTimer = (timerId: string) => {
    const running = runningTimers.get(timerId)
    if (running) {
        running.stats = {
            ticks: 0,
            lags: [],
            drifts: []
        }
    }
    multiTimerManager.clearTimer(timerId)
    chart.clearTimer(timerId)
    updateUI()
}

// Remove a timer
const removeTimer = async (timerId: string) => {
    const running = runningTimers.get(timerId)
    if (running && running.isRunning) {
        await stopTimer(timerId)
    }

    runningTimers.delete(timerId)
    multiTimerManager.removeTimer(timerId)
    chart.clearTimer(timerId)
    updateUI()
}

// Start all timers
const startAllTimers = async () => {
    const timers = multiTimerManager.getAllTimers()
    for (const timer of timers) {
        const running = runningTimers.get(timer.id)
        if (!running?.isRunning) {
            await startTimer(timer.id)
            // Small delay between starts
            await new Promise(resolve => setTimeout(resolve, 50))
        }
    }
}

// Stop all timers
const stopAllTimers = async () => {
    for (const [timerId, running] of runningTimers.entries()) {
        if (running.isRunning) {
            await stopTimer(timerId)
        }
    }
}

// Reset all timers
const resetAllTimers = async () => {
    await stopAllTimers()
    runningTimers.forEach((running, timerId) => {
        running.stats = {
            ticks: 0,
            lags: [],
            drifts: []
        }
    })
    multiTimerManager.clear()
    chart.clear()
    updateUI()
}

// Update UI
const updateUI = () => {
    const timers = multiTimerManager.getAllTimers()

    // Render timer cards
    timersContainer.innerHTML = ''
    timers.forEach(timer => {
        const card = renderTimerCard(timer.id)
        if (card) {
            timersContainer.appendChild(card)
        }
    })

    // Update global buttons
    startAllBtn.disabled = isAnyRunning || timers.length === 0
    stopAllBtn.disabled = !isAnyRunning
    resetAllBtn.disabled = timers.length === 0

    // Update stats table
    if (timers.length === 0) {
        statsTable.innerHTML = '<tr class="empty-state"><td colspan="6">Add timers to begin comparison</td></tr>'
    } else {
        statsTable.innerHTML = timers.map(timer => {
            const running = runningTimers.get(timer.id)
            const stats = running?.stats
            const avgLag = stats?.lags.length ? (stats.lags.reduce((a, b) => a + b) / stats.lags.length).toFixed(2) : '0.00'
            const avgDrift = stats?.drifts.length ? (stats.drifts.reduce((a, b) => a + b) / stats.drifts.length).toFixed(2) : '0.00'

            return `
                <tr>
                    <td><span style="color: ${timer.color}; font-weight: bold;">●</span> ${timer.name}</td>
                    <td>${running?.isRunning ? '▶ Running' : '⏸ Stopped'}</td>
                    <td>${timer.bpm}</td>
                    <td>${avgLag}ms</td>
                    <td>${avgDrift}ms</td>
                    <td>${stats?.ticks || 0}</td>
                </tr>
            `
        }).join('')
    }
}

// Add new timer
addTimerBtn.addEventListener('click', () => {
    const timerId = multiTimerManager.addTimer({
        bpm: 120,
        name: `Timer ${multiTimerManager.getAllTimers().length + 1}`
    })
    updateUI()
})

// Global control buttons
startAllBtn.addEventListener('click', startAllTimers)
stopAllBtn.addEventListener('click', stopAllTimers)
resetAllBtn.addEventListener('click', resetAllTimers)

// Initial render
updateUI()
