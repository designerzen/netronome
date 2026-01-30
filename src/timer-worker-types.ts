// All available timing worker implementations
// Using ?worker format to ensure files are emitted as separate JS modules
import AUDIOCONTEXT_WORKER from './workers/timing.audiocontext.worker.ts?worker'
import AUDIOCONTEXT_WORKLET from './workers/timing.audioworklet.ts?worker'
import AUDIOWORKLET_PROCESSOR from './workers/timing.audioworklet-processor.ts?worker'
import ROLLING_WORKER from './workers/timing.rolling.worker.ts?worker'
import SETINTERVAL_WORKER from './workers/timing.setinterval.worker.ts?worker'
import SETTIMEOUT_WORKER from './workers/timing.settimeout.worker.ts?worker'

// Convert worker modules to URLs
export const AUDIOCONTEXT_WORKER_URI = new URL(AUDIOCONTEXT_WORKER, import.meta.url).href
export const AUDIOCONTEXT_WORKLET_URI = new URL(AUDIOCONTEXT_WORKLET, import.meta.url).href
export const AUDIOWORKLET_PROCESSOR_URI = new URL(AUDIOWORKLET_PROCESSOR, import.meta.url).href
export const ROLLING_WORKER_URI = new URL(ROLLING_WORKER, import.meta.url).href
export const SETINTERVAL_WORKER_URI = new URL(SETINTERVAL_WORKER, import.meta.url).href
export const SETTIMEOUT_WORKER_URI = new URL(SETTIMEOUT_WORKER, import.meta.url).href
