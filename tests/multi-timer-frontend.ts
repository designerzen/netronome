/**
 * Multi-Timer Frontend
 * Manages UI and orchestrates multiple timers with shared chart
 */

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

interface RunningTimer {
    id: string
    timer: Timer
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
let tickAudioEnabled = false
let audioContext: AudioContext | null = null
const audioTimerTypes = new Set<TimerType>([
    TIMER_TYPE_AUDIO_CONTEXT,
    TIMER_TYPE_AUDIO_WORKLET,
    TIMER_TYPE_ELASTIC_AUDIO_WORKLET,
])

const renderTimerTypeOptions = (selectedType: TimerType) => {
    return TIMER_TYPE_OPTIONS.map((timerType) => {
        const selected = timerType === selectedType ? 'selected' : ''
        return `<option value="${timerType}" ${selected}>${getTimerTypeDescription(timerType)}</option>`
    }).join('')
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

// Render timer card
const renderTimerCard = (timerId: string) => {
    const timerConfig = multiTimerManager.getTimer(timerId)
    if (!timerConfig) return

    const running = runningTimers.get(timerId)?.isRunning || false
    const stats = runningTimers.get(timerId)?.stats
    const template = document.getElementById('timer-card-template') as HTMLTemplateElement

    // Clone template
    const fragment = template.content.cloneNode(true) as DocumentFragment
    const card = fragment.querySelector('.timer-card') as HTMLElement
    card.id = `timer-${timerId}`

    // Update header
    const tickIndicator = fragment.querySelector('.timer-tick-indicator') as HTMLElement
    tickIndicator.style.color = timerConfig.color

    const colorIndicator = fragment.querySelector('.timer-color-indicator') as HTMLElement
    colorIndicator.style.background = timerConfig.color

    const cardTitle = fragment.querySelector('.timer-card-title') as HTMLElement
    cardTitle.textContent = timerConfig.name

    const typeBadge = fragment.querySelector('.timer-type-badge') as HTMLElement
    typeBadge.textContent = getTimerTypeDescription(timerConfig.workerType)

    // Update controls
    const bpmInput = fragment.querySelector('.timer-bpm') as HTMLInputElement
    bpmInput.value = timerConfig.bpm.toString()
    bpmInput.disabled = running

    const workerTypeSelect = fragment.querySelector('.timer-worker-type') as HTMLSelectElement
    workerTypeSelect.innerHTML = renderTimerTypeOptions(timerConfig.workerType)
    workerTypeSelect.value = timerConfig.workerType
    workerTypeSelect.disabled = running

    // Update stats
    const statValues = fragment.querySelectorAll('.timer-stat-value')
    if (statValues.length >= 4) {
        const avgLag = stats?.lags.length ? (stats.lags.reduce((a, b) => a + b) / stats.lags.length).toFixed(2) : '0.00'
        const avgDrift = stats?.drifts.length ? (stats.drifts.reduce((a, b) => a + b) / stats.drifts.length).toFixed(2) : '0.00'
        
        statValues[0].textContent = `${avgLag}ms`
        statValues[1].textContent = `${avgDrift}ms`
        statValues[2].textContent = `${stats?.ticks || 0}`
        statValues[3].textContent = running ? '▶ Running' : '⏸ Stopped'
    }

    // Update buttons
    const startBtn = fragment.querySelector('.timer-start') as HTMLButtonElement
    const stopBtn = fragment.querySelector('.timer-stop') as HTMLButtonElement
    const clearBtn = fragment.querySelector('.timer-clear') as HTMLButtonElement
    const removeBtn = fragment.querySelector('.timer-remove') as HTMLButtonElement

    startBtn.disabled = running
    stopBtn.disabled = !running
    clearBtn.disabled = !stats?.ticks

    // Add event listeners
    bpmInput.addEventListener('change', (e) => {
        const bpm = parseInt((e.target as HTMLInputElement).value)
        multiTimerManager.updateTimerConfig(timerId, { bpm })
        // Update interval if timer is running
        const running = runningTimers.get(timerId)
        if (running) {
            const interval = 60000 / bpm
            running.timer.timeBetween = interval
        }
    })

    workerTypeSelect.addEventListener('change', (e) => {
        const workerType = (e.target as HTMLSelectElement).value as TimerType
        multiTimerManager.updateTimerConfig(timerId, { workerType })
        updateUI()
    })

    startBtn.addEventListener('click', () => startTimer(timerId))
    stopBtn.addEventListener('click', () => stopTimer(timerId))
    clearBtn.addEventListener('click', () => clearTimer(timerId))
    removeBtn.addEventListener('click', () => removeTimer(timerId))

    return fragment
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
        const timer = audioTimerTypes.has(config.workerType)
            ? new AudioTimer(await ensureAudioContext(), config.workerType)
            : new Timer({ bpm: config.bpm, type: config.workerType })

        timer.BPM = config.bpm

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

            // Trigger tick indicator animation and sound
            const timerCard = document.getElementById(`timer-${timerId}`)
            if (timerCard) {
                timerCard.classList.remove('tick-active')
                // Trigger reflow to restart animation
                void timerCard.offsetWidth
                timerCard.classList.add('tick-active')
            }

            // Play tick sound
            playTickSound()
        }

        // Start the timer
        await timer.startTimer(callback)

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
        const fragment = renderTimerCard(timer.id)
        if (fragment) {
            timersContainer.appendChild(fragment)
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

// Global tick audio toggle
const globalTickAudioCheckbox = document.getElementById('global-tick-audio') as HTMLInputElement
if (globalTickAudioCheckbox) {
    globalTickAudioCheckbox.addEventListener('change', (event) => {
        tickAudioEnabled = (event.target as HTMLInputElement).checked
    })
}

// Initial render
updateUI()
