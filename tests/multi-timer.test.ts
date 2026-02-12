import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MultiTimerManager } from '../public/multi-timer.ts'
import { MultiTimerChart } from '../public/multi-timer-chart.ts'

// Skip chart tests if running in Node environment (without DOM)
const skipChartTests = typeof document === 'undefined'

describe('MultiTimerManager', () => {
    let manager: MultiTimerManager

    beforeEach(() => {
        manager = new MultiTimerManager()
    })

    describe('Timer Creation', () => {
        it('should add a new timer', () => {
            const timerId = manager.addTimer({ bpm: 120, name: 'Test Timer' })
            expect(timerId).toBeDefined()
            expect(manager.getAllTimers().length).toBe(1)
        })

        it('should assign unique IDs to timers', () => {
            const id1 = manager.addTimer({ bpm: 120 })
            const id2 = manager.addTimer({ bpm: 100 })
            expect(id1).not.toBe(id2)
        })

        it('should assign unique colors from palette', () => {
            const id1 = manager.addTimer({ bpm: 120 })
            const id2 = manager.addTimer({ bpm: 100 })
            const timer1 = manager.getTimer(id1)
            const timer2 = manager.getTimer(id2)
            expect(timer1?.color).not.toBe(timer2?.color)
        })

        it('should use provided configuration', () => {
            const timerId = manager.addTimer({
                bpm: 140,
                name: 'Custom Timer',
                workerType: 'rolling'
            })
            const timer = manager.getTimer(timerId)
            expect(timer?.bpm).toBe(140)
            expect(timer?.name).toBe('Custom Timer')
            expect(timer?.workerType).toBe('rolling')
        })

        it('should use default values when not provided', () => {
            const timerId = manager.addTimer({})
            const timer = manager.getTimer(timerId)
            expect(timer?.bpm).toBe(120)
            expect(timer?.workerType).toBe('audiocontext')
            expect(timer?.name).toMatch(/^Timer \d+$/)
        })
    })

    describe('Timer Management', () => {
        it('should remove a timer', () => {
            const id = manager.addTimer({ bpm: 120 })
            expect(manager.getAllTimers().length).toBe(1)
            manager.removeTimer(id)
            expect(manager.getAllTimers().length).toBe(0)
        })

        it('should get a specific timer', () => {
            const id = manager.addTimer({ bpm: 120, name: 'Found Me' })
            const timer = manager.getTimer(id)
            expect(timer?.name).toBe('Found Me')
        })

        it('should update timer configuration', () => {
            const id = manager.addTimer({ bpm: 120, name: 'Original' })
            manager.updateTimerConfig(id, { bpm: 140, name: 'Updated' })
            const timer = manager.getTimer(id)
            expect(timer?.bpm).toBe(140)
            expect(timer?.name).toBe('Updated')
        })

        it('should return all timers', () => {
            manager.addTimer({ bpm: 120 })
            manager.addTimer({ bpm: 100 })
            manager.addTimer({ bpm: 90 })
            expect(manager.getAllTimers().length).toBe(3)
        })
    })

    describe('Data Collection', () => {
        it('should add data for a timer', () => {
            const id = manager.addTimer({ bpm: 120 })
            manager.addData({
                id,
                lag: 5.5,
                timePassed: 250,
                interval: 250,
                timestamp: Date.now(),
                drift: 0.5
            })
            const data = manager.getData(id)
            expect(data.length).toBe(1)
            expect(data[0].lag).toBe(5.5)
        })

        it('should accumulate data points', () => {
            const id = manager.addTimer({ bpm: 120 })
            for (let i = 0; i < 10; i++) {
                manager.addData({
                    id,
                    lag: i * 0.5,
                    timePassed: 250,
                    interval: 250,
                    timestamp: Date.now() + i,
                    drift: 0
                })
            }
            const data = manager.getData(id)
            expect(data.length).toBe(10)
        })

        it('should cap data points at 500', () => {
            const id = manager.addTimer({ bpm: 120 })
            for (let i = 0; i < 600; i++) {
                manager.addData({
                    id,
                    lag: i * 0.1,
                    timePassed: 250,
                    interval: 250,
                    timestamp: Date.now() + i,
                    drift: 0
                })
            }
            const data = manager.getData(id)
            expect(data.length).toBeLessThanOrEqual(500)
        })

        it('should clear timer data', () => {
            const id = manager.addTimer({ bpm: 120 })
            manager.addData({
                id,
                lag: 5.5,
                timePassed: 250,
                interval: 250,
                timestamp: Date.now(),
                drift: 0.5
            })
            expect(manager.getData(id).length).toBe(1)
            manager.clearTimer(id)
            expect(manager.getData(id).length).toBe(0)
        })

        it('should clear all data', () => {
            const id1 = manager.addTimer({ bpm: 120 })
            const id2 = manager.addTimer({ bpm: 100 })
            
            manager.addData({
                id: id1,
                lag: 5.5,
                timePassed: 250,
                interval: 250,
                timestamp: Date.now(),
                drift: 0.5
            })
            manager.addData({
                id: id2,
                lag: 3.2,
                timePassed: 240,
                interval: 240,
                timestamp: Date.now(),
                drift: 0.2
            })
            
            manager.clear()
            expect(manager.getData(id1).length).toBe(0)
            expect(manager.getData(id2).length).toBe(0)
        })
    })

    describe('Subscriptions', () => {
        it('should notify subscribers on data change', () => {
            const listener = vi.fn()
            const id = manager.addTimer({ bpm: 120 })
            manager.subscribe(listener)
            
            manager.addData({
                id,
                lag: 5.5,
                timePassed: 250,
                interval: 250,
                timestamp: Date.now(),
                drift: 0.5
            })
            
            expect(listener).toHaveBeenCalled()
        })

        it('should unsubscribe listener', () => {
            const listener = vi.fn()
            const id = manager.addTimer({ bpm: 120 })
            const unsubscribe = manager.subscribe(listener)
            
            unsubscribe()
            
            manager.addData({
                id,
                lag: 5.5,
                timePassed: 250,
                interval: 250,
                timestamp: Date.now(),
                drift: 0.5
            })
            
            expect(listener).not.toHaveBeenCalled()
        })

        it('should support multiple subscribers', () => {
            const listener1 = vi.fn()
            const listener2 = vi.fn()
            const id = manager.addTimer({ bpm: 120 })
            
            manager.subscribe(listener1)
            manager.subscribe(listener2)
            
            manager.addData({
                id,
                lag: 5.5,
                timePassed: 250,
                interval: 250,
                timestamp: Date.now(),
                drift: 0.5
            })
            
            expect(listener1).toHaveBeenCalled()
            expect(listener2).toHaveBeenCalled()
        })
    })

    describe('getAllData', () => {
        it('should return all data from all timers sorted by timestamp', () => {
            const id1 = manager.addTimer({ bpm: 120 })
            const id2 = manager.addTimer({ bpm: 100 })
            
            const now = Date.now()
            manager.addData({
                id: id1,
                lag: 5.5,
                timePassed: 250,
                interval: 250,
                timestamp: now,
                drift: 0.5
            })
            manager.addData({
                id: id2,
                lag: 3.2,
                timePassed: 240,
                interval: 240,
                timestamp: now + 1,
                drift: 0.2
            })
            
            const allData = manager.getAllData()
            expect(allData.length).toBe(2)
            expect(allData[0].timestamp).toBeLessThanOrEqual(allData[1].timestamp)
        })
    })
})

