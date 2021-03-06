// JS test combining an audio context currentTime
// with a JS worker running in parallel
import {
    CMD_START, CMD_STOP, CMD_UPDATE,
    EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from './timing.constants.js'

const AudioContext = window.AudioContext || window.webkitAudioContext

// different timing options
//const mode = "requestframe"
// let mode = "setinterval"
let mode = "settimeout"

const prefix = "/_dist_/" // .

// Load in the correct worker...
let timingWorker = new Worker(`${prefix}/timing.${mode}.worker.js`)

let startTime = -1
let audioContext = null
let isRunning = false


const elapsed = () => (audioContext.currentTime - startTime) * 0.001

export const setMode = newMode => {
    // check to see if in array of acceptable types
    mode = newMode
    timingWorker = new Worker(`${prefix}/timing.${mode}.worker.js`)
    // TODO: restart if running
    console.error("Changing mode",mode, timingWorker)
    if (isRunning)
    {
        // 
    }
}

export const setTimeBetween = time => {
    interval = time
    // if it is running, stop and restart it?
     //interval = newInterval
    // TODO
    // FIXME
    // timingWorker.postMessage({command:CMD_UPDATE, interval:newInterval, time:currentTime})
}

export const getMode = () => mode

export const start = (callback, interval=200) => {

    // lazily initialise a context
    if (audioContext === null)
    {
        audioContext = new AudioContext()
        // on Safari macOS/iOS, the audioContext is suspended if it's not created
        // in the event handler of a user action: we attempt to resume it.
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }
   
    // now hook into our worker bee and watch for timing changes
    timingWorker.onmessage = (e) => {

        const currentTime = audioContext.currentTime
        const data = e.data
        switch(data.event)
        {
            case EVENT_STARTING:
                const time = data.time
                // save start time
                startTime = currentTime
                isRunning = true
                console.log("EVENT_STARTING", {time, startTime})
                break

            case EVENT_TICK:
                // How many ticks have occured yet
                const intervals = data.intervals
                // Expected time stamp
                const expected = intervals * interval * 0.001
                // How long has elapsed according to audio context
                const elapsed = currentTime - startTime
                // How long has elapsed according to our worker
                const timePassed = data.time
                // how much spill over the expected timestamp is there
                const lag = timePassed % interval * 0.001
                // should be 0 if the timer is working...
                const drift = timePassed - elapsed
                // deterministic intervals not neccessary
                const level = Math.floor(timePassed / interval)
                
                // update offset?

                // elapsed should === time
                //console.log("EVENT_TICK", {timePassed, elapsed, drift, art})
                callback && callback({timePassed, elapsed, expected, drift, level, intervals, lag})
                // timingWorker.postMessage({command:CMD_UPDATE, time:currentTime, interval})
                break

            default:
                console.log("message: " , e)
        }
    }

    // Error!
    timingWorker.onerror = error =>{
        console.error("error...", {error} )
        timingWorker.postMessage({error, time:audioContext.currentTime })
    }

    // send command to worker
    timingWorker.postMessage({command:CMD_START, time:audioContext.currentTime, interval })
    console.log("Starting...", {audioContext, interval, timingWorker} )

    // methods that can be chained?
    return {
        audioContext,
        currentTime:audioContext.currentTime,
        timingWorker,
        mode
    }
}



export const stop = () => {
    const currentTime = audioContext.currentTime
    // cancel the thing thrugh the workers first
    // cancel any scheduled quie noises
    timingWorker.onmessage = (e) => {
        switch(e.event)
        {
            // Clean up
            case EVENT_STOPPING:
                // destroy contexts and unsubscribe from events
                isRunning = false
                audioContext = null
                break
        }
    }

    timingWorker.postMessage({command:CMD_STOP, time:currentTime})

    return {
        audioContext,
        currentTime:audioContext.currentTime,
        timingWorker,
        mode
    }
}