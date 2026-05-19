import { describe, expect, it } from 'vitest'
import SyncSession from '../../src/sync-session'

describe('SyncSession', () => {
    it('should estimate offset and RTT from ping/pong samples', () => {
        const session = new SyncSession(8, 2)

        session.addSample({
            clientSendTimeMs: 100,
            leaderReceiveTimeMs: 112,
            leaderSendTimeMs: 113,
            clientReceiveTimeMs: 125
        })

        session.addSample({
            clientSendTimeMs: 200,
            leaderReceiveTimeMs: 212,
            leaderSendTimeMs: 213,
            clientReceiveTimeMs: 225
        })

        const estimate = session.getEstimate()

        expect(estimate.offsetMs).toBeCloseTo(0, 5)
        expect(estimate.rttMs).toBeCloseTo(24, 5)
        expect(estimate.locked).toBe(true)
    })

    it('should translate between local and leader time using the current estimate', () => {
        const session = new SyncSession(8, 1)

        session.addSample({
            clientSendTimeMs: 1000,
            leaderReceiveTimeMs: 1060,
            leaderSendTimeMs: 1060,
            clientReceiveTimeMs: 1020
        })

        expect(session.localToLeaderTime(2000)).toBeCloseTo(2050, 5)
        expect(session.leaderToLocalTime(2050)).toBeCloseTo(2000, 5)
    })

    it('should favor lower RTT samples when estimating offset', () => {
        const session = new SyncSession(8, 2)

        session.addSample({
            clientSendTimeMs: 0,
            leaderReceiveTimeMs: 15,
            leaderSendTimeMs: 15,
            clientReceiveTimeMs: 10
        })

        session.addSample({
            clientSendTimeMs: 100,
            leaderReceiveTimeMs: 170,
            leaderSendTimeMs: 170,
            clientReceiveTimeMs: 240
        })

        session.addSample({
            clientSendTimeMs: 200,
            leaderReceiveTimeMs: 215,
            leaderSendTimeMs: 215,
            clientReceiveTimeMs: 210
        })

        const estimate = session.getEstimate()

        expect(estimate.offsetMs).toBeCloseTo(10, 5)
        expect(estimate.jitterMs).toBeLessThan(20)
    })
})
