/**
 * Timer type constants for selecting which worker/worklet to use
 * Pass these string IDs to Timer constructor as the 'type' option
 */

export const TIMER_TYPE_AUDIO_CONTEXT = 'audio-context'
export const TIMER_TYPE_AUDIO_WORKLET = 'audio-worklet'
export const TIMER_TYPE_ROLLING = 'rolling'
export const TIMER_TYPE_SET_INTERVAL = 'set-interval'
export const TIMER_TYPE_SET_TIMEOUT = 'set-timeout'

export type TimerType =
  | typeof TIMER_TYPE_AUDIO_CONTEXT
  | typeof TIMER_TYPE_AUDIO_WORKLET
  | typeof TIMER_TYPE_ROLLING
  | typeof TIMER_TYPE_SET_INTERVAL
  | typeof TIMER_TYPE_SET_TIMEOUT

export const TIMER_TYPES = {
  AUDIO_CONTEXT: TIMER_TYPE_AUDIO_CONTEXT,
  AUDIO_WORKLET: TIMER_TYPE_AUDIO_WORKLET,
  ROLLING: TIMER_TYPE_ROLLING,
  SET_INTERVAL: TIMER_TYPE_SET_INTERVAL,
  SET_TIMEOUT: TIMER_TYPE_SET_TIMEOUT,
} as const

export const isValidTimerType = (type: unknown): type is TimerType => {
  return (
    type === TIMER_TYPE_AUDIO_CONTEXT ||
    type === TIMER_TYPE_AUDIO_WORKLET ||
    type === TIMER_TYPE_ROLLING ||
    type === TIMER_TYPE_SET_INTERVAL ||
    type === TIMER_TYPE_SET_TIMEOUT
  )
}

export const getTimerTypeDescription = (type: TimerType): string => {
  const descriptions: Record<TimerType, string> = {
    [TIMER_TYPE_AUDIO_CONTEXT]: 'Audio Context Worker',
    [TIMER_TYPE_AUDIO_WORKLET]: 'Audio Worklet',
    [TIMER_TYPE_ROLLING]: 'Rolling Worker',
    [TIMER_TYPE_SET_INTERVAL]: 'SetInterval Worker',
    [TIMER_TYPE_SET_TIMEOUT]: 'SetTimeout Worker',
  }
  return descriptions[type]
}
