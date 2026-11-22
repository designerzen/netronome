import { describe, expect, it } from 'vitest'
import SyncSession from '../../src/sync-session'

/** A leader clock running `ppm` fast with a `base` offset, seen through `rtt` ms round trips. */
const ping = (clock: SyncSession, at: number, base: number, ppm: number, rtt = 10, asymmetry = 0) => {
    const offset = base + at * ppm / 1e6
    clock.addSample({ clientSendTimeMs: at, clientReceiveTimeMs: at + rtt,
        leaderReceiveTimeMs: at + rtt / 2 + asymmetry + offset, leaderSendTimeMs: at + rtt / 2 + asymmetry + offset })
}

describe('SyncSession drift', () => {
    it('measures crystal drift and extrapolates the offset between pings', () => {
        const clock = new SyncSession()
        // Alternate small asymmetries to stand in for network noise.
        for (let at = 0; at <= 60000; at += 250) ping(clock, at, 100, 80, 10, at % 500 ? 1.5 : -1.5)
        const estimate = clock.getEstimate(70000)
        expect(estimate.driftPpm).toBeCloseTo(80, -1)
        expect(estimate.offsetMs).toBeCloseTo(100 + 70000 * 80e-6, 0)
        expect(estimate.locked).toBe(false)
        expect(clock.getEstimate(61000).locked).toBe(true)
        expect(clock.leaderToLocalTime(clock.localToLeaderTime(65000))).toBeCloseTo(65000, 4)
    })

    it('keeps drift at zero until the samples span long enough to separate it from noise', () => {
        const clock = new SyncSession()
        for (let at = 0; at <= 2000; at += 250) ping(clock, at, 50, 0, 10, at % 500 ? 2 : -2)
        expect(clock.getEstimate().driftPpm).toBe(0)
        expect(clock.getEstimate().offsetMs).toBeCloseTo(50, 0)
    })

    it('ignores a single outlier but follows a confirmed clock step', () => {
        const clock = new SyncSession()
        for (let at = 0; at < 5000; at += 250) ping(clock, at, 0, 0)
        ping(clock, 5000, 200, 0)
        expect(clock.getEstimate().offsetMs).toBeCloseTo(0, 6)
        ping(clock, 5250, 0, 0)
        for (let at = 5500; at < 6250; at += 250) ping(clock, at, 200, 0)
        expect(clock.getEstimate().offsetMs).toBeCloseTo(200, 6)
        expect(clock.getEstimate().sampleCount).toBe(3)
    })
})
