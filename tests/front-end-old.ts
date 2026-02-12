// Netronome - Timing Experiments
import { startTimer, stopTimer, setTimeBetween, createTimer, getTimer } from '../src/timer-global.js'
import {
    AudioContextWorkerWrapper,
    TimingWorkletNode,
    createTimingWorklet,
    RollingTimeWorkerWrapper,
    SetIntervalWorkerWrapper,
    SetTimeoutWorkerWrapper
} from '../src/timer-worker-types.js'
import { CMD_ADJUST_DRIFT } from '../src/timer-event-types.js'
import { PerformanceChart } from '../public/performance-chart.js'
import { MultiTimerManager } from '../public/multi-timer.ts'
import { MultiTimerChart } from '../public/multi-timer-chart.ts'

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
    audiocontext: AudioContextWorkerWrapper,
    audioworklet: TimingWorkletNode,
    rolling: RollingTimeWorkerWrapper,
    setinterval: SetIntervalWorkerWrapper,
    settimeout: SetTimeoutWorkerWrapper
}

// UI Elements - Single Timer
const feedbackTable = document.getElementById('feedback')!
const startBtn = document.getElementById('start') as HTMLButtonElement
const stopBtn = document.getElementById('stop') as HTMLButtonElement
const resetBtn = document.getElementById('reset') as HTMLButtonElement
const workerTypeSelector = document.getElementById('worker-type') as HTMLSelectElement
const intervalInput = document.getElementById('interval') as HTMLInputElement
const bpmSlider = document.getElementById('bpm') as HTMLInputElement
const bpmValue = document.getElementById('bpm-value')!
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement
const accurateModeCheckbox = document.getElementById('accurate-mode') as HTMLInputElement
const cpuStressCheckbox = document.getElementById('cpu-stress') as HTMLInputElement
const midiConnectBtn = document.getElementById('midi-connect') as HTMLButtonElement

// Stats Elements - Single Timer
const statIntervals = document.getElementById('stat-intervals')!
const statDrift = document.getElementById('stat-drift')!
const statLag = document.getElementById('stat-lag')!
const statTicks = document.getElementById('stat-ticks')!

// UI Elements - Multi-Timer
const addTimerBtn = document.getElementById('add-timer')!

// State - Single Timer
let interval = 1000
let bpm = 120
let lags: number[] = []
let drifts: number[] = []
let tickCount = 0
let isRunning = false
let currentWorkerType = 'audiocontext'
let accurateMode = false
let cpuStressEnabled = false
let cpuStressAnimationId: number | null = null
let midiOutputs: MIDIOutput[] = []
let midiTransportStarted = false
let midiClockCounter = 0

// State - Multi-Timer
interface RunningTimer {
    id: string
    timer: any
    stats: {
        ticks: number
        lags: number[]
        drifts: number[]
    }
    isRunning: boolean
}

const multiTimerManager = new MultiTimerManager()
const runningTimers = new Map<string, RunningTimer>()
let multiChart: MultiTimerChart
let isAnyMultiTimerRunning = false

const reset = () => {
    lags = []
    drifts = []
    tickCount = 0
    statIntervals.textContent = '0'
    statDrift.textContent = '0'
    statLag.textContent = '0'
    statTicks.textContent = '0'
    feedbackTable.innerHTML = '<tr class="empty-state"><td colspan="6">Click Start to begin collecting timing data</td></tr>'
    if (multiChart) {
        multiChart.clearTimer('single-timer')
    }
}

