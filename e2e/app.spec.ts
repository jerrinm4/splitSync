import { setup } from './mock-app'
import { test, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tripId, sampleTrip } from './fixtures'

test('signed-out visitors can reach login and protected routes redirect', async ({ page }) => {
  await setup(page, false)
  await page.goto(`/trips/${tripId}`)
  await expect(page).toHaveURL(/login/)
  await expect(page.getByLabel('Email Address')).toBeVisible()
})

test('search filters notes and CSV contains only matching expenses', async ({ page }) => {
  await setup(page)
  await page.goto(`/trips/${tripId}/expenses`)
  await page.getByRole('textbox', { name: 'Search expenses' }).fill('waterfront')
  await expect(page.getByText('1 of 4 expenses')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export expenses as CSV' }).click()
  const download = await downloadPromise
  const csv = await readFile((await download.path())!, 'utf8')
  expect(csv).toContain('Sunset dinner')
  expect(csv).not.toContain('Beachside villa')
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByText('4 of 4 expenses')).toBeVisible()
})

test('editing preserves multiple payers and a local calendar date', async ({ page }) => {
  const { writes } = await setup(page)
  await page.goto(`/trips/${tripId}/expenses/${sampleTrip.expenses[0]!.id}/edit`)
  await page.getByLabel('Description', { exact: true }).fill('Villa updated')
  await page.getByLabel('Date', { exact: true }).fill('2026-09-26')
  await page.getByRole('button', { name: 'Update Expense', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]?.p_expense_date).toBe('2026-09-26')
  expect(writes[0]?.p_payers).toHaveLength(2)
  expect(writes[0]?.p_expected_version).toBe(1)
})

test('backup downloads without sharing secrets', async ({ page }) => {
  await setup(page)
  await page.goto(`/trips/${tripId}/settings`)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download trip backup' }).click()
  const download = await downloadPromise
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(backup.trip.expenses).toHaveLength(4)
  expect(backup.trip.share_token).toBeUndefined()
})

for (const report of [
  { name: 'expenses', route: `/trips/${tripId}/expenses`, button: 'Export expenses as PDF' },
  { name: 'member-balances', route: `/trips/${tripId}/members`, button: 'Export member balances as PDF' },
  { name: 'member-statement', route: `/trips/${tripId}/members/${sampleTrip.trip_members[0]!.id}`, button: 'Export PDF' },
]) {
  test(`${report.name} PDF downloads`, async ({ page }) => {
    await setup(page)
    await page.goto(report.route)
    await page.getByRole('button', { name: report.button, exact: true }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download PDF', exact: true }).click()
    const download = await downloadPromise
    const contents = await readFile((await download.path())!)
    expect(contents.subarray(0, 5).toString()).toBe('%PDF-')
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
    await expect(page.getByRole('dialog')).not.toBeVisible()
    if (process.env.CAPTURE_PDFS) {
      await mkdir('output/pdf', { recursive: true })
      await writeFile(`output/pdf/${report.name}.pdf`, contents)
    }
  })
}

test('PDF font download failure can be retried', async ({ page }) => {
  await setup(page)
  await page.route('**/fonts/*.ttf', route => route.fulfill({ status: 503, body: '' }))
  await page.goto(`/trips/${tripId}/expenses`)
  await page.getByRole('button', { name: 'Export expenses as PDF' }).click()
  await page.getByRole('button', { name: 'Download PDF' }).click()
  await expect(page.getByRole('alert')).toContainText('PDF fonts could not load')
  await page.unroute('**/fonts/*.ttf')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF' }).click()
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.pdf$/)
})

