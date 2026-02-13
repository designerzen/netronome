// Netronome - Unified Timer Management
import AudioTimer from '../src/timer-audio.ts'
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

// ===== UI ELEMENTS =====

// Helper function to safely get DOM elements
const getElement = <T extends HTMLElement>(id: string): T | null => {
    const el = document.getElementById(id)
    if (!el) {
        return null
    }
    return el as T
}

// Timer Creation Form
const newTimerNameInput = getElement<HTMLInputElement>('new-timer-name')
const newTimerBpmInput = getElement<HTMLInputElement>('new-timer-bpm')
const newTimerBpmSlider = getElement<HTMLInputElement>('new-timer-bpm-slider')
const newTimerWorkerSelect = getElement<HTMLSelectElement>('new-timer-worker')
const newTimerAccurateCheckbox = getElement<HTMLInputElement>('new-timer-accurate')
const newTimerMetronomeCheckbox = getElement<HTMLInputElement>('new-timer-metronome')
const newTimerCpuStressCheckbox = getElement<HTMLInputElement>('new-timer-cpu-stress')
const newTimerMidiCheckbox = getElement<HTMLInputElement>('new-timer-midi')
const createTimerBtn = getElement<HTMLButtonElement>('create-timer')

// Active Timers Display
const timersList = getElement('timers-list')
const timerDetailsPanel = getElement('timer-details-panel')
const timerDetailsContent = timerDetailsPanel?.querySelector('.timer-details-content')

// Theme
const themeToggle = getElement<HTMLButtonElement>('theme-toggle')

// ===== STATE =====

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
let selectedTimerId: string | null = null
let cpuStressEnabled = false
let cpuStressAnimationId: number | null = null
let midiOutputs: MIDIOutput[] = []
let audioContext: AudioContext | null = null

// ===== INITIALIZATION =====

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

const initMultiChart = () => {
    if (!multiChart) {
        multiChart = new MultiTimerChart('multi-timer-chart')
    }
}

initTheme()

// ===== METRONOME SOUND =====

const playMetronomeBeep = (frequency: number = 880, duration: number = 100) => {
    try {
        // Initialize audio context if needed
        if (!audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
            if (!AudioContextClass) {
                return
            }
            audioContext = new AudioContextClass()
        }

        // Resume context if suspended (required on some browsers)
        // This happens asynchronously but we'll proceed anyway
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {
                // Silently fail if resume fails
            })
        }

        const now = audioContext.currentTime
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = frequency
        oscillator.type = 'sine'

        // Attack and release envelope
        gainNode.gain.setValueAtTime(0.3, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000)

        oscillator.start(now)
        oscillator.stop(now + duration / 1000)
    } catch (error) {
        // Silently handle errors
    }
}

// Function to manually test audio
const testAudioBeep = () => {
    playMetronomeBeep(880, 100)
}

// ===== TIMER CREATION =====

const syncBpmControls = (value: number) => {
    newTimerBpmInput.value = value.toString()
    newTimerBpmSlider.value = value.toString()
}

// ===== UI RENDERING =====

const renderTimersList = () => {
    const timers = multiTimerManager.getAllTimers()

    if (timers.length === 0) {
        timersList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No timers yet. Click "Create Timer" to start.</p>'
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
                    <button class="timer-toggle" data-timer-id="${timer.id}">${running ? 'Stop' : 'Start'}</button>
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
            if (running) stopTimer(timerId)
            else startTimer(timerId)
        })
    })

    timersList.querySelectorAll('.timer-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation()
            const timerId = (btn as any).dataset.timerId
            removeTimer(timerId)
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

const updateTimerDetailsStats = (timerId: string, stats: { ticks: number; lags: number[]; drifts: number[] }) => {
    // Only update if details panel is visible
    if (timerDetailsPanel.style.display === 'none') return

    const avgLag = stats.lags.length ? (stats.lags.reduce((a, b) => a + b) / stats.lags.length).toFixed(2) : '0.00'
    const avgDrift = stats.drifts.length ? (stats.drifts.reduce((a, b) => a + b) / stats.drifts.length).toFixed(2) : '0.00'

    // Update stat cards
    const statCards = timerDetailsContent.querySelectorAll('.timer-stat-value')
    if (statCards.length >= 4) {
        statCards[0].textContent = `${avgLag}ms`
        statCards[1].textContent = `${avgDrift}ms`
        statCards[2].textContent = `${stats.ticks}`
    }
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
            <div class="timer-detail-group">
                <label>
                    <input type="checkbox" class="timer-metronome-toggle" ${config.metronomeEnabled ? 'checked' : ''} />
                    Metronome Sound
                </label>
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
    const metronomeToggle = timerDetailsContent.querySelector('.timer-metronome-toggle') as HTMLInputElement
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

    metronomeToggle.addEventListener('change', (e) => {
        const metronomeEnabled = (e.target as HTMLInputElement).checked
        multiTimerManager.updateTimerConfig(timerId, { metronomeEnabled })
    })

    startBtn.addEventListener('click', () => startTimer(timerId))
    stopBtn.addEventListener('click', () => stopTimer(timerId))
    clearBtn.addEventListener('click', () => clearTimer(timerId))
}

// ===== TIMER CONTROL =====

const startTimer = async (timerId: string) => {
    const config = multiTimerManager.getTimer(timerId)
    if (!config) return

    if (runningTimers.has(timerId)) {
        const running = runningTimers.get(timerId)!
        if (running.isRunning) return
    }

    try {
        initMultiChart()
        const interval = 60000 / config.bpm

        // Always initialize AudioContext for AudioTimer
        if (!audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
            if (!AudioContextClass) {
                throw new Error('Web Audio API not supported in this browser')
            }
            audioContext = new AudioContextClass()
            console.log('AudioContext initialized:', {
                state: audioContext.state,
                sampleRate: audioContext.sampleRate,
                currentTime: audioContext.currentTime
            })
        }

        // Resume context if suspended (required on some browsers)
        if (audioContext.state === 'suspended') {
            console.log('AudioContext is suspended, attempting to resume...')
            await audioContext.resume()
        }

        // Determine if using worklet based on worker type
        const isWorklet = config.workerType === 'audioworklet'

        // Always use AudioTimer with AudioContext
        const timer = new AudioTimer(audioContext, isWorklet)

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

            // Play metronome sound if enabled
            if (config.metronomeEnabled) {
                playMetronomeBeep(880, 100)
            }

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

            // Update UI if this timer is selected
            if (selectedTimerId === timerId) {
                updateTimerDetailsStats(timerId, stats)
            }
        }

        const startTime = Date.now()
        const startDate = new Date(startTime)
        const epoch = startDate.toISOString()

        await timer.startTimer(callback)

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

        renderTimersList()
        if (selectedTimerId === timerId) showTimerDetails(timerId)
    } catch (error) {
        // Silently handle errors
    }
}

