# Netronome

A high-precision timing and tempo library for JavaScript, designed to achieve near-perfect timing accuracy in native JavaScript. Provides multiple timing backends using Web Workers, AudioContext, and more for accurate scheduling and beat synchronization.

## Overview

Netronome is a comprehensive timing system that prioritizes accuracy in JavaScript environments. It mitigates browser timing limitations (like Spectre/Meltdown mitigations that round timer values) by offering multiple timing backends with varying precision characteristics. The library is particularly useful for music production, metronomes, sequencers, and any application requiring precise temporal control.

### Key Features

- **Multiple timing backends**: AudioContext Worker, Web Workers (setInterval/setTimeout), and rolling timers
- **High-precision timing**: Works around browser timing resolution limitations
- **Tap tempo detection**: Automatic BPM detection from user input with linear regression
- **MIDI clock support**: External clock synchronization (24 pulses per quarter note)
- **Instance-based timers**: Run multiple independent timers at different rates simultaneously
- **Beat and bar synchronization**: Full support for bars, divisions (24 per beat, MIDI-compliant), and musical time calculations
- **Comprehensive timing metrics**: Track drift, lag, and expected vs. actual timing
- **Audio worklet support**: Ultra-low-latency timing on supported browsers
- **TypeScript support**: Fully typed API

## Installation

```bash
npm install netronome
# or
pnpm add netronome
```

## Quick Start

### Basic Timer (Global API)

```javascript
import { startTimer, stopTimer, setTimeBetween } from 'netronome'

// Start a timer that fires every 1000ms
startTimer(({ timePassed, drift, lag }) => {
  console.log('Tick', { timePassed, drift, lag })
}, 1000)

// Stop the timer
stopTimer()

// Change interval
setTimeBetween(500)
```

### Instance-Based Timer

```javascript
import Timer from 'netronome'

const timer = new Timer({
  bpm: 120,           // Beats per minute
  divisions: 24,      // Ticks per beat (MIDI standard)
  bars: 16,           // Total bars in a loop
  callback: (event) => {
    console.log('Bar:', event.bar, 'Tick:', event.divisionsElapsed)
  }
})

await timer.startTimer()

// Later...
await timer.stopTimer()
```

### Audio-Based Timer

For ultra-precise timing using the Web Audio API:

```javascript
import AudioTimer from 'netronome'

const audioContext = new (window.AudioContext || window.webkitAudioContext)()
const timer = new AudioTimer(audioContext, true) // true = use AudioWorklet

await timer.startTimer((event) => {
  console.log('Time passed:', event.timePassed, 'Drift:', event.drift)
})
```

## API Reference

### Global Functions

#### `startTimer(callback, interval, options)`

Start the global timer instance.

- **callback**: `(event: TimerEvent) => void` - Called on each tick
- **interval**: `number` - Milliseconds between ticks (default: 1000)
- **options**: `object` - Timer options
  - **type**: `string` - Worker URI (audiocontext, rolling, setinterval, settimeout)

#### `stopTimer()`

Stop the global timer.

#### `setTimeBetween(interval)`

Update the interval without restarting the timer.

#### `resetTimer()`

Reset the global timer state.

#### `createTimer(options)`

Create a new independent Timer instance.

### Timer Class

#### Constructor

```javascript
new Timer(options: TimerOptions)
```

Options:
- **bpm**: `number` - Beats per minute (default: 90)
- **bars**: `number` - Total bars in loop (default: 16, max: 32)
- **divisions**: `number` - Ticks per bar (default: 24, MIDI standard)
- **callback**: `function` - Tick callback
- **type**: `string` - Worker URI for timing backend
- **audioContext**: `AudioContext` - Optional audio context for high-precision timing

#### Properties

- **running**: `boolean` - Whether timer is currently running
- **available**: `boolean` - Whether timing backend is available
- **bpm**: `number` - Get/set beats per minute
- **bar**: `number` - Current bar (0 to bars-1)
- **barsElapsed**: `number` - Total bars completed
- **divisionsElapsed**: `number` - Ticks elapsed in current bar (0 to divisions-1)
- **now**: `number` - Current timestamp in milliseconds
- **timeElapsed**: `number` - Time elapsed since timer started
- **totalTime**: `number` - Total loop duration in milliseconds
- **barProgress**: `number` - Current bar progress 0-1
- **beatProgress**: `number` - Current beat progress 0-1
- **quarterNoteDuration**: `number` - Duration of one beat in microseconds

#### Methods

##### `async startTimer(callback?, options?)`

Start the timer with optional callback override.

Returns: `{ time: number; interval: number; worker: Worker | AudioWorkletNode | null }`

##### `async stopTimer()`

Stop the timer.

Returns: `{ currentTime: number; worker: Worker | AudioWorkletNode | null }`

##### `async toggleTimer(callback?, options?)`

Toggle between running and stopped states.

Returns: `Promise<boolean>` - Whether timer is now running

##### `resetTimer()`

Reset bar and division counters to zero.

##### `setCallback(callback)`

Update the tick callback function.

##### `tapTempo(): number`

Detect BPM from tap input. Requires 3+ taps within 10 seconds.

Returns: `number` - Detected BPM, or -1 if insufficient data

##### `externalTrigger(advance?)`

