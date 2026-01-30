# Test Suite Documentation

## Overview

The `tests/` directory contains the unit and integration tests for the netronome project. Tests are organized by type and module for clarity and maintainability.

## Directory Structure

```
tests/
├── unit/                          # Unit tests
│   ├── timer.test.ts             # Timer class tests (80+ tests)
│   └── tap-tempo.test.ts          # Tap tempo detection tests (20+ tests)
├── integration/                   # Integration tests (future)
├── fixtures/                      # Test data and factories
│   └── timer-fixtures.ts          # Timer test utilities
├── vitest.setup.ts               # Global test configuration
└── README.md                      # This file
```

## Running Tests

### Run All Tests
```bash
npm run test
```
Runs all tests in watch mode with auto-reload.

### Run Tests Once
```bash
npm run test -- --run
```

### View Test Dashboard
```bash
npm run test:ui
```
Opens interactive test UI at http://localhost:51204

### Generate Coverage Report
```bash
npm run test:coverage
```
Creates `coverage/` directory with detailed reports.

### Run Specific Test File
```bash
npm run test tests/unit/timer.test.ts
```

### Run Tests Matching Pattern
```bash
npm run test -- --grep "Timer Class"
```

## Test Files

### tests/unit/timer.test.ts
**Purpose:** Comprehensive unit tests for the Timer class

**Test Coverage:**
- Utility functions (BPM conversion, time formatting)
- Timer initialization and defaults
- Getters (time calculations, progress tracking, state detection)
- Setters (bar, BPM, tempo, swing)
- Control methods (reset, callbacks, conversions)
- Bypass mode (external clock)
- External triggers
- Tap tempo integration
- Edge cases and error handling

**Test Count:** 80+ tests

**Key Test Suites:**
1. **Timer Utility Functions** - Static utility functions
2. **Timer Class** - Instance methods and properties
3. **Timer Configuration** - Constructor options
4. **Timer Edge Cases** - Boundary conditions

### tests/unit/tap-tempo.test.ts
**Purpose:** Tests for tap tempo detection algorithms

**Test Coverage:**
- Quick tap tempo detection
- Full tap tempo with linear regression
- Tempo calculation and accuracy
- Reset behavior
- Timeout handling
- Integration between quick and full detection

**Test Count:** 20+ tests

**Key Test Suites:**
1. **tapTempoQuick** - Fast detection algorithm
2. **tapTempo** - Advanced detection with regression
3. **Tap Tempo Integration** - Combined testing
4. **Edge Cases** - Boundary conditions

## Test Fixtures

### timer-fixtures.ts
Reusable test utilities and data:

```typescript
// Create test timers with defaults
const timer = createTestTimer({ bpm: 140 })

// Mock callback for event testing
const { callback, getCalls } = createMockCallback()

// Simulate tick events
simulateTicks(timer, 10)

// Test scenarios
const scenario = TIMING_SCENARIOS.standard16Bar

// Format timer state for debugging
const state = formatTimerState(timer)
```

## Writing Tests

### Basic Test Structure
```typescript
import { describe, it, expect } from 'vitest'
import Timer from '../../src/timer'

describe('MyFeature', () => {
  it('should do something', () => {
    const timer = new Timer()
    expect(timer.bars).toBe(16)
  })
})
```

### Using Fixtures
```typescript
import { createTestTimer, simulateTicks } from '../fixtures/timer-fixtures'

describe('Feature', () => {
  it('should work with fixture', () => {
    const timer = createTestTimer({ bpm: 120 })
    simulateTicks(timer, 5)
    expect(timer.divisionsElapsed).toBe(5)
  })
})
```

### Testing Async Code
```typescript
it('should handle async operations', async () => {
  const result = await timer.startTimer()
  expect(result).toBeDefined()
})
```

### Using Mocks and Spies
```typescript
import { vi } from 'vitest'

it('should call callback', () => {
  const callback = vi.fn()
  timer.setCallback(callback)
  timer.onTick(0.1, 0.1, 0, 0, 1, 0)
  expect(callback).toHaveBeenCalled()
})
```

