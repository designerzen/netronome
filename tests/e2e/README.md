# E2E Tests - Netronome Timing Library

End-to-end tests for Netronome using Playwright. These tests validate timer accuracy, worker type behavior, and timing consistency.

## Running Tests

### Run all tests
```bash
# Terminal 1: Start dev server
pnpm dev

# Terminal 2: Run e2e tests
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
pnpm test:e2e tests/e2e/accuracy-under-duress.spec.ts
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

### `accuracy-under-duress.spec.ts` ⭐⭐ **NEW**
**Comprehensive stress testing under heavy CPU load:**

1. **Accurate mode maintains timing despite heavy CPU**
   - Creates accurate-mode timer
   - Applies sustained CPU stress (fibonacci, matrix math, sorting)
   - Verifies drift remains < 50ms even with duress
   - Confirms timer self-corrects

2. **Accurate vs Standard comparison under duress**
   - Standard mode with 1500ms CPU stress
   - Accurate mode with identical CPU stress
   - Proves accurate mode has less drift
   - Shows real-world improvement

3. **Recovery from burst CPU spikes**
   - Timer running normally
   - Sudden 500ms of intense CPU work
   - Verifies recovery happens
   - Checks ticks continue after spike

4. **Sustained heavy load at 140 BPM**
   - Fast tempo (140 BPM) under continuous CPU stress
   - Metronome enabled for audio feedback
   - Monitors tick accumulation over time
   - Verifies steady operation despite load

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

## Accurate Mode Under Duress

The new duress tests validate that **accurate mode self-corrects even under extreme conditions**:

### Test Scenario 1: Sustained Heavy Load
```
Condition: 2 seconds of heavy CPU work (fibonacci, matrix ops)
Expected: Drift < 50ms with accurate mode
Proof: Accurate mode maintains timing despite continuous blocking
```

### Test Scenario 2: Burst CPU Spike
```
Condition: Sudden 500ms of intense CPU work during normal operation
Expected: Timer recovers after spike
Proof: Ticks continue, no glitches or resets
```

### Test Scenario 3: Standard vs Accurate Comparison
```
Condition: Both timers under identical CPU stress
Result: accurate_drift ≤ standard_drift
Proof: Accurate mode is measurably better under load
```

### Test Scenario 4: Fast Tempo Under Duress
```
Condition: 140 BPM + metronome + CPU stress for 3 seconds
Expected: Steady tick accumulation (> 20 ticks)
Proof: Timer handles demanding workload reliably
```

## CPU Stress Workloads

The duress tests use realistic heavy CPU loads:

```javascript
// Fibonacci calculation (CPU intensive recursion)
fibonacci(18-19) computed repeatedly

// Matrix multiplication (large-scale math)
50x50 matrix multiplied multiple times per iteration

// String operations (garbage collection stress)
Repeated string concatenation with random numbers

// Array sorting (algorithmic complexity)
1000-element array sorting per iteration
```

## Accurate Mode Feature Validation

The tests verify that accurate mode:

1. ✓ **Reduces drift under load** - Measurably better than standard mode
2. ✓ **Maintains synchronization** - Doesn't fall out of epoch sync
3. ✓ **Self-corrects** - Adapts to changing CPU conditions
4. ✓ **Doesn't block** - Timer continues operating
5. ✓ **Supports metronome** - Audio feedback still works
6. ✓ **Works across workers** - All worker types benefit
7. ✓ **Recovers from spikes** - Handles burst CPU events
8. ✓ **Sustains performance** - No degradation over time

## Notes

- Tests run sequentially (not in parallel) for timing consistency
- Each test creates its own timer instance
- Tests automatically clean up by removing timers
- CPU stress test uses computationally intensive work to validate robustness
- Metronome tests require Web Audio API support
- Duress tests run longer (2-3 seconds each) to stress system adequately

## Performance Expectations

| Condition | Standard Mode | Accurate Mode |
|-----------|---------------|---------------|
| No load | < 5ms drift | < 5ms drift |
| Light load | 10-20ms drift | 5-10ms drift |
| Heavy load | 30-50ms drift | < 30ms drift |
| CPU spike | 50-100ms+ drift | 20-50ms drift |

## Debugging

Enable verbose logging by setting environment variable:
```bash
DEBUG=pw:api pnpm test:e2e
```

View HTML report after test run:
```bash
npx playwright show-report
```

Run single duress test with debugging:
```bash
pnpm test:e2e tests/e2e/accuracy-under-duress.spec.ts --debug
```
