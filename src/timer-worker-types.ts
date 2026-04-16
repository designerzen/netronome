// All available timing worker implementations
// Exports createWorker helper for consumers to create workers with explicit paths
// This avoids import.meta.url issues in non-Vite bundlers like Parcel

import type { WorkerWrapper } from './vite-env'

// Placeholder workers - these are resolved at runtime via setTimingWorker(string)
// For the app (Vite), these will be inlined via the app's vite config
// For consumers, they can use createWorker() or provide their own worker URLs

export const createWorker = (workerPath: string): Worker | null => {
    if (typeof window === 'undefined') return null
    return new Worker(workerPath, { type: 'module' })
}

// Export null wrappers - consumers use setTimingWorker('path/to/worker.js')
export const AudioContextWorkerWrapper: WorkerWrapper | null = null
export const RollingTimeWorkerWrapper: WorkerWrapper | null = null
export const SetIntervalWorkerWrapper: WorkerWrapper | null = null
export const SetTimeoutWorkerWrapper: WorkerWrapper | null = null

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
