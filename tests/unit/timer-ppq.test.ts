import { describe, expect, it } from 'vitest'

import Timer from '../../src/timer'
import { isNetworkTransport } from '../../src/network-timeline'
import { MAX_PPQ, PPQ_OPTIONS } from '../../src/ppq'

describe('Timer PPQ', () => {
  it.each(PPQ_OPTIONS)('keeps tempo when switching to %i PPQ', async (ppq) => {
    const timer = new Timer({ bpm: 133 }, false)
    await timer.loaded
    timer.BPM = 133

    expect(timer.setPPQ(ppq)).toBe(ppq)

    expect(timer.ppq).toBe(ppq)
    expect(timer.BPM).toBeCloseTo(133, 6)
    expect(timer.period * ppq).toBeCloseTo(60000 / 133, 6)
  })

  it('keeps the position within the beat', async () => {
    const timer = new Timer({ bpm: 120 }, false)
    await timer.loaded
    timer.divisionsElapsed = 12

    timer.ppq = 96

    expect(timer.divisionsElapsed).toBe(48)
  })

  it('ignores resolutions it cannot run', async () => {
    const timer = new Timer({ bpm: 120 }, false)
    await timer.loaded

    for (const value of [0, -24, 1.5, Number.NaN, MAX_PPQ + 1]) {
      expect(timer.setPPQ(value)).toBe(24)
    }
    expect(timer.ppq).toBe(24)
  })

  it('shares every supported resolution over the network', () => {
    const transport = { revision: 1, playing: false, timestamp: 0, position: 0, bpm: 120, swing: 0, bars: 4 }

    for (const ppq of PPQ_OPTIONS) {
      expect(isNetworkTransport({ ...transport, divisions: ppq })).toBe(true)
    }
    expect(isNetworkTransport({ ...transport, divisions: MAX_PPQ + 1 })).toBe(false)
  })
})
