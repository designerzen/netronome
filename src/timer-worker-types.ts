// All available timing worker implementations
// Resolves worker URLs relative to this module at runtime
// The indirect URL construction prevents bundlers from inlining workers as data URIs

const baseUrl = () => {
    const url = import.meta.url
    return url.substring(0, url.lastIndexOf('/') + 1)
}

export const AudioContextWorkerWrapper = () =>
    new Worker(baseUrl() + 'workers/timing.audiocontext.worker.js', { type: 'module' })

export const RollingTimeWorkerWrapper = () =>
    new Worker(baseUrl() + 'workers/timing.rolling.worker.js', { type: 'module' })

export const SetIntervalWorkerWrapper = () =>
    new Worker(baseUrl() + 'workers/timing.setinterval.worker.js', { type: 'module' })

export const SetTimeoutWorkerWrapper = () =>
    new Worker(baseUrl() + 'workers/timing.settimeout.worker.js', { type: 'module' })

// Note: TimingWorkletNode is dynamically imported in timer.ts for lazy loading
// so we don't export it statically here to avoid vite bundling conflicts

// Export timer type constants for convenient access
export {
    TIMER_TYPE_AUDIO_CONTEXT,
    TIMER_TYPE_AUDIO_WORKLET,
    TIMER_TYPE_ELASTIC_AUDIO_WORKLET,
    TIMER_TYPE_ROLLING,
    TIMER_TYPE_SET_INTERVAL,
    TIMER_TYPE_SET_TIMEOUT,
    TIMER_TYPES,
    TIMER_TYPE_OPTIONS,
    isValidTimerType,
    isWorkletTimerType,
    getTimerTypeDescription,
    type TimerType,
} from './timer-types'
