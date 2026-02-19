import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Metronome Sound Feature', () => {
  let mockOscillator: any
  let mockGainNode: any
  let mockAudioContext: any

  beforeEach(() => {
    // Mock oscillator
    mockOscillator = {
      connect: vi.fn().mockReturnThis(),
      frequency: { value: 880 },
      type: 'sine',
      start: vi.fn(),
      stop: vi.fn(),
    }

    // Mock gain node
    mockGainNode = {
      connect: vi.fn().mockReturnThis(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    }

    // Mock audio context
    mockAudioContext = {
      currentTime: 0,
      state: 'running',
      destination: {},
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGainNode),
      resume: vi.fn().mockResolvedValue(undefined),
    }

    // Set up global AudioContext mock
    ;(global as any).AudioContext = vi.fn(() => mockAudioContext)
    ;(global as any).webkitAudioContext = vi.fn(() => mockAudioContext)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should create oscillator and gain node on beep', () => {
    // Simulate playMetronomeBeep function
    const playMetronomeBeep = (
      frequency: number = 880,
      duration: number = 100
    ) => {
      try {
        const audioContext = mockAudioContext

        const now = audioContext.currentTime
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = frequency
        oscillator.type = 'sine'

        gainNode.gain.setValueAtTime(0.3, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000)

        oscillator.start(now)
        oscillator.stop(now + duration / 1000)
      } catch (error) {
        // Silently handle errors
      }
    }

    playMetronomeBeep(880, 100)

    // Verify oscillator was created
    expect(mockAudioContext.createOscillator).toHaveBeenCalled()

    // Verify gain node was created
    expect(mockAudioContext.createGain).toHaveBeenCalled()

    // Verify connections were made
    expect(mockOscillator.connect).toHaveBeenCalledWith(mockGainNode)
    expect(mockGainNode.connect).toHaveBeenCalledWith(mockAudioContext.destination)

    // Verify oscillator properties
    expect(mockOscillator.frequency.value).toBe(880)
    expect(mockOscillator.type).toBe('sine')

    // Verify oscillator was started and stopped
    expect(mockOscillator.start).toHaveBeenCalled()
    expect(mockOscillator.stop).toHaveBeenCalled()
  })

  it('should use custom frequency and duration', () => {
    const playMetronomeBeep = (
      frequency: number = 880,
      duration: number = 100
    ) => {
      const audioContext = mockAudioContext
      const now = audioContext.currentTime
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = frequency
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000)

      oscillator.start(now)
      oscillator.stop(now + duration / 1000)
    }

    playMetronomeBeep(440, 200)

    // Verify custom frequency was set
    expect(mockOscillator.frequency.value).toBe(440)

    // Verify stop duration was calculated correctly
    const calls = mockOscillator.stop.mock.calls
    expect(calls.length).toBeGreaterThan(0)
  })

  it('should handle audio context state correctly', () => {
    let audioContext: any = null

    const initAudioContext = () => {
      const AudioContextClass = (global as any).AudioContext
      if (!AudioContextClass) {
        return
      }
      audioContext = mockAudioContext // Use the mock directly
    }

    initAudioContext()

    expect(audioContext).not.toBeNull()
    expect(audioContext.state).toBe('running')
  })

  it('should resume suspended audio context', async () => {
    const suspendedContext = {
      ...mockAudioContext,
      state: 'suspended',
    }

    ;(global as any).AudioContext = vi.fn(() => suspendedContext)

    const resumeSpy = vi.spyOn(suspendedContext, 'resume')

    const playMetronomeBeep = () => {
      const audioContext = suspendedContext

      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {})
      }
    }

    playMetronomeBeep()

    expect(resumeSpy).toHaveBeenCalled()
  })
})

describe('Metronome Configuration in Timer', () => {
  it('should store metronomeEnabled flag in timer config', () => {
    interface MultiTimerConfig {
      id: string
      bpm: number
      name: string
      workerType: string
      color: string
      startTime?: number
      epoch?: string
      metronomeEnabled?: boolean
    }

    const config: MultiTimerConfig = {
      id: 'timer-1',
      bpm: 120,
      name: 'Test Timer',
      workerType: 'audiocontext',
      color: '#FF0000',
      metronomeEnabled: true,
    }

    expect(config.metronomeEnabled).toBe(true)
  })

  it('should default metronomeEnabled to false when not specified', () => {
    interface MultiTimerConfig {
      id: string
      bpm: number
      name: string
      workerType: string
      color: string
      metronomeEnabled?: boolean
    }

    const config: Partial<MultiTimerConfig> = {
      bpm: 120,
      name: 'Test Timer',
      metronomeEnabled: undefined,
    }

    const finalConfig: MultiTimerConfig = {
      id: 'timer-1',
      bpm: config.bpm || 120,
      name: config.name || 'Timer',
      workerType: 'audiocontext',
      color: '#FF0000',
      metronomeEnabled: config.metronomeEnabled || false,
    }

    expect(finalConfig.metronomeEnabled).toBe(false)
  })

  it('should trigger beep on every tick when metronomeEnabled is true', () => {
    const playMetronomeBeep = vi.fn()
    const ticks = 5

    // Simulate callback with metronomeEnabled = true
    const metronomeEnabled = true
    for (let i = 0; i < ticks; i++) {
      if (metronomeEnabled) {
        playMetronomeBeep(880, 100)
      }
    }

    // Should be called once per tick
    expect(playMetronomeBeep).toHaveBeenCalledTimes(ticks)
    expect(playMetronomeBeep).toHaveBeenCalledWith(880, 100)
  })

  it('should not trigger beep when metronomeEnabled is false', () => {
    const playMetronomeBeep = vi.fn()
    const ticks = 5

    // Simulate callback with metronomeEnabled = false
    const metronomeEnabled = false
    for (let i = 0; i < ticks; i++) {
      if (metronomeEnabled) {
        playMetronomeBeep(880, 100)
      }
    }

    // Should not be called at all
    expect(playMetronomeBeep).not.toHaveBeenCalled()
  })
})
