import { test, expect } from '@playwright/test'

test.describe('Worker Type Behavior', () => {
  const TIMER_BPM = 120
  const TEST_DURATION_MS = 500

  const workerTypes = [
    { name: 'audiocontext', label: 'Audio Context' },
    { name: 'rolling', label: 'Rolling' },
    { name: 'setinterval', label: 'SetInterval' },
    { name: 'settimeout', label: 'SetTimeout' },
  ]

  for (const workerType of workerTypes) {
    test(`${workerType.label} worker should start and stop cleanly`, async ({
      page,
    }) => {
      await page.goto('/')

      const nameInput = page.locator('#new-timer-name')
      await nameInput.fill(`${workerType.label} Timer`)

      const bpmInput = page.locator('#new-timer-bpm')
      await bpmInput.fill(TIMER_BPM.toString())

      const workerSelect = page.locator('#new-timer-worker')
      await workerSelect.selectOption(workerType.name)

      const createBtn = page.locator('#create-timer')
      await createBtn.click()

      // Verify timer created
      const timerItem = page.locator('.timer-item').first()
      await expect(timerItem).toBeVisible()

      // Start
      const startBtn = page.locator('.timer-toggle').first()
      await startBtn.click()
      await expect(startBtn).toContainText('Stop')

      // Run for specified duration
      await page.waitForTimeout(TEST_DURATION_MS)

      // Stop
      await startBtn.click()
      await expect(startBtn).toContainText('Start')

      // Verify responsive after stop
      await page.waitForTimeout(100)
      await expect(timerItem).toBeVisible()
    })

    test(`${workerType.label} worker with accurate mode should track metrics`, async ({
      page,
    }) => {
      await page.goto('/')

      const nameInput = page.locator('#new-timer-name')
      await nameInput.fill(`${workerType.label} Accurate`)

      const bpmInput = page.locator('#new-timer-bpm')
      await bpmInput.fill(TIMER_BPM.toString())

      const accurateCheckbox = page.locator('#new-timer-accurate')
      await accurateCheckbox.check()

      const workerSelect = page.locator('#new-timer-worker')
      await workerSelect.selectOption(workerType.name)

      const createBtn = page.locator('#create-timer')
      await createBtn.click()

      // Select to view details
      const timerItem = page.locator('.timer-item').first()
      await timerItem.click()

      // Start timer
      const startBtn = page.locator('.timer-toggle').first()
      await startBtn.click()

      // Let it accumulate data
      await page.waitForTimeout(TEST_DURATION_MS)

      await startBtn.click()

      // Verify metrics captured
      const statCards = page.locator('.timer-stat-value')
      const count = await statCards.count()
      expect(count).toBeGreaterThanOrEqual(3)
    })
  }

  test('should compare timing consistency across worker types', async ({
    page,
  }) => {
    await page.goto('/')

    const metrics: Record<string, { lag: string; drift: string }> = {}

    for (const workerType of workerTypes) {
      const nameInput = page.locator('#new-timer-name')
      await nameInput.fill(`${workerType.label} Comparison`)

      const bpmInput = page.locator('#new-timer-bpm')
      await bpmInput.fill(TIMER_BPM.toString())

      const workerSelect = page.locator('#new-timer-worker')
      await workerSelect.selectOption(workerType.name)

      const createBtn = page.locator('#create-timer')
      await createBtn.click()

      // Select to show details
      const timerItem = page.locator('.timer-item').last()
      await timerItem.click()

      // Start
      const startBtn = page.locator('.timer-toggle').last()
      await startBtn.click()

      await page.waitForTimeout(TEST_DURATION_MS)

      await startBtn.click()

      // Capture metrics
      const statCards = page.locator('.timer-stat-value')
      const lag = await statCards.nth(0).textContent()
      const drift = await statCards.nth(1).textContent()

      metrics[workerType.name] = {
        lag: lag || '0ms',
        drift: drift || '0ms',
      }

      // Remove for next iteration
      const removeBtn = page.locator('.timer-remove').last()
      await removeBtn.click()
      await page.waitForTimeout(100)
    }

    // Log comparison results
    console.log('Worker Type Comparison:')
    console.log(JSON.stringify(metrics, null, 2))

    // All workers should produce valid metrics
    for (const [workerType, metric] of Object.entries(metrics)) {
      expect(metric.lag).toMatch(/\d+\.?\d*ms/)
      expect(metric.drift).toMatch(/\d+\.?\d*ms/)
    }
  })
})
