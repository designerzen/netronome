# Netronome

Timing, transport and clock-synchronisation library used by Harmoneasy. The package exports named classes and helpers from [src/index.ts](src/index.ts); there is no default export from the package root. [package.json](package.json) resolves consumers to `dist/`.

## Build and use

From the parent workspace, run `pnpm --filter netronome build:lib` before consuming updated source through package imports.

```ts
import { Timer, TIMER_TYPE_SET_INTERVAL } from "netronome"

const timer = new Timer({ bpm: 120, divisions: 24, bars: 16, type: TIMER_TYPE_SET_INTERVAL })
await timer.startTimer(event => console.log(event.bar, event.divisionsElapsed))
await timer.stopTimer()
```

For audio scheduling, create/resume the context from a user action:

```ts
import { AudioTimer } from "netronome"

const context = new AudioContext()
await context.resume()
const timer = new AudioTimer(context, true)
timer.BPM = 120
await timer.startTimer(event => console.log(event.scheduledContextTimeSeconds))
// On teardown: await timer.stopTimer(); await context.close()
```

`createTimer(options)` returns an independent `Timer`; use `bpm`, not an `interval` property. The module-level `startTimer(callback, intervalMs, options)`, `stopTimer`, `getTimer`, `setTimeBetween` and `resetTimer` manage a separate singleton.

## Clock and transport contracts

[TimerOptions and callback types](src/timer-interfaces.ts), [defaults](src/timer-options.ts), [Timer](src/timer.ts) and [AudioTimer](src/timer-audio.ts) define the current API.

- Defaults are 90 BPM, 24 divisions, 16 bars, audio-worklet timing and local-grid synchronisation. Timer types also include elastic audio-worklet, audio-context, rolling, set-interval and set-timeout; use exported constants.
- `divisions` defaults to 24 ticks per quarter note for MIDI clock. Legacy counters wrap `divisionsElapsed` at `divisions`; their `bar` labels do not establish a four-quarter-note musical bar. Network transport has a separate beat-position and quantum contract.
- `Timer.now` uses its clock's units; `AudioTimer.now` and `audioTimeSeconds` use AudioContext seconds. `performanceTimeMs` and the audio/performance conversion helpers explicitly use milliseconds. Keep scheduling in one clock domain.
- Use callback fields such as `scheduledContextTimeSeconds` for scheduled audio when supplied. `expected` remains transport-continuous across live tempo changes; tempo changes affect future spacing.
- `startTimer`, `stopTimer`, `toggleTimer`, `resetTimer`, `setCallback`, `externalTrigger`, `useExternalClock`, `setBPM`, `setTimeBetween` and `setSwing` are instance operations. Maximum configured loop bars: 32. Inspect source for legacy getter units rather than inferring units from names such as `microTempo`.
- Accuracy and callback delivery depend on backend, workload and device. The demo's charts, pulse indicators and click audio are demo features, not guarantees or automatic library output.

## Shared clocks and rooms

[SyncSession](src/sync-session.ts) estimates clock offsets. [NetworkSession](src/network-session.ts) coordinates a leader/follower transport with lookahead scheduling, revisions, transport proposals and latency compensation. The host supplies peer IDs and message routing via `send`; the library does not create Harmoneasy's room UI or choose player parts. [WebRTC synchronization](src/webrtc-sync.ts) supplies additional transport helpers. See [network timeline types](src/network-timeline.ts) for beat positions and quantum semantics.

## Demo and development

[Live demo](https://designerzen.github.io/netronome/). The manifest defines `dev`, `build`, `build:lib`, `preview`, `signal`, `cert`, `type-check`, lint and Vitest/Playwright scripts. There is no `dev:secure` script. AudioWorklet and capture-related browser capabilities depend on the deployment's secure context and platform.

See [test guide](tests/README.md), [integration tests](tests/integration/README.md) and [browser tests](tests/e2e/README.md). Source and tests, rather than old browser-version claims, are the reference for backend behavior.
