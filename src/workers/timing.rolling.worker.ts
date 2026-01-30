import {
	CMD_START,CMD_STOP,CMD_UPDATE,
	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from '../timer-event-types'

interface WorkerMessage {
	command: string
	interval?: number
	accurateTiming?: boolean
}

const GAP_BETWEEN_LOOPS = 0

let isRunning: boolean = false
let startTime: number = -1
let currentTime: number = -1
let nextInterval: number = -1
let gap: number = 0
let intervals: number = 0
let timerID: ReturnType<typeof setTimeout> | -1 = -1
let exit: boolean = false
let accurateTiming: boolean = true

const now = (): number => performance.now() || Date.now()

const elapsed = (): number => (now() - startTime) * 0.001

const reset = (): void => {
    intervals = 0
    startTime = now()
}

/**
 * drifting short loop
 * @returns 
 */
const loop = (): void => {

    if (exit)
    {
        exit = false
        return
    }

    currentTime = now()
  
    // if the currentTime is equal or greater to our rolling time + interval
    if (currentTime >= nextInterval)
    {
        // update our counter
        intervals++
		nextInterval += gap
        // callback
        self.postMessage({ event:EVENT_TICK, time:elapsed(), intervals })
    }

    timerID = setTimeout(loop, GAP_BETWEEN_LOOPS )
}

const start = (interval: number = 250, accurateTiming: boolean = true ): void =>{

    gap = interval
   
	if (isRunning)
    {
        clearInterval(timerID)
    }

    if (!isRunning)
    {   
        startTime = now()
		// work out the next step from this step...
		nextInterval = startTime + interval
        isRunning = true
        self.postMessage({event:EVENT_STARTING, time:0, intervals})
    }else{
		// work out the next step from this step...
		nextInterval = now() + interval
	}
	
    loop()
	
    // INITIAL tick
    self.postMessage({event:EVENT_TICK, time:elapsed(), intervals})
}

const stop = (): void => {
    exit = true
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
