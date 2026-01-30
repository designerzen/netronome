// All available timing worker implementations
// Import as raw source code and create blob URLs with correct MIME type
import AUDIOCONTEXT_WORKER_CODE from './workers/timing.audiocontext.worker.ts?raw'
import AUDIOCONTEXT_WORKLET_CODE from './workers/timing.audioworklet.ts?raw'
import AUDIOWORKLET_PROCESSOR_CODE from './workers/timing.audioworklet-processor.ts?raw'
import ROLLING_WORKER_CODE from './workers/timing.rolling.worker.ts?raw'
import SETINTERVAL_WORKER_CODE from './workers/timing.setinterval.worker.ts?raw'
import SETTIMEOUT_WORKER_CODE from './workers/timing.settimeout.worker.ts?raw'

// Create blob URLs with correct MIME type
const createWorkerBlobURL = (code: string): string => {
    const blob = new Blob([code], { type: 'application/javascript' })
    return URL.createObjectURL(blob)
}

export const AUDIOCONTEXT_WORKER_URI = createWorkerBlobURL(AUDIOCONTEXT_WORKER_CODE)
export const AUDIOCONTEXT_WORKLET_URI = createWorkerBlobURL(AUDIOCONTEXT_WORKLET_CODE)
export const AUDIOWORKLET_PROCESSOR_URI = createWorkerBlobURL(AUDIOWORKLET_PROCESSOR_CODE)
export const ROLLING_WORKER_URI = createWorkerBlobURL(ROLLING_WORKER_CODE)
export const SETINTERVAL_WORKER_URI = createWorkerBlobURL(SETINTERVAL_WORKER_CODE)
export const SETTIMEOUT_WORKER_URI = createWorkerBlobURL(SETTIMEOUT_WORKER_CODE)
