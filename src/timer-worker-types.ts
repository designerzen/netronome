// All available timing worker implementations using ?worker
// Vite will automatically bundle these as separate worker files
export { default as AudioContextWorkerWrapper } from './workers/timing.audiocontext.worker.ts?worker'
export { default as RollingTimeWorkerWrapper } from './workers/timing.rolling.worker.ts?worker'
export { default as SetIntervalWorkerWrapper } from './workers/timing.setinterval.worker.ts?worker'
export { default as SetTimeoutWorkerWrapper } from './workers/timing.settimeout.worker.ts?worker'

export { default as TimingWorkletNode, createTimingWorklet } from './worklets/timing.audioworklet'

// Export timer type constants for convenient access
export {
    TIMER_TYPE_AUDIO_CONTEXT,
    TIMER_TYPE_AUDIO_WORKLET,
    TIMER_TYPE_ROLLING,
    TIMER_TYPE_SET_INTERVAL,
    TIMER_TYPE_SET_TIMEOUT,
    TIMER_TYPES,
    isValidTimerType,
    getTimerTypeDescription,
    type TimerType,
} from './timer-types'