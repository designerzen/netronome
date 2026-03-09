# Netronome

A high-precision timing and tempo library for JavaScript, designed to achieve near-perfect timing accuracy in native JavaScript with zero dependencies. Provides multiple timing backends using Web Workers, AudioContext, and more for accurate scheduling and beat synchronization.

You can use this for repeating timings in contexts such as animation or audio or synching both together!

**[Live Demo](https://designerzen.github.io/netronome/)** - Test timing accuracy in your browser with interactive GUI

## Overview

Netronome is a comprehensive timing system that prioritizes accuracy in JavaScript environments. It mitigates browser timing limitations (like [Spectre/Meltdown mitigations](https://developer.mozilla.org/en-US/docs/Glossary/spectre) that round timer values) by offering multiple timing backends with varying precision characteristics. The library is particularly useful for music production, metronomes, sequencers, and any application requiring precise temporal control.

### Key Features

- **Multiple timing backends**: AudioContext Worker, Web Workers (setInterval/setTimeout), rolling timers, and audio worklets
- **High-precision timing**: Works around browser timing resolution limitations
- **Tap tempo detection**: Automatic BPM detection from user input with linear regression
- **MIDI clock support**: External clock synchronization (24 pulses per quarter note)
- **Instance-based timers**: Run multiple independent timers at different rates simultaneously
- **Beat and bar synchronization**: Full support for bars, divisions (24 per beat, MIDI-compliant), and musical time calculations
- **Comprehensive timing metrics**: Track drift, lag, and expected vs. actual timing with visual indicators
- **Audio worklet support**: Ultra-low-latency timing on supported browsers
- **TypeScript support**: Fully typed API
- **Visual Tick Indicators**: Bright glowing pulse animation on every timer tick for immediate visual feedback
- **Tick Audio**: Optional audio beep sound on each timer tick (1200Hz, 30ms) for auditory feedback
- **Interactive GUI**: Real-time timer monitoring with performance charts and statistics
- **CPU Stress Testing**: Test timing accuracy under CPU load
- **Dark/Light Theme**: Automatic theme detection with manual toggle

## Installation

```bash
npm install netronome
# or
pnpm add netronome
# or
yarn add netronome
```

## Quick Start

### Basic Usage

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

### Create Multiple Timers

```javascript
import { createTimer } from 'netronome'

// Create independent timers running at different tempos
const timer1 = createTimer({ interval: 500 })  // 120 BPM
const timer2 = createTimer({ interval: 333 })  // 180 BPM

await timer1.startTimer(callback1)
await timer2.startTimer(callback2)
```

## GUI Features

The interactive demo provides:

### Index Page (Main Dashboard)
- Create timers with custom names and tempos
- Select different worker types (AudioContext, AudioWorklet, Rolling, SetInterval, SetTimeout)
- Enable/disable accurate mode (drift compensation)
- Optional metronome sounds
- MIDI clock synchronization
- CPU stress testing
- Real-time performance monitoring
- Timer details panel with timing statistics
- Visual tick indicators with configurable audio feedback

### Multi-Timer Page
- Compare multiple timers running simultaneously
- Global controls for Start All, Stop All, Reset All
- Per-timer statistics (average lag, drift, tick count)
- Performance comparison chart
- Worker type display for each timer
- Configurable tick audio per timer
- Dark/light theme support

## API Reference

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
- **BPM**: `number` - Get/set beats per minute (uppercase variant)
- **bar**: `number` - Current bar (0 to bars-1)
- **barsElapsed**: `number` - Total bars completed
- **divisionsElapsed**: `number` - Ticks elapsed in current bar (0 to divisions-1)
- **now**: `number` - Current timestamp using high-resolution timer
- **timeElapsed**: `number` - Time elapsed since timer started
- **timeBetween**: `number` - Time between divisions in milliseconds
- **timePerBar**: `number` - Duration of one bar in milliseconds
- **totalTime**: `number` - Total loop duration in milliseconds (all bars)
- **totalBars**: `number` - Total number of bars
- **totalDivisions**: `number` - Total divisions per bar
- **barProgress**: `number` - Current bar progress 0-1
- **beatProgress**: `number` - Current beat/division progress 0-1
- **quarterNoteDuration**: `number` - Duration of one beat in microseconds
- **quarterNoteDurationInSeconds**: `number` - Duration of one beat in seconds
- **microTempo**: `number` - Tempo in microseconds per bar
- **microsPerMIDIClock**: `number` - Microseconds per MIDI clock event
- **ticksPerSecond**: `number` - Number of ticks per second
- **elapsedSinceLastTick**: `number` - Time elapsed since last tick event
- **isBypassed**: `boolean` - Whether using external clock (bypass internal timing)
- **isActive**: `boolean` - Whether timer is active
- **swing**: `number` - Swing offset as fraction of divisions (0-1)

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

##### `retrigger()`

Repeat previous clock tick but do not advance.

##### `useExternalClock(enabled?)`

Enable or disable external clock mode (bypass internal timing).

- **enabled**: `boolean` - Whether to use external clock (default: true)

##### `setBPM(value)`

Set the timer tempo in beats per minute.

- **value**: `number | string` - Beats per minute

##### `setTimeBetween(time)`

Set the time between each division in milliseconds.

- **time**: `number` - Milliseconds between ticks

##### `setSwing(value)`

Set swing offset as a fraction of divisions.

- **value**: `number` - Swing value 0-1

### Position & State Getters

- **isAtStartOfBar**: `boolean` - True if at bar progress 0
- **isStartBar**: `boolean` - True if at bar 0
- **isAtStart**: `boolean` - True if at division 0
- **isAtMiddleOfBar**: `boolean` - True if at bar progress 0.5
- **isQuarterNote**: `boolean` - True if at quarter note boundary
- **isHalfNote**: `boolean` - True if at half note boundary
- **isSwungBeat**: `boolean` - True if current division is a swung beat
- **isUsingExternalTrigger**: `boolean` - True if external clock is active

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
Ultra-low-latency option using modern Web Audio worklets (Chrome 66+, Firefox 76+, Safari 14.1+).

### Rolling Timer
Custom rolling timer implementation with frame-based synchronization.

### setInterval/setTimeout
Standard browser timer APIs (lower precision due to browser rounding).

## Timing Accuracy

Modern browsers limit timer precision to mitigate [Spectre/Meltdown attacks](https://developer.mozilla.org/en-US/docs/Glossary/spectre):
- **Firefox**: 1ms granularity
- **Chrome**: 100μs with jitter
- **Safari**: Variable, context-dependent

Netronome works around these limitations by:
1. Using [AudioContext timestamps](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/currentTime) (when available) for sub-millisecond precision
2. Tracking and reporting drift and lag metrics
3. Providing multiple backend options for different use cases
4. Averaging timing measurements across samples
5. Visual feedback (bright glowing pulse) on every tick
6. Optional audio feedback for auditory confirmation

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

[AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) support available in Chrome/Edge 66+, Firefox 76+, Safari 14.1+.

## License

MIT

## Notes

- **MIDI Compatibility**: Division count defaults to 24 to match [MIDI 1.0 spec](https://en.wikipedia.org/wiki/MIDI_clock) (24 ticks per quarter note)
- **Visual Feedback**: Every timer tick is accompanied by a bright, glowing pulse indicator for immediate visual feedback
- **Audio Feedback**: Optional tick audio (1200Hz sine wave, 30ms duration) can be enabled for auditory feedback on each tick
- **WebAssembly Future**: Potential for [WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly) backend for even greater precision
- **Audio Context Limitations**: iOS requires [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) creation within user-triggered events; the timer will auto-resume suspended contexts
- **Maximum Bars**: Timer supports a maximum of 32 bars per loop (MAX_BARS_ALLOWED)
- **Worker Type Display**: Timer type is displayed on the GUI for easy identification of which timing backend is in use
- **Semantic HTML**: The GUI uses semantic HTML elements (header, section, article) for better accessibility

## References

- [MIDI 1.0 Specification](https://en.wikipedia.org/wiki/MIDI) - Overview and clock specification
- [Web Audio API Specification](https://www.w3.org/TR/webaudio/) - W3C Web Audio API standard
- [Tap Tempo Detection with Linear Regression](https://www.nayuki.io/page/tap-to-measure-tempo-javascript) - Nayuki's detailed implementation guide
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) - MDN Web Workers documentation
- [AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) - MDN AudioContext documentation
- [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) - MDN AudioWorklet documentation
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance) - High-resolution time measurement
