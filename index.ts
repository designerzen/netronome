// Netronome - Timing Experiments
import { startTimer, stopTimer, setTimeBetween, createTimer, getTimer } from './src/timer-global'
import {
    AUDIOCONTEXT_WORKER_URI,
    AUDIOCONTEXT_WORKLET_URI,
    AUDIOWORKLET_PROCESSOR_URI,
    ROLLING_WORKER_URI,
    SETINTERVAL_WORKER_URI,
    SETTIMEOUT_WORKER_URI
} from './src/timer-worker-types'
import { CMD_ADJUST_DRIFT } from './src/timer-event-types'
import { PerformanceChart } from './public/performance-chart.js'

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
    audioworklet: AUDIOCONTEXT_WORKLET_URI,
    audioworklet_processor: AUDIOWORKLET_PROCESSOR_URI,
    rolling: ROLLING_WORKER_URI,
    setinterval: SETINTERVAL_WORKER_URI,
    settimeout: SETTIMEOUT_WORKER_URI
}

// UI Elements
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

// Stats Elements
const statIntervals = document.getElementById('stat-intervals')!
const statDrift = document.getElementById('stat-drift')!
const statLag = document.getElementById('stat-lag')!
const statTicks = document.getElementById('stat-ticks')!

// State
let interval = 1000
let bpm = 120
let lags: number[] = []
let drifts: number[] = []
let tickCount = 0
let isRunning = false
let currentWorkerType = 'audiocontext'
let performanceChart: PerformanceChart
let accurateMode = false
let cpuStressEnabled = false
let cpuStressAnimationId: number | null = null
let midiOutputs: MIDIOutput[] = []
let midiTransportStarted = false
let midiClockCounter = 0

const reset = () => {
    lags = []
    drifts = []
    tickCount = 0
    statIntervals.textContent = '0'
    statDrift.textContent = '0'
    statLag.textContent = '0'
    statTicks.textContent = '0'
    feedbackTable.innerHTML = '<tr class="empty-state"><td colspan="6">Click Start to begin collecting timing data</td></tr>'
    if (performanceChart) {
        performanceChart.clear()
    }
}

startBtn.addEventListener('click', async () => {
    if (isRunning) return
    
    reset()
    isRunning = true
    accurateMode = accurateModeCheckbox.checked
    
    // Initialize chart if not already created
    if (!performanceChart) {
        performanceChart = new PerformanceChart('performance-chart', 100)
    }
    
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

        // Add data to chart (lag, timePassed, interval)
        performanceChart.addData(lag, timePassed, interval)

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