describe.skipIf(skipChartTests)('MultiTimerChart', () => {
    let container: HTMLDivElement
    let chart: MultiTimerChart

    beforeEach(() => {
        // Create a test container
        container = document.createElement('div')
        container.innerHTML = '<canvas id="test-chart" style="width: 600px; height: 400px;"></canvas>'
        document.body.appendChild(container)
        
        chart = new MultiTimerChart('test-chart')
    })

    afterEach(() => {
        document.body.removeChild(container)
    })

    it('should create a chart instance', () => {
        expect(chart).toBeDefined()
    })

    it('should add data points', () => {
        chart.addData({
            id: 'timer-1',
            lag: 5.5,
            timePassed: 250,
            interval: 250,
            timestamp: Date.now(),
            color: '#FF6B6B'
        })
        // Chart should render without error
        expect(chart).toBeDefined()
    })

    it('should clear data', () => {
        chart.addData({
            id: 'timer-1',
            lag: 5.5,
            timePassed: 250,
            interval: 250,
            timestamp: Date.now(),
            color: '#FF6B6B'
        })
        chart.clear()
        // Chart should render without error
        expect(chart).toBeDefined()
    })

    it('should clear specific timer data', () => {
        chart.addData({
            id: 'timer-1',
            lag: 5.5,
            timePassed: 250,
            interval: 250,
            timestamp: Date.now(),
            color: '#FF6B6B'
        })
        chart.addData({
            id: 'timer-2',
            lag: 3.2,
            timePassed: 240,
            interval: 240,
            timestamp: Date.now(),
            color: '#4ECDC4'
        })
        chart.clearTimer('timer-1')
        // Chart should render without error
        expect(chart).toBeDefined()
    })

    it('should handle multiple data points from same timer', () => {
        const now = Date.now()
        for (let i = 0; i < 10; i++) {
            chart.addData({
                id: 'timer-1',
                lag: 5 + i * 0.1,
                timePassed: 250,
                interval: 250,
                timestamp: now + i * 100,
                color: '#FF6B6B'
            })
        }
        expect(chart).toBeDefined()
    })

    it('should handle data from multiple timers', () => {
        const now = Date.now()
        for (let i = 0; i < 5; i++) {
            chart.addData({
                id: 'timer-1',
                lag: 5 + i * 0.1,
                timePassed: 250,
                interval: 250,
                timestamp: now + i * 100,
                color: '#FF6B6B'
            })
            chart.addData({
                id: 'timer-2',
                lag: 3 + i * 0.15,
                timePassed: 240,
                interval: 240,
                timestamp: now + i * 100,
                color: '#4ECDC4'
            })
        }
        expect(chart).toBeDefined()
    })
})

