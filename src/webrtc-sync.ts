import Timer from './timer'
import SyncSession from './sync-session'

export type WebRTCSyncRole = 'leader' | 'follower'

export type WebRTCSyncSignal =
    | { type: 'description'; description: RTCSessionDescriptionInit }
    | { type: 'candidate'; candidate: RTCIceCandidateInit }

export interface WebRTCSessionBundle {
    description: RTCSessionDescriptionInit
}

type TransportSnapshot = {
    bpm: number
    divisions: number
    bars: number
    swing: number
    periodMs: number
}

type WireMessage =
    | { type: 'sync-ping'; id: string; clientSendTimeMs: number }
    | { type: 'sync-pong'; id: string; clientSendTimeMs: number; leaderReceiveTimeMs: number; leaderSendTimeMs: number }
    | { type: 'prepare-start'; leaderStartTimeMs: number; transport: TransportSnapshot }
    | { type: 'heartbeat'; leaderNowMs: number; transport: TransportSnapshot; leaderStartTimeMs: number | null }
    | { type: 'tempo-update'; effectiveLeaderTimeMs: number; transport: TransportSnapshot }
    | { type: 'stop'; leaderTimeMs: number }

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

const DEFAULT_OPTIONS: Required<Omit<WebRTCSyncControllerOptions, 'rtcConfig'>> = {
    role: 'leader',
    sampleWindow: 16,
    minSamples: 4,
    pingIntervalMs: 1000,
    heartbeatIntervalMs: 1000,
    startLookaheadMs: 1200,
    resyncThresholdMs: 30,
    channelLabel: 'netronome-sync'
}

const DEFAULT_RTC_CONFIGURATION: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
}

export class WebRTCSyncController {
    readonly timer: Timer
    readonly role: WebRTCSyncRole

    onSignal?: (signal: WebRTCSyncSignal) => void
    onStateChange?: (state: WebRTCSyncState) => void

    #options: Required<Omit<WebRTCSyncControllerOptions, 'rtcConfig'>> & Pick<WebRTCSyncControllerOptions, 'rtcConfig'>
    #peerConnection: RTCPeerConnection | null = null
    #dataChannel: RTCDataChannel | null = null
    #syncSession: SyncSession
    #pingIntervalId: ReturnType<typeof setInterval> | null = null
    #heartbeatIntervalId: ReturnType<typeof setInterval> | null = null
    #scheduledTickTimeoutId: ReturnType<typeof setTimeout> | null = null
    #leaderStartTimeMs: number | null = null
    #lastTriggeredTick: number = -1
    #isFollowerRunning: boolean = false
    #transportSnapshot: TransportSnapshot
    #destroyed: boolean = false

    constructor(timer: Timer, options: WebRTCSyncControllerOptions) {
        this.timer = timer
        this.#options = { ...DEFAULT_OPTIONS, ...options }
        this.role = this.#options.role
        this.#syncSession = new SyncSession(this.#options.sampleWindow, this.#options.minSamples)
        this.#transportSnapshot = this.#readTransportSnapshot()
        this.#ensurePeerConnection()
    }

