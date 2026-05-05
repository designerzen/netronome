// Netronome - Unified Timer Management
import Timer from '../src/timer.ts'
import AudioTimer from '../src/timer-audio.ts'
import { MultiTimerManager } from '../src/multi-timer.ts'
import { MultiTimerChart } from '../src/multi-timer-chart.ts'
import {
    TIMER_TYPE_AUDIO_CONTEXT,
    TIMER_TYPE_AUDIO_WORKLET,
    TIMER_TYPE_ELASTIC_AUDIO_WORKLET,
    TIMER_TYPE_OPTIONS,
    getTimerTypeDescription,
    type TimerType,
} from '../src/timer-types'

interface TimerEvent {
    timePassed: number
    elapsed: number
    expected: number
    drift: number
    level: number
    intervals: number
    lag: number
}

interface TickOrderState {
    order: number
    batchId: number
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
const newTimerSwingSlider = getElement<HTMLInputElement>('new-timer-swing')
const newTimerSwingValue = getElement<HTMLElement>('new-timer-swing-value')
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
        lastErrorMs: number
        lastJitterMs: number
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
let tickAudioEnabled = false
let currentTickBatchStartedAt = 0
let currentTickBatchOrder = 0
let currentTickBatchId = 0
const audioTimerTypes = new Set<TimerType>([
    TIMER_TYPE_AUDIO_CONTEXT,
    TIMER_TYPE_AUDIO_WORKLET,
    TIMER_TYPE_ELASTIC_AUDIO_WORKLET,
])
const recentTickOrders = new Map<string, TickOrderState>()
const tickOrderTimeouts = new Map<string, number>()
const TICK_BATCH_WINDOW_MS = 40
const TICK_ORDER_DISPLAY_MS = 420

const renderTimerTypeOptions = (selectedType: TimerType) => {
    return TIMER_TYPE_OPTIONS.map((timerType) => {
        const selected = timerType === selectedType ? 'selected' : ''
        return `<option value="${timerType}" ${selected}>${getTimerTypeDescription(timerType)}</option>`
    }).join('')
}

const populateTimerTypeSelect = (select: HTMLSelectElement | null, selectedType: TimerType = TIMER_TYPE_AUDIO_CONTEXT) => {
    if (!select) {
        return
    }

    select.innerHTML = renderTimerTypeOptions(selectedType)
    select.value = selectedType
}

const ensureAudioContext = async () => {
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContextClass) {
            throw new Error('Web Audio API not supported in this browser')
        }
        audioContext = new AudioContextClass()
    }

    if (audioContext.state === 'suspended') {
        await audioContext.resume()
    }

    return audioContext
}

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

// Play a short tick sound
const playTickSound = (frequency: number = 1200, duration: number = 30) => {
    if (!tickAudioEnabled) return
    try {
        if (!audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
            if (!AudioContextClass) return
            audioContext = new AudioContextClass()
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {})
        }

        const now = audioContext.currentTime
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = frequency
        oscillator.type = 'sine'

        gainNode.gain.setValueAtTime(0.15, now)
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration / 1000)

        oscillator.start(now)
        oscillator.stop(now + duration / 1000)
    } catch (error) {
        // Silently handle errors
    }
}

// ===== TIMER CREATION =====

const syncBpmControls = (value: number) => {
    newTimerBpmInput.value = value.toString()
    newTimerBpmSlider.value = value.toString()
}

const formatSwingLabel = (value: number) => `${Math.round(value * 100)}%`

const syncSwingControls = (value: number) => {
    if (newTimerSwingSlider) {
        newTimerSwingSlider.value = value.toString()
    }

    if (newTimerSwingValue) {
        newTimerSwingValue.textContent = formatSwingLabel(value)
    }
}

const formatTickOrder = (order: number) => {
    if (order % 10 === 1 && order % 100 !== 11) return `${order}st`
    if (order % 10 === 2 && order % 100 !== 12) return `${order}nd`
    if (order % 10 === 3 && order % 100 !== 13) return `${order}rd`
    return `${order}th`
}

