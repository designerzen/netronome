import type Timer from './timer'
import type { NetworkTransport } from './network-timeline'
import PROCESSOR_CODE from './worklets/network-timing-processor.js?raw'
import AudioClock from './audio-clock'

export interface NetworkScheduler {
    /** latencyMs plays everything that much earlier, for output delay the browser cannot see. */
    setTimeline(states: NetworkTransport[], offsetMs: number, latencyMs?: number): void
    clear(): void
    destroy(): void
}

const modules = new WeakMap<AudioContext, Promise<void>>()
const ORIGIN_SAMPLES = 9
const ORIGIN_JUMP_CONFIRMATIONS = 3

export async function createNetworkAudioScheduler(timer: Timer, onTransport: (state: NetworkTransport) => void): Promise<NetworkScheduler> {
    const context = timer.audioContext
    if (!context?.audioWorklet) throw new Error('Network timing requires an AudioWorklet-capable audio context')
    let module = modules.get(context)
    if (!module) {
        const url = URL.createObjectURL(new Blob([PROCESSOR_CODE], { type: 'application/javascript' }))
        module = context.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url))
        modules.set(context, module)
        module.catch(() => modules.delete(context))
    }
    await module
    const node = new AudioWorkletNode(context, 'netronome-network-timing', { numberOfInputs: 0, outputChannelCount: [1] })
    node.connect(context.destination) // Silent output keeps the processor active.
    const audioClock = new AudioClock(context)
    let alive = true
    let enabled = false
    let revisions = new Set<number>()
    // Output timestamps jitter by a render quantum; a running median keeps
    // that out of tick times while still following audio clock drift.
    let origins: number[] = []
    let jumps: number[] = []
    node.port.onmessage = ({ data }) => {
        if (!alive || !enabled || !timer.isUsingExternalTrigger) return
        if (!revisions.has(data.state?.revision)) return
        // Drop stale main-thread messages instead of playing a burst after a stall.
        if (context.currentTime - data.scheduledContextTimeSeconds > 0.1) return
        onTransport(data.state)
        if (data.tick !== undefined) timer.networkTick(data.tick, data)
    }
    return {
        setTimeline(states, offsetMs, latencyMs = 0) {
            if (!alive) return
            enabled = true
            revisions = new Set(states.map(state => state.revision))
            const pair = audioClock.getTimestampPair()
            const origin = pair.contextTime - pair.performanceTime / 1000
            const median = () => [...origins].sort((a, b) => a - b)[Math.floor(origins.length / 2)]
            // A suspended and resumed context moves the origin for real, but one
            // stalled reading does not: start over only once the jump repeats.
            if (origins.length && Math.abs(median() - origin) > 0.05) {
                jumps.push(origin)
                if (jumps.length >= ORIGIN_JUMP_CONFIRMATIONS) { origins = jumps; jumps = [] }
            } else {
                jumps = []
                origins = [...origins, origin].slice(-ORIGIN_SAMPLES)
            }
            const audioOrigin = median()
            node.port.postMessage({ type: 'timeline', states: states.map(state => ({
                ...state, audioTime: audioOrigin + (state.timestamp - offsetMs - latencyMs) / 1000 - 0.1
            })) })
        },
        clear() { enabled = false; node.port.postMessage({ type: 'clear' }) },
        destroy() { alive = false; enabled = false; node.port.onmessage = null; node.port.close(); node.disconnect() }
    }
}
