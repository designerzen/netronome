import type Timer from './timer'
import SyncSession from './sync-session'
import { createNetworkAudioScheduler, type NetworkScheduler } from './network-audio-scheduler'
import { isNetworkTransport, positionAt, type NetworkTransport } from './network-timeline'

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
}

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
    constructor(timer: Timer, options: NetworkSessionOptions) {
        this.timer = timer
        this.options = options
        this.now = options.now ?? (() => performance.now())
    }
    get isLeader(): boolean { return this.options.peerId === this.options.leaderId }
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
        this.peers.delete(id)
        if (id === this.options.leaderId) this.scheduler?.clear()
        this.emit()
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
        return this.isLeader ? 0 : this.peers.get(this.options.leaderId)?.clock.getEstimate(this.now()).offsetMs ?? 0
    }
    private locked(): boolean {
        return this.isLeader || Boolean(this.peers.get(this.options.leaderId)?.clock.getEstimate(this.now()).locked)
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
        const estimate = this.peers.get(this.options.leaderId)?.clock.getEstimate(this.now())
        this.timer.networkSync = {
            mode: this.isLeader ? 'network-leader' : 'network-follower',
            status: this.locked() ? 'locked' : 'probing',
            clockOffsetMs: this.offset(), clockJitterMs: estimate?.jitterMs ?? 0,
            transportRevision: this.current()?.revision, leaderTimeMs: this.now() + this.offset()
        }
        if (!this.locked()) { this.scheduler?.clear(); return }
        this.scheduler?.setTimeline(this.timeline, this.offset())
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
        this.send(id, { type: 'state', leaderId: this.options.leaderId,
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
            this.updateScheduler()
        } else if (message.type === 'state' && !this.isLeader && id === this.options.leaderId
            && message.leaderId === id && Array.isArray(message.timeline)
            && message.timeline.length > 0 && message.timeline.length <= 2
            && message.timeline.every(isNetworkTransport)) {
            const incoming: NetworkTransport[] = message.timeline
            if (incoming.some((state, index) => index > 0 && (state.revision <= incoming[index - 1].revision
                || state.timestamp < incoming[index - 1].timestamp))) return
            if (incoming[incoming.length - 1].revision < (this.timeline[this.timeline.length - 1]?.revision ?? -1)) return
            // A revision is immutable: heartbeats may refresh estimates, never rewrite history.
            for (const state of incoming) {
                const existing = this.timeline.find(item => item.revision === state.revision)
                if (existing && JSON.stringify(existing) !== JSON.stringify(state)) return
            }
            this.timeline = incoming
            peer.lastSeen = now
            this.updateScheduler()
        }
        this.emit()
    }
    /** Coalesce edits onto the same future bar; preserve position under tempo changes. */
    setTransport(change: Partial<Pick<NetworkTransport, 'playing' | 'bpm' | 'swing' | 'position'>>, effectiveTimeMs?: number): NetworkTransport {
        if (!this.isLeader) throw new Error('Only the host can change shared transport')
        if (this.destroyed || !this.ready) throw new Error('Session is not ready')
        const now = this.now()
        const current = this.current()
        const pending = this.timeline.find(state => state.timestamp > now)
        const base = pending ?? current
        let timestamp = pending?.timestamp ?? now + Math.max(500, this.options.lookaheadMs ?? 600)
        let position = current ? positionAt(current, timestamp) : 0
        if (!pending && current?.playing) {
            position = Math.ceil(position / 4) * 4
            timestamp = current.timestamp + (position - current.position) * 60000 / current.bpm
        }
        if (pending) position = pending.position
        if (effectiveTimeMs !== undefined) {
            if (!Number.isFinite(effectiveTimeMs) || effectiveTimeMs < now + 200) throw new Error('Transport changes need at least 200 ms of scheduling headroom')
            timestamp = effectiveTimeMs
            position = current ? positionAt(current, timestamp) : 0
        }
        const state: NetworkTransport = { revision: ++this.sequence, playing: base?.playing ?? false,
            timestamp, position, bpm: base?.bpm ?? this.timer.BPM, swing: base?.swing ?? this.timer.swing,
            divisions: this.timer.divisions, bars: this.timer.bars, ...change }
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
            status: !this.isLeader && !this.peers.has(this.options.leaderId) ? 'disconnected'
                : !locked ? 'synchronizing' : this.timeline.some(s => s.timestamp > this.now() + this.offset()) ? 'armed' : 'locked',
            playing: state?.playing ?? false, position: state ? positionAt(state, this.now() + this.offset()) : 0,
            bpm: state?.bpm ?? this.timer.BPM, swing: state?.swing ?? this.timer.swing,
            peers: [...this.peers].map(([id, peer]) => ({ id, ...peer.clock.getEstimate(this.now()) })) }
    }
    private emit(): void { this.options.onStateChange?.(this.getState()) }
    async destroy(): Promise<void> {
        this.destroyed = true
        clearInterval(this.interval)
        this.scheduler?.destroy()
        try { await this.starting } catch { /* Failed initialization still releases timer ownership. */ }
        this.peers.clear()
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