test('PDF handles long names, multi-page rows and filtered totals', async ({ page }) => {
  await setup(page)
  await page.goto(`/trips/${tripId}/expenses`)
  await expect(page.getByRole('heading', { name: 'Expenses', exact: true })).toBeVisible()
  const result = await page.evaluate(async trip => {
    const modulePath = '/src/lib/pdf.ts'
    const { buildExpensesPDF, buildMemberPDF } = await import(/* @vite-ignore */ modulePath)
    trip.name = 'A long weekend with friends along the beautiful Konkan coast and beyond'
    trip.trip_members[0]!.name = 'Alexandra Marie Fernández-Silva'
    const expenses = Array.from({ length: 35 }, (_, index) => ({ ...trip.expenses[0]!, id: `test-${index}`, title: `Expense ${index + 1}: shared beachside accommodation`, note: 'A detailed note for the group. '.repeat(20) }))
    const doc = await buildExpensesPDF({ ...trip, expenses }, expenses)
    const filtered = await buildExpensesPDF(trip, [trip.expenses[1]!])
    // Include an expense paid by this member even when none of its cost is assigned to them.
    const payerOnly = { ...trip.expenses[0]!, expense_splits: trip.expenses[0]!.expense_splits.slice(1) }
    const statement = await buildMemberPDF({ ...trip, expenses: [payerOnly], fund_transactions: [] }, trip.trip_members[0]!)
    return {
      pages: doc.getNumberOfPages(), report: doc.output('datauristring').split(',')[1],
      rows: filtered.lastAutoTable.body.map((row: { cells: Record<string, { text: string[] }> }) => row.cells[1]!.text.join(' ')),
      memberRows: statement.lastAutoTable.body.length,
    }
  }, structuredClone(sampleTrip))
  expect(result.pages).toBeGreaterThan(2)
  expect(result.rows).toHaveLength(1)
  expect(result.rows[0]).toContain('Sunset dinner')
  expect(result.memberRows).toBe(1)
  if (process.env.CAPTURE_PDFS) {
    await mkdir('tmp/pdfs', { recursive: true })
    await writeFile('tmp/pdfs/stress.pdf', Buffer.from(result.report, 'base64'))
  }
})

test('shared trip shows paid balances and offers no write actions', async ({ page }) => {
  await setup(page, false)
  await page.goto('/shared/goa/sample-share-token')
  await expect(page.getByRole('heading', { name: sampleTrip.name })).toBeVisible()
  await expect(page.getByText('₹4,300', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /delete|edit|add expense/i })).toHaveCount(0)
})

test('mobile expenses fit the viewport and expand with the keyboard', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/trips/${tripId}/expenses`)
  const detail = page.getByRole('button', { name: 'Details for Sunset dinner' })
  await detail.focus()
  await page.keyboard.press('Enter')
  await expect(detail).toHaveAttribute('aria-expanded', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('capture documentation screenshots', async ({ page }) => {
  test.skip(!process.env.CAPTURE_SCREENSHOTS, 'Run pnpm screenshots to refresh the README images')
  await setup(page)
  await mkdir('docs/screenshots', { recursive: true })
  const prepareShot = async () => {
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' })
    await page.evaluate(async () => {
      await document.fonts.ready
      document.querySelectorAll('main .overflow-y-auto').forEach(element => element.scrollTo(0, 0))
    })
  }
  const shots = [
    ['dashboard', `/trips/${tripId}`, sampleTrip.name],
    ['expenses', `/trips/${tripId}/expenses`, 'Expenses'],
  ]
  for (const [name, url, title] of shots) {
    await page.goto(url!)
    await expect(page.getByRole('heading', { name: title!, exact: true })).toBeVisible()
    await prepareShot()
    await page.screenshot({ path: `docs/screenshots/${name}.png`, animations: 'disabled' })
  }
  await page.evaluate(() => { document.documentElement.classList.add('light'); document.documentElement.classList.remove('dark') })
  await prepareShot()
  await page.screenshot({ path: 'docs/screenshots/expenses-light.png', animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/trips/${tripId}/expenses`)
  await expect(page.getByRole('heading', { name: 'Expenses', exact: true })).toBeVisible()
  await prepareShot()
  await page.screenshot({ path: 'docs/screenshots/mobile.png', animations: 'disabled' })
})
