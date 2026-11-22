import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NetworkSession } from '../../src/network-session'

const timer = () => ({ loaded: Promise.resolve(), BPM: 120, swing: 0, divisions: 24, bars: 16,
    bypass: vi.fn(), startTimer: vi.fn(async () => {}), stopTimer: vi.fn(async () => {}) }) as any
const scheduler = () => ({ setTimeline: vi.fn(), clear: vi.fn(), destroy: vi.fn() })

describe('network transport roles and cues', () => {
    const sessions: NetworkSession[] = []
    beforeEach(() => vi.useFakeTimers())
    afterEach(async () => { for (const session of sessions.splice(0)) await session.destroy(); vi.useRealTimers() })
    /** Peers with their clocks offset by the given milliseconds, fully meshed and locked. */
    const room = async (offsets: Record<string, number>, options: any = {}) => {
        vi.setSystemTime(1000)
        const clients = new Map<string, NetworkSession>()
        const outputs = new Map<string, ReturnType<typeof scheduler>>()
        for (const [id, offset] of Object.entries(offsets)) {
            const output = scheduler()
            const session = new NetworkSession(timer(), { peerId: id, leaderId: 'host', scheduler: output,
                now: () => Date.now() + offset, send: (to, message) => clients.get(to)?.receive(id, message), ...options })
            sessions.push(session); clients.set(id, session); outputs.set(id, output)
            await session.start()
        }
        for (const a of clients.keys()) for (const b of clients.keys()) clients.get(a)!.addPeer(b)
        await vi.advanceTimersByTimeAsync(1500)
        return { clients, outputs }
    }

    it('lands transport changes on the configured quantum', async () => {
        const { clients } = await room({ host: 0 }, { quantum: 3 })
        const host = clients.get('host')!
        const start = host.setTransport({ playing: true, position: 0 })
        expect(start.quantum).toBe(3)
        vi.setSystemTime(start.timestamp + 700)
        expect(host.setTransport({ bpm: 100 }).position).toBe(3)
        vi.setSystemTime(start.timestamp + 5000)
        const longer = host.setTransport({ quantum: 7 })
        expect(longer.position % 3).toBe(0)
        expect(host.getState().quantum).toBe(3)
    })

    it('gives every peer the same bar line for a cue, in its own clock', async () => {
        const { clients } = await room({ host: 0, a: 10000 })
        const host = clients.get('host')!, a = clients.get('a')!
        const start = host.setTransport({ playing: true, position: 0 })
        await vi.advanceTimersByTimeAsync(start.timestamp - Date.now() + 1300)
        const fromHost = host.nextBoundary()
        const fromFollower = a.nextBoundary()
        expect(fromHost.position % 4).toBe(0)
        expect(fromHost.leaderTimeMs - Date.now()).toBeGreaterThanOrEqual(600)
        expect(fromFollower.position).toBe(fromHost.position)
        expect(fromFollower.localTimeMs - fromHost.localTimeMs).toBeCloseTo(10000, 0)
        expect(host.nextBoundary(1, 0).position).toBe(Math.ceil(host.getState().position))
        expect(() => host.nextBoundary(0)).toThrow('Quantum')
    })

    it('applies follower proposals only when the leader accepts them', async () => {
        const acceptProposal = vi.fn((peer: string) => peer === 'a')
        const { clients } = await room({ host: 0, a: 500, b: -500 }, { acceptProposal })
        clients.get('b')!.requestTransport({ bpm: 90 })
        expect(clients.get('host')!.getState().bpm).toBe(120)
        clients.get('a')!.requestTransport({ bpm: 90, swing: 'loose' } as any)
        expect(acceptProposal).toHaveBeenLastCalledWith('a', { bpm: 90 })
        await vi.advanceTimersByTimeAsync(1000)
        for (const session of clients.values()) expect(session.getState().bpm).toBe(90)
    })

    it('keeps playing through a leader handover without restarting the clock', async () => {
        const { clients, outputs } = await room({ host: 0, a: 7000, b: -3000 })
        const host = clients.get('host')!, a = clients.get('a')!, b = clients.get('b')!
        host.setTransport({ playing: true, position: 0 })
        await vi.advanceTimersByTimeAsync(3000)
        const before = b.getState().position
        outputs.get('b')!.clear.mockClear()
        for (const session of [a, b]) session.removePeer('host')
        clients.delete('host')
        expect(b.getState().playing).toBe(true)
        expect(outputs.get('b')!.clear).not.toHaveBeenCalled()
        for (const session of [a, b]) session.setLeader('a')
        await vi.advanceTimersByTimeAsync(500)
        expect(a.isLeader).toBe(true)
        expect(b.getState().status).toBe('locked')
        expect(b.getState().position).toBeCloseTo(a.getState().position, 1)
        expect(b.getState().position).toBeGreaterThan(before)
        const edit = a.setTransport({ bpm: 100 })
        await vi.advanceTimersByTimeAsync(edit.timestamp - (Date.now() + 7000) + 300)
        expect(b.getState().bpm).toBe(100)
        expect(b.timer.startTimer).toHaveBeenCalledTimes(1)
    })

    it('free-runs only on a locked clock, and only for the grace period', async () => {
        const { clients, outputs } = await room({ host: 0, a: 4000 }, { leaderGraceMs: 2000 })
        const a = clients.get('a')!
        clients.get('host')!.setTransport({ playing: true })
        await vi.advanceTimersByTimeAsync(1000)
        outputs.get('a')!.clear.mockClear()
        a.removePeer('host')
        expect(outputs.get('a')!.clear).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(2500)
        expect(outputs.get('a')!.clear).toHaveBeenCalled()

        const lonely = new NetworkSession(timer(), { peerId: 'b', leaderId: 'host', scheduler: scheduler(), send: vi.fn() })
        sessions.push(lonely)
        await lonely.start()
        lonely.addPeer('host')
        lonely.removePeer('host')
        expect(lonely.getState().status).toBe('disconnected')
        expect(lonely.toLeaderTime(500)).toBe(500)
    })

    it('adopts the new leader even when a follower saw a revision the new leader missed', async () => {
        const { clients } = await room({ host: 0, a: 2000, b: -1000 })
        const host = clients.get('host')!, a = clients.get('a')!, b = clients.get('b')!
        host.setTransport({ playing: true, position: 0 })
        await vi.advanceTimersByTimeAsync(2000)
        // Only b hears the stop before the host disappears.
        clients.delete('a')
        host.setTransport({ playing: false })
        clients.set('a', a)
        for (const session of [a, b]) session.removePeer('host')
        clients.delete('host')
        for (const session of [a, b]) session.setLeader('a')
        await vi.advanceTimersByTimeAsync(2000)
        expect(a.getState().playing).toBe(true)
        expect(b.getState().playing).toBe(true)
        const edit = a.setTransport({ bpm: 80 })
        expect(edit.revision).toBeGreaterThan(2 ** 20)
        await vi.advanceTimersByTimeAsync(edit.timestamp - (Date.now() + 2000) + 300)
        expect(b.getState().bpm).toBe(80)
        expect(b.timer.BPM).toBe(80)
    })

    it('plays early by the configured output latency', async () => {
        const { clients, outputs } = await room({ host: 0 }, { outputLatencyMs: 40 })
        const host = clients.get('host')!
        host.setTransport({ playing: true })
        expect(outputs.get('host')!.setTimeline.mock.lastCall?.[2]).toBe(40)
        host.outputLatencyMs = 15
        expect(outputs.get('host')!.setTimeline.mock.lastCall?.[2]).toBe(15)
        expect(() => { host.outputLatencyMs = -1 }).toThrow('Output latency')
        expect(() => { host.outputLatencyMs = 301 }).toThrow('between 0 and 300')
    })
})