startBtn.addEventListener('click', async () => {
    if (isRunning) return
    
    reset()
    isRunning = true
    accurateMode = accurateModeCheckbox.checked
    
    // Initialize multi-timer chart if not already created
    initMultiChart()
    
    startBtn.disabled = true
    stopBtn.disabled = false
    workerTypeSelector.disabled = true
    intervalInput.disabled = true
    accurateModeCheckbox.disabled = true

    // Get the selected worker type
    const selectedType = workerTypeSelector.value
    currentWorkerType = selectedType
    const workerUri = WORKER_TYPES[selectedType]

    startTimer(({ timePassed, elapsed, expected, drift, level, intervals, lag }: TimerEvent) => {
        tickCount++
        
        // Send MIDI transport start on first tick
        if (tickCount === 1 && midiOutputs.length > 0 && !midiTransportStarted) {
            sendMidiTransportStart()
        }
        
        // Send MIDI clock - 24 clocks per quarter note
        // At current BPM/interval, send appropriate number of clocks
        const clocksPerTick = Math.max(1, Math.round(24 * interval / 250))
        for (let i = 0; i < clocksPerTick; i++) {
            sendMidiClock()
        }

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

        // Add single-timer data to shared chart
        if (multiChart) {
            multiChart.addData({
                id: 'single-timer',
                lag,
                timePassed,
                interval,
                timestamp: Date.now(),
                color: '#007bff'
            })
        }

        // Update stats
        const avgDrift = drifts.reduce((a, b) => a + b, 0) / drifts.length
        const avgLag = lags.reduce((a, b) => a + b, 0) / lags.length
        
        statIntervals.textContent = intervals.toString()
        statDrift.textContent = avgDrift.toFixed(4)
        statLag.textContent = avgLag.toFixed(4)
        statTicks.textContent = tickCount.toString()

        // Apply drift compensation if accurate mode is enabled
        if (accurateMode) {
            const timer = getTimer()
            if (timer && tickCount > 5) {
                // Only send drift adjustment after the system has stabilized (after tick 5)
                // The worker will apply damping (10% of drift) to gradually correct
                timer.postMessage({
                    command: CMD_ADJUST_DRIFT,
                    drift: drift
                })
            }
        }

        console.log("Tick", { intervals, drift, lag, tickCount, accurateMode })
    }, interval, { type: workerUri })
})


stopBtn.addEventListener('click', () => {
    if (!isRunning) return
    
    stopTimer()
    isRunning = false
    
    // Send MIDI stop
    if (midiTransportStarted) {
        sendMidiTransportStop()
    }
    
    startBtn.disabled = false
    stopBtn.disabled = true
    workerTypeSelector.disabled = false
    intervalInput.disabled = false
    accurateModeCheckbox.disabled = false

    const averageLag = lags.length > 0 ? lags.reduce((a, b) => a + b, 0) / lags.length : 0
    const averageDrift = drifts.length > 0 ? drifts.reduce((a, b) => a + b, 0) / drifts.length : 0

    console.log("Stopped with", currentWorkerType, { averageLag, averageDrift, totalTicks: tickCount, accurateMode })
})

resetBtn.addEventListener('click', () => {
    stopTimer()
    isRunning = false
    
    // Send MIDI stop
    if (midiTransportStarted) {
        sendMidiTransportStop()
    }
    
    reset()
    
    startBtn.disabled = false
    stopBtn.disabled = true
    workerTypeSelector.disabled = false
    intervalInput.disabled = false
    accurateModeCheckbox.disabled = false
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

bpmSlider.addEventListener('input', (event) => {
    const newBpm = parseInt((event.target as HTMLInputElement).value)
    bpm = newBpm
    bpmValue.textContent = newBpm.toString()
    
    // Convert BPM to interval in milliseconds
    // interval (ms) = 60,000 / BPM
    const newInterval = 60000 / newBpm
    intervalInput.value = newInterval.toString()
    interval = newInterval
    
    // Update the timer if it's running
    if (isRunning) {
        setTimeBetween(newInterval)
    }
})

// Theme Toggle
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
    
    // Notify chart of theme change
    window.dispatchEvent(new Event('colorscheme-change'))
})

initTheme()

// ===== MULTI-TIMER FUNCTIONS =====

// UI Elements
const timersList = document.getElementById('timers-list')!
const timerDetailsPanel = document.getElementById('timer-details-panel')!
const timerDetailsContent = timerDetailsPanel.querySelector('.timer-details-content')!
let selectedTimerId: string | null = null

const initMultiChart = () => {
    if (!multiChart) {
        multiChart = new MultiTimerChart('multi-timer-chart')
    }
}

