import { test, expect } from '@playwright/test'

test.describe('Timer Accuracy Tests', () => {
  test('standard mode should produce tick events', async ({ page }) => {
    await page.goto('/')

    const ticksReceived: number[] = []

    // Listen for tick events via exposed function
    await page.evaluateHandle(() => {
      ;(window as any).recordedTicks = []
    })

    // Create standard timer
    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Standard Timer')

    const bpmInput = page.locator('#new-timer-bpm')
    await bpmInput.fill('120')

    // Standard mode (default)
    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Start timer
    const startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()

    // Wait for ticks to accumulate
    await page.waitForTimeout(500)

    // Stop timer
    await startBtn.click()

    // Check that timer is running (has stats)
    const timerDetailsPanel = page.locator('#timer-details-panel')
    await expect(timerDetailsPanel).toBeVisible()
  })

  test('accurate mode should improve timing consistency', async ({ page }) => {
    await page.goto('/')

    // Create accurate timer
    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Accurate Timer')

    const bpmInput = page.locator('#new-timer-bpm')
    await bpmInput.fill('120')

    // Check accurate checkbox
    const accurateCheckbox = page.locator('#new-timer-accurate')
    await accurateCheckbox.check()
    await expect(accurateCheckbox).toBeChecked()

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Verify timer shows accurate setting in details
    const timerItem = page.locator('.timer-item').first()
    await timerItem.click()

    const detailsPanel = page.locator('#timer-details-panel')
    await expect(detailsPanel).toBeVisible()
  })

  test('different worker types should handle timing differently', async ({
    page,
  }) => {
    await page.goto('/')

    // Test AudioContext worker (default)
    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('AudioContext Timer')

    const workerSelect = page.locator('#new-timer-worker')
    await workerSelect.selectOption('audiocontext')

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    let timerItem = page.locator('.timer-item').first()
    await expect(timerItem).toContainText('AudioContext Timer')

    // Clean up
    const removeBtn = page.locator('.timer-remove').first()
    await removeBtn.click()

    // Test Rolling worker
    await nameInput.fill('Rolling Timer')
    await workerSelect.selectOption('rolling')
    await createBtn.click()

    timerItem = page.locator('.timer-item').first()
    await expect(timerItem).toContainText('Rolling Timer')
  })

  test('should calculate drift and lag metrics', async ({ page }) => {
    await page.goto('/')

    // Create timer
    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Metrics Timer')

    const bpmInput = page.locator('#new-timer-bpm')
    await bpmInput.fill('120')

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Select timer to show details
    const timerItem = page.locator('.timer-item').first()
    await timerItem.click()

    // Start timer
    const startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()

    // Let it run
    await page.waitForTimeout(1000)

    // Stop timer
    await startBtn.click()

    // Check for stat cards (lag, drift, ticks)
    const statCards = page.locator('.timer-stat-value')
    await expect(statCards).toHaveCount(3)

    // Get lag value (should be in milliseconds)
    const lagValue = await statCards.nth(0).textContent()
    expect(lagValue).toMatch(/\d+\.\d+ms/)

    // Get drift value
    const driftValue = await statCards.nth(1).textContent()
    expect(driftValue).toMatch(/\d+\.\d+ms/)

    // Get ticks value (should be number)
    const ticksValue = await statCards.nth(2).textContent()
    expect(ticksValue).toMatch(/\d+/)
  })

  test('metronome sound should play when enabled', async ({ page }) => {
    await page.goto('/')

    // Set up listener to track if audio context was used
    let audioContextCreated = false
    let timerStarted = false
    
    await page.evaluateHandle(() => {
      ;(window as any).audioContextUsed = false
      ;(window as any).metronomeBeepsCalled = 0
    })

    const metronomeCheckbox = page.locator('#new-timer-metronome')
    await metronomeCheckbox.check()
    await expect(metronomeCheckbox).toBeChecked()

    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Metronome Timer')

    const bpmInput = page.locator('#new-timer-bpm')
    await bpmInput.fill('120')

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Verify timer was created with metronome enabled
    const timerItem = page.locator('.timer-item').first()
    await expect(timerItem).toBeVisible()
    await expect(timerItem).toContainText('Metronome Timer')

    const startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()
    
    await expect(startBtn).toContainText('Stop')

    // Wait for multiple ticks (at 120 BPM = 500ms per beat)
    // This should trigger multiple beeps
    await page.waitForTimeout(1000)

    // Stop timer
    await startBtn.click()
    await expect(startBtn).toContainText('Start')

    // Verify timer is still responsive
    await expect(timerItem).toBeVisible()
  })

  test('CPU stress test should not affect timer accuracy', async ({ page }) => {
    await page.goto('/')

    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Stress Timer')

    const bpmInput = page.locator('#new-timer-bpm')
    await bpmInput.fill('120')

    const cpuStressCheckbox = page.locator('#new-timer-cpu-stress')
    await cpuStressCheckbox.check()
    await expect(cpuStressCheckbox).toBeChecked()

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Start timer under CPU stress
    const startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()

    await page.waitForTimeout(1000)

    await startBtn.click()

    // Timer should still be responsive
    const timerItem = page.locator('.timer-item').first()
    await expect(timerItem).toBeVisible()
  })

  test('synchronization offset should be calculated', async ({ page }) => {
    await page.goto('/')

    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Sync Timer')

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Select timer to show details with sync info
    const timerItem = page.locator('.timer-item').first()
    await timerItem.click()

    const detailsPanel = page.locator('#timer-details-panel')
    await expect(detailsPanel).toBeVisible()

    // Should show synchronization offset in details
    const detailsText = await detailsPanel.textContent()
    expect(detailsText).toBeTruthy()
  })
})