    #nowMs(): number {
        return performance.now()
    }

    #readTransportSnapshot(): TransportSnapshot {
        return {
            bpm: this.timer.BPM,
            divisions: this.timer.divisions,
            bars: this.timer.bars,
            swing: this.timer.swing,
            periodMs: this.timer.timeBetween
        }
    }

    #emitState(): void {
        const estimate = this.#syncSession.getEstimate()
        this.onStateChange?.({
            role: this.role,
            connected: this.#dataChannel?.readyState === 'open',
            sampleCount: estimate.sampleCount,
            offsetMs: estimate.offsetMs,
            rttMs: estimate.rttMs,
            jitterMs: estimate.jitterMs,
            locked: estimate.locked
        })
    }

    #ensurePeerConnection(): void {
        if (this.#peerConnection || typeof RTCPeerConnection === 'undefined') {
            return
        }

        const peerConnection = new RTCPeerConnection(this.#options.rtcConfig ?? DEFAULT_RTC_CONFIGURATION)
        this.#peerConnection = peerConnection

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.onSignal?.({
                    type: 'candidate',
                    candidate: event.candidate.toJSON()
                })
            }
        }

        peerConnection.ondatachannel = (event) => {
            this.#attachDataChannel(event.channel)
        }

        if (this.role === 'leader') {
            const dataChannel = peerConnection.createDataChannel(this.#options.channelLabel, {
                ordered: true
            })
            this.#attachDataChannel(dataChannel)
        }
    }

    #attachDataChannel(dataChannel: RTCDataChannel): void {
        this.#dataChannel = dataChannel

        dataChannel.onopen = () => {
            if (this.role === 'follower') {
                this.#startPingLoop()
            } else {
                this.#startHeartbeatLoop()
            }
            this.#emitState()
        }

        dataChannel.onclose = () => {
            this.#stopPingLoop()
            this.#stopHeartbeatLoop()
            this.#clearScheduledTick()
            this.#emitState()
        }

        dataChannel.onmessage = (event) => {
            const parsed = JSON.parse(String(event.data)) as WireMessage
            this.#handleWireMessage(parsed)
        }
    }

    #send(message: WireMessage): void {
        if (this.#destroyed || !this.#dataChannel || this.#dataChannel.readyState !== 'open') {
            return
        }
        this.#dataChannel.send(JSON.stringify(message))
    }

    async #waitForIceGatheringComplete(): Promise<void> {
        const peerConnection = this.#peerConnection
        if (!peerConnection || peerConnection.iceGatheringState === 'complete') {
            return
        }

        await new Promise<void>((resolve) => {
            const onStateChange = (): void => {
                if (!peerConnection || peerConnection.iceGatheringState !== 'complete') {
                    return
                }
                peerConnection.removeEventListener('icegatheringstatechange', onStateChange)
                resolve()
            }

            peerConnection.addEventListener('icegatheringstatechange', onStateChange)
        })
    }

    async start(): Promise<void> {
        if (this.role !== 'leader') {
            return
        }

        const peerConnection = this.#peerConnection
        if (!peerConnection) {
            throw new Error('RTCPeerConnection is not available in this environment')
        }

        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        this.onSignal?.({
            type: 'description',
            description: offer
        })
    }

    async createOfferBundle(): Promise<WebRTCSessionBundle> {
        if (this.role !== 'leader') {
            throw new Error('Only the leader can create an offer bundle')
        }

        const peerConnection = this.#peerConnection
        if (!peerConnection) {
            throw new Error('RTCPeerConnection is not available in this environment')
        }

        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        await this.#waitForIceGatheringComplete()

        if (!peerConnection.localDescription) {
            throw new Error('Failed to gather local offer description')
        }

        return {
            description: peerConnection.localDescription.toJSON()
        }
    }

    async createAnswerBundle(): Promise<WebRTCSessionBundle> {
        const peerConnection = this.#peerConnection
        if (!peerConnection) {
            throw new Error('RTCPeerConnection is not available in this environment')
        }

        if (!peerConnection.remoteDescription) {
            throw new Error('Remote offer must be set before creating an answer bundle')
        }

        const answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)
        await this.#waitForIceGatheringComplete()

        if (!peerConnection.localDescription) {
            throw new Error('Failed to gather local answer description')
        }

        return {
            description: peerConnection.localDescription.toJSON()
        }
    }

    async applyOfferBundle(bundle: WebRTCSessionBundle): Promise<void> {
        if (this.role !== 'follower') {
            throw new Error('Only the follower can apply an offer bundle')
        }

        await this.handleSignal({
            type: 'description',
            description: bundle.description
        })
    }

    async applyAnswerBundle(bundle: WebRTCSessionBundle): Promise<void> {
        if (this.role !== 'leader') {
            throw new Error('Only the leader can apply an answer bundle')
        }

        await this.handleSignal({
            type: 'description',
            description: bundle.description
        })
    }

    async handleSignal(signal: WebRTCSyncSignal): Promise<void> {
        const peerConnection = this.#peerConnection
        if (!peerConnection) {
            throw new Error('RTCPeerConnection is not available in this environment')
        }

        if (signal.type === 'candidate') {
            await peerConnection.addIceCandidate(signal.candidate)
            return
        }

        const { description } = signal
        await peerConnection.setRemoteDescription(description)

        if (description.type === 'offer') {
            const answer = await peerConnection.createAnswer()
            await peerConnection.setLocalDescription(answer)
            this.onSignal?.({
                type: 'description',
                description: answer
            })
        }
    }

    async startSynchronized(lookaheadMs: number = this.#options.startLookaheadMs): Promise<void> {
        if (this.role !== 'leader') {
            throw new Error('Only the leader can initiate synchronized start')
        }

        if (this.timer.isRunning) {
            await this.timer.stopTimer()
        }

        this.#transportSnapshot = this.#readTransportSnapshot()
        this.#leaderStartTimeMs = this.#nowMs() + Math.max(250, lookaheadMs)
        this.#send({
            type: 'prepare-start',
            leaderStartTimeMs: this.#leaderStartTimeMs,
            transport: this.#transportSnapshot
        })

        const delayMs = Math.max(0, this.#leaderStartTimeMs - this.#nowMs())
        globalThis.setTimeout(() => {
            void this.timer.startTimer(this.timer.callback)
        }, delayMs)
    }

    async stopSynchronized(): Promise<void> {
        if (this.role === 'leader') {
            this.#send({
                type: 'stop',
                leaderTimeMs: this.#nowMs()
            })
        }

        this.#leaderStartTimeMs = null
        this.#clearScheduledTick()
        this.#isFollowerRunning = false
        await this.timer.stopTimer()
    }

    broadcastTempoUpdate(effectiveLeaderTimeMs: number = this.#nowMs() + this.#options.startLookaheadMs): void {
        if (this.role !== 'leader') {
            return
        }

        this.#transportSnapshot = this.#readTransportSnapshot()
        this.#send({
            type: 'tempo-update',
            effectiveLeaderTimeMs,
            transport: this.#transportSnapshot
        })
    }

    getState(): WebRTCSyncState {
        const estimate = this.#syncSession.getEstimate()
        return {
            role: this.role,
            connected: this.#dataChannel?.readyState === 'open',
            sampleCount: estimate.sampleCount,
            offsetMs: estimate.offsetMs,
            rttMs: estimate.rttMs,
            jitterMs: estimate.jitterMs,
            locked: estimate.locked
        }
    }

    #startPingLoop(): void {
        this.#stopPingLoop()
        const ping = (): void => {
            const clientSendTimeMs = this.#nowMs()
            this.#send({
                type: 'sync-ping',
                id: `${clientSendTimeMs}-${Math.random()}`,
                clientSendTimeMs
            })
        }

        ping()
        this.#pingIntervalId = setInterval(ping, this.#options.pingIntervalMs)
    }

    #stopPingLoop(): void {
        if (this.#pingIntervalId) {
            clearInterval(this.#pingIntervalId)
            this.#pingIntervalId = null
        }
    }

    #startHeartbeatLoop(): void {
        this.#stopHeartbeatLoop()
        const beat = (): void => {
            this.#transportSnapshot = this.#readTransportSnapshot()
            this.#send({
                type: 'heartbeat',
                leaderNowMs: this.#nowMs(),
                transport: this.#transportSnapshot,
                leaderStartTimeMs: this.#leaderStartTimeMs
            })
        }

        beat()
        this.#heartbeatIntervalId = setInterval(beat, this.#options.heartbeatIntervalMs)
    }

    #stopHeartbeatLoop(): void {
        if (this.#heartbeatIntervalId) {
            clearInterval(this.#heartbeatIntervalId)
            this.#heartbeatIntervalId = null
        }
    }

    #handleWireMessage(message: WireMessage): void {
        switch (message.type) {
            case 'sync-ping': {
                if (this.role !== 'leader') {
                    return
                }

                const leaderReceiveTimeMs = this.#nowMs()
                const leaderSendTimeMs = this.#nowMs()
                this.#send({
                    type: 'sync-pong',
                    id: message.id,
                    clientSendTimeMs: message.clientSendTimeMs,
                    leaderReceiveTimeMs,
                    leaderSendTimeMs
                })
                break
            }

            case 'sync-pong': {
                if (this.role !== 'follower') {
                    return
                }

                this.#syncSession.addSample({
                    clientSendTimeMs: message.clientSendTimeMs,
                    leaderReceiveTimeMs: message.leaderReceiveTimeMs,
                    leaderSendTimeMs: message.leaderSendTimeMs,
                    clientReceiveTimeMs: this.#nowMs()
                })
                this.#emitState()
                if (this.#leaderStartTimeMs !== null && this.#isFollowerRunning) {
                    this.#scheduleNextFollowerTick()
                }
                break
            }

            case 'prepare-start': {
                if (this.role !== 'follower') {
                    return
                }
                this.#transportSnapshot = message.transport
                this.#leaderStartTimeMs = message.leaderStartTimeMs
                void this.#prepareFollowerStart()
                break
            }

            case 'heartbeat': {
                if (this.role !== 'follower') {
                    return
                }
                this.#transportSnapshot = message.transport
                this.#leaderStartTimeMs = message.leaderStartTimeMs
                if (this.#isFollowerRunning) {
                    this.#scheduleNextFollowerTick(message.leaderNowMs)
                }
                break
            }

            case 'tempo-update': {
                if (this.role !== 'follower') {
                    return
                }
                this.#transportSnapshot = message.transport
                this.timer.bars = message.transport.bars
                this.timer.divisions = message.transport.divisions
                this.timer.swing = message.transport.swing
                this.timer.BPM = message.transport.bpm
                if (this.#isFollowerRunning) {
                    const localEffectiveTime = this.#syncSession.leaderToLocalTime(message.effectiveLeaderTimeMs)
                    globalThis.setTimeout(() => {
                        this.#scheduleNextFollowerTick()
                    }, Math.max(0, localEffectiveTime - this.#nowMs()))
                }
                break
            }

            case 'stop': {
                void this.stopSynchronized()
                break
            }
        }
    }

    async #prepareFollowerStart(): Promise<void> {
        this.timer.bars = this.#transportSnapshot.bars
        this.timer.divisions = this.#transportSnapshot.divisions
        this.timer.swing = this.#transportSnapshot.swing
        this.timer.BPM = this.#transportSnapshot.bpm
        this.timer.bypass(true)
        this.timer.resetTimer()
        this.#lastTriggeredTick = -1
        this.#isFollowerRunning = true
        await this.timer.startTimer(this.timer.callback)
        this.#scheduleNextFollowerTick()
    }

    #clearScheduledTick(): void {
        if (this.#scheduledTickTimeoutId) {
            clearTimeout(this.#scheduledTickTimeoutId)
            this.#scheduledTickTimeoutId = null
        }
    }

    #getTickDurationMs(): number {
        return 60000 / (this.#transportSnapshot.bpm * this.#transportSnapshot.divisions)
    }

    #scheduleNextFollowerTick(leaderNowMs: number = this.#syncSession.localToLeaderTime(this.#nowMs())): void {
        if (!this.#isFollowerRunning || this.#leaderStartTimeMs === null) {
            return
        }

        this.#clearScheduledTick()

        const tickDurationMs = this.#getTickDurationMs()
        const leaderElapsedMs = leaderNowMs - this.#leaderStartTimeMs
        const nextTickIndex = Math.max(
            this.#lastTriggeredTick + 1,
            leaderElapsedMs <= 0 ? 0 : Math.ceil(leaderElapsedMs / tickDurationMs)
        )
        const targetLeaderTimeMs = this.#leaderStartTimeMs + nextTickIndex * tickDurationMs
        const targetLocalTimeMs = this.#syncSession.leaderToLocalTime(targetLeaderTimeMs)
        const delayMs = Math.max(0, targetLocalTimeMs - this.#nowMs())

        this.#scheduledTickTimeoutId = setTimeout(() => {
            const actualLeaderTimeMs = this.#syncSession.localToLeaderTime(this.#nowMs())
            const phaseErrorMs = actualLeaderTimeMs - targetLeaderTimeMs

            if (Math.abs(phaseErrorMs) > this.#options.resyncThresholdMs) {
                this.#scheduleNextFollowerTick(actualLeaderTimeMs)
                return
            }

            this.#lastTriggeredTick = nextTickIndex
            this.timer.externalTrigger(true)
            this.#scheduleNextFollowerTick()
        }, delayMs)
    }

    async destroy(): Promise<void> {
        this.#destroyed = true
        this.#stopPingLoop()
        this.#stopHeartbeatLoop()
        this.#clearScheduledTick()
        this.#isFollowerRunning = false

        if (this.#dataChannel) {
            this.#dataChannel.close()
            this.#dataChannel = null
        }

        if (this.#peerConnection) {
            this.#peerConnection.close()
            this.#peerConnection = null
        }
    }
}

export const createWebRTCSyncController = (timer: Timer, options: WebRTCSyncControllerOptions): WebRTCSyncController =>
    new WebRTCSyncController(timer, options)

export default WebRTCSyncController