const renderTimersList = () => {
    const timers = multiTimerManager.getAllTimers()
    
    if (timers.length === 0) {
        timersList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No timers yet. Click "Add Timer" to start.</p>'
        return
    }

    timersList.innerHTML = timers.map(timer => {
        const running = runningTimers.get(timer.id)?.isRunning || false
        const stats = runningTimers.get(timer.id)?.stats
        const isSelected = selectedTimerId === timer.id

        return `
            <div class="timer-item ${isSelected ? 'active' : ''}" data-timer-id="${timer.id}">
                <div class="timer-color-indicator" style="background: ${timer.color}"></div>
                <div class="timer-item-info">
                    <span class="timer-name">${timer.name}</span>
                    <span class="timer-status">${timer.bpm} BPM ${running ? '▶' : '⏸'}</span>
                </div>
                <div class="timer-item-controls">
                    <button class="timer-toggle" data-timer-id="${timer.id}" ${stats?.ticks && running ? 'disabled' : ''}>${running ? 'Stop' : 'Start'}</button>
                    <button class="timer-remove" data-timer-id="${timer.id}">Remove</button>
                </div>
            </div>
        `
    }).join('')

    // Add event listeners
    timersList.querySelectorAll('.timer-item').forEach(item => {
        item.addEventListener('click', () => {
            const timerId = (item as any).dataset.timerId
            selectTimer(timerId)
        })
    })

    timersList.querySelectorAll('.timer-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation()
            const timerId = (btn as any).dataset.timerId
            const running = runningTimers.get(timerId)?.isRunning
            if (running) stopMultiTimer(timerId)
            else startMultiTimer(timerId)
        })
    })

    timersList.querySelectorAll('.timer-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation()
            const timerId = (btn as any).dataset.timerId
            removeMultiTimer(timerId)
        })
    })
}

const selectTimer = (timerId: string) => {
    selectedTimerId = selectedTimerId === timerId ? null : timerId
    if (selectedTimerId) {
        showTimerDetails(selectedTimerId)
    } else {
        timerDetailsPanel.style.display = 'none'
    }
    renderTimersList()
}

