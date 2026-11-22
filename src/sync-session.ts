export interface SyncSample {
    offsetMs: number
    rttMs: number
    receivedAtMs: number
}

export interface SyncEstimate {
    offsetMs: number
    rttMs: number
    jitterMs: number
    /** Leader clock rate relative to ours, in parts per million. */
    driftPpm: number
    sampleCount: number
    locked: boolean
}

export interface PingSampleInput {
    clientSendTimeMs: number
    leaderReceiveTimeMs: number
    leaderSendTimeMs: number
    clientReceiveTimeMs: number
}

interface ClockFit {
    centreTimeMs: number
    centreOffsetMs: number
    slope: number
    rttMs: number
    jitterMs: number
}

/** About one minute of history at the default 250 ms ping interval. */
export const DEFAULT_SYNC_SESSION_SAMPLE_WINDOW = 240
/** Shorter spans cannot separate crystal drift from network noise. */
const MIN_DRIFT_SPAN_MS = 10000
/** Real oscillators stay within a few hundred ppm; anything larger is noise. */
const MAX_DRIFT = 500e-6
const STEP_THRESHOLD_MS = 20
const STEP_CONFIRMATIONS = 3

/**
 * Estimates a leader clock as a line (offset plus drift) through the
 * fastest round trips, so the estimate stays accurate between pings and a
 * long window averages out network noise without lagging behind drift.
 */
export class SyncSession {
    #samples: SyncSample[] = []
    #suspects: SyncSample[] = []
    #sampleWindow: number
    #minSamples: number
    #fit?: ClockFit

    constructor(sampleWindow: number = DEFAULT_SYNC_SESSION_SAMPLE_WINDOW, minSamples: number = 4) {
        this.#sampleWindow = Math.max(3, sampleWindow)
        this.#minSamples = Math.max(1, minSamples)
    }

    addSample(input: PingSampleInput): SyncSample {
        if (!Object.values(input).every(Number.isFinite)
            || input.clientReceiveTimeMs < input.clientSendTimeMs
            || input.leaderSendTimeMs < input.leaderReceiveTimeMs) {
            throw new Error('Invalid clock sample')
        }
        const rttMs = (input.clientReceiveTimeMs - input.clientSendTimeMs)
            - (input.leaderSendTimeMs - input.leaderReceiveTimeMs)
        const offsetMs = ((input.leaderReceiveTimeMs - input.clientSendTimeMs)
            + (input.leaderSendTimeMs - input.clientReceiveTimeMs)) / 2

        const sample: SyncSample = {
            offsetMs,
            rttMs: Math.max(0, rttMs),
            receivedAtMs: input.clientReceiveTimeMs
        }

        // A sample's offset error is bounded by half its round trip, so only
        // repeated deviations beyond that mean the leader's clock jumped.
        const fit = this.#samples.length >= this.#minSamples ? this.#getFit() : undefined
        const deviation = fit ? Math.abs(offsetMs - this.#offsetAt(fit, sample.receivedAtMs)) : 0
        if (fit && deviation > Math.max(STEP_THRESHOLD_MS, fit.jitterMs * 4) + sample.rttMs / 2) {
            this.#suspects.push(sample)
            if (this.#suspects.length < STEP_CONFIRMATIONS) return sample
            this.#samples = this.#suspects
            this.#suspects = []
        } else {
            this.#suspects = []
            this.#samples.push(sample)
            if (this.#samples.length > this.#sampleWindow) {
                this.#samples.shift()
            }
        }
        this.#fit = undefined

        return sample
    }

    clear(): void {
        this.#samples = []
        this.#suspects = []
        this.#fit = undefined
    }

    getEstimate(nowMs?: number): SyncEstimate {
        if (this.#samples.length === 0) {
            return {
                offsetMs: 0,
                rttMs: 0,
                jitterMs: 0,
                driftPpm: 0,
                sampleCount: 0,
                locked: false
            }
        }

        const fit = this.#getFit()
        const latest = this.#samples[this.#samples.length - 1].receivedAtMs
        return {
            offsetMs: this.#offsetAt(fit, nowMs ?? latest),
            rttMs: fit.rttMs,
            jitterMs: fit.jitterMs,
            driftPpm: fit.slope * 1e6,
            sampleCount: this.#samples.length,
            locked: this.#samples.length >= this.#minSamples && fit.jitterMs <= 10 && fit.rttMs <= 250
                && (nowMs === undefined || nowMs - latest <= 3000)
        }
    }

    leaderToLocalTime(leaderTimeMs: number): number {
        if (this.#samples.length === 0) return leaderTimeMs
        const fit = this.#getFit()
        // The offset is a function of local time, so refine the first guess once.
        const guess = leaderTimeMs - this.#offsetAt(fit, leaderTimeMs)
        return leaderTimeMs - this.#offsetAt(fit, guess)
    }

    localToLeaderTime(localTimeMs: number): number {
        if (this.#samples.length === 0) return localTimeMs
        return localTimeMs + this.#offsetAt(this.#getFit(), localTimeMs)
    }

    #offsetAt(fit: ClockFit, localTimeMs: number): number {
        return fit.centreOffsetMs + fit.slope * (localTimeMs - fit.centreTimeMs)
    }

    #getFit(): ClockFit {
        if (this.#fit) return this.#fit
        // Fast round trips are the least affected by queueing, so fit only those.
        const sortedByRtt = [...this.#samples].sort((a, b) => a.rttMs - b.rttMs)
        const best = sortedByRtt.slice(0, Math.max(1, Math.ceil(sortedByRtt.length / 2)))
        const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
        const centreTimeMs = mean(best.map(sample => sample.receivedAtMs))
        const centreOffsetMs = mean(best.map(sample => sample.offsetMs))
        const times = best.map(sample => sample.receivedAtMs)
        let slope = 0
        if (best.length >= 8 && Math.max(...times) - Math.min(...times) >= MIN_DRIFT_SPAN_MS) {
            const spread = best.reduce((sum, sample) => sum + (sample.receivedAtMs - centreTimeMs) ** 2, 0)
            const covariance = best.reduce((sum, sample) =>
                sum + (sample.receivedAtMs - centreTimeMs) * (sample.offsetMs - centreOffsetMs), 0)
            slope = Math.min(MAX_DRIFT, Math.max(-MAX_DRIFT, covariance / spread))
        }
        const line = { centreTimeMs, centreOffsetMs, slope, rttMs: 0, jitterMs: 0 }
        line.rttMs = mean(best.map(sample => sample.rttMs))
        line.jitterMs = Math.sqrt(mean(best.map(sample => (sample.offsetMs - this.#offsetAt(line, sample.receivedAtMs)) ** 2)))
        this.#fit = line
        return line
    }
}

export default SyncSession
