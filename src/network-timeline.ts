/** Position is measured in quarter notes; timestamp is in leader performance milliseconds. */
export interface NetworkTransport {
    revision: number
    playing: boolean
    timestamp: number
    position: number
    bpm: number
    swing: number
    divisions: number
    bars: number
}

export const isNetworkTransport = (value: any): value is NetworkTransport => Boolean(value
    && Number.isSafeInteger(value.revision) && value.revision >= 0
    && typeof value.playing === 'boolean'
    && Number.isFinite(value.timestamp)
    && Number.isFinite(value.position) && value.position >= 0
    && Number.isFinite(value.bpm) && value.bpm >= 10 && value.bpm <= 300
    && Number.isFinite(value.swing) && value.swing >= 0 && value.swing <= 1
    && Number.isInteger(value.divisions) && value.divisions >= 1 && value.divisions <= 96
    && Number.isInteger(value.bars) && value.bars >= 1 && value.bars <= 32)

export const positionAt = (state: NetworkTransport, timestamp: number): number =>
    state.position + (state.playing ? Math.max(0, timestamp - state.timestamp) * state.bpm / 60000 : 0)

/** Match Timer's swing convention: delay odd divisions by a fraction of one division. */
export const networkTickTime = (state: NetworkTransport, tick: number): number =>
    state.timestamp + (tick / state.divisions - state.position
        + (tick % 2 ? state.swing / state.divisions : 0)) * 60000 / state.bpm
