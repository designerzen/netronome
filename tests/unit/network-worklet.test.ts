import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, it, expect } from 'vitest'

const processor = () => {
    const messages: any[] = []
    let Processor: any
    const context = vm.createContext({ currentTime: 0, currentFrame: 0, sampleRate: 48000,
        AudioWorkletProcessor: class { port = { postMessage: (value: any) => messages.push(value) } },
        registerProcessor: (_name: string, value: any) => { Processor = value } })
    vm.runInContext(readFileSync(new URL('../../src/worklets/network-timing-processor.js', import.meta.url), 'utf8'), context)
    const worklet = new Processor()
    const advance = (time: number) => { context.currentTime = time; worklet.process() }
    return { messages, worklet, advance }
}
const state = { revision: 1, playing: true, audioTime: 1, timestamp: 1100, position: 0, bpm: 120, swing: 0, divisions: 24, bars: 16 }

describe('network audio worklet', () => {
    it('emits future audio timestamps and absolute beat indices', () => {
        const { worklet, messages, advance } = processor()
        worklet.port.onmessage({ data: { type: 'timeline', states: [state] } })
        advance(0.9); expect(messages).toHaveLength(0)
        advance(1)
        expect(messages.at(-1).tick).toBe(0)
        expect(messages.at(-1).scheduledContextTimeSeconds).toBeCloseTo(1.1)
        advance(3)
        expect(messages.at(-1).tick).toBe(96)
        expect(messages.filter(m => m.tick !== undefined)).toHaveLength(2)
    })
    it('does not lose odd swung ticks at maximum swing', () => {
        const { worklet, messages, advance } = processor()
        worklet.port.onmessage({ data: { type: 'timeline', states: [{ ...state, swing: 1 }] } })
        advance(1); advance(1 + 2 * 60 / (120 * 24))
        expect(messages.filter(m => m.tick !== undefined).map(m => m.tick)).toEqual([0, 1, 2])
    })
    it('stops at the shared boundary and cannot restart after clear', () => {
        const { worklet, messages, advance } = processor()
        worklet.port.onmessage({ data: { type: 'timeline', states: [state, { ...state, revision: 2, playing: false, audioTime: 2 }] } })
        advance(1); advance(2)
        expect(messages.at(-1).state.playing).toBe(false)
        worklet.port.onmessage({ data: { type: 'clear' } })
        const count = messages.length
        advance(10); expect(messages).toHaveLength(count)
    })
})
