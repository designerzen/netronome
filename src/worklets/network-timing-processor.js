// Shared transport anchors are converted to audio seconds before reaching this worklet.
class NetworkTimingProcessor extends AudioWorkletProcessor {
    states = []
    revision = -1
    tick = -1
    constructor() {
        super()
        this.port.onmessage = ({ data }) => {
            if (data.type === 'clear') {
                this.states = []
                this.revision = -1
                this.tick = -1
            } else if (data.type === 'timeline') {
                this.states = data.states
            }
        }
    }
    process() {
        let state
        for (const candidate of this.states) {
            if (candidate.audioTime <= currentTime) state = candidate
        }
        if (!state) return true
        const interval = 60 / (state.bpm * state.divisions)
        if (this.revision !== state.revision) {
            this.revision = state.revision
            // Late joins skip elapsed ticks and retain absolute musical position.
            this.tick = Math.max(Math.ceil(state.position * state.divisions - 1e-7),
                Math.floor(state.position * state.divisions + (currentTime - state.audioTime) / interval) - 1) - 1
            this.port.postMessage({ state, scheduledContextTimeSeconds: state.audioTime + 0.1 })
        }
        if (!state.playing) return true
        // A suspended context must never replay a backlog of musical events.
        let next = Math.max(this.tick + 1,
            Math.floor(state.position * state.divisions + (currentTime - state.audioTime) / interval) - 1)
        for (let count = 0; count < 4; count++, next++) {
            const scheduled = state.audioTime + (next - state.position * state.divisions
                + (next % 2 ? state.swing : 0)) * interval
            if (scheduled > currentTime + 1e-7) break
            this.tick = next
            if (scheduled < currentTime - 256 / sampleRate) continue
            this.port.postMessage({ state, tick: next, scheduledContextTimeSeconds: scheduled + 0.1,
                contextTimeSeconds: currentTime, audioFrame: currentFrame, sampleRate })
        }
        return true
    }
}
registerProcessor('netronome-network-timing', NetworkTimingProcessor)