const showTimerDetails = (timerId: string) => {
    const config = multiTimerManager.getTimer(timerId)
    if (!config) return

    const running = runningTimers.get(timerId)?.isRunning || false
    const stats = runningTimers.get(timerId)?.stats

    const startTimeDisplay = config.startTime ? new Date(config.startTime).toLocaleString() : '—'
    const epochDisplay = config.epoch || '—'

    timerDetailsContent.innerHTML = `
        <div class="timer-detail-section">
            <h3>Configuration</h3>
            <div class="timer-detail-group">
                <label>Name</label>
                <input type="text" class="timer-name-input" value="${config.name}" ${running ? 'disabled' : ''} />
            </div>
            <div class="timer-detail-group">
                <label>Tempo (BPM)</label>
                <input type="number" class="timer-bpm-input" value="${config.bpm}" min="20" max="300" ${running ? 'disabled' : ''} />
            </div>
            <div class="timer-detail-group">
                <label>Worker Type</label>
                <select class="timer-worker-type-select" ${running ? 'disabled' : ''}>
                    <option value="audiocontext" ${config.workerType === 'audiocontext' ? 'selected' : ''}>AudioContext</option>
                    <option value="audioworklet" ${config.workerType === 'audioworklet' ? 'selected' : ''}>AudioWorklet</option>
                    <option value="rolling" ${config.workerType === 'rolling' ? 'selected' : ''}>Rolling</option>
                    <option value="setinterval" ${config.workerType === 'setinterval' ? 'selected' : ''}>SetInterval</option>
                    <option value="settimeout" ${config.workerType === 'settimeout' ? 'selected' : ''}>SetTimeout</option>
                </select>
            </div>
        </div>

        <div class="timer-detail-section">
            <h3>Timing</h3>
            <div class="timer-detail-group">
                <label>Start Time</label>
                <div class="timer-detail-value">${startTimeDisplay}</div>
            </div>
            <div class="timer-detail-group">
                <label>Epoch (ISO 8601)</label>
                <div class="timer-detail-value" style="font-size: 0.85rem; word-break: break-all;">${epochDisplay}</div>
            </div>
        </div>

        <div class="timer-detail-section">
            <h3>Performance</h3>
            <div class="timer-stats-grid">
                <div class="timer-stat-card">
                    <div class="timer-stat-label">Avg Lag</div>
                    <div class="timer-stat-value">${stats?.lags.length ? (stats.lags.reduce((a, b) => a + b) / stats.lags.length).toFixed(2) : '0.00'}ms</div>
                </div>
                <div class="timer-stat-card">
                    <div class="timer-stat-label">Avg Drift</div>
                    <div class="timer-stat-value">${stats?.drifts.length ? (stats.drifts.reduce((a, b) => a + b) / stats.drifts.length).toFixed(2) : '0.00'}ms</div>
                </div>
                <div class="timer-stat-card">
                    <div class="timer-stat-label">Ticks</div>
                    <div class="timer-stat-value">${stats?.ticks || 0}</div>
                </div>
                <div class="timer-stat-card">
                    <div class="timer-stat-label">Status</div>
                    <div class="timer-stat-value">${running ? '▶ Running' : '⏸ Stopped'}</div>
                </div>
            </div>
            <div class="timer-detail-actions">
                <button class="timer-detail-start" ${running ? 'disabled' : ''}>Start</button>
                <button class="timer-detail-stop" ${!running ? 'disabled' : ''}>Stop</button>
                <button class="timer-detail-clear" ${!stats?.ticks ? 'disabled' : ''}>Clear Data</button>
            </div>
        </div>
    `

    timerDetailsPanel.style.display = 'block'

    // Add event listeners
    const nameInput = timerDetailsContent.querySelector('.timer-name-input') as HTMLInputElement
    const bpmInput = timerDetailsContent.querySelector('.timer-bpm-input') as HTMLInputElement
    const workerTypeSelect = timerDetailsContent.querySelector('.timer-worker-type-select') as HTMLSelectElement
    const startBtn = timerDetailsContent.querySelector('.timer-detail-start') as HTMLButtonElement
    const stopBtn = timerDetailsContent.querySelector('.timer-detail-stop') as HTMLButtonElement
    const clearBtn = timerDetailsContent.querySelector('.timer-detail-clear') as HTMLButtonElement

    nameInput.addEventListener('change', (e) => {
        const name = (e.target as HTMLInputElement).value
        multiTimerManager.updateTimerConfig(timerId, { name })
        renderTimersList()
    })

    bpmInput.addEventListener('change', (e) => {
        const bpm = parseInt((e.target as HTMLInputElement).value)
        multiTimerManager.updateTimerConfig(timerId, { bpm })
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

    startBtn.addEventListener('click', () => startMultiTimer(timerId))
    stopBtn.addEventListener('click', () => stopMultiTimer(timerId))
    clearBtn.addEventListener('click', () => clearMultiTimer(timerId))
}

const startMultiTimer = async (timerId: string) => {
    const config = multiTimerManager.getTimer(timerId)
    if (!config) return

    if (runningTimers.has(timerId)) {
        const running = runningTimers.get(timerId)!
        if (running.isRunning) return
    }

    try {
        initMultiChart()
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

        const callback = ({ timePassed, elapsed, expected, drift, lag }: TimerEvent) => {
            stats.ticks++
            stats.lags.push(lag)
            stats.drifts.push(drift)

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

            multiChart.addData({
                id: timerId,
                lag,
                timePassed,
                interval,
                timestamp: Date.now(),
                color: config.color
            })
        }

        const startTime = Date.now()
        const startDate = new Date(startTime)
        const epoch = startDate.toISOString()

        await timer.startTimer(callback, {
            type: workerUri
        })

        // Update config with start time and epoch
        multiTimerManager.updateTimerConfig(timerId, { 
            startTime, 
            epoch 
        })

        runningTimers.set(timerId, {
            id: timerId,
            timer,
            stats,
            isRunning: true
        })

        isAnyMultiTimerRunning = true
        renderTimersList()
    } catch (error) {
        console.error(`Error starting timer ${timerId}:`, error)
    }
}

const stopMultiTimer = async (timerId: string) => {
    const running = runningTimers.get(timerId)
    if (!running) return

    try {
        await running.timer.stopTimer?.()
        running.isRunning = false
        isAnyMultiTimerRunning = Array.from(runningTimers.values()).some(t => t.isRunning)
        renderTimersList()
        if (selectedTimerId === timerId) showTimerDetails(timerId)
    } catch (error) {
        console.error(`Error stopping timer ${timerId}:`, error)
    }
}

const clearMultiTimer = (timerId: string) => {
    const running = runningTimers.get(timerId)
    if (running) {
        running.stats = {
            ticks: 0,
            lags: [],
            drifts: []
        }
    }
    multiTimerManager.clearTimer(timerId)
    multiChart.clearTimer(timerId)
    renderTimersList()
    if (selectedTimerId === timerId) showTimerDetails(timerId)
}

const removeMultiTimer = async (timerId: string) => {
    const running = runningTimers.get(timerId)
    if (running && running.isRunning) {
        await stopMultiTimer(timerId)
    }

    runningTimers.delete(timerId)
    multiTimerManager.removeTimer(timerId)
    multiChart.clearTimer(timerId)
    if (selectedTimerId === timerId) {
        selectedTimerId = null
        timerDetailsPanel.style.display = 'none'
    }
    renderTimersList()
}

addTimerBtn.addEventListener('click', () => {
    const timerId = multiTimerManager.addTimer({
        bpm: 120,
        name: `Timer ${multiTimerManager.getAllTimers().length + 1}`
    })
    renderTimersList()
})

renderTimersList()

// CPU Stress Test
const cpuStressLoop = () => {
    if (!cpuStressEnabled) {
        cpuStressAnimationId = null
        return
    }

    // Do computationally intensive work
    // Calculate fibonacci numbers
    const fib = (n: number): number => {
        if (n <= 1) return n
        return fib(n - 1) + fib(n - 2)
    }

    // Do this multiple times to stress the CPU
    for (let i = 0; i < 100; i++) {
        fib(15)
    }

    // Also do some matrix operations
    const matrix = Array(100).fill(0).map(() => Array(100).fill(Math.random()))
    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
            matrix[i][j] = Math.sqrt(Math.pow(matrix[i][j], 2) + Math.pow(matrix[i][j], 3))
        }
    }

    // Schedule next iteration
    cpuStressAnimationId = requestAnimationFrame(cpuStressLoop)
}

