export interface SyncSample {
    offsetMs: number
    rttMs: number
    receivedAtMs: number
}

export interface SyncEstimate {
    offsetMs: number
    rttMs: number
    jitterMs: number
    sampleCount: number
    locked: boolean
}

export interface PingSampleInput {
    clientSendTimeMs: number
    leaderReceiveTimeMs: number
    leaderSendTimeMs: number
    clientReceiveTimeMs: number
}

export const DEFAULT_SYNC_SESSION_SAMPLE_WINDOW = 16

export class SyncSession {
    #samples: SyncSample[] = []
    #sampleWindow: number
    #minSamples: number

    constructor(sampleWindow: number = DEFAULT_SYNC_SESSION_SAMPLE_WINDOW, minSamples: number = 4) {
        this.#sampleWindow = Math.max(3, sampleWindow)
        this.#minSamples = Math.max(1, minSamples)
    }

    addSample(input: PingSampleInput): SyncSample {
        const rttMs = (input.clientReceiveTimeMs - input.clientSendTimeMs)
            - (input.leaderSendTimeMs - input.leaderReceiveTimeMs)
        const offsetMs = ((input.leaderReceiveTimeMs - input.clientSendTimeMs)
            + (input.leaderSendTimeMs - input.clientReceiveTimeMs)) / 2

        const sample: SyncSample = {
            offsetMs,
            rttMs: Math.max(0, rttMs),
            receivedAtMs: input.clientReceiveTimeMs
        }

        this.#samples.push(sample)
        if (this.#samples.length > this.#sampleWindow) {
            this.#samples.shift()
        }

        return sample
    }

    clear(): void {
        this.#samples = []
    }

    getEstimate(): SyncEstimate {
        if (this.#samples.length === 0) {
            return {
                offsetMs: 0,
                rttMs: 0,
                jitterMs: 0,
                sampleCount: 0,
                locked: false
            }
        }

        const sortedByRtt = [...this.#samples].sort((a, b) => a.rttMs - b.rttMs)
        const sliceLength = Math.max(1, Math.ceil(sortedByRtt.length / 2))
        const bestSamples = sortedByRtt.slice(0, sliceLength)
        const offsetMs = bestSamples.reduce((sum, sample) => sum + sample.offsetMs, 0) / bestSamples.length
        const rttMs = bestSamples.reduce((sum, sample) => sum + sample.rttMs, 0) / bestSamples.length
        const jitterMs = Math.sqrt(
            bestSamples.reduce((sum, sample) => sum + Math.pow(sample.offsetMs - offsetMs, 2), 0)
            / bestSamples.length
        )

        return {
            offsetMs,
            rttMs,
            jitterMs,
            sampleCount: this.#samples.length,
            locked: this.#samples.length >= this.#minSamples
        }
    }

    leaderToLocalTime(leaderTimeMs: number): number {
        const estimate = this.getEstimate()
        return leaderTimeMs - estimate.offsetMs
    }

    localToLeaderTime(localTimeMs: number): number {
        const estimate = this.getEstimate()
        return localTimeMs + estimate.offsetMs
    }
}

export default SyncSession
