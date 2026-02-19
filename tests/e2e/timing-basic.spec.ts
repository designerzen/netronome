import { test, expect } from '@playwright/test'

test.describe('Timer Basic Functionality', () => {
  test('should create and start a timer', async ({ page }) => {
    await page.goto('/')

    // Set timer name
    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Test Timer')

    // Set BPM
    const bpmInput = page.locator('#new-timer-bpm')
    await bpmInput.fill('120')

    // Create timer
    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Verify timer appears in list
    const timerItem = page.locator('.timer-item')
    await expect(timerItem).toContainText('Test Timer')
    await expect(timerItem).toContainText('120 BPM')
  })

  test('should start and stop timer', async ({ page }) => {
    await page.goto('/')

    // Create timer
    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Toggle Timer')

    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Start timer
    const startBtn = page.locator('.timer-toggle').first()
    await startBtn.click()
    await expect(startBtn).toContainText('Stop')

    // Wait a bit
    await page.waitForTimeout(100)

    // Stop timer
    await startBtn.click()
    await expect(startBtn).toContainText('Start')
  })

  test('should remove timer', async ({ page }) => {
    await page.goto('/')

    // Create timer
    const nameInput = page.locator('#new-timer-name')
    await nameInput.fill('Remove Timer')
    const createBtn = page.locator('#create-timer')
    await createBtn.click()

    // Remove timer
    const removeBtn = page.locator('.timer-remove').first()
    await removeBtn.click()

    // Verify removed
    const timersList = page.locator('.timer-item')
    await expect(timersList).toHaveCount(0)
  })

  test('should sync BPM input and slider', async ({ page }) => {
    await page.goto('/')

    const bpmInput = page.locator('#new-timer-bpm')
    const bpmSlider = page.locator('#new-timer-bpm-slider')

    // Change via input
    await bpmInput.fill('90')
    await expect(bpmSlider).toHaveValue('90')

    // Change via slider
    await bpmSlider.fill('140')
    await expect(bpmInput).toHaveValue('140')
  })
})