const updateTickFeedback = (timerId: string, color: string, order?: number) => {
    const timerItem = timersList?.querySelector(`[data-timer-id="${timerId}"]`) as HTMLElement | null
    if (!timerItem) {
        return
    }

    const tickIndicator = timerItem.querySelector('.timer-tick-indicator') as HTMLElement | null
    const tickOrder = timerItem.querySelector('.timer-tick-order') as HTMLElement | null

    if (tickIndicator) {
        tickIndicator.style.color = color
    }

    timerItem.classList.remove('tick-active')
    void timerItem.offsetWidth
    timerItem.classList.add('tick-active')

    if (tickOrder && typeof order === 'number') {
        tickOrder.textContent = formatTickOrder(order)
        tickOrder.style.background = color
        tickOrder.style.borderColor = color
        timerItem.classList.add('tick-sequenced')
    }
}

const updateLiveTimerStatus = (timerId: string) => {
    const timerItem = timersList?.querySelector(`[data-timer-id="${timerId}"]`) as HTMLElement | null
    const timerConfig = multiTimerManager.getTimer(timerId)
    const running = runningTimers.get(timerId)

    if (!timerItem || !timerConfig) {
        return
    }

    const statusEl = timerItem.querySelector('.timer-status') as HTMLElement | null
    const toggleBtn = timerItem.querySelector('.timer-toggle') as HTMLButtonElement | null

    if (statusEl) {
        const tickSummary = running?.isRunning && running.stats
            ? ` · ${running.stats.ticks} ticks · err ${running.stats.lastErrorMs.toFixed(2)}ms`
            : ''
        statusEl.textContent = `${timerConfig.bpm} BPM ${running?.isRunning ? '▶ Running' : '⏸ Stopped'}${tickSummary}`
    }

    if (toggleBtn) {
        toggleBtn.textContent = running?.isRunning ? 'Stop' : 'Start'
    }
}

const clearTickFeedback = (timerId: string) => {
    const timerItem = timersList?.querySelector(`[data-timer-id="${timerId}"]`) as HTMLElement | null
    if (!timerItem) {
        return
    }

    const tickOrder = timerItem.querySelector('.timer-tick-order') as HTMLElement | null
    timerItem.classList.remove('tick-active', 'tick-sequenced')
    if (tickOrder) {
        tickOrder.textContent = ''
    }
}

const registerTickOrder = (timerId: string, color: string) => {
    const now = performance.now()

    if (now - currentTickBatchStartedAt > TICK_BATCH_WINDOW_MS) {
        currentTickBatchStartedAt = now
        currentTickBatchOrder = 0
        currentTickBatchId += 1
    }

    currentTickBatchOrder += 1
    recentTickOrders.set(timerId, {
        order: currentTickBatchOrder,
        batchId: currentTickBatchId
    })

    updateTickFeedback(timerId, color, currentTickBatchOrder)

    const existingTimeout = tickOrderTimeouts.get(timerId)
    if (existingTimeout) {
        window.clearTimeout(existingTimeout)
    }

    const timeoutId = window.setTimeout(() => {
        const state = recentTickOrders.get(timerId)
        if (state?.batchId === currentTickBatchId) {
            recentTickOrders.delete(timerId)
        }
        clearTickFeedback(timerId)
    }, TICK_ORDER_DISPLAY_MS)

    tickOrderTimeouts.set(timerId, timeoutId)
}

// ===== UI RENDERING =====

