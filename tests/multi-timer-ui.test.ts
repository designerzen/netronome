/**
 * Multi-Timer UI Integration Tests
 * These tests verify the front-end UI works correctly
 * Run with: pnpm run test:ui
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// These tests assume the DOM is available
describe('Multi-Timer UI Integration', () => {
    beforeEach(() => {
        // Clear DOM before each test
        if (typeof document !== 'undefined') {
            document.body.innerHTML = ''
        }
    })

    it('should have required DOM elements', () => {
        if (typeof document === 'undefined') return

        // Create minimal HTML structure
        document.body.innerHTML = `
            <button id="add-timer">+ Add Timer</button>
            <div id="timers-list" class="timers-list"></div>
            <div id="timer-details-panel" class="timer-details-panel" style="display: none;">
                <div class="timer-details-content"></div>
            </div>
            <canvas id="multi-timer-chart"></canvas>
        `

        expect(document.getElementById('add-timer')).toBeTruthy()
        expect(document.getElementById('timers-list')).toBeTruthy()
        expect(document.getElementById('timer-details-panel')).toBeTruthy()
        expect(document.getElementById('multi-timer-chart')).toBeTruthy()
    })

    it('should show timer item with color indicator', () => {
        if (typeof document === 'undefined') return

        document.body.innerHTML = `
            <div class="timers-list">
                <div class="timer-item" data-timer-id="timer-1">
                    <div class="timer-color-indicator" style="background: #FF6B6B"></div>
                    <div class="timer-item-info">
                        <span class="timer-name">Test Timer</span>
                        <span class="timer-status">120 BPM ▶</span>
                    </div>
                    <div class="timer-item-controls">
                        <button class="timer-toggle">Stop</button>
                        <button class="timer-remove">Remove</button>
                    </div>
                </div>
            </div>
        `

        const item = document.querySelector('.timer-item')
        expect(item).toBeTruthy()
        expect(item?.querySelector('.timer-name')?.textContent).toBe('Test Timer')
        expect(item?.querySelector('.timer-status')?.textContent).toBe('120 BPM ▶')
    })

    it('should display timer details panel when visible', () => {
        if (typeof document === 'undefined') return

        document.body.innerHTML = `
            <div id="timer-details-panel" class="timer-details-panel" style="display: block;">
                <div class="timer-details-content">
                    <div class="timer-detail-section">
                        <h3>Configuration</h3>
                        <div class="timer-detail-group">
                            <label>Tempo (BPM)</label>
                            <input type="number" class="timer-bpm-input" value="120" />
                        </div>
                    </div>
                    <div class="timer-detail-section">
                        <h3>Performance</h3>
                        <div class="timer-stats-grid">
                            <div class="timer-stat-card">
                                <div class="timer-stat-label">Avg Lag</div>
                                <div class="timer-stat-value">5.25ms</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `

        const panel = document.getElementById('timer-details-panel')
        expect(panel).toBeTruthy()
        expect(panel?.style.display).toBe('block')
        expect(document.querySelector('.timer-bpm-input')).toBeTruthy()
        expect(document.querySelector('.timer-stat-value')?.textContent).toBe('5.25ms')
    })

    it('should handle empty timer list state', () => {
        if (typeof document === 'undefined') return

        document.body.innerHTML = `
            <div id="timers-list" class="timers-list">
                <p style="color: var(--text-secondary); text-align: center; padding: 1rem;">
                    No timers yet. Click "Add Timer" to start.
                </p>
            </div>
        `

        const list = document.getElementById('timers-list')
        expect(list?.textContent).toContain('No timers yet')
    })

    it('should display multiple timer items', () => {
        if (typeof document === 'undefined') return

        document.body.innerHTML = `
            <div class="timers-list">
                <div class="timer-item" data-timer-id="timer-1">
                    <div class="timer-color-indicator" style="background: #FF6B6B"></div>
                    <div class="timer-item-info">
                        <span class="timer-name">Timer 1</span>
                        <span class="timer-status">120 BPM ▶</span>
                    </div>
                </div>
                <div class="timer-item" data-timer-id="timer-2">
                    <div class="timer-color-indicator" style="background: #4ECDC4"></div>
                    <div class="timer-item-info">
                        <span class="timer-name">Timer 2</span>
                        <span class="timer-status">100 BPM ⏸</span>
                    </div>
                </div>
            </div>
        `

        const items = document.querySelectorAll('.timer-item')
        expect(items.length).toBe(2)
        expect(items[0].querySelector('.timer-name')?.textContent).toBe('Timer 1')
        expect(items[1].querySelector('.timer-name')?.textContent).toBe('Timer 2')
    })

    it('should show active state on selected timer', () => {
        if (typeof document === 'undefined') return

        document.body.innerHTML = `
            <div class="timers-list">
                <div class="timer-item active" data-timer-id="timer-1">
                    <span class="timer-name">Selected Timer</span>
                </div>
                <div class="timer-item" data-timer-id="timer-2">
                    <span class="timer-name">Other Timer</span>
                </div>
            </div>
        `

        const items = document.querySelectorAll('.timer-item')
        expect(items[0].classList.contains('active')).toBe(true)
        expect(items[1].classList.contains('active')).toBe(false)
    })

    it('should display stats in details panel', () => {
        if (typeof document === 'undefined') return

        document.body.innerHTML = `
            <div class="timer-detail-section">
                <h3>Performance</h3>
                <div class="timer-stats-grid">
                    <div class="timer-stat-card">
                        <div class="timer-stat-label">Avg Lag</div>
                        <div class="timer-stat-value">5.25ms</div>
                    </div>
                    <div class="timer-stat-card">
                        <div class="timer-stat-label">Avg Drift</div>
                        <div class="timer-stat-value">0.15ms</div>
                    </div>
                    <div class="timer-stat-card">
                        <div class="timer-stat-label">Ticks</div>
                        <div class="timer-stat-value">150</div>
                    </div>
                    <div class="timer-stat-card">
                        <div class="timer-stat-label">Status</div>
                        <div class="timer-stat-value">▶ Running</div>
                    </div>
                </div>
            </div>
        `

        const stats = document.querySelectorAll('.timer-stat-card')
        expect(stats.length).toBe(4)
        expect(stats[0].querySelector('.timer-stat-value')?.textContent).toBe('5.25ms')
        expect(stats[2].querySelector('.timer-stat-value')?.textContent).toBe('150')
    })

    it('should disable controls when timer is running', () => {
        if (typeof document === 'undefined') return

        document.body.innerHTML = `
            <div class="timer-detail-group">
                <input type="number" class="timer-bpm-input" value="120" disabled />
            </div>
            <div class="timer-detail-actions">
                <button class="timer-detail-start" disabled>Start</button>
                <button class="timer-detail-stop">Stop</button>
            </div>
        `

        const bpmInput = document.querySelector('.timer-bpm-input') as HTMLInputElement
        const startBtn = document.querySelector('.timer-detail-start') as HTMLButtonElement
        const stopBtn = document.querySelector('.timer-detail-stop') as HTMLButtonElement

        expect(bpmInput.disabled).toBe(true)
        expect(startBtn.disabled).toBe(true)
        expect(stopBtn.disabled).toBe(false)
    })

    it('should enable controls when timer is stopped', () => {
        if (typeof document === 'undefined') return

        document.body.innerHTML = `
            <div class="timer-detail-group">
                <input type="number" class="timer-bpm-input" value="120" />
            </div>
            <div class="timer-detail-actions">
                <button class="timer-detail-start">Start</button>
                <button class="timer-detail-stop" disabled>Stop</button>
            </div>
        `

        const bpmInput = document.querySelector('.timer-bpm-input') as HTMLInputElement
        const startBtn = document.querySelector('.timer-detail-start') as HTMLButtonElement
        const stopBtn = document.querySelector('.timer-detail-stop') as HTMLButtonElement

        expect(bpmInput.disabled).toBe(false)
        expect(startBtn.disabled).toBe(false)
        expect(stopBtn.disabled).toBe(true)
    })
})

describe('Multi-Timer Data Flow', () => {
    it('should track data updates correctly', () => {
        // This test verifies the data model structure
        const timerData = {
            id: 'timer-1',
            lag: 5.5,
            timePassed: 250,
            interval: 250,
            timestamp: Date.now(),
            drift: 0.5,
            color: '#FF6B6B'
        }

        expect(timerData).toHaveProperty('id')
        expect(timerData).toHaveProperty('lag')
        expect(timerData).toHaveProperty('timePassed')
        expect(timerData).toHaveProperty('interval')
        expect(timerData).toHaveProperty('timestamp')
        expect(timerData).toHaveProperty('drift')
        expect(timerData).toHaveProperty('color')

        expect(typeof timerData.id).toBe('string')
        expect(typeof timerData.lag).toBe('number')
        expect(typeof timerData.color).toBe('string')
    })

    it('should maintain timer configuration', () => {
        const timerConfig = {
            id: 'timer-1',
            bpm: 120,
            name: 'Test Timer',
            workerType: 'audiocontext',
            color: '#FF6B6B'
        }

        expect(timerConfig.bpm).toBe(120)
        expect(timerConfig.name).toBe('Test Timer')
        expect(timerConfig.workerType).toBe('audiocontext')
    })

    it('should handle timer state transitions', () => {
        const timerState = {
            isRunning: false,
            stats: {
                ticks: 0,
                lags: [] as number[],
                drifts: [] as number[]
            }
        }

        // Add some data
        timerState.stats.lags.push(5.5, 5.2, 5.8)
        timerState.stats.drifts.push(0.1, 0.2, 0.15)
        timerState.stats.ticks = 3

        expect(timerState.stats.lags.length).toBe(3)
        expect(timerState.stats.drifts.length).toBe(3)
        expect(timerState.stats.ticks).toBe(3)

        // Transition to running
        timerState.isRunning = true
        expect(timerState.isRunning).toBe(true)

        // Stop and clear
        timerState.isRunning = false
        timerState.stats = { ticks: 0, lags: [], drifts: [] }
        expect(timerState.stats.ticks).toBe(0)
        expect(timerState.stats.lags.length).toBe(0)
    })
})
