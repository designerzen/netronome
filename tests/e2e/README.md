# E2E Tests - Netronome Timing Library

End-to-end tests for Netronome using Playwright. These tests validate timer accuracy, worker type behavior, and timing consistency.

## Running Tests

### Run all tests
```bash
pnpm test:e2e
```

### UI mode (interactive)
```bash
pnpm test:e2e:ui
```

### Debug mode
```bash
pnpm test:e2e:debug
```

### Run specific test file
```bash
pnpm test:e2e tests/e2e/timing-accuracy.spec.ts
```

### Run with specific browser
```bash
pnpm test:e2e --project=chromium
pnpm test:e2e --project=firefox
pnpm test:e2e --project=webkit
```

## Test Files

### `timing-basic.spec.ts`
- Timer creation and naming
- Start/stop functionality
- Timer removal
- BPM input synchronization

### `timing-accuracy.spec.ts` ⭐
Main accuracy tests:
- **Standard vs Accurate Mode**: Verifies accurate mode settings
- **Drift & Lag Metrics**: Validates calculated drift and lag values
- **Metronome Sound**: Tests audio playback when enabled
- **CPU Stress**: Ensures timer accuracy under CPU load
- **Synchronization**: Validates epoch synchronization offset

### `worker-types.spec.ts`
Tests for each worker implementation:
- AudioContext Worker
- Rolling Worker
- SetInterval Worker
- SetTimeout Worker

Each worker is tested for:
- Clean start/stop behavior
- Accurate mode compatibility
- Metric tracking
- Cross-worker comparison

## Key Metrics Tested

| Metric | Unit | Description |
|--------|------|-------------|
| Lag | ms | Time delay in tick execution |
| Drift | ms | Deviation from expected timing |
| Ticks | count | Number of timer ticks accumulated |
| BPM | beats/min | Configured tempo |

## Accurate Mode Testing

The accurate mode test suite validates:

1. **Configuration**: Accurate checkbox can be enabled
2. **Metrics**: Accurate timers produce measurable lag/drift
3. **Worker Support**: All worker types support accurate mode
4. **Performance**: Accurate mode doesn't block timer operation

## Notes

- Tests run sequentially (not in parallel) for timing consistency
- Each test creates its own timer instance
- Tests automatically clean up by removing timers
- CPU stress test uses computationally intensive work to validate robustness
- Metronome tests require Web Audio API support

## Debugging

Enable verbose logging by setting environment variable:
```bash
DEBUG=pw:api pnpm test:e2e
```

View HTML report after test run:
```bash
npx playwright show-report
```