const renderTimersList = () => {
    const timers = multiTimerManager.getAllTimers()
    const template = document.getElementById('timer-item-template') as HTMLTemplateElement

    if (timers.length === 0) {
        timersList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No timers yet. Click "Create Timer" to start.</p>'
        return
    }

    timersList.innerHTML = ''
    
    timers.forEach(timer => {
        const running = runningTimers.get(timer.id)?.isRunning || false
        const stats = runningTimers.get(timer.id)?.stats
        const isSelected = selectedTimerId === timer.id

        // Clone template
        const fragment = template.content.cloneNode(true) as DocumentFragment
        const item = fragment.querySelector('.timer-item') as HTMLElement
        
        // Set data attributes
        item.dataset.timerId = timer.id
        if (isSelected) item.classList.add('active')

        // Update elements
        const tickIndicator = fragment.querySelector('.timer-tick-indicator') as HTMLElement
        tickIndicator.style.color = timer.color

        const tickOrder = fragment.querySelector('.timer-tick-order') as HTMLElement
        const tickState = recentTickOrders.get(timer.id)
        if (tickState) {
            tickOrder.textContent = formatTickOrder(tickState.order)
            tickOrder.style.background = timer.color
            tickOrder.style.borderColor = timer.color
            item.classList.add('tick-sequenced')
        }

        const colorIndicator = fragment.querySelector('.timer-color-indicator') as HTMLElement
        colorIndicator.style.background = timer.color

        const nameEl = fragment.querySelector('.timer-name') as HTMLElement
        nameEl.textContent = timer.name

        const statusEl = fragment.querySelector('.timer-status') as HTMLElement
        const tickSummary = running && stats
            ? ` · ${stats.ticks} ticks · err ${stats.lastErrorMs.toFixed(2)}ms`
            : ''
        statusEl.textContent = `${timer.bpm} BPM ${running ? '▶ Running' : '⏸ Stopped'}${tickSummary}`

        const typeBadge = fragment.querySelector('.timer-type-badge') as HTMLElement
        typeBadge.textContent = getTimerTypeDescription(timer.workerType)

        const toggleBtn = fragment.querySelector('.timer-toggle') as HTMLButtonElement
        toggleBtn.textContent = running ? 'Stop' : 'Start'
        toggleBtn.dataset.timerId = timer.id

        const removeBtn = fragment.querySelector('.timer-remove') as HTMLButtonElement
        removeBtn.dataset.timerId = timer.id

        // Add event listeners
        item.addEventListener('click', () => {
            selectTimer(timer.id)
        })

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            const running = runningTimers.get(timer.id)?.isRunning
            if (running) stopTimer(timer.id)
            else startTimer(timer.id)
        })

        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            removeTimer(timer.id)
        })

        timersList.appendChild(fragment)
    })
}

const selectTimer = (timerId: string) => {
    selectedTimerId = selectedTimerId === timerId ? null : timerId
    if (selectedTimerId) {
        showTimerDetails(selectedTimerId)
    } else {
        timerDetailsPanel.hidden = true
    }
    renderTimersList()
}