describe('Integration Tests', () => {
    let manager: MultiTimerManager

    beforeEach(() => {
        manager = new MultiTimerManager()
    })

    it('should support typical multi-timer workflow', () => {
        // Add 3 timers
        const id1 = manager.addTimer({ bpm: 120, name: 'Timer 1' })
        const id2 = manager.addTimer({ bpm: 100, name: 'Timer 2' })
        const id3 = manager.addTimer({ bpm: 140, name: 'Timer 3' })
        
        expect(manager.getAllTimers().length).toBe(3)
        
        // Add data to all timers
        for (let i = 0; i < 10; i++) {
            manager.addData({
                id: id1,
                lag: 5 + Math.random() * 2,
                timePassed: 250,
                interval: 250,
                timestamp: Date.now() + i * 10,
                drift: 0.5
            })
            manager.addData({
                id: id2,
                lag: 4 + Math.random() * 3,
                timePassed: 240,
                interval: 240,
                timestamp: Date.now() + i * 10,
                drift: 0.3
            })
            manager.addData({
                id: id3,
                lag: 6 + Math.random() * 1.5,
                timePassed: 260,
                interval: 260,
                timestamp: Date.now() + i * 10,
                drift: 0.7
            })
        }
        
        // Verify data collected
        expect(manager.getData(id1).length).toBe(10)
        expect(manager.getData(id2).length).toBe(10)
        expect(manager.getData(id3).length).toBe(10)
        
        // Update timer configuration
        manager.updateTimerConfig(id1, { bpm: 130 })
        expect(manager.getTimer(id1)?.bpm).toBe(130)
        
        // Clear one timer's data
        manager.clearTimer(id2)
        expect(manager.getData(id2).length).toBe(0)
        expect(manager.getData(id1).length).toBe(10)
        
        // Remove a timer
        manager.removeTimer(id3)
        expect(manager.getAllTimers().length).toBe(2)
    })

    it('should handle color palette cycling', () => {
        // Add more timers than colors in palette (10 colors)
        const timers = []
        for (let i = 0; i < 15; i++) {
            timers.push(manager.addTimer({ bpm: 120 + i }))
        }
        
        expect(manager.getAllTimers().length).toBe(15)
        
        // All timers should have colors (cycling through palette)
        manager.getAllTimers().forEach(timer => {
            expect(timer.color).toBeDefined()
            expect(timer.color).toMatch(/^#[0-9A-F]{6}$/i)
        })
    })
})
