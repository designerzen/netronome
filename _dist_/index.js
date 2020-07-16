import {start, stop, getMode, setMode, setTimeBetween} from "./timing.js";
const feedback = document.getElementById("feedback");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const resetButton = document.getElementById("reset");
const modeSelector = document.getElementById("mode");
const intervalSelector = document.getElementById("interval");
let interval = 1000;
let lags;
let drifts;
const reset = () => {
  lags = [];
  drifts = [];
};
startButton.addEventListener("click", (event) => {
  reset();
  const plop = start(({timePassed, elapsed, expected, drift, level, intervals, lag}) => {
    console.log("Timer", {
      timePassed,
      elapsed,
      expected,
      drift,
      level,
      intervals,
      lag
    }, {
      baselateency: plop.audioContext.baseLatency,
      outputlatency: plop.audioContext.outputLatency
    });
    feedback.innerHTML += `<tr>
                                    <td>${intervals}</td>
                                    <td>${expected}s</td>
                                    <td>${elapsed}s</td>
                                    <td>${timePassed}s</td>
                                    <td><strong>${drift}</strong></td>
                                    <td>${lag}</td>
                                    <td>${getMode()}</td>
                                </tr>`;
    lags.push(lag);
    drifts.push(drift);
  }, interval);
  const {audioContext} = plop;
  const oscillatorNode = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  console.error("Starting", plop, audioContext);
  event.preventDefault();
  return false;
}, true);
resetButton.addEventListener("click", (event) => {
  reset();
  event.preventDefault();
  return false;
});
stopButton.addEventListener("click", (event) => {
  const plop = stop();
  const averageLag = lags.reduce((previous, current) => current += previous) / lags.length;
  const averageDrifts = drifts.reduce((previous, current) => current += previous) / drifts.length;
  console.error("Stopping", {
    baselateency: plop.audioContext.baseLatency,
    outputlatency: plop.audioContext.outputLatency
  });
  feedback.innerHTML += `<tr>
                                <td><strong>average lag</strong> ${averageLag}</td>
                                <td><strong>average drift</strong>${averageDrifts}</td>
                            </tr>`;
  event.preventDefault();
  return false;
}, true);
intervalSelector.addEventListener("change", (event) => {
  const interval2 = parseInt(event.target.value);
}, true);
modeSelector.addEventListener("change", (event) => {
  setMode(event.target.value);
}, true);
