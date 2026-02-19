import { test, expect } from '@playwright/test'

test.describe('Accuracy Mode Under CPU Duress', () => {
  const TIMER_BPM = 120
  const TEST_DURATION_MS = 2000 // 2 seconds of heavy load
  const EXPECTED_TICKS = (TIMER_BPM / 60) * (TEST_DURATION_MS / 1000) * 24 // BPM * time * divisions

  test('accurate mode should maintain timing despite heavy CPU load', async ({
    page,
  }) => {
    await page.goto('/')

    // Create accurate mode timer
    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Accurate Under Duress')

    const bpmInput = page.locator('#new-timer-bpm')
    await bpmInput.fill(TIMER_BPM.toString())

    // Enable accurate mode
    const accurateCheckbox = page.locator('#new-timer-accurate')
    await accurateCheckbox.check()

    // Enable CPU stress
    const cpuStressCheckbox = page.locator('#new-timer-cpu-stress')
    await cpuStressCheckbox.check()

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Select timer to show details
    const timerItem = page.locator('.timer-item').first()
    await timerItem.click()

    // Start timer
    const startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()

    // Heavy CPU load for the entire test duration
    const heavyComputationHandle = await page.evaluateHandle(() => {
      const startTime = Date.now()
      const duration = 2000

      // Create a busy loop that continuously does CPU work
      const fibonacci = (n: number): number => {
        if (n <= 1) return n
        return fibonacci(n - 1) + fibonacci(n - 2)
      }

      const matrixMultiply = () => {
        const size = 50
        const matrix1 = Array(size)
          .fill(0)
          .map(() => Array(size).fill(Math.random()))
        const matrix2 = Array(size)
          .fill(0)
          .map(() => Array(size).fill(Math.random()))
        const result = Array(size)
          .fill(0)
          .map(() => Array(size).fill(0))

        for (let i = 0; i < size; i++) {
          for (let j = 0; j < size; j++) {
            for (let k = 0; k < size; k++) {
              result[i][j] += matrix1[i][k] * matrix2[k][j]
            }
          }
        }
        return result
      }

      // Run heavy computation continuously
      while (Date.now() - startTime < duration) {
        // Fibonacci calculation
        for (let i = 0; i < 50; i++) {
          fibonacci(18)
        }

        // Matrix multiplication
        for (let i = 0; i < 5; i++) {
          matrixMultiply()
        }

        // String operations
        let str = 'x'
        for (let i = 0; i < 100; i++) {
          str = str + Math.random().toString() + Math.random().toString()
        }

        // Sorting
        const arr = Array(1000)
          .fill(0)
          .map(() => Math.random())
        arr.sort((a, b) => a - b)
      }

      return { computationDone: true }
    })

    // Let CPU stress run while timer is going
    await page.waitForTimeout(TEST_DURATION_MS)

    // Stop timer
    await startBtn.click()

    // Disable CPU stress
    await cpuStressCheckbox.uncheck()

    // Wait for details to update
    await page.waitForTimeout(200)

    // Get metrics from accurate timer
    const statCards = page.locator('.timer-stat-value')
    const accurateLag = await statCards.nth(0).textContent()
    const accurateDrift = await statCards.nth(1).textContent()
    const accurateTicks = await statCards.nth(2).textContent()

    // Parse metrics
    const accurateLagMs = parseFloat(accurateLag?.match(/\d+\.?\d*/)?.[0] || '0')
    const accurateDriftMs = parseFloat(accurateDrift?.match(/\d+\.?\d*/)?.[0] || '0')
    const tickCount = parseInt(accurateTicks?.match(/\d+/)?.[0] || '0')

    // Verify metrics are reasonable
    expect(accurateLag).toMatch(/\d+\.?\d*ms/)
    expect(accurateDrift).toMatch(/\d+\.?\d*ms/)
    expect(tickCount).toBeGreaterThan(0)

    // With CPU stress and accurate mode, drift should still be manageable
    // (not perfect, but significantly better than without accurate mode)
    expect(accurateDriftMs).toBeLessThan(50) // Less than 50ms drift under duress
  })

  test('standard mode should show more drift than accurate mode under duress', async ({
    page,
  }) => {
    await page.goto('/')

    // Test 1: Standard mode with CPU stress
    const standardName = page.locator('#new-timer-name')
    await standardName.fill('Standard Under Duress')

    const bpmInput = page.locator('#new-timer-bpm')
    await bpmInput.fill(TIMER_BPM.toString())

    // CPU stress ON
    const cpuStressCheckbox = page.locator('#new-timer-cpu-stress')
    await cpuStressCheckbox.check()

    let createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Select standard timer
    let timerItem = page.locator('.timer-item').first()
    await timerItem.click()

    // Start standard timer
    let startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()

    // Run under CPU stress
    await page.evaluateHandle(() => {
      const startTime = Date.now()
      const duration = 1500

      const fibonacci = (n: number): number => {
        if (n <= 1) return n
        return fibonacci(n - 1) + fibonacci(n - 2)
      }

      while (Date.now() - startTime < duration) {
        for (let i = 0; i < 100; i++) {
          fibonacci(17)
        }

        for (let i = 0; i < 1000; i++) {
          Math.sqrt(Math.random())
        }
      }
    })

    await page.waitForTimeout(1500)

    // Stop standard timer
    await startBtn.click()
    await page.waitForTimeout(200)

    // Get standard timer metrics
    const statCards1 = page.locator('.timer-stat-value')
    const standardDrift = await statCards1.nth(1).textContent()
    const standardDriftMs = parseFloat(
      standardDrift?.match(/\d+\.?\d*/)?.[0] || '0'
    )

    // Clean up standard timer
    const removeBtn1 = page.locator('.timer-remove').first()
    await removeBtn1.click()
    await page.waitForTimeout(100)

    // Test 2: Accurate mode with CPU stress
    const accurateName = page.locator('#new-timer-name')
    await accurateName.fill('Accurate Under Duress 2')

    const bpmInput2 = page.locator('#new-timer-bpm')
    await bpmInput2.fill(TIMER_BPM.toString())

    // Enable accurate mode
    const accurateCheckbox = page.locator('#new-timer-accurate')
    await accurateCheckbox.check()

    // CPU stress remains ON
    createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Select accurate timer
    timerItem = page.locator('.timer-item').first()
    await timerItem.click()

    // Start accurate timer
    startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()

    // Run under same CPU stress
    await page.evaluateHandle(() => {
      const startTime = Date.now()
      const duration = 1500

      const fibonacci = (n: number): number => {
        if (n <= 1) return n
        return fibonacci(n - 1) + fibonacci(n - 2)
      }

      while (Date.now() - startTime < duration) {
        for (let i = 0; i < 100; i++) {
          fibonacci(17)
        }

        for (let i = 0; i < 1000; i++) {
          Math.sqrt(Math.random())
        }
      }
    })

    await page.waitForTimeout(1500)

    // Stop accurate timer
    await startBtn.click()
    await page.waitForTimeout(200)

    // Get accurate timer metrics
    const statCards2 = page.locator('.timer-stat-value')
    const accurateDrift = await statCards2.nth(1).textContent()
    const accurateDriftMs = parseFloat(
      accurateDrift?.match(/\d+\.?\d*/)?.[0] || '0'
    )

    // Disable CPU stress
    await cpuStressCheckbox.uncheck()

    // Accurate mode should have less drift than standard mode
    expect(accurateDriftMs).toBeLessThanOrEqual(standardDriftMs)
    console.log(
      `Standard drift: ${standardDriftMs}ms, Accurate drift: ${accurateDriftMs}ms`
    )
  })

  test('accurate mode should recover from burst CPU spikes', async ({ page }) => {
    await page.goto('/')

    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Accurate Spike Recovery')

    const bpmInput = page.locator('#new-timer-bpm')
    await bpmInput.fill(TIMER_BPM.toString())

    // Enable accurate mode
    const accurateCheckbox = page.locator('#new-timer-accurate')
    await accurateCheckbox.check()

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Select timer
    const timerItem = page.locator('.timer-item').first()
    await timerItem.click()

    // Start timer
    const startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()

    // Run for a bit
    await page.waitForTimeout(300)

    // Create a sudden CPU spike
    await page.evaluateHandle(() => {
      const startTime = Date.now()
      const duration = 500 // 500ms of intense CPU work

      const fibonacci = (n: number): number => {
        if (n <= 1) return n
        return fibonacci(n - 1) + fibonacci(n - 2)
      }

      while (Date.now() - startTime < duration) {
        for (let i = 0; i < 200; i++) {
          fibonacci(19)
        }
      }
    })

    // Wait for spike to finish
    await page.waitForTimeout(500)

    // Continue for a bit more to see recovery
    await page.waitForTimeout(300)

    // Stop timer
    await startBtn.click()

    // Check metrics
    const statCards = page.locator('.timer-stat-value')
    const lag = await statCards.nth(0).textContent()
    const drift = await statCards.nth(1).textContent()
    const ticks = await statCards.nth(2).textContent()

    // Even with spike, timer should have ticked
    const tickCount = parseInt(ticks?.match(/\d+/)?.[0] || '0')
    expect(tickCount).toBeGreaterThan(5) // Should have at least some ticks

    // Drift should be present but not excessive
    const driftMs = parseFloat(drift?.match(/\d+\.?\d*/)?.[0] || '0')
    expect(driftMs).toBeGreaterThanOrEqual(0)
    expect(driftMs).toBeLessThan(100) // Less than 100ms even with spike
  })

  test('accurate mode should handle sustained heavy load', async ({ page }) => {
    await page.goto('/')

    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Accurate Sustained Load')

    const bpmInput = page.locator('#new-timer-bpm')
    await bpmInput.fill('140') // Faster tempo = more demanding

    // Enable accurate mode
    const accurateCheckbox = page.locator('#new-timer-accurate')
    await accurateCheckbox.check()

    // Enable metronome for audio feedback
    const metronomeCheckbox = page.locator('#new-timer-metronome')
    await metronomeCheckbox.check()

    // Enable CPU stress
    const cpuStressCheckbox = page.locator('#new-timer-cpu-stress')
    await cpuStressCheckbox.check()

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Select timer
    const timerItem = page.locator('.timer-item').first()
    await timerItem.click()

    // Start timer
    const startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()

    // Sustain heavy load for 3 seconds
    const testDuration = 3000
    const ticksAccumulated: number[] = []

    // Monitor ticks periodically
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(500)

      const statCards = page.locator('.timer-stat-value')
      const ticks = await statCards.nth(2).textContent()
      const tickCount = parseInt(ticks?.match(/\d+/)?.[0] || '0')
      ticksAccumulated.push(tickCount)
    }

    // Stop timer
    await startBtn.click()

    // Disable stress
    await cpuStressCheckbox.uncheck()

    // Verify timer maintained steady ticking under load
    const finalTickCount = ticksAccumulated[ticksAccumulated.length - 1]
    expect(finalTickCount).toBeGreaterThan(20) // 140 BPM = ~56 ticks/sec

    // Ticks should generally increase (some might be same due to UI update lag)
    let increasingCount = 0
    for (let i = 1; i < ticksAccumulated.length; i++) {
      if (ticksAccumulated[i] >= ticksAccumulated[i - 1]) {
        increasingCount++
      }
    }

    // Most samples should show equal or increasing ticks
    expect(increasingCount).toBeGreaterThanOrEqual(4)
  })
})
