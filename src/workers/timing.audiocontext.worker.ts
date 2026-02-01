// import {
// 	CMD_START,CMD_STOP,CMD_UPDATE,
// 	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
// } from './timing.js'
import {
	CMD_INITIALISE,
	CMD_START,CMD_STOP,CMD_UPDATE,CMD_ADJUST_DRIFT,
	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from '../timer-event-types'

interface WorkerMessage {
	command: string
	interval?: number
	accurateTiming?: boolean
	drift?: number
}

interface WorkerEvent {
	event: string
	time?: number
	intervals?: number
}

let timerID: number | null = null
let isRunning: boolean = false
let startTime: number = -1
let currentTime: number = -1
let gap: number = -1
let intervals: number = 0
let accurateTiming: boolean = true
let cumulativeDrift: number = 0

const now = (): number => performance.now()

const elapsed = (): number => ( now() - startTime) * 0.001

const loop = (interval: number): void => {
    if (timerID !== null) clearInterval(timerID)
    
    // Apply drift compensation to the interval only if accurate timing is enabled
    // Small fractional adjustments to gradually correct drift
    let compensatedInterval = interval
    if (accurateTiming && cumulativeDrift !== 0) {
        // Dampen the drift correction to avoid overcorrection
        // Use only 10% of measured drift to gradually steer back to target
        const dampedDrift = cumulativeDrift * 0.1
        compensatedInterval = Math.max(interval - dampedDrift, 1)
    }
    
    timerID = self.setInterval(() => {
        self.postMessage({ 
            event: EVENT_TICK, 
            time: elapsed(), 
            intervals: intervals++ 
        })
    }, compensatedInterval)
}

const reset = (): void =>{
    intervals = 0
    startTime = now()
}

const start = (interval: number = 250): void =>{
    // stop if running
    if (isRunning)
    {
        if (timerID !== null) clearInterval(timerID)
    }

    if (!isRunning)
    {
        startTime = now()
        isRunning = true

        self.postMessage({event:EVENT_STARTING, time:0})
    }
    gap = interval
    loop(gap)

    // INITIAL tick
    self.postMessage({ event:EVENT_TICK, time:elapsed(), intervals })
}

const stop = (): void => {
    if (timerID !== null) clearInterval(timerID)
    timerID = null
    isRunning = false
    self.postMessage({ event:EVENT_STOPPING, time:elapsed(), intervals })
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {

    const data = e.data

    switch (data.command)
    {
		// TODO : Set this up with the provided audioContext
        case CMD_INITIALISE:
            accurateTiming = data.accurateTiming || false
            start(data.interval || 250)
            break

        case CMD_START:
            accurateTiming = data.accurateTiming || false
            start(data.interval || 250)
            break

        case CMD_STOP:
            stop()
            break

        case CMD_UPDATE:
            start(data.interval || 250)
            break

        case CMD_ADJUST_DRIFT:
            if (data.drift !== undefined) {
                cumulativeDrift = data.drift
                // Restart loop with compensated interval
                if (isRunning) {
                    loop(gap)
                }
            }
            break
    }
}
