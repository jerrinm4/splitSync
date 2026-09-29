import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { setup } from './mock-app'
import { tripId, sampleTrip } from './fixtures'

const screens = [
  ['trips', '/trips?all=true', 'My Trips'],
  ['new-trip', '/trips/new', 'Create a New Trip'],
  ['dashboard', `/trips/${tripId}`, sampleTrip.name],
  ['expenses', `/trips/${tripId}/expenses`, 'Expenses'],
  ['new-expense', `/trips/${tripId}/expenses/new`, 'Add Expense'],
  ['edit-expense', `/trips/${tripId}/expenses/${sampleTrip.expenses[0]!.id}/edit`, 'Edit Expense'],
  ['members', `/trips/${tripId}/members`, 'Members'],
  ['member', `/trips/${tripId}/members/${sampleTrip.trip_members[0]!.id}`, 'Aarav'],
  ['funds', `/trips/${tripId}/funds`, 'Trip Wallet'],
  ['activity', `/trips/${tripId}/activity`, 'Activity Log'],
  ['settings', `/trips/${tripId}/settings`, 'Trip Settings'],
  ['shared', '/shared/goa/sample-share-token', sampleTrip.name],
  ['login', '/login', 'SplitSync'],
  ['not-found', '/missing-page', 'Page not found'],
] as const

for (const [name, url, heading] of screens) {
  test(`accessibility and layout: ${name}`, async ({ page }, info) => {
    test.setTimeout(90000)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await setup(page, name !== 'login' && name !== 'shared')
    await page.goto(url)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    const findings = []
    for (const mode of [
      { theme: 'dark', width: 1440, height: 1000 },
      { theme: 'light', width: 1440, height: 1000 },
      { theme: 'dark', width: 320, height: 740 },
      { theme: 'light-yellow', width: 320, height: 740 },
      { theme: 'dark-yellow', width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize({ width: mode.width, height: mode.height })
      await page.evaluate(theme => {
        document.documentElement.classList.toggle('light', theme.startsWith('light'))
        document.documentElement.classList.toggle('dark', theme.startsWith('dark'))
        document.documentElement.classList.toggle('theme-yellow', theme.endsWith('yellow'))
      }, mode.theme)
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
      findings.push({ mode, violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })) })
      const overflow = await page.evaluate(() => {
        const containers = [document.documentElement, ...document.querySelectorAll('main, main .overflow-y-auto')]
        return containers.some(element => element.scrollWidth > element.clientWidth + 1)
      })
      if (overflow) findings.push({ mode, overflow })
    }
    await mkdir('tmp/audit', { recursive: true })
    await writeFile(`tmp/audit/${info.project.name}-${name}.json`, JSON.stringify(findings, null, 2))
    expect(errors).toEqual([])
    expect(findings.filter(item => 'overflow' in item || item.violations.length > 0)).toEqual([])
  })
}
