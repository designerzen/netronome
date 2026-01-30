// All available timing worker implementations
// Using ?url to get file URLs that will be properly transpiled by Vite
import AUDIOCONTEXT_WORKER_URI from './workers/timing.audiocontext.worker.ts?url'
import AUDIOCONTEXT_WORKLET_URI from './workers/timing.audioworklet.ts?url'
import AUDIOWORKLET_PROCESSOR_URI from './workers/timing.audioworklet-processor.ts?url'
import ROLLING_WORKER_URI from './workers/timing.rolling.worker.ts?url'
import SETINTERVAL_WORKER_URI from './workers/timing.setinterval.worker.ts?url'
import SETTIMEOUT_WORKER_URI from './workers/timing.settimeout.worker.ts?url'

export { AUDIOCONTEXT_WORKER_URI, AUDIOCONTEXT_WORKLET_URI, AUDIOWORKLET_PROCESSOR_URI, ROLLING_WORKER_URI, SETINTERVAL_WORKER_URI, SETTIMEOUT_WORKER_URI }
