import {CMD_START, CMD_STOP, CMD_UPDATE, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK} from "./timing.constants.js";
const AudioContext = window.AudioContext || window.webkitAudioContext;
let mode = "settimeout";
const prefix = "/_dist_/";
let timingWorker = new Worker(`${prefix}/timing.${mode}.worker.js`);
let startTime = -1;
let audioContext = null;
let isRunning = false;
const elapsed = () => (audioContext.currentTime - startTime) * 0.001;
export const setMode = (newMode) => {
  mode = newMode;
  timingWorker = new Worker(`${prefix}/timing.${mode}.worker.js`);
  console.error("Changing mode", mode, timingWorker);
  if (isRunning) {
  }
};
export const setTimeBetween = (time) => {
  interval = time;
};
export const getMode = () => mode;
export const start = (callback, interval2 = 200) => {
  if (audioContext === null) {
    audioContext = new AudioContext();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
  }
  timingWorker.onmessage = (e) => {
    const currentTime = audioContext.currentTime;
    const data = e.data;
    switch (data.event) {
      case EVENT_STARTING:
        const time = data.time;
        startTime = currentTime;
        isRunning = true;
        console.log("EVENT_STARTING", {
          time,
          startTime
        });
        break;
      case EVENT_TICK:
        const intervals = data.intervals;
        const expected = intervals * interval2 * 0.001;
        const elapsed2 = currentTime - startTime;
        const timePassed = data.time;
        const lag = timePassed % interval2 * 0.001;
        const drift = timePassed - elapsed2;
        const level = Math.floor(timePassed / interval2);
        callback && callback({
          timePassed,
          elapsed: elapsed2,
          expected,
          drift,
          level,
          intervals,
          lag
        });
        break;
      default:
        console.log("message: ", e);
    }
  };
  timingWorker.onerror = (error) => {
    console.error("error...", {
      error
    });
    timingWorker.postMessage({
      error,
      time: audioContext.currentTime
    });
  };
  timingWorker.postMessage({
    command: CMD_START,
    time: audioContext.currentTime,
    interval: interval2
  });
  console.log("Starting...", {
    audioContext,
    interval: interval2,
    timingWorker
  });
  return {
    audioContext,
    currentTime: audioContext.currentTime,
    timingWorker,
    mode
  };
};
export const stop = () => {
  const currentTime = audioContext.currentTime;
  timingWorker.onmessage = (e) => {
    switch (e.event) {
      case EVENT_STOPPING:
        isRunning = false;
        audioContext = null;
        break;
    }
  };
  timingWorker.postMessage({
    command: CMD_STOP,
    time: currentTime
  });
  return {
    audioContext,
    currentTime: audioContext.currentTime,
    timingWorker,
    mode
  };
};