Handle external clock signals (e.g., MIDI clock). Call this on each external clock event.

- **advance**: `boolean` - Whether to increment the divisions counter (default: true)

### Timer Callback Event

Each tick fires a callback with:

```javascript
{
  bar: number              // Current bar index
  bars: number             // Total bars
  divisionsElapsed: number // Ticks in current bar (0 to divisions-1)
  barsElapsed: number      // Total bars completed
  elapsed: number          // Milliseconds since start
  timePassed: number       // Time since last tick
  expected: number         // Expected time since start
  drift: number            // Difference between actual and expected
  level: number            // Timing level/layer
  intervals: number        // Interval count
  lag: number              // Timing lag
}
```

## Timing Backends

Netronome supports multiple timing backends, each with different precision characteristics:

### AudioContext Worker
High-precision timing using Web Audio API in a worker thread. Generally the most accurate.

### AudioWorklet
Ultra-low-latency option using modern Web Audio worklets.

### Rolling Timer
Custom rolling timer implementation with frame-based synchronization.

### setInterval/setTimeout
Standard browser timer APIs (lower precision due to browser rounding).

## Timing Accuracy

Modern browsers limit timer precision to mitigate Spectre/Meltdown attacks:
- **Firefox**: 1ms granularity
- **Chrome**: 100μs with jitter
- **Safari**: Variable, context-dependent

Netronome works around these limitations by:
1. Using AudioContext timestamps (when available) for sub-millisecond precision
2. Tracking and reporting drift and lag metrics
3. Providing multiple backend options for different use cases
4. Averaging timing measurements across samples

## Time Utilities

Netronome includes utility functions for time calculations:

```javascript
import { 
  convertBPMToPeriod,
  convertPeriodToBPM,
  convertMIDIClockIntervalToBPM,
  secondsToTicks,
  formatTimeStampFromSeconds
} from 'netronome'

// Convert between BPM and period (ms)
const period = convertBPMToPeriod(120)  // 500ms per beat
const bpm = convertPeriodToBPM(500)     // 120 BPM

// Calculate ticks at a given tempo
const ticks = secondsToTicks(2, 120)    // 2 seconds at 120 BPM

// Format time
const timeStr = formatTimeStampFromSeconds(3661.25) // "01:01:01:25"

// MIDI clock conversion (24 pulses per quarter note)
const bpm = convertMIDIClockIntervalToBPM(20.83) // BPM from clock interval
```

### Tick Resolution

Netronome uses a high-resolution tick system compatible with MIDI:
- **3840 ticks** = 1 quarter note (beat)
- **15360 ticks** = 1 whole note
- **960 ticks** = 1 sixteenth note

## Examples

### Music Sequencer

```javascript
const timer = new Timer({
  bpm: 120,
  divisions: 24,  // 24 ticks per beat
  bars: 8,
  callback: (event) => {
    // Trigger samples based on bar/division
    if (event.divisionsElapsed === 0) {
      playDrumKit.kick()
    }
    if (event.divisionsElapsed === 12) {
      playDrumKit.snare()
    }
  }
})

await timer.startTimer()
```

### Metronome

```javascript
const metronome = new Timer({
  bpm: 90,
  divisions: 4,   // 4 beats per bar
  callback: (event) => {
    const isDownBeat = event.divisionsElapsed === 0
    playTone(isDownBeat ? 880 : 440)
  }
})

// Tap tempo detection
document.addEventListener('keydown', () => {
  const newBpm = metronome.tapTempo()
  if (newBpm > -1) console.log('BPM:', newBpm)
})

await metronome.startTimer()
```

### MIDI Synchronization

```javascript
const timer = new Timer({ bpm: 120 })
let midiClockStarted = false

midiInput.onmidimessage = (message) => {
  const [status, , ] = message.data
  
  if (status === 0xFA) {
    // MIDI START
    if (!midiClockStarted) {
      timer.startTimer()
      midiClockStarted = true
    }
  } else if (status === 0xFC) {
    // MIDI STOP
    timer.stopTimer()
    midiClockStarted = false
  } else if (status === 0xF8) {
    // MIDI CLOCK (24 per quarter note)
    timer.externalTrigger(true)
  }
}
```

## Building

```bash
# Development server
npm run dev

# Secure HTTPS server (required for AudioContext on some domains)
npm run dev:secure

# Build for production
npm run build

# Type checking
npm run type-check

# Linting types
npm run lint:types
```

## Testing

```bash
# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Browser Support

- **Chrome/Edge**: 80+
- **Firefox**: 78+
- **Safari**: 13+
- **iOS Safari**: 13+

AudioWorklet support available in Chrome/Edge 66+, Firefox 76+, Safari 14.1+.

## License

MIT

## Notes

- **MIDI Compatibility**: Division count defaults to 24 to match MIDI 1.0 spec (24 ticks per quarter note)
- **WebAssembly Future**: Potential for WebAssembly backend for even greater precision
- **Audio Context Limitations**: iOS requires AudioContext creation within user-triggered events; the timer will auto-resume suspended contexts
- **Maximum Bars**: Timer supports a maximum of 32 bars per loop (MAX_BARS_ALLOWED)

## References

- MIDI 1.0 Specification (24 PPQN)
- Web Audio API Specification
- Tap tempo detection based on linear regression techniques