cpuStressCheckbox.addEventListener('change', (event) => {
    cpuStressEnabled = (event.target as HTMLInputElement).checked
    
    if (cpuStressEnabled) {
        cpuStressAnimationId = requestAnimationFrame(cpuStressLoop)
    } else if (cpuStressAnimationId !== null) {
        cancelAnimationFrame(cpuStressAnimationId)
        cpuStressAnimationId = null
    }
})

// MIDI Support
const sendMidiClock = () => {
    if (midiOutputs.length === 0) return
    
    const clockMessage = new Uint8Array([0xF8]) // Timing Clock
    for (const output of midiOutputs) {
        output.send(clockMessage)
    }
}

const sendMidiTransportStart = () => {
    if (midiOutputs.length === 0) return
    
    const startMessage = new Uint8Array([0xFA]) // Transport Start
    for (const output of midiOutputs) {
        output.send(startMessage)
    }
    midiTransportStarted = true
    midiClockCounter = 0
}

const sendMidiTransportStop = () => {
    if (midiOutputs.length === 0) return
    
    const stopMessage = new Uint8Array([0xFC]) // Transport Stop
    for (const output of midiOutputs) {
        output.send(stopMessage)
    }
    midiTransportStarted = false
}

midiConnectBtn.addEventListener('click', async () => {
    try {
        const midiAccess = await (navigator as any).requestMIDIAccess()
        const outputs = midiAccess.outputs.values()
        
        midiOutputs = []
        for (const output of outputs) {
            midiOutputs.push(output)
        }
        
        if (midiOutputs.length > 0) {
            midiConnectBtn.textContent = `Connected to ${midiOutputs.length} MIDI device${midiOutputs.length !== 1 ? 's' : ''}`
            midiConnectBtn.style.background = '#28a745'
            console.log(`Connected to ${midiOutputs.length} MIDI devices:`, midiOutputs.map(o => o.name).join(', '))
            
            // Start MIDI transport if timer is already running
            if (isRunning) {
                sendMidiTransportStart()
            }
        } else {
            console.log('No MIDI outputs found')
            midiConnectBtn.textContent = 'No MIDI Devices Found'
            midiConnectBtn.style.background = '#ffc107'
        }
    } catch (error) {
        console.error('MIDI access denied:', error)
        midiConnectBtn.textContent = 'MIDI Not Supported'
        midiConnectBtn.style.background = '#dc3545'
    }
})