### Testing Timing Code
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Timing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should handle time advancement', () => {
    vi.advanceTimersByTime(500)
    // Test time-sensitive code
  })
})
```

## Test Coverage

Current coverage targets:

| Component | Coverage | Notes |
|-----------|----------|-------|
| Timer class | 85%+ | Most methods tested |
| Tap tempo | 80%+ | Various scenarios covered |
| Utilities | 90%+ | All conversions tested |
| Workers | 0% | Integration tests needed |
| Audio | 0% | Integration tests needed |

Run coverage:
```bash
npm run test:coverage
```

View HTML report:
```bash
open coverage/index.html
```

## Best Practices

### 1. Test Organization
- Group related tests with `describe()`
- Use clear, descriptive test names
- One assertion per test when possible

### 2. Test Data
- Use fixtures for common setups
- Keep test data minimal and focused
- Document complex test scenarios

### 3. Cleanup
- Use `beforeEach()` / `afterEach()` for setup/teardown
- Clear mocks and timers after tests
- Don't rely on test order

### 4. Performance
- Mock expensive operations
- Use fake timers for time-based tests
- Keep tests fast (<100ms each)

### 5. Readability
- Use meaningful variable names
- Avoid magic numbers
- Add comments for complex logic

## Common Test Patterns

### Testing State Changes
```typescript
it('should update state', () => {
  const initial = timer.currentBar
  timer.currentBar = 5
  expect(timer.currentBar).toBe(5)
  expect(timer.currentBar).not.toBe(initial)
})
```

### Testing Calculations
```typescript
it('should calculate correctly', () => {
  timer.bpm = 120
  const expected = MICROSECONDS_PER_MINUTE / (250 * 24)
  expect(timer.BPM).toBeCloseTo(expected)
})
```

### Testing Callbacks
```typescript
it('should trigger callback', () => {
  const callback = vi.fn()
  timer.setCallback(callback)
  timer.onTick(0.1, 0.1, 0, 0, 1, 0)
  expect(callback).toHaveBeenCalledWith(expect.objectContaining({
    bar: expect.any(Number)
  }))
})
```

### Testing Edge Cases
```typescript
it('should handle edge cases', () => {
  expect(() => {
    timer.setBars(0)
  }).not.toThrow()
  
  expect(timer.bars).toBeGreaterThanOrEqual(1)
})
```

## Debugging Tests

### Run Single Test
```bash
npm run test tests/unit/timer.test.ts
```

### Run Tests Matching Pattern
```bash
npm run test -- --grep "BPM"
```

### Increase Test Timeout
```typescript
it('should do something slow', async () => {
  // test code
}, 20000) // 20 second timeout
```

### Debug Output
```typescript
it('test', () => {
  console.log('Debug info:', timer.BPM)
  expect(timer.BPM).toBe(120)
})
```

Run with output:
```bash
npm run test -- --reporter=verbose
```

## CI/CD Integration

Tests are run in GitHub Actions. Configuration:

```yaml
- name: Run tests
  run: npm run test -- --run

- name: Generate coverage
  run: npm run test:coverage
```

## Future Improvements

- [ ] Integration tests for Worker timing
- [ ] AudioContext API testing
- [ ] Performance benchmarks
- [ ] E2E tests with demo UI
- [ ] Coverage reports in CI
- [ ] Test report artifacts

## Contributing Tests

When adding features:

1. Write tests first (TDD)
2. Make tests pass
3. Ensure coverage > 80%
4. Update this README if needed

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://vitest.dev/guide/)
- [Assertion Reference](https://vitest.dev/api/expect.html)

## Troubleshooting

### Tests Not Found
- Ensure files end with `.test.ts` or `.spec.ts`
- Check file is in `tests/` or `src/` directory
- Verify vitest.config.ts includes the path

### Import Errors
- Use relative paths: `../../src/timer`
- Check file extensions match

### Timeout Errors
- Increase timeout in test: `{ timeout: 20000 }`
- Check for infinite loops

### Flaky Tests
- Avoid time-dependent assertions
- Use fake timers (`vi.useFakeTimers()`)
- Clean up properly in `afterEach()`

---

For questions, see [VITE_SETUP.md](../VITE_SETUP.md#writing-tests)
