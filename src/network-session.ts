import type Timer from './timer'
import SyncSession from './sync-session'
import { createNetworkAudioScheduler, type NetworkScheduler } from './network-audio-scheduler'
import { DEFAULT_QUANTUM, isNetworkTransport, isQuantum, positionAt, type NetworkTransport } from './network-timeline'

export type TransportChange = Partial<Pick<NetworkTransport, 'playing' | 'bpm' | 'swing' | 'position' | 'quantum'>>

export interface TransportBoundary {
    position: number
    leaderTimeMs: number
    localTimeMs: number
}

export interface NetworkSessionOptions {
    peerId: string
    leaderId: string
    send: (peerId: string, message: unknown) => void
    now?: () => number
    lookaheadMs?: number
    sampleWindow?: number
    minSamples?: number
    pollIntervalMs?: number
    onStateChange?: (state: ReturnType<NetworkSession['getState']>) => void
    onTransport?: (state: NetworkTransport) => void
    scheduler?: NetworkScheduler
    /** Beats per bar used until the transport carries its own; defaults to 4. */
    quantum?: number
    /** Output delay the browser does not report, such as Bluetooth or MIDI hardware. */
    outputLatencyMs?: number
    /** Leader only: decide whether a follower's requestTransport() is applied. Without it, proposals are ignored. */
    acceptProposal?: (peerId: string, change: TransportChange) => boolean
    /** How long playback continues without a measurable leader clock; defaults to 10 s. */
    leaderGraceMs?: number
}

/** Revisions from successive leaders never collide, even when a change was only seen by some peers. */
const LEADER_TERM = 2 ** 20

