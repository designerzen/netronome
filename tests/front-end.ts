// Netronome - Unified Timer Management
import Timer from '../src/timer.ts'
import AudioTimer from '../src/timer-audio.ts'
import { MultiTimerManager } from '../src/multi-timer.ts'
import { MultiTimerChart } from '../src/multi-timer-chart.ts'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import QRCode from 'qrcode'
import { prepareZXingModule, readBarcodes, type ReaderOptions, ZXING_WASM_VERSION } from 'zxing-wasm'
import { createWebRTCSyncController, type WebRTCSyncController, type WebRTCSyncRole, type WebRTCSyncSignal, type WebRTCSessionBundle } from '../src/webrtc-sync.ts'
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
const syncRoomIdInput = getElement<HTMLInputElement>('sync-room-id')
const syncMethodSelect = getElement<HTMLSelectElement>('sync-method')
const syncRoleSelect = getElement<HTMLSelectElement>('sync-role')
const syncServerUrlInput = getElement<HTMLInputElement>('sync-server-url')
const syncServerControls = getElement<HTMLElement>('sync-server-controls')
const syncTimerSelect = getElement<HTMLSelectElement>('sync-timer-id')
const syncConnectBtn = getElement<HTMLButtonElement>('sync-connect')
const syncDisconnectBtn = getElement<HTMLButtonElement>('sync-disconnect')
const syncStartBtn = getElement<HTMLButtonElement>('sync-start')
const syncPushTempoBtn = getElement<HTMLButtonElement>('sync-push-tempo')
const syncQrControls = getElement<HTMLElement>('sync-qr-controls')
const syncGenerateOfferBtn = getElement<HTMLButtonElement>('sync-generate-offer')
const syncApplyOfferBtn = getElement<HTMLButtonElement>('sync-apply-offer')
const syncGenerateAnswerBtn = getElement<HTMLButtonElement>('sync-generate-answer')
const syncApplyAnswerBtn = getElement<HTMLButtonElement>('sync-apply-answer')
const syncStartScanBtn = getElement<HTMLButtonElement>('sync-start-scan')
const syncStopScanBtn = getElement<HTMLButtonElement>('sync-stop-scan')
const syncCameraPreview = getElement<HTMLVideoElement>('sync-camera-preview')
const syncBundleInput = getElement<HTMLTextAreaElement>('sync-bundle-input')
const syncLocalBundle = getElement<HTMLTextAreaElement>('sync-local-bundle')
const syncShareUrlInput = getElement<HTMLInputElement>('sync-share-url')
const syncCopyUrlBtn = getElement<HTMLButtonElement>('sync-copy-url')
const syncQrCanvas = getElement<HTMLCanvasElement>('sync-qr-canvas')
const syncHealthScan = getElement<HTMLElement>('sync-health-scan')
const syncHealthPeer = getElement<HTMLElement>('sync-health-peer')
const syncHealthLock = getElement<HTMLElement>('sync-health-lock')
const syncStatusText = getElement<HTMLElement>('sync-status-text')
const syncStatusDetail = getElement<HTMLElement>('sync-status-detail')

// Active Timers Display
const timersList = getElement('timers-list')
const timerDetailsPanel = getElement('timer-details-panel')
const timerDetailsContent = timerDetailsPanel?.querySelector('.timer-details-content')

// Theme
const themeToggle = getElement<HTMLButtonElement>('theme-toggle')

// ===== STATE =====

interface RunningTimer {
    id: string
    timer: Timer | AudioTimer | null
    stats: {
        ticks: number
        lags: number[]
        drifts: number[]
        lastErrorMs: number
        lastJitterMs: number
    }
    isRunning: boolean
}

interface SignalingEnvelope {
    fromPeerId: string
    signal: WebRTCSyncSignal
}