const stopTimer = async (timerId: string) => {
    const running = runningTimers.get(timerId)
    if (!running) return

    try {
        await running.timer.stopTimer?.()
        running.isRunning = false
        renderTimersList()
        if (selectedTimerId === timerId) showTimerDetails(timerId)
    } catch (error) {
        // Silently handle errors
    }
}

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
    multiChart.clearTimer(timerId)
    renderTimersList()
    if (selectedTimerId === timerId) showTimerDetails(timerId)
}

const removeTimer = async (timerId: string) => {
    const running = runningTimers.get(timerId)
    if (running && running.isRunning) {
        await stopTimer(timerId)
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

    if (newTimerBpmInput) {
    newTimerBpmInput.addEventListener('change', (e) => {
        syncBpmControls(parseInt((e.target as HTMLInputElement).value))
    })
}

if (newTimerBpmSlider) {
    newTimerBpmSlider.addEventListener('input', (e) => {
        syncBpmControls(parseInt((e.target as HTMLInputElement).value))
    })
}

if (createTimerBtn) {
    createTimerBtn.addEventListener('click', () => {
    const name = newTimerNameInput.value.trim() || `Timer ${multiTimerManager.getAllTimers().length + 1}`
    const bpm = parseInt(newTimerBpmInput.value)
    const workerType = newTimerWorkerSelect.value
    const metronomeEnabled = newTimerMetronomeCheckbox.checked

    const timerId = multiTimerManager.addTimer({
        bpm,
        name,
        workerType,
        metronomeEnabled
    })

    // Store options for later use
    if (!runningTimers.has(timerId)) {
        runningTimers.set(timerId, {
            id: timerId,
            timer: null,
            stats: { ticks: 0, lags: [], drifts: [] },
            isRunning: false
        })
    }

    // Clear form
    newTimerNameInput.value = ''
    syncBpmControls(120)
    newTimerWorkerSelect.value = 'audiocontext'
    newTimerMetronomeCheckbox.checked = false

    renderTimersList()
    })
}

// ===== THEME TOGGLE =====

if (themeToggle) {
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
    }

    // ===== CPU STRESS TEST =====

const cpuStressLoop = () => {
    if (!cpuStressEnabled) {
        cpuStressAnimationId = null
        return
    }

    // Do computationally intensive work
    const fib = (n: number): number => {
        if (n <= 1) return n
        return fib(n - 1) + fib(n - 2)
    }

    for (let i = 0; i < 100; i++) {
        fib(15)
    }

    const matrix = Array(100).fill(0).map(() => Array(100).fill(Math.random()))
    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
            matrix[i][j] = Math.sqrt(Math.pow(matrix[i][j], 2) + Math.pow(matrix[i][j], 3))
        }
    }

    cpuStressAnimationId = requestAnimationFrame(cpuStressLoop)
}

newTimerCpuStressCheckbox.addEventListener('change', (event) => {
    cpuStressEnabled = (event.target as HTMLInputElement).checked

    if (cpuStressEnabled) {
        cpuStressAnimationId = requestAnimationFrame(cpuStressLoop)
    } else if (cpuStressAnimationId !== null) {
        cancelAnimationFrame(cpuStressAnimationId)
        cpuStressAnimationId = null
    }
})

// ===== MIDI SUPPORT =====

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
}

const sendMidiTransportStop = () => {
    if (midiOutputs.length === 0) return

    const stopMessage = new Uint8Array([0xFC]) // Transport Stop
    for (const output of midiOutputs) {
        output.send(stopMessage)
    }
}

newTimerMidiCheckbox.addEventListener('change', async (event) => {
    if (!(event.target as HTMLInputElement).checked) return

    try {
        const midiAccess = await (navigator as any).requestMIDIAccess()
        const outputs = midiAccess.outputs.values()

        midiOutputs = []
        for (const output of outputs) {
            midiOutputs.push(output)
        }
    } catch (error) {
        newTimerMidiCheckbox.checked = false
    }
})

// ===== INITIAL RENDER =====

// Initialize the app when DOM is ready
const initApp = () => {
    // Verify required elements exist
    if (!timersList || !timerDetailsPanel) {
        return
    }

    // Render initial state
    renderTimersList()
    initTheme()
}

// Ensure DOM is ready before rendering
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp)
} else {
    initApp()
}

// Expose debug function globally
(window as any).testAudioBeep = testAudioBeep
