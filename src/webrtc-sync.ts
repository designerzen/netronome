import Timer from './timer'
import { NetworkSession } from './network-session'

export type WebRTCSyncRole = 'leader' | 'follower'
export type WebRTCSyncSignal =
    | { type: 'description'; description: RTCSessionDescriptionInit }
    | { type: 'candidate'; candidate: RTCIceCandidateInit }
export interface WebRTCSessionBundle { description: RTCSessionDescriptionInit }
export interface WebRTCSyncControllerOptions {
    role: WebRTCSyncRole
    rtcConfig?: RTCConfiguration
    sampleWindow?: number
    minSamples?: number
    pingIntervalMs?: number
    heartbeatIntervalMs?: number
    startLookaheadMs?: number
    resyncThresholdMs?: number
    channelLabel?: string
}
export interface WebRTCSyncState {
    role: WebRTCSyncRole
    connected: boolean
    sampleCount: number
    offsetMs: number
    rttMs: number
    jitterMs: number
    locked: boolean
}

/** Single-peer compatibility facade. Use NetworkSession for rooms and multiple transports. */
export class WebRTCSyncController {
    readonly timer: Timer
    readonly role: WebRTCSyncRole
    onSignal?: (signal: WebRTCSyncSignal) => void
    onStateChange?: (state: WebRTCSyncState) => void
    private pc: RTCPeerConnection | null = null
    private channel: RTCDataChannel | null = null
    private session?: NetworkSession
    private sessionReady?: Promise<void>
    private candidates: RTCIceCandidateInit[] = []
    private destroyed = false
    private iceWaits = new Set<() => void>()
    private readonly options: WebRTCSyncControllerOptions
    constructor(timer: Timer, options: WebRTCSyncControllerOptions) {
        this.timer = timer
        this.options = options
        this.role = options.role
        if (typeof RTCPeerConnection === 'undefined') return
        const pc = new RTCPeerConnection(options.rtcConfig ?? {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        })
        this.pc = pc
        pc.onicecandidate = ({ candidate }) => {
            if (candidate) this.onSignal?.({ type: 'candidate', candidate: candidate.toJSON() })
        }
        pc.ondatachannel = ({ channel }) => this.attach(channel)
        if (this.role === 'leader') this.attach(pc.createDataChannel(options.channelLabel ?? 'netronome-sync', { ordered: true }))
    }
    private peer(): RTCPeerConnection {
        if (this.destroyed || !this.pc) throw new Error('RTCPeerConnection is not available')
        return this.pc
    }
    private attach(channel: RTCDataChannel): void {
        this.channel = channel
        channel.onopen = () => {
            void this.ensureSession().then(() => this.onStateChange?.(this.getState())).catch(() => {
                channel.close()
                this.onStateChange?.(this.getState())
            })
        }
        channel.onclose = () => {
            this.session?.removePeer(this.role === 'leader' ? 'follower' : 'leader')
            this.onStateChange?.(this.getState())
        }
        channel.onmessage = ({ data }) => {
            if (typeof data !== 'string' || data.length > 32768) return
            try { this.session?.receive(this.role === 'leader' ? 'follower' : 'leader', JSON.parse(data)) } catch { /* Reject malformed messages. */ }
        }
    }
    private async ensureSession(): Promise<void> {
        if (this.destroyed) throw new Error('Controller has been destroyed')
        if (!this.session) {
            this.session = new NetworkSession(this.timer, {
                peerId: this.role, leaderId: 'leader', lookaheadMs: this.options.startLookaheadMs,
                sampleWindow: this.options.sampleWindow, minSamples: this.options.minSamples,
                pollIntervalMs: this.options.pingIntervalMs ?? this.options.heartbeatIntervalMs,
                send: (_id, message) => {
                    if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(message))
                },
                onStateChange: () => this.onStateChange?.(this.getState())
            })
            this.sessionReady = this.session.start()
        }
        await this.sessionReady
        if (this.channel?.readyState === 'open') this.session.addPeer(this.role === 'leader' ? 'follower' : 'leader')
    }
    async start(): Promise<void> {
        if (this.role !== 'leader') return
        const pc = this.peer()
        await pc.setLocalDescription(await pc.createOffer())
        this.onSignal?.({ type: 'description', description: pc.localDescription!.toJSON() })
    }
    private async gather(): Promise<WebRTCSessionBundle> {
        const pc = this.peer()
        if (pc.iceGatheringState !== 'complete') await new Promise<void>((resolve, reject) => {
            const cleanup = () => { clearTimeout(timeout); pc.removeEventListener('icegatheringstatechange', check); this.iceWaits.delete(cancel) }
            const cancel = () => { cleanup(); reject(new Error('ICE gathering cancelled')) }
            const check = () => { if (pc.iceGatheringState === 'complete') { cleanup(); resolve() } }
            const timeout = setTimeout(() => { cleanup(); reject(new Error('ICE gathering timed out')) }, 10000)
            this.iceWaits.add(cancel)
            pc.addEventListener('icegatheringstatechange', check)
            check()
        })
        return { description: this.peer().localDescription!.toJSON() }
    }
    async createOfferBundle(): Promise<WebRTCSessionBundle> {
        if (this.role !== 'leader') throw new Error('Only the leader can create an offer')
        await this.start()
        return this.gather()
    }
    async applyOfferBundle(bundle: WebRTCSessionBundle): Promise<void> {
        if (this.role !== 'follower') throw new Error('Only the follower can apply an offer')
        await this.handleSignal({ type: 'description', description: bundle.description })
    }
    async createAnswerBundle(): Promise<WebRTCSessionBundle> {
        if (this.role !== 'follower' || !this.peer().remoteDescription) throw new Error('Apply an offer first')
        // handleSignal already created the answer; do not negotiate a second one.
        return this.gather()
    }
    async applyAnswerBundle(bundle: WebRTCSessionBundle): Promise<void> {
        if (this.role !== 'leader') throw new Error('Only the leader can apply an answer')
        await this.handleSignal({ type: 'description', description: bundle.description })
    }
    async handleSignal(signal: WebRTCSyncSignal): Promise<void> {
        const pc = this.peer()
        if (signal.type === 'candidate') {
            if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate)
            else if (this.candidates.length < 100) this.candidates.push(signal.candidate)
            return
        }
        await pc.setRemoteDescription(signal.description)
        for (const candidate of this.candidates.splice(0)) await pc.addIceCandidate(candidate)
        if (signal.description.type === 'offer') {
            await pc.setLocalDescription(await pc.createAnswer())
            this.onSignal?.({ type: 'description', description: pc.localDescription!.toJSON() })
        }
    }
    async startSynchronized(lookaheadMs = this.options.startLookaheadMs): Promise<void> {
        if (this.role !== 'leader') throw new Error('Only the leader can initiate synchronized start')
        if (lookaheadMs !== undefined) this.options.startLookaheadMs = lookaheadMs
        await this.ensureSession()
        if (lookaheadMs !== undefined) this.session!.options.lookaheadMs = lookaheadMs
        this.session!.setTransport({ playing: true, position: 0 })
    }
    async stopSynchronized(): Promise<void> {
        if (this.role === 'leader' && this.session) this.session.setTransport({ playing: false })
        else await this.destroy()
    }
    broadcastTempoUpdate(effectiveLeaderTimeMs?: number): void {
        if (this.role !== 'leader' || !this.session) return
        const bpm = this.timer.BPM, swing = this.timer.swing
        const current = this.session.getState()
        this.timer.BPM = current.bpm
        this.timer.swing = current.swing
        this.session.setTransport({ bpm, swing }, effectiveLeaderTimeMs)
    }
    getState(): WebRTCSyncState {
        const state = this.session?.getState()
        const peer = state?.peers[0]
        return { role: this.role, connected: this.channel?.readyState === 'open',
            sampleCount: peer?.sampleCount ?? 0, offsetMs: peer?.offsetMs ?? 0,
            rttMs: peer?.rttMs ?? 0, jitterMs: peer?.jitterMs ?? 0, locked: peer?.locked ?? false }
    }
    async destroy(): Promise<void> {
        this.destroyed = true
        for (const cancel of [...this.iceWaits]) cancel()
        await this.session?.destroy()
        this.channel?.close(); this.channel = null
        this.pc?.close(); this.pc = null
    }
}
export const createWebRTCSyncController = (timer: Timer, options: WebRTCSyncControllerOptions): WebRTCSyncController =>
    new WebRTCSyncController(timer, options)
export default WebRTCSyncController
