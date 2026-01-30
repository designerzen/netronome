// import {
// 	CMD_START,CMD_STOP,CMD_UPDATE,
// 	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
// } from './timing.js'
import {
	CMD_START,CMD_STOP,CMD_UPDATE,
	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from '../timer-event-types'

interface WorkerMessage {
	command: string
	interval?: number
	accurateTiming?: boolean
}

let timerID: number | null = null
let isRunning: boolean = false
let startTime: number = -1
let currentTime: number = -1
let gap: number = -1
let intervals: number = 0
let accurateTiming: boolean = true

const now = (): number => performance.now()

const elapsed = (): number => ( now() - startTime) * 0.001

const loop = (interval: number): void => {
    
    // Loop
    timerID = setTimeout( (): void =>{

        const expected = intervals * gap * 0.001
        const passed = elapsed()
        const difference = expected - passed

        currentTime = now()
        
        intervals++
        
        self.postMessage({ event:EVENT_TICK, time:passed, intervals })
        // console.log({expected,passed,difference,currentTime})

        // modify the interval to accomodate the drift
        const nextInterval = accurateTiming ? interval + difference : interval 

        // call itself with the new interval?
        loop(nextInterval)

    }, interval)
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

self.onmessage = (e: MessageEvent<WorkerMessage>): void => {

    const data = e.data

    switch (data.command)
    {
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
    }
}
