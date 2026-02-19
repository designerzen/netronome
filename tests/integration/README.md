# Integration Tests - Netronome Timing Library

Comprehensive integration tests validating all time-related calculations and timer behavior.

## Running Tests

### Run all integration tests
```bash
pnpm test
```

### Run specific test file
```bash
pnpm test tests/integration/time-calculations.spec.ts
```

### Watch mode
```bash
pnpm test --watch
```

### UI mode
```bash
pnpm test:ui
```

### Coverage
```bash
pnpm test:coverage
```

## Test Files

### `time-calculations.spec.ts` ⭐ Main Calculations
Core mathematical conversions for musical timing:

**BPM ↔ Period Conversions**
- 120 BPM = 500ms period
- 60 BPM = 1000ms period
- Inverse conversion validation
- Decimal BPM handling
- String input parsing

**MIDI Clock Support**
- MIDI timing clock intervals (24 PPQN standard)
- Custom PPQN values (96 PPQN for MIDI 2.0)
- Fast & slow tempo handling
- Real-world conversion validation

**Time Unit Conversions**
- Seconds to ticks at various BPMs
- Internal tick resolution (3840 ticks/quarter note)
- Bar and beat calculations
- Fractional second handling
- Custom tick resolutions

**Time Formatting**
- HH:MM:SS:MS format
- Millisecond precision
- Field padding validation
- Result caching verification
- Large time value handling

**Tick Constants**
- SemiBreve (whole note) = 15360 ticks
- Beat (quarter note) = 3840 ticks
- SemiQuaver (16th note) = 960 ticks
- Musical ratio validation

**Edge Cases**
- Very fast tempos (300+ BPM)
- Very slow tempos (20 BPM)
- Fractional BPM values
- Microsecond precision timing
- Hour-scale timing

### `epoch-synchronization.spec.ts` ⭐ Global Sync
Epoch-based synchronization across multiple timers:

**Singleton Management**
- Single instance pattern
- Consistent reference across app
- Per-test reset support

**Time Tracking**
- Current Unix timestamp
- Elapsed time calculation
- Time progression validation

**Tick Grid Synchronization**
- Offset to next tick calculation
- Deterministic grid alignment
- Multi-timer synchronization
- Different tempo support

**Tick Number Calculation**
- Absolute tick numbering
- Specific time querying
- Time progression tracking
- Reference epoch support

**Multi-Metronome Scenarios**
- Sync timers at 120 BPM and 60 BPM
- Rapid multiple timers
- Cross-tempo alignment
- Grid consistency

**Reference Epoch Management**
- Custom epoch setting
- Epoch-based recalculation
- Tick reset behavior
- Time reference updating

### `timer-instance.spec.ts` ⭐ Instance Behavior
Timer class initialization and state management:

**Initialization**
- Default option handling
- Configuration persistence
- State initialization (counters at zero)
- Not running on creation
- Not active on creation

**BPM Configuration**
- BPM getter/setter
- Period recalculation on change
- BPM range validation (30-300+)
- Period accuracy validation

**Time Tracking**
- Current bar tracking
- Division tracking
- Bar length calculation
- Total time calculation
- Elapsed time tracking

**Bar & Division Management**
- Divisions elapsed counter
- Bars elapsed counter
- Maximum bars limit
- Synchronization settings

**Callback System**
- Callback registration
- Callback execution
- Null callback support
- Callback updates

**State Management**
- Running state tracking
- Active state tracking
- Bypass state for external clocks
- Availability checking

**Synchronization Features**
- Sync enable/disable
- Synchronization offset calculation
- Global tick number query
- Synchronized state checking

**Multiple Instances**
- Independent timer instances
- Isolated state
- Different configurations
- Simultaneous operation

**Edge Cases**
- Minimum BPM (1)
- Very high BPM (999)
- Single division
- Many divisions (96)
- Single bar
- Many bars (256)

### `tap-tempo.spec.ts`
Tap tempo detection for user-driven tempo input:

**Quick Tap Detection**
- Insufficient tap detection (-1)
- Multi-tap accumulation
- Auto-reset timeout
- Custom minimum taps
- Custom timeout values
- Non-auto-reset mode

**Tempo Range Validation**
- Very slow tempos (40 BPM)
- Fast tempos (240 BPM)
- Musical tempo ranges (60-180 BPM)

**Edge Cases**
- Single tap handling
- Rapid consecutive taps
- Zero timeout with auto-reset
- Very high minimum tap count

**Return Value Validation**
- Valid period numbers
- -1 for insufficient data
- Type consistency

## Test Coverage Statistics

| Category | Tests | Status |
|----------|-------|--------|
| BPM Conversions | 10+ | ✓ |
| Period Conversions | 8+ | ✓ |
| MIDI Clock | 5+ | ✓ |
| Time Formatting | 6+ | ✓ |
| Epoch Sync | 25+ | ✓ |
| Timer Instances | 30+ | ✓ |
| Tap Tempo | 15+ | ✓ |

## Key Scenarios Tested

### 1. Musical Timing
```
120 BPM = 500ms per quarter note
24 divisions per bar (MIDI standard)
16 bars per cycle
Total cycle = 500ms × 24 × 16 = 192 seconds
```

### 2. Cross-Tempo Synchronization
```
Timer 1: 120 BPM (500ms ticks)
Timer 2: 60 BPM (1000ms ticks)
Both sync to same epoch grid
Never drift relative to each other
```

### 3. MIDI Clock Integration
```
120 BPM = 500ms per quarter note
MIDI sends 24 clocks per quarter note
Clock interval = 500ms / 24 ≈ 20.83ms
Can detect tempo from clock intervals
```

### 4. Time Calculations
```
At 120 BPM, 1 second = ~2.4 ticks
At 60 BPM, 1 second = ~1.2 ticks
Calculations independent of tempo
Support fractional seconds
```

## Notes

- Tests use Vitest (fast, ESM-native)
- No external Web Audio API required
- Pure mathematical validation
- Singleton pattern for Epoch tested
- Multiple timer instances validated
- Edge cases thoroughly covered

## Debugging

Print test output:
```bash
pnpm test --reporter=verbose
```

Run single test:
```bash
pnpm test time-calculations.spec.ts -t "BPM to Period"
```

## Common Assertions

```typescript
// BPM ↔ Period round-trip
expect(convertPeriodToBPM(convertBPMToPeriod(120))).toBeCloseTo(120, 5)

// Time calculations
expect(secondsToTicks(1, 60, Ticks.Beat)).toBe(Ticks.Beat)

// Epoch grid alignment
expect(offset).toBeGreaterThan(0)
expect(offset).toBeLessThanOrEqual(tickDuration)

// Multiple instances
expect(timer1.BPM).not.toBe(timer2.BPM)
```
