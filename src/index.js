// TESTS
// Simply exposes the internal methods
import { start, stop, getMode, setMode, setTimeBetween } from './timing.js'

const feedback = document.getElementById('feedback')
const startButton = document.getElementById('start')
const stopButton = document.getElementById('stop')
const resetButton = document.getElementById('reset')
const modeSelector = document.getElementById('mode')
const intervalSelector = document.getElementById('interval')

// this should be changeable also
let interval = 1000

// become filled in reset()
let lags
let drifts

const reset = () => {
    lags = []
    drifts = []
}

startButton.addEventListener( 'click', event => {

    reset()

    // The different ways of connecting to the timer...
    // 1. Natural timer - just trying it's best to give a regular beat with as much accuracy as possible
    // 2. Audio timer - trying to synchronise iself with the audio context timer for accurate audio synch
    // 3. ?
    const plop = start( ({timePassed, elapsed, expected, drift, level, intervals, lag} )=>{

        console.log("Timer", {timePassed, elapsed, expected, drift, level, intervals, lag},
            {baselateency:plop.audioContext.baseLatency,
            outputlatency:plop.audioContext.outputLatency} )

        feedback.innerHTML +=  `<tr>
                                    <td>${intervals}</td>
                                    <td>${expected}s</td>
                                    <td>${elapsed}s</td>
                                    <td>${timePassed}s</td>
                                    <td><strong>${drift}</strong></td>
                                    <td>${lag}</td>
                                    <td>${getMode()}</td>
                                </tr>`
                             
                                
        lags.push(lag)
        drifts.push(drift)

    }, interval )
    
    const { audioContext } = plop
    
    const oscillatorNode = audioContext.createOscillator();
    const gainNode = audioContext.createGain()
// var finish = audioContext.destination

console.error("Starting",plop, audioContext)

    // to add some stuff to the audio track to hopefully coincide with the tick
    

    // currentTime:audioContext.currentTime,
    // timingWorker,
    // mode

      // 3. ?
    // const plop = start( 1000 )
    
    // plop.onTick = ( ({timePassed, elapsed, expected, drift, level, lag})=>{

    //     console.log("Timer", {timePassed, elapsed, expected, drift, level, lag} )
    // })
    event.preventDefault()
    return false

}, true)


resetButton.addEventListener( 'click', event => {
    reset()
    event.preventDefault()
    return false
})

stopButton.addEventListener( 'click', event => {

    const plop = stop()

    const averageLag = lags.reduce((previous, current) => current += previous) / lags.length
    const averageDrifts = drifts.reduce((previous, current) => current += previous) / drifts.length

    console.error("Stopping", {baselateency:plop.audioContext.baseLatency,
        outputlatency:plop.audioContext.outputLatency} )

    // feedback.innerHTML +=  `<thead>
    //                             <th>averageLag</th>
    //                             <th>averageDrift</th>
    //                         <thead>`

    feedback.innerHTML +=  `<tr>
                                <td><strong>average lag</strong> ${averageLag}</td>
                                <td><strong>average drift</strong>${averageDrifts}</td>
                            </tr>`

    event.preventDefault()
    return false

}, true)


// do this for different intervals...
intervalSelector.addEventListener( 'change', event => {

    const interval = parseInt(event.target.value)
    setTimeBetween(interval)

}, true)



modeSelector.addEventListener( 'change', event => {

    setMode( event.target.value )

}, true)