import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { setup } from './mock-app'
import { tripId, sampleTrip } from './fixtures'

async function audit(page: Page) {
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => {
      document.documentElement.classList.toggle('light', theme === 'light')
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }, theme)
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
    expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), theme).toEqual([])
    expect(await page.evaluate(() => [document.documentElement, ...document.querySelectorAll('main, [role="dialog"]')].every(el => el.scrollWidth <= el.clientWidth + 1)), 'No horizontal overflow').toBe(true)
  }
}

const dialogs = [
  { name: 'categories', route: 'expenses', button: 'Manage Categories', title: 'Manage Categories' },
  { name: 'groups', route: 'members', button: 'Manage member groups', title: 'Manage Groups' },
  { name: 'new member', route: 'members', button: 'Add member', title: 'Add a new member' },
  { name: 'wallet deposit', route: 'funds', button: 'Add', title: 'Add Funds to Wallet' },
  { name: 'wallet refund', route: 'funds', button: 'Withdraw', title: 'Withdraw Funds' },
  { name: 'share', route: '', button: 'Share Trip', title: 'Share Trip' },
  { name: 'export', route: 'expenses', button: 'Export expenses as PDF', title: 'Export Expenses' },
]
for (const dialog of dialogs) {
  test(`dialog accessibility: ${dialog.name}`, async ({ page }) => {
    await setup(page)
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto(`/trips/${tripId}/${dialog.route}`)
    await page.getByRole('button', { name: dialog.button, exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await audit(page)
    if (dialog.name === 'categories') {
      await page.getByRole('button', { name: 'Edit category Stay' }).click()
      await audit(page)
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.getByRole('button', { name: 'Delete category Stay' }).click()
      await audit(page)
    }
    await page.keyboard.press('Escape')
  })
}

test('trip edit and destructive confirmation are accessible', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(`/trips/${tripId}`)
  for (const action of ['Edit Trip', 'Delete Trip']) {
    await page.getByRole('button', { name: 'Trip actions' }).click()
    await page.getByRole('menuitem', { name: action }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await audit(page)
    if (action === 'Delete Trip') await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
})

test('mobile navigation traps focus, closes with Escape and restores focus', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(`/trips/${tripId}`)
  const trigger = page.getByRole('button', { name: 'Open navigation' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Trip navigation' })).toBeVisible()
  await audit(page)
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(false)
})

for (const route of ['', 'expenses', 'members', 'funds']) {
  test(`empty state accessibility: ${route || 'dashboard'}`, async ({ page }) => {
    await setup(page, true, { empty: true })
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto(`/trips/${tripId}/${route}`)
    await expect(page.getByRole('heading').first()).toBeVisible()
    await audit(page)
  })
}

test('failed requests explain the problem and retry recovers', async ({ page }) => {
  const options = { error: true }
  await setup(page, true, options)
  await page.goto(`/trips/${tripId}/expenses`)
  await expect(page.getByRole('heading', { name: 'Could not load this page' })).toBeVisible()
  await audit(page)
  options.error = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Expenses', exact: true })).toBeVisible()
})

test('login error and sent-email states are accessible', async ({ page }) => {
  await setup(page, false)
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/login#error=access_denied&error_description=Please%20try%20again')
  await expect(page.getByRole('alert')).toContainText('Please try again')
  await audit(page)
  await page.getByLabel('Email Address').fill('traveler@example.test')
  await page.getByRole('button', { name: 'Sign In with Magic Link' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await audit(page)
})

test('PIN protection shows errors, unlocks and keeps receipts private', async ({ page }) => {
  await setup(page, false, { pin: true, receipt: true })
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/shared/goa/sample-share-token')
  await expect(page.getByRole('heading', { name: 'Protected Trip' })).toBeVisible()
  await audit(page)
  await page.getByLabel('Trip PIN').fill('0000')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('alert')).toContainText('Wrong PIN')
  await audit(page)
  await page.getByLabel('Trip PIN').fill('1234')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('heading', { name: sampleTrip.name })).toBeVisible()
  await expect(page.getByRole('button', { name: /view receipt/i })).toHaveCount(0)
})

test('receipt access uses expiring URLs and recovers from a signing failure', async ({ page }) => {
  const options = { receipt: true, receiptError: true }
  const { signedRequests } = await setup(page, true, options)
  await page.goto(`/trips/${tripId}/expenses`)
  await page.getByRole('button', { name: 'Details for Beachside villa' }).click()
  await page.getByRole('button', { name: 'View receipt for Beachside villa' }).click()
  await expect(page.getByRole('alert')).toContainText('Could not load this receipt')
  await audit(page)
  options.receiptError = false
  await page.getByRole('button', { name: 'Retry receipt' }).click()
  await expect(page.getByRole('img', { name: 'Receipt for Beachside villa' })).toBeVisible()
  expect(signedRequests.at(-1)).toMatchObject({ expiresIn: 300 })
  await expect(page.getByRole('link', { name: 'Open receipt in a new tab' })).toHaveAttribute('href', /object\/sign\/receipts\/.+token=/)
  await audit(page)
})

test('offline status is announced and clears after reconnecting', async ({ page, context }) => {
  await setup(page)
  await page.goto(`/trips/${tripId}/expenses`)
  await expect(page.getByRole('heading', { name: 'Expenses', exact: true })).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByRole('status')).toContainText('offline')
  await audit(page)
  await context.setOffline(false)
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('member management dialogs and checkbox selection work with the keyboard', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(`/trips/${tripId}/members/${sampleTrip.trip_members[0]!.id}`)
  for (const action of ['Edit Details', 'Disable Member', 'Delete Member']) {
    await page.getByRole('button', { name: 'Member actions' }).click()
    await page.getByRole('menuitem', { name: action, exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await audit(page)
    if (action === 'Disable Member') {
      const checkbox = page.getByRole('checkbox').first()
      await checkbox.focus()
      const previous = await checkbox.isChecked()
      await page.keyboard.press('Space')
      expect(await checkbox.isChecked()).toBe(!previous)
    }
    if (action === 'Delete Member') await expect(page.getByRole('button', { name: 'Delete member', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
  }
})

test('shared member and category summaries and activity details are accessible', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/shared/goa/sample-share-token')
  await page.getByRole('button', { name: /Beachside villa/ }).click()
  await audit(page)
  await page.getByRole('button', { name: /^Members/ }).click()
  await audit(page)
  await page.getByRole('button', { name: /Contributions/ }).first().click()
  await audit(page)
  await page.getByRole('button', { name: /^Categories/ }).click()
  await audit(page)
  await page.goto(`/trips/${tripId}/activity`)
  await page.getByRole('button', { name: /^Activity:/ }).first().click()
  await audit(page)
})

test('long names and notes fit narrow screens', async ({ page }) => {
  const { trip } = await setup(page)
  trip.name = 'KonkanCoastWeekendWithFriends'.repeat(3)
  trip.trip_members[0]!.name = 'AlexandraMarieFernandezSilva'.repeat(3)
  trip.expenses[0]!.title = 'BeachsideAccommodationBooking'.repeat(3)
  trip.expenses[0]!.note = 'VeryLongReceiptReference'.repeat(10)
  await page.setViewportSize({ width: 320, height: 740 })
  for (const route of ['', 'expenses', 'members', `members/${sampleTrip.trip_members[0]!.id}`]) {
    await page.goto(`/trips/${tripId}/${route}`)
    await expect(page.getByRole('heading').first()).toBeVisible()
    expect(await page.evaluate(() => [document.documentElement, ...document.querySelectorAll('main, main .overflow-y-auto')].every(el => el.scrollWidth <= el.clientWidth + 1)), route).toBe(true)
  }
})

test('mobile expense submit stays above bottom navigation', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(`/trips/${tripId}/expenses/${sampleTrip.expenses[0]!.id}/edit`)
  const submit = page.getByRole('button', { name: 'Update Expense', exact: true })
  await submit.scrollIntoViewIfNeeded()
  const button = await submit.boundingBox()
  const navigation = await page.getByRole('navigation', { name: 'Trip pages' }).boundingBox()
  expect(button && navigation && button.y + button.height <= navigation.y).toBeTruthy()
  await submit.click()
  await expect(page.getByRole('dialog', { name: 'Confirm Expense' })).toBeVisible()
  await audit(page)
})

test('receipt preview removal is visible and permits choosing the same image again', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(`/trips/${tripId}/expenses/new`)
  const file = { name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=', 'base64') }
  const input = page.getByLabel('Receipt image')
  await input.setInputFiles(file)
  await expect(page.getByRole('img', { name: 'Receipt preview' })).toBeVisible()
  await page.getByRole('button', { name: 'Remove selected image' }).click()
  await expect(input).toHaveValue('')
  await expect(page.getByRole('img', { name: 'Receipt preview' })).toHaveCount(0)
  await input.setInputFiles(file)
  await expect(page.getByRole('img', { name: 'Receipt preview' })).toBeVisible()
  await audit(page)
})
