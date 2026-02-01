import {
	CMD_START,CMD_STOP,CMD_UPDATE,CMD_ADJUST_DRIFT,
	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from '../timer-event-types'

interface WorkerMessage {
	command: string
	interval?: number
	accurateTiming?: boolean
	drift?: number
}

let timerID: ReturnType<typeof setInterval> | null = null
let isRunning: boolean = false
let startTime: number = -1
let currentTime: number = -1
// assumes a constant tempo
let gap: number = -1
let intervals: number = 0
let accurateTiming: boolean = true
let cumulativeDrift: number = 0

const now = (): number => performance.now()

const elapsed = (): number => (now() - startTime) * 0.001

const loop = (interval: number): void => {
    
    // Apply drift compensation only if accurate timing is enabled
    // Small fractional adjustments to gradually correct drift
    let compensatedInterval = interval
    if (accurateTiming && cumulativeDrift !== 0) {
        // Dampen the drift correction to avoid overcorrection
        // Use only 10% of measured drift to gradually steer back to target
        const dampedDrift = cumulativeDrift * 0.1
        compensatedInterval = Math.max(interval - dampedDrift, 1)
    }
    
    // Loop
    timerID = setInterval( (): void =>{

        const expected = intervals * gap * 0.001
        const passed = elapsed()
        const difference = expected - passed
        
        // if the difference is too great, restart with different interval?

        currentTime = now()
        
        intervals++
        
        self.postMessage({ event:EVENT_TICK, time:passed, intervals })
       
        //dconst nextInterval = accurateTiming ? interval + difference : interval 

        // call itself with the new interval?
        //dloop(nextInterval)

    }, compensatedInterval)
}

const reset = (): void =>{
    intervals = 0
    startTime = now()
}

const start = (interval: number = 250, timeSignature?: any): void =>{
    
    gap = interval
	
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

    // do the setinterval here
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

    // If we want to get a specific time from outside of this context we need to proxy
    // which is slow but possible
    // postMessage({ event:EVENT_TICK, time:passed, intervals })
    switch (data.command)
    {
        case CMD_START:
            accurateTiming = data.accurateTiming || false    
            start(data.interval || 250)
            console.log("starting at tempo", data.interval)
           
			break

        case CMD_STOP:
            stop()
            break

        case CMD_UPDATE:
			console.log("changing tempo", data.interval)
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
