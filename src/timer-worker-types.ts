// All available timing worker implementations
// Uses the cross-bundler `new URL(..., import.meta.url)` pattern
// Compatible with Vite, Parcel, Webpack 5, Rollup, and esbuild

export const AudioContextWorkerWrapper = () =>
    new Worker(new URL('./workers/timing.audiocontext.worker.ts', import.meta.url), { type: 'module' })

export const RollingTimeWorkerWrapper = () =>
    new Worker(new URL('./workers/timing.rolling.worker.ts', import.meta.url), { type: 'module' })

export const SetIntervalWorkerWrapper = () =>
    new Worker(new URL('./workers/timing.setinterval.worker.ts', import.meta.url), { type: 'module' })

export const SetTimeoutWorkerWrapper = () =>
    new Worker(new URL('./workers/timing.settimeout.worker.ts', import.meta.url), { type: 'module' })

// Note: TimingWorkletNode is dynamically imported in timer.ts for lazy loading
// so we don't export it statically here to avoid vite bundling conflicts

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