const updateTimerDetailsStats = (timerId: string, stats: { ticks: number; lags: number[]; drifts: number[] }) => {
    // Only update if details panel is visible
    if (timerDetailsPanel.hidden) return

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

    timerDetailsPanel.hidden = false
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
                <label for="timer-swing-input-${timerId}">Swing ${formatSwingLabel(config.swing)}</label>
                <input id="timer-swing-input-${timerId}" type="range" class="timer-swing-input" value="${config.swing}" min="0" max="1" step="0.01" />
            </div>
            <div class="timer-detail-group">
                <label>Worker Type</label>
                <select class="timer-worker-type-select" ${running ? 'disabled' : ''}>
                    ${renderTimerTypeOptions(config.workerType)}
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

    // Add event listeners
    const nameInput = timerDetailsContent.querySelector('.timer-name-input') as HTMLInputElement
    const bpmInput = timerDetailsContent.querySelector('.timer-bpm-input') as HTMLInputElement
    const swingInput = timerDetailsContent.querySelector('.timer-swing-input') as HTMLInputElement
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
            running.timer.timeBetween = interval
        }
    })

    swingInput.addEventListener('input', (e) => {
        const swing = parseFloat((e.target as HTMLInputElement).value)
        multiTimerManager.updateTimerConfig(timerId, { swing })

        const label = swingInput.previousElementSibling
        if (label) {
            label.textContent = `Swing ${formatSwingLabel(swing)}`
        }

        const running = runningTimers.get(timerId)
        if (running?.timer) {
            running.timer.swing = swing
        }
    })

    workerTypeSelect.addEventListener('change', (e) => {
        const workerType = (e.target as HTMLSelectElement).value as TimerType
        multiTimerManager.updateTimerConfig(timerId, { workerType })
        renderTimersList()
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
        const timer = audioTimerTypes.has(config.workerType)
            ? new AudioTimer(await ensureAudioContext(), config.workerType)
            : new Timer({ bpm: config.bpm, type: config.workerType })

        timer.BPM = config.bpm
        timer.swing = config.swing

        const stats = {
            ticks: 0,
            lags: [] as number[],
            drifts: [] as number[],
            lastErrorMs: 0,
            lastJitterMs: 0
        }

        const callback = ({ timePassed, elapsed, expected, drift, lag }: TimerEvent) => {
            const errorMs = Math.abs(timePassed - expected) * 1000
            stats.ticks++
            stats.lags.push(lag)
            stats.drifts.push(drift)
            stats.lastJitterMs = stats.ticks > 1 ? Math.abs(errorMs - stats.lastErrorMs) : 0
            stats.lastErrorMs = errorMs

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
                drift,
                expected,
                elapsed
            })

            multiChart.addData({
                id: timerId,
                lag,
                timePassed,
                expected,
                elapsed,
                drift,
                interval,
                timestamp: Date.now(),
                color: config.color
            })

            registerTickOrder(timerId, config.color)

            playTickSound()

            // Update UI if this timer is selected
            if (selectedTimerId === timerId) {
                updateTimerDetailsStats(timerId, stats)
            }

            updateLiveTimerStatus(timerId)
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
        console.error(`Error starting timer ${timerId}:`, error)
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
        console.error(`Error stopping timer ${timerId}:`, error)
    }
}

const clearTimer = (timerId: string) => {
    const running = runningTimers.get(timerId)
    if (running) {
        running.stats = {
            ticks: 0,
            lags: [],
            drifts: [],
            lastErrorMs: 0,
            lastJitterMs: 0
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
        timerDetailsPanel.hidden = true
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

if (newTimerSwingSlider) {
    newTimerSwingSlider.addEventListener('input', (e) => {
        syncSwingControls(parseFloat((e.target as HTMLInputElement).value))
    })
}

if (createTimerBtn) {
    createTimerBtn.addEventListener('click', () => {
    const name = newTimerNameInput.value.trim() || `Timer ${multiTimerManager.getAllTimers().length + 1}`
    const bpm = parseInt(newTimerBpmInput.value)
    const swing = newTimerSwingSlider ? parseFloat(newTimerSwingSlider.value) : 0
    const workerType = newTimerWorkerSelect.value as TimerType
    const metronomeEnabled = newTimerMetronomeCheckbox.checked

    const timerId = multiTimerManager.addTimer({
        bpm,
        swing,
        name,
        workerType,
        metronomeEnabled
    })

    // Store options for later use
    if (!runningTimers.has(timerId)) {
            runningTimers.set(timerId, {
            id: timerId,
            timer: null,
            stats: { ticks: 0, lags: [], drifts: [], lastErrorMs: 0, lastJitterMs: 0 },
            isRunning: false
        })
    }

    // Clear form
    newTimerNameInput.value = ''
    syncBpmControls(120)
    syncSwingControls(0)
    populateTimerTypeSelect(newTimerWorkerSelect, TIMER_TYPE_AUDIO_CONTEXT)
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

// ===== TICK AUDIO =====

const newTimerTickAudioCheckbox = getElement<HTMLInputElement>('new-timer-tick-audio')

if (newTimerTickAudioCheckbox) {
    newTimerTickAudioCheckbox.addEventListener('change', (event) => {
        tickAudioEnabled = (event.target as HTMLInputElement).checked
    })
}

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
    populateTimerTypeSelect(newTimerWorkerSelect, TIMER_TYPE_AUDIO_CONTEXT)
    renderTimersList()
    initTheme()
    syncSwingControls(0)
}

// Ensure DOM is ready before rendering
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp)
} else {
    initApp()
}

// Expose debug function globally
(window as any).testAudioBeep = testAudioBeep
