import type { Page } from '@playwright/test'
import { ownerId, sampleTrip } from './fixtures'

export async function setup(page: Page, signedIn = true, options: { theme?: string; empty?: boolean; error?: boolean; pin?: boolean; receipt?: boolean; receiptError?: boolean } = {}) {
  const trip = structuredClone(sampleTrip)
  if (options.empty) { trip.expenses = []; trip.fund_transactions = []; trip.trip_members = [] }
  if (options.receipt) trip.expenses[0]!.receipt_url = `${trip.id}/demo.png`
  const signedRequests: Record<string, unknown>[] = []
  const user = { id: ownerId, email: 'traveler@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  await page.addInitScript(({ signedIn, user, theme }) => {
    localStorage.setItem('app-theme', theme)
    if (signedIn) localStorage.setItem('sb-demo-auth-token', JSON.stringify({
      access_token: 'demo-access-token', refresh_token: 'demo-refresh-token', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, user,
    }))
  }, { signedIn, user, theme: options.theme || 'dark' })
  const writes: Record<string, unknown>[] = []
  await page.route('https://demo.supabase.co/**', async route => {
    const url = new URL(route.request().url())
    if (options.error && url.pathname.includes('/rest/v1/')) { await route.fulfill({ status: 500, json: { message: 'Test unavailable' } }); return }
    if (url.pathname.includes('/storage/v1/object/sign/receipts/')) {
      if (route.request().method() === 'POST') {
        signedRequests.push(route.request().postDataJSON())
        await route.fulfill(options.receiptError
          ? { status: 403, json: { message: 'Access denied' } }
          : { json: { signedURL: '/object/sign/receipts/' + trip.id + '/demo.png?token=demo' } })
      } else await route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=', 'base64') })
      return
    }
    if (options.pin && url.pathname.endsWith('/trips') && url.searchParams.has('share_token') && route.request().headers()['x-share-pin'] !== '1234') {
      await route.fulfill({ status: 406, json: { message: 'Trip unavailable' } }); return
    }
    let result: unknown = []
    if (url.pathname.endsWith('/auth/v1/user')) result = user
    else if (url.pathname.endsWith('/auth/v1/logout')) result = {}
    else if (url.pathname.endsWith('/rpc/check_trip_pin_required')) result = options.pin || false
    else if (url.pathname.endsWith('/rpc/get_trip_owner')) result = [{ owner_id: ownerId, email: user.email }]
    else if (url.pathname.endsWith('/rpc/get_trip_audit_logs')) result = options.empty ? [] : ['CREATE', 'UPDATE', 'DELETE', 'ADD_FUNDS', 'REMOVE_FUNDS'].map((action, index) => ({
      id: 'audit-' + index, trip_id: trip.id, actor_user_id: ownerId, actor_email: user.email,
      entity_type: index > 2 ? 'FUND_TRANSACTION' : 'EXPENSE', entity_id: trip.expenses[0]?.id, action,
      after_data: { title: 'Beachside villa', amount_paise: 1200000, note: 'Updated booking', splits: trip.expenses[0]?.expense_splits },
      before_data: action === 'UPDATE' ? { title: 'Original booking', amount_paise: 1000000 } : null,
      created_at: '2026-09-25T10:00:00Z',
    }))
    else if (url.pathname.endsWith('/rpc/get_trip_admins')) result = []
    else if (url.pathname.endsWith('/rpc/create_expense') || url.pathname.endsWith('/rpc/update_expense')) {
      writes.push(route.request().postDataJSON())
      result = url.pathname.endsWith('create_expense') ? crypto.randomUUID() : null
    } else if (url.pathname.endsWith('/trips')) {
      result = url.searchParams.has('id') || url.searchParams.has('share_token') ? trip : [trip]
    } else if (url.pathname.endsWith('/trip_members')) result = trip.trip_members
    else if (url.pathname.endsWith('/expense_categories')) result = trip.expense_categories
    await route.fulfill({ json: result })
  })
  return { trip, writes, signedRequests }
}
