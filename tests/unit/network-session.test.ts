import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NetworkSession } from '../../src/network-session'
import { networkTickTime, positionAt } from '../../src/network-timeline'
import SyncSession from '../../src/sync-session'
import Timer from '../../src/timer'

const timer = () => ({ loaded: Promise.resolve(), BPM: 120, swing: 0, divisions: 24, bars: 16,
    bypass: vi.fn(), startTimer: vi.fn(async () => {}), stopTimer: vi.fn(async () => {}) }) as any
const scheduler = () => ({ setTimeline: vi.fn(), clear: vi.fn(), destroy: vi.fn() })

describe('network musical transport', () => {
    const sessions: NetworkSession[] = []
    beforeEach(() => vi.useFakeTimers())
    afterEach(async () => { for (const session of sessions.splice(0)) await session.destroy(); vi.useRealTimers() })
    const create = async (options: any = {}) => {
        const session = new NetworkSession(timer(), { peerId: 'host', leaderId: 'host', send: vi.fn(),
            scheduler: scheduler(), now: () => Date.now(), ...options })
        sessions.push(session); await session.start(); return session
    }
    it('preserves beat position and delays a tempo edit until its effective boundary', async () => {
        vi.setSystemTime(0)
        const host = await create()
        const initial = host.setTransport({ playing: true, position: 0 })
        vi.setSystemTime(initial.timestamp + 250)
        const edited = host.setTransport({ bpm: 90, swing: 0.4 })
        expect(edited.position % 4).toBe(0)
        expect(positionAt(initial, edited.timestamp)).toBeCloseTo(edited.position)
        expect(host.timer.BPM).toBe(120)
        vi.setSystemTime(edited.timestamp)
        await vi.advanceTimersByTimeAsync(250)
        expect(host.timer.BPM).toBe(90)
        expect(host.timer.swing).toBe(0.4)
    })
    it('cancels a pending start by replacing it with a stopped transport', async () => {
        vi.setSystemTime(0)
        const output = scheduler()
        const host = await create({ scheduler: output })
        const start = host.setTransport({ playing: true })
        const stop = host.setTransport({ playing: false })
        expect(stop.timestamp).toBe(start.timestamp)
        expect(output.setTimeline.mock.lastCall?.[0]).toEqual([stop])
        await vi.advanceTimersByTimeAsync(2000)
        expect(host.getState().playing).toBe(false)
        expect(host.timer.startTimer).toHaveBeenCalledTimes(1)
    })
    it('synchronizes two followers with different clock origins and supports late joining', async () => {
        vi.setSystemTime(1000)
        const clients = new Map<string, NetworkSession>()
        const send = (from: string) => (to: string, message: unknown) => clients.get(to)?.receive(from, message)
        const host = await create({ send: send('host') }); clients.set('host', host)
        host.setTransport({ playing: true })
        await vi.advanceTimersByTimeAsync(2000)
        for (const [id, offset] of [['a', 10000], ['b', -5000]] as const) {
            const output = scheduler()
            const follower = await create({ peerId: id, send: send(id), now: () => Date.now() + offset, scheduler: output })
            clients.set(id, follower)
            follower.addPeer('host'); host.addPeer(id)
            await vi.advanceTimersByTimeAsync(1500)
            expect(follower.getState().status).toBe('locked')
            expect(follower.getState().playing).toBe(true)
            expect(follower.getState().position).toBeCloseTo(host.getState().position)
            expect(output.setTimeline.mock.lastCall?.[1]).toBeCloseTo(-offset)
            expect(() => follower.setTransport({ bpm: 60 })).toThrow('Only the host')
        }
    })
    it('rejects transport injection and stale revisions', async () => {
        const follower = await create({ peerId: 'follower' })
        follower.addPeer('host'); follower.addPeer('other')
        const message = { protocol: 'netronome/1', type: 'state', leaderId: 'host', timeline: [
            { revision: 3, playing: true, timestamp: 0, position: 0, bpm: 120, swing: 0, divisions: 24, bars: 16 }
        ] }
        follower.receive('other', message)
        expect(follower.getState().playing).toBe(false)
        follower.receive('host', message)
        follower.receive('host', { ...message, timeline: [{ ...message.timeline[0], revision: 2, bpm: 70 }] })
        expect(follower.getState().bpm).toBe(120)
        follower.receive('host', { ...message, timeline: [{ ...message.timeline[0], bpm: 80 }] })
        expect(follower.getState().bpm).toBe(120)
    })
    it('does not report a noisy or stale clock as locked', () => {
        const clock = new SyncSession()
        for (let i = 0; i < 4; i++) clock.addSample({ clientSendTimeMs: 0,
            clientReceiveTimeMs: 1000, leaderReceiveTimeMs: i * 100, leaderSendTimeMs: i * 100 })
        expect(clock.getEstimate().locked).toBe(false)
        clock.clear()
        for (let i = 0; i < 4; i++) clock.addSample({ clientSendTimeMs: 0,
            clientReceiveTimeMs: 10, leaderReceiveTimeMs: 5, leaderSendTimeMs: 5 })
        expect(clock.getEstimate(10).locked).toBe(true)
        expect(clock.getEstimate(4000).locked).toBe(false)
    })
    it('keeps swing on the same absolute subdivision grid', () => {
        const state = { revision: 1, playing: true, timestamp: 1000, position: 0, bpm: 120, swing: 0.5, divisions: 24, bars: 16 }
        expect(networkTickTime(state, 1)).toBeCloseTo(1031.25)
        expect(networkTickTime(state, 2)).toBeCloseTo(1041.6666667)
    })
    it('ignores local worker ticks while an external clock owns the transport', async () => {
        const clock = new Timer({ bpm: 120 }, false)
        await clock.loaded
        clock.isRunning = true
        clock.isBypassed = true
        clock.callback = vi.fn()
        clock.createTick(24, 0.5)
        expect(clock.callback).not.toHaveBeenCalled()
        clock.networkTick(96, { scheduledContextTimeSeconds: 2 })
        expect(clock.callback).toHaveBeenCalledTimes(1)
        expect(clock.totalBarsElapsed).toBe(4)
        expect(clock.divisionsElapsed).toBe(0)
    })
})
