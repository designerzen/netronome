// All available timing worker implementations
// Uses Vite inline worker syntax to inline worker code as blob URLs
// This ensures consumers (Parcel, Webpack, etc.) see self-contained blob URLs

import AudioContextWorker from './workers/timing.audiocontext.worker.ts?worker&inline'
import RollingTimeWorker from './workers/timing.rolling.worker.ts?worker&inline'
import SetIntervalWorker from './workers/timing.setinterval.worker.ts?worker&inline'
import SetTimeoutWorker from './workers/timing.settimeout.worker.ts?worker&inline'

export const AudioContextWorkerWrapper = () =>
    new AudioContextWorker()

export const RollingTimeWorkerWrapper = () =>
    new RollingTimeWorker()

export const SetIntervalWorkerWrapper = () =>
    new SetIntervalWorker()

export const SetTimeoutWorkerWrapper = () =>
    new SetTimeoutWorker()

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