interface SyncUiState {
    controller: WebRTCSyncController | null
    roomId: string | null
    peerId: string | null
    role: WebRTCSyncRole | null
    pollIntervalId: number | null
    connectedTimerId: string | null
    method: 'server' | 'qr'
    pendingBundle: WebRTCSessionBundle | null
    scanStream: MediaStream | null
    scanAnimationFrameId: number | null
    scanCanvas: HTMLCanvasElement | null
    scanContext: CanvasRenderingContext2D | null
    scanActive: boolean
    scanPhase: 'idle' | 'scanning' | 'bundle-detected' | 'connected' | 'locked'
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
const qrReaderOptions: ReaderOptions = {
    formats: ['QRCode'],
    tryHarder: true,
    maxNumberOfSymbols: 1
}

prepareZXingModule({
    overrides: {
        locateFile: (path: string, prefix: string) => {
            if (path.endsWith('.wasm')) {
                return `https://cdn.jsdelivr.net/npm/zxing-wasm@${ZXING_WASM_VERSION}/dist/full/${path}`
            }
            return prefix + path
        }
    }
})
const syncUiState: SyncUiState = {
    controller: null,
    roomId: null,
    peerId: null,
    role: null,
    pollIntervalId: null,
    connectedTimerId: null,
    method: 'server',
    pendingBundle: null,
    scanStream: null,
    scanAnimationFrameId: null,
    scanCanvas: null,
    scanContext: null,
    scanActive: false,
    scanPhase: 'idle'
}

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

const setSyncStatus = (headline: string, detail: string = '') => {
    if (syncStatusText) {
        syncStatusText.textContent = headline
    }
    if (syncStatusDetail) {
        syncStatusDetail.textContent = detail
    }
}

const setHealthPill = (
    element: HTMLElement | null,
    state: 'idle' | 'active' | 'success',
    label: string
) => {
    if (!element) {
        return
    }

    element.dataset.state = state
    element.textContent = label
}

const updateSyncHealth = () => {
    const { scanPhase } = syncUiState

    if (scanPhase === 'scanning') {
        setHealthPill(syncHealthScan, 'active', 'Scanning')
    } else if (scanPhase === 'bundle-detected') {
        setHealthPill(syncHealthScan, 'success', 'QR Captured')
    } else {
        setHealthPill(syncHealthScan, 'idle', 'Scan Idle')
    }

    if (scanPhase === 'connected' || scanPhase === 'locked') {
        setHealthPill(syncHealthPeer, 'success', 'Peer Linked')
    } else if (syncUiState.controller) {
        setHealthPill(syncHealthPeer, 'active', 'Peer Arming')
    } else {
        setHealthPill(syncHealthPeer, 'idle', 'Peer Offline')
    }

    if (scanPhase === 'locked') {
        setHealthPill(syncHealthLock, 'success', 'Clock Locked')
    } else if (scanPhase === 'connected') {
        setHealthPill(syncHealthLock, 'active', 'Clock Settling')
    } else {
        setHealthPill(syncHealthLock, 'idle', 'Clock Free')
    }
}

const setScanPhase = (phase: SyncUiState['scanPhase'], detail?: string) => {
    syncUiState.scanPhase = phase
    updateSyncHealth()

    switch (phase) {
        case 'idle':
            setSyncStatus('Disconnected', detail ?? 'Select a timer, choose a role, and connect with either the signaling server or QR bundle exchange.')
            break
        case 'scanning':
            setSyncStatus('Scanning QR code', detail ?? 'Point the camera at the master clock QR/share URL.')
            break
        case 'bundle-detected':
            setSyncStatus('Bundle detected', detail ?? 'Applying the scanned bundle and preparing the peer connection.')
            break
        case 'connected':
            setSyncStatus('Connected to master', detail ?? 'Peer connection is open. Waiting for clock lock.')
            break
        case 'locked':
            setSyncStatus('In time with master', detail ?? 'Clock offset samples are stable and follower timing is locked.')
            break
    }
}

const updateSyncTimerOptions = () => {
    if (!syncTimerSelect) {
        return
    }

    const timers = multiTimerManager.getAllTimers()
    const previousValue = syncTimerSelect.value
    syncTimerSelect.innerHTML = timers.map((timer) => (
        `<option value="${timer.id}">${timer.name} · ${timer.bpm} BPM</option>`
    )).join('')

    if (timers.length === 0) {
        syncTimerSelect.innerHTML = '<option value="">No timers available</option>'
        syncTimerSelect.disabled = true
        return
    }

    syncTimerSelect.disabled = false
    syncTimerSelect.value = timers.some((timer) => timer.id === previousValue)
        ? previousValue
        : timers[0].id
}

const getSelectedSyncTimerId = () => syncTimerSelect?.value || ''

const getSyncMethod = (): 'server' | 'qr' =>
    (syncMethodSelect?.value === 'qr' ? 'qr' : 'server')

const updateSyncMethodVisibility = () => {
    syncUiState.method = getSyncMethod()

    if (syncServerControls) {
        syncServerControls.hidden = syncUiState.method !== 'server'
    }

    if (syncQrControls) {
        syncQrControls.hidden = syncUiState.method !== 'qr'
    }

    if (syncUiState.method !== 'qr') {
        stopCameraScan()
    }
}

const encodeSessionBundle = (bundle: WebRTCSessionBundle): string =>
    compressToEncodedURIComponent(JSON.stringify(bundle))

const decodeSessionBundle = (value: string): WebRTCSessionBundle => {
    const decoded = decompressFromEncodedURIComponent(value.trim())
    if (!decoded) {
        throw new Error('Bundle payload could not be decompressed')
    }
    return JSON.parse(decoded) as WebRTCSessionBundle
}

const buildBundleShareUrl = (payload: string) => {
    const url = new URL(window.location.href)
    url.hash = `sync-bundle=${payload}`
    return url.toString()
}

const parseBundlePayload = (value: string): string => {
    const trimmed = value.trim()
    if (!trimmed) {
        throw new Error('QR payload was empty')
    }

    if (/^https?:\/\//i.test(trimmed)) {
        const url = new URL(trimmed)
        const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
        const params = new URLSearchParams(hash)
        const payload = params.get('sync-bundle')
        if (!payload) {
            throw new Error('Shared URL did not contain a sync-bundle hash')
        }
        return payload
    }

    return trimmed
}

const clearQrCanvas = () => {
    if (!syncQrCanvas) {
        return
    }
    const context = syncQrCanvas.getContext('2d')
    context?.clearRect(0, 0, syncQrCanvas.width, syncQrCanvas.height)
}

const renderQrPayload = async (payload: string) => {
    if (!syncLocalBundle) {
        return
    }

    syncLocalBundle.value = payload
    const shareUrl = buildBundleShareUrl(payload)
    if (syncShareUrlInput) {
        syncShareUrlInput.value = shareUrl
    }

    if (!syncQrCanvas) {
        return
    }

    await QRCode.toCanvas(syncQrCanvas, shareUrl, {
        width: 256,
        margin: 1,
        errorCorrectionLevel: 'L'
    })
}

const ensureScanSurface = () => {
    if (!syncUiState.scanCanvas) {
        syncUiState.scanCanvas = document.createElement('canvas')
        syncUiState.scanCanvas.width = 640
        syncUiState.scanCanvas.height = 480
        syncUiState.scanContext = syncUiState.scanCanvas.getContext('2d', { willReadFrequently: true })
    }
    return {
        canvas: syncUiState.scanCanvas,
        context: syncUiState.scanContext
    }
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
    updateSyncTimerOptions()

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

const createRuntimeTimer = async (timerId: string): Promise<Timer | AudioTimer> => {
    const config = multiTimerManager.getTimer(timerId)
    if (!config) {
        throw new Error(`Timer config ${timerId} was not found`)
    }

    const timer = audioTimerTypes.has(config.workerType)
        ? new AudioTimer(await ensureAudioContext(), config.workerType)
        : new Timer({ bpm: config.bpm, type: config.workerType })

    timer.BPM = config.bpm
    timer.swing = config.swing

    return timer
}

const ensureRuntimeTimer = async (timerId: string): Promise<Timer | AudioTimer> => {
    const running = runningTimers.get(timerId)
    if (running?.timer) {
        return running.timer
    }

    const timer = await createRuntimeTimer(timerId)
    const existing = runningTimers.get(timerId)
    if (existing) {
        existing.timer = timer
        return timer
    }

    runningTimers.set(timerId, {
        id: timerId,
        timer,
        stats: { ticks: 0, lags: [], drifts: [], lastErrorMs: 0, lastJitterMs: 0 },
        isRunning: false
    })

    return timer
}

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
        const timer = await ensureRuntimeTimer(timerId)

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

// ===== WEBRTC SYNC =====

const createPeerId = () => `peer-${Math.random().toString(36).slice(2, 10)}`

const getSyncServerUrl = () => (syncServerUrlInput?.value || 'http://localhost:8787').replace(/\/$/, '')

const postJson = async <T>(url: string, payload: unknown): Promise<T> => {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })

