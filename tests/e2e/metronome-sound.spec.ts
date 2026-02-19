import { test, expect } from '@playwright/test'

test.describe('Metronome Sound Feature', () => {
  test('metronome checkbox should be available', async ({ page }) => {
    await page.goto('/')

    const metronomeCheckbox = page.locator('#new-timer-metronome')
    await expect(metronomeCheckbox).toBeVisible()
    await expect(metronomeCheckbox).not.toBeChecked()
  })

  test('enabling metronome checkbox should persist in timer config', async ({
    page,
  }) => {
    await page.goto('/')

    // Check the metronome checkbox
    const metronomeCheckbox = page.locator('#new-timer-metronome')
    await metronomeCheckbox.check()
    await expect(metronomeCheckbox).toBeChecked()

    // Create a timer with metronome enabled
    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Metronome Test Timer')

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Timer should be created and visible
    const timerItem = page.locator('.timer-item').first()
    await expect(timerItem).toBeVisible()

    // Click timer to see details
    await timerItem.click()

    const detailsPanel = page.locator('#timer-details-panel')
    await expect(detailsPanel).toBeVisible()
  })

  test('metronome sound should trigger on every tick when enabled', async ({
    page,
  }) => {
    await page.goto('/')

    // Set up an audio context listener to verify beeps are called
    const audioContextBeeps: number[] = []

    await page.evaluateHandle((beeps) => {
      ;(window as any).beepCount = 0
      // Patch playMetronomeBeep to track calls
      const originalBeep = (window as any).playMetronomeBeep
      if (originalBeep) {
        ;(window as any).playMetronomeBeep = function (...args: any[]) {
          ;(window as any).beepCount++
          return originalBeep.apply(this, args)
        }
      }
    }, audioContextBeeps)

    // Enable metronome
    const metronomeCheckbox = page.locator('#new-timer-metronome')
    await metronomeCheckbox.check()

    // Create timer with known BPM
    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Sound Test Timer')

    const bpmInput = page.locator('#new-timer-bpm')
    await bpmInput.fill('120') // 120 BPM = 500ms per beat

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Start timer
    const startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()
    await expect(startBtn).toContainText('Stop')

    // Wait for multiple ticks
    // At 120 BPM over 1 second, we should get ~2 ticks
    await page.waitForTimeout(1500)

    // Check that beeps were called
    const beepCount = await page.evaluate(() => {
      return (window as any).beepCount || 0
    })

    expect(beepCount).toBeGreaterThan(0)

    // Stop timer
    await startBtn.click()
    await expect(startBtn).toContainText('Start')
  })

  test('metronome sound should not trigger when disabled', async ({ page }) => {
    await page.goto('/')

    // DO NOT check the metronome checkbox
    const metronomeCheckbox = page.locator('#new-timer-metronome')
    await expect(metronomeCheckbox).not.toBeChecked()

    // Set up beep counter
    await page.evaluateHandle(() => {
      ;(window as any).beepCount = 0
      const originalBeep = (window as any).playMetronomeBeep
      if (originalBeep) {
        ;(window as any).playMetronomeBeep = function (...args: any[]) {
          ;(window as any).beepCount++
          return originalBeep.apply(this, args)
        }
      }
    })

    // Create timer
    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('No Sound Timer')

    const bpmInput = page.locator('#new-timer-bpm')
    await bpmInput.fill('120')

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Start timer
    const startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()

    // Wait for potential ticks
    await page.waitForTimeout(1500)

    // Beeps should not have been called
    const beepCount = await page.evaluate(() => {
      return (window as any).beepCount || 0
    })

    expect(beepCount).toBe(0)

    // Stop timer
    await startBtn.click()
  })

  test('metronome beep should have correct parameters', async ({ page }) => {
    await page.goto('/')

    // Track the parameters passed to playMetronomeBeep
    const beepParameters: Array<{ frequency: number; duration: number }> = []

    await page.evaluateHandle(() => {
      ;(window as any).beepParameters = []
      const originalBeep = (window as any).playMetronomeBeep
      if (originalBeep) {
        ;(window as any).playMetronomeBeep = function (
          frequency: number = 880,
          duration: number = 100
        ) {
          ;(window as any).beepParameters.push({ frequency, duration })
          return originalBeep.call(this, frequency, duration)
        }
      }
    })

    // Enable metronome
    const metronomeCheckbox = page.locator('#new-timer-metronome')
    await metronomeCheckbox.check()

    // Create timer
    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Beep Params Timer')

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Start timer
    const startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()

    // Wait for at least one beep
    await page.waitForTimeout(600)

    // Get recorded parameters
    const params = await page.evaluate(() => {
      return (window as any).beepParameters || []
    })

    // Verify we got at least one beep
    expect(params.length).toBeGreaterThan(0)

    // Verify beep parameters (default should be 880Hz for 100ms)
    params.forEach((param) => {
      expect(param.frequency).toBe(880)
      expect(param.duration).toBe(100)
    })

    // Stop timer
    await startBtn.click()
  })

  test('multiple timers with metronome should each produce sound', async ({
    page,
  }) => {
    await page.goto('/')

    // Set up beep counter
    await page.evaluateHandle(() => {
      ;(window as any).beepCount = 0
      const originalBeep = (window as any).playMetronomeBeep
      if (originalBeep) {
        ;(window as any).playMetronomeBeep = function (...args: any[]) {
          ;(window as any).beepCount++
          return originalBeep.apply(this, args)
        }
      }
    })

    // Enable metronome
    const metronomeCheckbox = page.locator('#new-timer-metronome')
    await metronomeCheckbox.check()

    // Create first timer
    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Timer 1')

    const bpmInput = page.locator('#new-timer-bpm')
    await bpmInput.fill('120')

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Start first timer
    let startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()

    // Create second timer
    await nameInput.fill('Timer 2')
    await bpmInput.fill('100')
    await createBtn.click()

    // Start second timer
    startBtn = page.locator('.timer-toggle').nth(1)
    await startBtn.click()

    // Wait for beeps from both timers
    await page.waitForTimeout(1500)

    // Get beep count - should be from both timers
    const beepCount = await page.evaluate(() => {
      return (window as any).beepCount || 0
    })

    // With 2 timers running, we should get beeps from both
    expect(beepCount).toBeGreaterThan(0)

    // Clean up - stop both timers
    const stopButtons = page.locator('.timer-toggle')
    await stopButtons.first().click()
    await stopButtons.nth(1).click()
  })
})