/** One transport and one audio scheduler per machine, independent of WS/WebRTC routing. */
export class NetworkSession {
    readonly timer: Timer
    readonly options: NetworkSessionOptions
    private scheduler?: NetworkScheduler
    private peers = new Map<string, { clock: SyncSession; pending: Set<number>; lastSeen: number }>()
    private timeline: NetworkTransport[] = []
    private interval?: ReturnType<typeof setInterval>
    private destroyed = false
    private activeRevision = -1
    private sequence = 0
    private now: () => number
    private ready = false
    private starting?: Promise<void>
    private ownsTimer = false
    private leaderId: string
    /**
     * Set while the timeline is in a clock we cannot measure: the leader left,
     * or a new leader's clock has not locked yet. Playback free-runs on the
     * last good offset for up to leaderGraceMs.
     */
    private freeRun?: { offsetMs: number; since: number }
    /** Set by a handover: the new leader's timeline replaces ours once, even where revisions differ. */
    private rebasing = false
    private latencyMs: number
    constructor(timer: Timer, options: NetworkSessionOptions) {
        this.timer = timer
        this.options = options
        this.now = options.now ?? (() => performance.now())
        this.leaderId = options.leaderId
        this.latencyMs = 0
        this.outputLatencyMs = options.outputLatencyMs ?? 0
    }
    get isLeader(): boolean { return this.options.peerId === this.leaderId }
    get currentLeaderId(): string { return this.leaderId }
    get outputLatencyMs(): number { return this.latencyMs }
    set outputLatencyMs(value: number) {
        // Followers need about 300 ms of the lookahead for transit and the worklet's own lead.
        const limit = this.lookahead - 300
        if (!Number.isFinite(value) || value < 0 || value > limit) throw new Error(`Output latency must be between 0 and ${limit} ms`)
        this.latencyMs = value
        this.updateScheduler()
    }
    private get lookahead(): number { return Math.max(500, this.options.lookaheadMs ?? 600) }
    start(): Promise<void> {
        if (this.destroyed) return Promise.reject(new Error('Session has been destroyed'))
        return this.starting ?? (this.starting = this.initialize())
    }
    private async initialize(): Promise<void> {
        const scheduler = this.options.scheduler ?? await createNetworkAudioScheduler(this.timer, state => this.applyTransport(state))
        if (this.destroyed) { scheduler.destroy(); return }
        this.scheduler = scheduler
        await this.timer.loaded
        if (this.destroyed) return
        this.timer.bypass(true)
        this.ownsTimer = true
        await this.timer.startTimer(this.timer.callback, { sync: { mode: 'off' } })
        if (this.destroyed) return
        this.ready = true
        this.interval = setInterval(() => this.poll(), Math.max(100, this.options.pollIntervalMs ?? 250))
        this.updateScheduler()
        this.poll()
    }
    addPeer(id: string): void {
        if (id === this.options.peerId || this.peers.has(id)) return
        this.peers.set(id, { clock: new SyncSession(this.options.sampleWindow, this.options.minSamples), pending: new Set(), lastSeen: this.now() })
        this.poll()
    }
    removePeer(id: string): void {
        const estimate = this.peers.get(id)?.clock.getEstimate(this.now())
        // Only a locked clock is worth free-running on; anything else would play at a wrong offset.
        if (id === this.leaderId && !this.freeRun && estimate?.locked) this.freeRun = { offsetMs: estimate.offsetMs, since: this.now() }
        this.peers.delete(id)
        this.updateScheduler()
        this.emit()
    }
    /**
     * Hand the transport to another peer without stopping playback. Every peer
     * must make the same call; the new leader keeps the timeline, converted to
     * its own clock, and followers adopt its copy.
     */
    setLeader(id: string): void {
        if (this.destroyed || id === this.leaderId) return
        const previous = this.locked() ? this.offset() : undefined
        this.leaderId = id
        this.freeRun = undefined
        this.rebasing = !this.isLeader
        if (previous === undefined) {
            // Nothing trustworthy to carry over: wait for the new leader's timeline.
            if (!this.isLeader) this.timeline = []
        } else if (this.isLeader || this.peers.get(id)?.clock.getEstimate(this.now()).locked) {
            this.shiftTimeline(this.offset() - previous)
        } else {
            this.freeRun = { offsetMs: previous, since: this.now() }
        }
        if (this.isLeader) {
            const seen = Math.max(this.sequence, ...this.timeline.map(state => state.revision))
            this.sequence = (Math.floor(seen / LEADER_TERM) + 1) * LEADER_TERM
            for (const peer of this.peers.keys()) this.sendState(peer)
        }
        this.updateScheduler()
        this.emit()
    }
    private shiftTimeline(shift: number): void {
        this.timeline = this.timeline.map(state => ({ ...state, timestamp: state.timestamp + shift }))
    }
    /** The leader's clock became measurable again: move the timeline onto it and stop free-running. */
    private resumeFromFreeRun(): void {
        const estimate = this.peers.get(this.leaderId)?.clock.getEstimate(this.now())
        if (!this.freeRun || !estimate?.locked) return
        this.shiftTimeline(estimate.offsetMs - this.freeRun.offsetMs)
        this.freeRun = undefined
    }
    private send(id: string, data: object): void {
        if (!this.destroyed) this.options.send(id, { protocol: 'netronome/1', ...data })
    }
    private current(at = this.now()): NetworkTransport | undefined {
        const leaderTime = at + this.offset()
        const states = this.timeline.filter(state => state.timestamp <= leaderTime)
        return states[states.length - 1]
    }
    private offset(): number {
        if (this.isLeader) return 0
        if (this.freeRun) return this.freeRun.offsetMs
        return this.peers.get(this.leaderId)?.clock.getEstimate(this.now()).offsetMs ?? 0
    }
    private locked(): boolean {
        if (this.isLeader) return true
        if (this.freeRun) return this.now() - this.freeRun.since <= (this.options.leaderGraceMs ?? 10000)
        return Boolean(this.peers.get(this.leaderId)?.clock.getEstimate(this.now()).locked)
    }
    /** Convert a time on the leader's clock to this machine's clock. */
    toLocalTime(leaderTimeMs: number): number {
        if (this.isLeader) return leaderTimeMs
        const leader = this.peers.get(this.leaderId)
        return leader && !this.freeRun ? leader.clock.leaderToLocalTime(leaderTimeMs) : leaderTimeMs - this.offset()
    }
    /** Convert a time on this machine's clock to the leader's clock. */
    toLeaderTime(localTimeMs: number): number {
        if (this.isLeader) return localTimeMs
        const leader = this.peers.get(this.leaderId)
        return leader && !this.freeRun ? leader.clock.localToLeaderTime(localTimeMs) : localTimeMs + this.offset()
    }
    /**
     * The first bar line (a multiple of quantum beats) at least minLeadMs
     * away. Stamp a cue with it and every peer applies the cue together.
     * While stopped, the boundary is simply minLeadMs from now.
     */
    nextBoundary(quantum?: number, minLeadMs: number = this.lookahead): TransportBoundary {
        if (quantum !== undefined && !isQuantum(quantum)) throw new Error('Quantum must be between 0 and 64 beats')
        const { position, timestamp } = this.boundaryAfter(this.now() + this.offset() + Math.max(0, minLeadMs), quantum)
        return { position, leaderTimeMs: timestamp, localTimeMs: this.toLocalTime(timestamp) }
    }
    private boundaryAfter(leaderTimeMs: number, quantum?: number): { position: number; timestamp: number } {
        let index = this.timeline.reduce((found, state, at) => state.timestamp <= leaderTimeMs ? at : found, 0)
        let from = leaderTimeMs
        while (true) {
            const state = this.timeline[index]
            if (!state) return { position: 0, timestamp: from }
            if (!state.playing) return { position: positionAt(state, from), timestamp: from }
            const beats = quantum ?? state.quantum ?? this.options.quantum ?? DEFAULT_QUANTUM
            // Tolerate float error so a time already on the line does not skip a bar.
            const position = Math.ceil(positionAt(state, from) / beats - 1e-9) * beats
            const timestamp = state.timestamp + (position - state.position) * 60000 / state.bpm
            const next = this.timeline[index + 1]
            if (!next || next.timestamp > timestamp) return { position, timestamp }
            // A change lands before this bar line, so measure from the change instead.
            index++
            from = next.timestamp
        }
    }
    private applyTransport(state: NetworkTransport): void {
        if (this.activeRevision >= state.revision) return
        this.activeRevision = state.revision
        this.timer.BPM = state.bpm
        this.timer.swing = state.swing
        this.timer.divisions = state.divisions
        this.timer.bars = state.bars
        this.options.onTransport?.(state)
    }
    private updateScheduler(): void {
        if (!this.ready) return
        const estimate = this.peers.get(this.leaderId)?.clock.getEstimate(this.now())
        this.timer.networkSync = {
            mode: this.isLeader ? 'network-leader' : 'network-follower',
            status: this.locked() ? 'locked' : 'probing',
            clockOffsetMs: this.offset(), clockJitterMs: estimate?.jitterMs ?? 0,
            transportRevision: this.current()?.revision, leaderTimeMs: this.now() + this.offset()
        }
        if (!this.locked()) { this.scheduler?.clear(); return }
        this.scheduler?.setTimeline(this.timeline, this.offset(), this.latencyMs)
        const state = this.current()
        if (state) this.applyTransport(state)
    }
    private poll(): void {
        if (this.destroyed) return
        const now = this.now()
        for (const [id, peer] of this.peers) {
            // Bound unanswered probes during disconnection.
            for (const stamp of peer.pending) if (now - stamp > 5000) peer.pending.delete(stamp)
            peer.pending.add(now)
            this.send(id, { type: 'ping', timestamp: now })
            this.sendState(id)
        }
        this.updateScheduler()
        this.emit()
    }
    private sendState(id: string): void {
        const state = this.current()
        this.send(id, { type: 'state', leaderId: this.leaderId,
            timestamp: this.now(), playing: state?.playing ?? false,
            position: state ? positionAt(state, this.now() + this.offset()) : 0,
            bpm: state?.bpm ?? this.timer.BPM, swing: state?.swing ?? this.timer.swing,
            timeline: this.isLeader ? this.timeline : [], locked: this.locked() })
    }
    receive(id: string, message: any): void {
        if (this.destroyed || !message || message.protocol !== 'netronome/1') return
        const peer = this.peers.get(id)
        if (!peer) return
        const now = this.now()
        if (message.type === 'ping' && Number.isFinite(message.timestamp)) {
            this.send(id, { type: 'pong', timestamp: message.timestamp, received: now, sent: this.now() })
        } else if (message.type === 'pong' && peer.pending.delete(message.timestamp)
            && Number.isFinite(message.received) && Number.isFinite(message.sent)) {
            try {
                peer.clock.addSample({ clientSendTimeMs: message.timestamp, clientReceiveTimeMs: now,
                    leaderReceiveTimeMs: message.received, leaderSendTimeMs: message.sent })
            } catch { return }
            peer.lastSeen = now
            if (id === this.leaderId) this.resumeFromFreeRun()
            this.updateScheduler()
        } else if (message.type === 'state' && !this.isLeader && !this.freeRun && id === this.leaderId
            && message.leaderId === id && Array.isArray(message.timeline)
            && message.timeline.length > 0 && message.timeline.length <= 2
            && message.timeline.every(isNetworkTransport)) {
            const incoming: NetworkTransport[] = message.timeline
            if (incoming.some((state, index) => index > 0 && (state.revision <= incoming[index - 1].revision
                || state.timestamp < incoming[index - 1].timestamp))) return
            if (!this.rebasing) {
                if (incoming[incoming.length - 1].revision < (this.timeline[this.timeline.length - 1]?.revision ?? -1)) return
                // A revision is immutable: heartbeats may refresh estimates, never rewrite history.
                for (const state of incoming) {
                    const existing = this.timeline.find(item => item.revision === state.revision)
                    if (existing && JSON.stringify(existing) !== JSON.stringify(state)) return
                }
            }
            if (this.rebasing) this.activeRevision = -1
            this.rebasing = false
            this.timeline = incoming
            peer.lastSeen = now
            this.updateScheduler()
        } else if (message.type === 'propose' && this.isLeader && this.ready) {
            const change = readTransportChange(message.change)
            if (change && this.options.acceptProposal?.(id, change)) {
                try { this.setTransport(change) } catch { /* Invalid or ill-timed proposals are dropped. */ }
            }
        }
        this.emit()
    }
    /** Ask the leader to change the transport; the leader applies it directly. */
    requestTransport(change: TransportChange): void {
        if (this.isLeader) {
            this.setTransport(change)
            return
        }
        const valid = readTransportChange(change)
        if (!valid) throw new Error('Invalid transport change')
        this.send(this.leaderId, { type: 'propose', change: valid })
    }
    /** Coalesce edits onto the same future bar; preserve position under tempo changes. */
    setTransport(change: TransportChange, effectiveTimeMs?: number): NetworkTransport {
        if (!this.isLeader) throw new Error('Only the host can change shared transport')
        if (this.destroyed || !this.ready) throw new Error('Session is not ready')
        const now = this.now()
        const current = this.current()
        const pending = this.timeline.find(state => state.timestamp > now)
        const base = pending ?? current
        let { timestamp, position } = pending ?? this.boundaryAfter(now + this.lookahead)
        if (effectiveTimeMs !== undefined) {
            if (!Number.isFinite(effectiveTimeMs) || effectiveTimeMs < now + 200) throw new Error('Transport changes need at least 200 ms of scheduling headroom')
            timestamp = effectiveTimeMs
            position = current ? positionAt(current, timestamp) : 0
        }
        const state: NetworkTransport = { revision: ++this.sequence, playing: base?.playing ?? false,
            timestamp, position, bpm: base?.bpm ?? this.timer.BPM, swing: base?.swing ?? this.timer.swing,
            divisions: this.timer.divisions, bars: this.timer.bars,
            quantum: base?.quantum ?? this.options.quantum ?? DEFAULT_QUANTUM, ...change }
        if (!isNetworkTransport(state)) throw new Error('Invalid shared transport')
        this.timeline = current ? [current, state] : [state]
        this.updateScheduler()
        for (const id of this.peers.keys()) this.sendState(id)
        this.emit()
        return state
    }
    getState() {
        const state = this.current()
        const locked = this.locked()
        return { role: this.isLeader ? 'leader' : 'follower', ready: this.ready,
            status: !this.isLeader && !this.peers.has(this.leaderId) ? 'disconnected'
                : !locked ? 'synchronizing' : this.timeline.some(s => s.timestamp > this.now() + this.offset()) ? 'armed' : 'locked',
            playing: state?.playing ?? false, position: state ? positionAt(state, this.now() + this.offset()) : 0,
            bpm: state?.bpm ?? this.timer.BPM, swing: state?.swing ?? this.timer.swing,
            quantum: state?.quantum ?? this.options.quantum ?? DEFAULT_QUANTUM,
            peers: [...this.peers].map(([id, peer]) => ({ id, ...peer.clock.getEstimate(this.now()) })) }
    }
    private emit(): void { this.options.onStateChange?.(this.getState()) }
    async destroy(): Promise<void> {
        this.destroyed = true
        clearInterval(this.interval)
        this.scheduler?.destroy()
        try { await this.starting } catch { /* Failed initialization still releases timer ownership. */ }
        this.peers.clear()
        this.freeRun = undefined
        this.timeline = []
        if (this.ownsTimer) {
            await this.timer.stopTimer()
            this.timer.isRunning = false
            this.timer.networkSync = undefined
            this.timer.bypass(false)
            this.ownsTimer = false
        }
        this.ready = false
    }
}

/** Keep only well-typed transport fields; setTransport validates the resulting state. */
function readTransportChange(value: any): TransportChange | undefined {
    if (!value || typeof value !== 'object') return undefined
    const change: TransportChange = {}
    if (typeof value.playing === 'boolean') change.playing = value.playing
    for (const key of ['bpm', 'swing', 'position', 'quantum'] as const) {
        if (Number.isFinite(value[key])) change[key] = value[key]
    }
    return Object.keys(change).length ? change : undefined
}
