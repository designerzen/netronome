import { describe, expect, it } from 'vitest'

import Timer from '../../src/timer'
import { CMD_START, CMD_UPDATE, EVENT_STARTING } from '../../src/timer-event-types'

type FakeWorker = {
  messages: Record<string, unknown>[]
  onmessage: ((event: MessageEvent<any>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage: (payload: Record<string, unknown>) => void
  emit: (data: Record<string, unknown>) => void
}

const createFakeWorker = (): FakeWorker => {
  const worker: FakeWorker = {
    messages: [],
    onmessage: null,
    onerror: null,
    postMessage(payload) {
      worker.messages.push(payload)
    },
    emit(data) {
      worker.onmessage?.({ data } as MessageEvent<any>)
    }
  }

  return worker
}

const setupRunningTimer = async (bpm: number) => {
  const timer = new Timer({ bpm }, false)
  await timer.loaded

  const worker = createFakeWorker()
  const events: Array<{ expected: number }> = []
  const startTime = 1_000
  let now = startTime

  timer.getNow = () => now
  timer.timingWorkHandler = worker as any

  await timer.startTimer((event) => {
    events.push({ expected: event.expected })
  })

  expect(worker.messages.at(-1)).toMatchObject({ command: CMD_START })

  worker.emit({ event: EVENT_STARTING })

  const emitTick = (intervals: number, timePassed: number) => {
    now = startTime + timePassed * 1_000
    timer.createTick(intervals, timePassed)
    return events.at(-1)
  }

  return {
    timer,
    worker,
    events,
    emitTick,
    setNow: (value: number) => {
      now = value
    },
    startTime,
  }
}

describe('Timer live tempo changes', () => {
  it('keeps expected stable at a steady tempo', async () => {
    const { timer, events, emitTick } = await setupRunningTimer(120)
    const period = timer.getCurrentPeriodInSeconds()

    for (let intervals = 0; intervals < 5; intervals++) {
      emitTick(intervals, intervals * period)
    }

    expect(events).toHaveLength(5)

    events.forEach((event, index) => {
      expect(event.expected).toBeCloseTo(index * period, 9)
    })
  })

  it('keeps expected continuous when tempo is reduced while running', async () => {
    const { timer, worker, events, emitTick, setNow, startTime } = await setupRunningTimer(120)
    const fastPeriod = timer.getCurrentPeriodInSeconds()

    for (let intervals = 0; intervals <= 4; intervals++) {
      emitTick(intervals, intervals * fastPeriod)
    }

    const changeTransport = 4 * fastPeriod + fastPeriod / 2
    setNow(startTime + changeTransport * 1_000)

    timer.BPM = 60

    expect(worker.messages.at(-1)).toMatchObject({ command: CMD_UPDATE, interval: timer.period })

    const slowPeriod = timer.getCurrentPeriodInSeconds()
    const nextEvent = emitTick(5, changeTransport + slowPeriod)
    const followingEvent = emitTick(6, changeTransport + 2 * slowPeriod)

    expect(nextEvent?.expected - slowPeriod).toBeCloseTo(changeTransport, 9)
    expect(followingEvent?.expected - (nextEvent?.expected || 0)).toBeCloseTo(slowPeriod, 9)
    expect(nextEvent?.expected).toBeGreaterThan(events[4].expected)
  })

  it('keeps expected continuous when tempo is increased while running', async () => {
    const { timer, worker, events, emitTick, setNow, startTime } = await setupRunningTimer(60)
    const slowPeriod = timer.getCurrentPeriodInSeconds()

    for (let intervals = 0; intervals <= 4; intervals++) {
      emitTick(intervals, intervals * slowPeriod)
    }

    const changeTransport = 4 * slowPeriod + slowPeriod / 2
    setNow(startTime + changeTransport * 1_000)

    timer.BPM = 120

    expect(worker.messages.at(-1)).toMatchObject({ command: CMD_UPDATE, interval: timer.period })

    const fastPeriod = timer.getCurrentPeriodInSeconds()
    const nextEvent = emitTick(5, changeTransport + fastPeriod)
    const followingEvent = emitTick(6, changeTransport + 2 * fastPeriod)

    expect(nextEvent?.expected - fastPeriod).toBeCloseTo(changeTransport, 9)
    expect(followingEvent?.expected - (nextEvent?.expected || 0)).toBeCloseTo(fastPeriod, 9)
    expect(nextEvent?.expected).toBeGreaterThan(events[4].expected)
  })
})