    if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`)
    }

    return response.json() as Promise<T>
}

const joinSyncRoom = async (serverUrl: string, roomId: string, peerId: string, role: WebRTCSyncRole) => {
    return postJson<{ peers: string[] }>(`${serverUrl}/join`, { roomId, peerId, role })
}

const leaveSyncRoom = async (serverUrl: string, roomId: string, peerId: string) => {
    return postJson<{ ok: true }>(`${serverUrl}/leave`, { roomId, peerId })
}

const sendSyncSignal = async (serverUrl: string, roomId: string, peerId: string, signal: WebRTCSyncSignal) => {
    return postJson<{ ok: true }>(`${serverUrl}/signal`, { roomId, peerId, signal })
}

const pollSyncSignals = async (serverUrl: string, roomId: string, peerId: string) => {
    const response = await fetch(`${serverUrl}/poll?roomId=${encodeURIComponent(roomId)}&peerId=${encodeURIComponent(peerId)}`)
    if (!response.ok) {
        throw new Error(`Polling failed with ${response.status}`)
    }

    return response.json() as Promise<{ signals: SignalingEnvelope[] }>
}

const buildSyncController = async (timerId: string, role: WebRTCSyncRole) => {
    const timer = await ensureRuntimeTimer(timerId)
    const running = runningTimers.get(timerId)

    if (role === 'follower' && running?.isRunning) {
        await stopTimer(timerId)
    }

    const controller = createWebRTCSyncController(timer, { role })
    controller.onStateChange = (state) => {
        if (state.connected && state.locked) {
            setScanPhase('locked', `offset ${state.offsetMs.toFixed(2)}ms · rtt ${state.rttMs.toFixed(2)}ms · jitter ${state.jitterMs.toFixed(2)}ms`)
            return
        }

        if (state.connected) {
            setScanPhase('connected', `samples ${state.sampleCount} · offset ${state.offsetMs.toFixed(2)}ms · rtt ${state.rttMs.toFixed(2)}ms · jitter ${state.jitterMs.toFixed(2)}ms`)
            return
        }

        setSyncStatus(
            `${state.connected ? 'Connected' : 'Connecting'} · ${state.role}`,
            `samples ${state.sampleCount} · offset ${state.offsetMs.toFixed(2)}ms · rtt ${state.rttMs.toFixed(2)}ms · jitter ${state.jitterMs.toFixed(2)}ms`
        )
    }

    syncUiState.controller = controller
    syncUiState.role = role
    syncUiState.connectedTimerId = timerId

    return controller
}

const stopCameraScan = () => {
    if (syncUiState.scanAnimationFrameId !== null) {
        cancelAnimationFrame(syncUiState.scanAnimationFrameId)
        syncUiState.scanAnimationFrameId = null
    }

    if (syncUiState.scanStream) {
        for (const track of syncUiState.scanStream.getTracks()) {
            track.stop()
        }
        syncUiState.scanStream = null
    }

    if (syncCameraPreview) {
        syncCameraPreview.srcObject = null
    }

    syncUiState.scanActive = false

    if (syncUiState.scanPhase === 'scanning') {
        setScanPhase('idle')
    }
}

const applyScannedBundlePayload = async (payloadText: string) => {
    const payload = parseBundlePayload(payloadText)
    const bundle = decodeSessionBundle(payload)
    syncUiState.pendingBundle = bundle

    if (syncBundleInput) {
        syncBundleInput.value = payload
    }

    setScanPhase('bundle-detected')

    if (!syncUiState.controller || !syncUiState.role) {
        setSyncStatus('Bundle detected', 'Connect in QR mode first, then apply the scanned bundle.')
        return
    }

    if (syncUiState.role === 'follower') {
        await syncUiState.controller.applyOfferBundle(bundle)
        stopCameraScan()
        setSyncStatus('Offer applied from scan', 'Connection is negotiating. Generate the answer QR or wait for connection status.')
        return
    }

    await syncUiState.controller.applyAnswerBundle(bundle)
    stopCameraScan()
    setSyncStatus('Answer applied from scan', 'Peer connection is negotiating with the follower.')
}

const scanVideoFrame = async (): Promise<void> => {
    if (!syncUiState.scanActive || !syncCameraPreview || !syncUiState.scanContext || !syncUiState.scanCanvas) {
        return
    }

    try {
        const width = syncCameraPreview.videoWidth
        const height = syncCameraPreview.videoHeight

        if (width > 0 && height > 0) {
            if (syncUiState.scanCanvas.width !== width || syncUiState.scanCanvas.height !== height) {
                syncUiState.scanCanvas.width = width
                syncUiState.scanCanvas.height = height
            }

            syncUiState.scanContext.drawImage(syncCameraPreview, 0, 0, width, height)
            const imageData = syncUiState.scanContext.getImageData(0, 0, width, height)
            const results = await readBarcodes(imageData, qrReaderOptions)
            const firstResult = results.find((result) => typeof result.text === 'string' && result.text.length > 0)

            if (firstResult?.text) {
                await applyScannedBundlePayload(firstResult.text)
                return
            }
        }
    } catch (error) {
        setSyncStatus('Scan error', error instanceof Error ? error.message : 'Unknown QR scanning error')
        stopCameraScan()
        return
    }

    syncUiState.scanAnimationFrameId = requestAnimationFrame(() => {
        void scanVideoFrame()
    })
}

const startCameraScan = async () => {
    if (getSyncMethod() !== 'qr') {
        setSyncStatus('Wrong mode', 'Switch the pairing method to QR / Bundle first.')
        return
    }

    if (!syncUiState.controller || !syncUiState.role) {
        setSyncStatus('Not ready to scan', 'Connect in QR mode first so the scanned bundle can be applied immediately.')
        return
    }

    if (!syncCameraPreview) {
        setSyncStatus('Camera preview unavailable', 'The camera preview element was not found in the page.')
        return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        setSyncStatus('Camera not available', 'This browser does not support camera capture for QR scanning.')
        return
    }

    stopCameraScan()
    ensureScanSurface()

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment'
            },
            audio: false
        })

        syncUiState.scanStream = stream
        syncCameraPreview.srcObject = stream
        await syncCameraPreview.play()

        syncUiState.scanActive = true
        setScanPhase('scanning')
        syncUiState.scanAnimationFrameId = requestAnimationFrame(() => {
            void scanVideoFrame()
        })
    } catch (error) {
        setSyncStatus('Camera access failed', error instanceof Error ? error.message : 'Unable to access the device camera.')
        stopCameraScan()
    }
}

const populateBundleFromHash = (): boolean => {
    const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
    const params = new URLSearchParams(hash)
    const payload = params.get('sync-bundle')

    if (!payload) {
        return false
    }

    if (syncMethodSelect) {
        syncMethodSelect.value = 'qr'
    }
    updateSyncMethodVisibility()

    if (syncBundleInput) {
        syncBundleInput.value = payload
    }

    try {
        syncUiState.pendingBundle = decodeSessionBundle(payload)
        setSyncStatus('Bundle loaded from URL', 'Choose the matching role, connect in QR mode, then apply the loaded bundle.')
        return true
    } catch (error) {
        syncUiState.pendingBundle = null
        setSyncStatus('Invalid share URL', error instanceof Error ? error.message : 'Bundle could not be parsed')
        return false
    }
}

const disconnectSyncController = async (statusMessage: string = 'Disconnected') => {
    const { controller, roomId, peerId, pollIntervalId } = syncUiState

    stopCameraScan()

    if (pollIntervalId !== null) {
        window.clearInterval(pollIntervalId)
        syncUiState.pollIntervalId = null
    }

    if (controller) {
        await controller.destroy()
    }

    if (syncUiState.method === 'server' && roomId && peerId) {
        try {
            await leaveSyncRoom(getSyncServerUrl(), roomId, peerId)
        } catch (error) {
            console.warn('Failed to leave sync room', error)
        }
    }

    syncUiState.controller = null
    syncUiState.roomId = null
    syncUiState.peerId = null
    syncUiState.role = null
    syncUiState.connectedTimerId = null
    syncUiState.pendingBundle = null
    if (syncBundleInput && !window.location.hash) {
        syncBundleInput.value = ''
    }
    if (syncLocalBundle) {
        syncLocalBundle.value = ''
    }
    if (syncShareUrlInput) {
        syncShareUrlInput.value = ''
    }
    clearQrCanvas()
    syncUiState.scanPhase = 'idle'
    updateSyncHealth()
    setSyncStatus(statusMessage, 'Select a timer, choose a role, and connect with either the signaling server or QR bundle exchange.')
}

const startSignalPolling = () => {
    const roomId = syncUiState.roomId
    const peerId = syncUiState.peerId
    if (!roomId || !peerId) {
        return
    }

    const poll = async () => {
        if (!syncUiState.controller || !syncUiState.roomId || !syncUiState.peerId) {
            return
        }

        try {
            const payload = await pollSyncSignals(getSyncServerUrl(), syncUiState.roomId, syncUiState.peerId)
            for (const entry of payload.signals) {
                await syncUiState.controller.handleSignal(entry.signal)
            }
        } catch (error) {
            setSyncStatus('Signal polling failed', error instanceof Error ? error.message : 'Unknown polling error')
        }
    }

    poll().catch(() => {})
    syncUiState.pollIntervalId = window.setInterval(() => {
        void poll()
    }, 800)
}

const connectSyncController = async () => {
    const timerId = getSelectedSyncTimerId()
    if (!timerId) {
        setSyncStatus('No timer selected', 'Create a timer first, then choose it in the sync panel.')
        return
    }

    const role = (syncRoleSelect?.value || 'leader') as WebRTCSyncRole
    const method = getSyncMethod()
    const roomId = syncRoomIdInput?.value.trim() || 'studio-a'
    const serverUrl = getSyncServerUrl()
    const peerId = createPeerId()

    await disconnectSyncController('Reconnecting')
    syncUiState.method = method

    const controller = await buildSyncController(timerId, role)

    if (method === 'server') {
        controller.onSignal = (signal) => {
            void sendSyncSignal(serverUrl, roomId, peerId, signal)
        }

        await joinSyncRoom(serverUrl, roomId, peerId, role)

        syncUiState.roomId = roomId
        syncUiState.peerId = peerId
        startSignalPolling()

        if (role === 'leader') {
            await controller.start()
        }

        setSyncStatus('Connecting', `Room ${roomId} · ${role} · waiting for peer/data channel`)
        return
    }

    if (syncBundleInput?.value.trim()) {
        try {
            syncUiState.pendingBundle = decodeSessionBundle(syncBundleInput.value)
        } catch (error) {
            syncUiState.pendingBundle = null
            setSyncStatus('Invalid bundle', error instanceof Error ? error.message : 'Bundle could not be parsed')
        }
    }

    setSyncStatus(
        'QR pairing ready',
        role === 'leader'
            ? 'Generate an offer bundle, show its QR, then apply the follower answer bundle.'
            : 'Apply the leader offer bundle first, then generate your answer QR.'
    )
    updateSyncHealth()
}

const startSynchronizedTimer = async () => {
    if (!syncUiState.controller) {
        setSyncStatus('Not connected', 'Connect to the signaling server before starting synchronized playback.')
        return
    }

    if (syncUiState.role !== 'leader') {
        setSyncStatus('Follower ready', 'The follower starts automatically when the leader triggers sync.')
        return
    }

    await syncUiState.controller.startSynchronized()
    const timerId = syncUiState.connectedTimerId
    if (timerId) {
        const running = runningTimers.get(timerId)
        if (running) {
            running.isRunning = true
        }
        renderTimersList()
    }
}

const pushTempoUpdate = () => {
    if (!syncUiState.controller) {
        return
    }

    syncUiState.controller.broadcastTempoUpdate()
    setSyncStatus('Tempo pushed', 'Leader transport settings were broadcast to followers.')
}

const generateOfferQr = async () => {
    if (getSyncMethod() !== 'qr') {
        setSyncStatus('Wrong mode', 'Switch the pairing method to QR / Bundle first.')
        return
    }

    if (syncUiState.role !== 'leader' || !syncUiState.controller) {
        setSyncStatus('Leader required', 'Connect as leader in QR mode before generating an offer bundle.')
        return
    }

    const payload = encodeSessionBundle(await syncUiState.controller.createOfferBundle())
    await renderQrPayload(payload)
    setSyncStatus('Offer ready', 'Show this QR to the follower or copy the local bundle text.')
}

const applyOfferBundle = async () => {
    if (getSyncMethod() !== 'qr') {
        setSyncStatus('Wrong mode', 'Switch the pairing method to QR / Bundle first.')
        return
    }

    if (syncUiState.role !== 'follower' || !syncUiState.controller || !syncBundleInput?.value.trim()) {
        setSyncStatus('Follower bundle required', 'Connect as follower and paste the leader offer bundle first.')
        return
    }

    const bundle = syncUiState.pendingBundle ?? decodeSessionBundle(syncBundleInput.value)
    await syncUiState.controller.applyOfferBundle(bundle)
    const answerPayload = encodeSessionBundle(await syncUiState.controller.createAnswerBundle())
    await renderQrPayload(answerPayload)
    setSyncStatus('Offer applied', 'Answer QR is ready. Show it to the leader so the peer connection can finish.')
}

const generateAnswerQr = async () => {
    if (getSyncMethod() !== 'qr') {
        setSyncStatus('Wrong mode', 'Switch the pairing method to QR / Bundle first.')
        return
    }

    if (syncUiState.role !== 'follower' || !syncUiState.controller) {
        setSyncStatus('Follower required', 'Connect as follower in QR mode before generating an answer bundle.')
        return
    }

    const payload = encodeSessionBundle(await syncUiState.controller.createAnswerBundle())
    await renderQrPayload(payload)
    setSyncStatus('Answer ready', 'Show this QR to the leader or copy the local bundle text.')
}

const applyAnswerBundle = async () => {
    if (getSyncMethod() !== 'qr') {
        setSyncStatus('Wrong mode', 'Switch the pairing method to QR / Bundle first.')
        return
    }

    if (syncUiState.role !== 'leader' || !syncUiState.controller || !syncBundleInput?.value.trim()) {
        setSyncStatus('Leader bundle required', 'Connect as leader and paste the follower answer bundle.')
        return
    }

    const bundle = syncUiState.pendingBundle ?? decodeSessionBundle(syncBundleInput.value)
    await syncUiState.controller.applyAnswerBundle(bundle)
    setSyncStatus('Answer applied', 'Peer connection should open shortly if both devices exchanged bundles successfully.')
}

if (syncConnectBtn) {
    syncConnectBtn.addEventListener('click', () => {
        void connectSyncController()
    })
}

if (syncDisconnectBtn) {
    syncDisconnectBtn.addEventListener('click', () => {
        void disconnectSyncController()
    })
}

if (syncStartBtn) {
    syncStartBtn.addEventListener('click', () => {
        void startSynchronizedTimer()
    })
}

if (syncPushTempoBtn) {
    syncPushTempoBtn.addEventListener('click', () => {
        pushTempoUpdate()
    })
}

if (syncCopyUrlBtn) {
    syncCopyUrlBtn.addEventListener('click', async () => {
        const shareUrl = syncShareUrlInput?.value || ''
        if (!shareUrl) {
            setSyncStatus('No share URL', 'Generate an offer or answer bundle first.')
            return
        }

        try {
            await navigator.clipboard.writeText(shareUrl)
            setSyncStatus('Share URL copied', 'Open it on the other device or turn it into a QR scan target.')
        } catch (error) {
            setSyncStatus('Copy failed', 'Clipboard access was denied. Copy the URL from the field manually.')
        }
    })
}

if (syncGenerateOfferBtn) {
    syncGenerateOfferBtn.addEventListener('click', () => {
        void generateOfferQr()
    })
}

if (syncApplyOfferBtn) {
    syncApplyOfferBtn.addEventListener('click', () => {
        void applyOfferBundle()
    })
}

if (syncGenerateAnswerBtn) {
    syncGenerateAnswerBtn.addEventListener('click', () => {
        void generateAnswerQr()
    })
}

if (syncApplyAnswerBtn) {
    syncApplyAnswerBtn.addEventListener('click', () => {
        void applyAnswerBundle()
    })
}

if (syncStartScanBtn) {
    syncStartScanBtn.addEventListener('click', () => {
        void startCameraScan()
    })
}

if (syncStopScanBtn) {
    syncStopScanBtn.addEventListener('click', () => {
        stopCameraScan()
        setSyncStatus('Camera scan stopped', 'You can restart scanning or paste a bundle manually.')
    })
}

if (syncMethodSelect) {
    syncMethodSelect.addEventListener('change', () => {
        updateSyncMethodVisibility()
    })
}

if (syncRoleSelect) {
    syncRoleSelect.addEventListener('change', () => {
        if (syncUiState.scanActive) {
            stopCameraScan()
            setSyncStatus('Role changed', 'Camera scan stopped. Reconnect and scan again with the new role.')
        }
    })
}

if (syncBundleInput) {
    syncBundleInput.addEventListener('input', () => {
        const payload = syncBundleInput.value.trim()
        if (!payload) {
            syncUiState.pendingBundle = null
            return
        }

        try {
            syncUiState.pendingBundle = decodeSessionBundle(payload)
        } catch (error) {
            syncUiState.pendingBundle = null
        }
    })
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
    updateSyncTimerOptions()
    updateSyncMethodVisibility()
    updateSyncHealth()
    if (!populateBundleFromHash()) {
        setSyncStatus('Disconnected', 'Select a timer, choose a role, and connect with either the signaling server or QR bundle exchange.')
    }
}

// Ensure DOM is ready before rendering
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp)
} else {
    initApp()
}

// Expose debug function globally
(window as any).testAudioBeep = testAudioBeep
