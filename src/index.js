// Simply exposes the internal methods
import { start, stop, getMode, setMode, setInterval } from './timing.js'

const feedback = document.getElementById('feedback')
const startButton = document.getElementById('start')
const stopButton = document.getElementById('stop')
const modeSelector = document.getElementById('mode')

let interval = 1000
let lags = []
let drifts = []

startButton.addEventListener( 'click', event => {

    // The different ways of connecting to the timer...
    // 1. Natural timer - just trying it's best to give a regular beat with as much accuracy as possible
    // 2. Audio timer - trying to synchronise iself with the audio context timer for accurate audio synch
    // 3. ?
    const plop = start( ({timePassed, elapsed, expected, drift, level, intervals, lag} )=>{

        console.log("Timer", {timePassed, elapsed, expected, drift, level, intervals, lag} )
        feedback.innerHTML +=  `<tr>
                                    <td>${intervals}s</td>
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
    
    console.error("Starting",plop)

      // 3. ?
    // const plop = start( 1000 )
    
    // plop.onTick = ( ({timePassed, elapsed, expected, drift, level, lag})=>{

    //     console.log("Timer", {timePassed, elapsed, expected, drift, level, lag} )
    // })


}, true)


stopButton.addEventListener( 'click', event => {

    const plop = stop()

    const averageLag = lags.reduce((previous, current) => current += previous) / lags.length
    const averageDrifts = drifts.reduce((previous, current) => current += previous) / drifts.length

    console.error("Stopping",plop)

    // feedback.innerHTML +=  `<thead>
    //                             <th>averageLag</th>
    //                             <th>averageDrift</th>
    //                         <thead>`

    feedback.innerHTML +=  `<tr>
                                <td><strong>average lag</strong> ${averageLag}</td>
                                <td><strong>average drift</strong>${averageDrifts}</td>
                            </tr>`

}, true)


modeSelector.addEventListener( 'change', event => {

    setMode( event.target.value )

}, true)