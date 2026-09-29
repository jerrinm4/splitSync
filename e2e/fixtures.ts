import type { TripDetails, Expense } from '../src/types/trip'

export const ownerId = '10000000-0000-4000-8000-000000000001'
export const tripId = '20000000-0000-4000-8000-000000000001'
const stamp = '2026-09-20T09:00:00Z'
const ids = [1, 2, 3, 4].map(index => `30000000-0000-4000-8000-00000000000${index}`)
const categories = [
  { id: '40000000-0000-4000-8000-000000000001', name: 'Stay', color: '#8b5cf6', estimated_amount_paise: 1500000 },
  { id: '40000000-0000-4000-8000-000000000002', name: 'Food', color: '#f97316', estimated_amount_paise: 600000 },
  { id: '40000000-0000-4000-8000-000000000003', name: 'Travel', color: '#14b8a6', estimated_amount_paise: 800000 },
].map(category => ({ ...category, trip_id: tripId, created_at: stamp }))
const expense = (index: number, title: string, amount: number, source: string, paid: boolean, category: number, note: string): Expense => ({
  id: `50000000-0000-4000-8000-00000000000${index}`, trip_id: tripId, title, amount_paise: amount,
  expense_date: `2026-09-${20 + index}`, created_at: `2026-09-${20 + index}T09:00:00Z`, updated_at: stamp,
  created_by: ownerId, idempotency_key: `60000000-0000-4000-8000-00000000000${index}`,
  is_paid: paid, category_id: categories[category]!.id, payment_source: source,
  paid_by_member_id: source === 'MEMBER' ? ids[0]! : null, split_method: 'EQUAL', note,
  status: 'ACTIVE', version: 1, receipt_url: null,
  expense_splits: ids.map(member_id => ({ member_id, amount_paise: amount / 4 })),
  expense_payers: source === 'MEMBER' ? ids.slice(0, 2).map(member_id => ({ member_id, amount_paise: amount / 2 })) : [],
})

export const sampleTrip: TripDetails = {
  id: tripId, owner_id: ownerId, name: 'Goa · Long weekend', note: 'Four friends, one shared adventure.', currency: 'INR',
  start_date: '2026-09-21', end_date: '2026-09-25', status: 'ACTIVE', share_enabled: true,
  share_token: 'sample-share-token', share_pin: null, created_at: stamp, updated_at: stamp,
  rounding_mode: 'PAISE', show_estimated_per_head: true,
  trip_members: ['Aarav', 'Maya', 'Neha', 'Rohan'].map((name, index) => ({
    id: ids[index]!, trip_id: tripId, name, note: null, status: 'ACTIVE', created_at: stamp, updated_at: stamp,
  })),
  trip_member_groups: [], expense_categories: categories,
  expenses: [
    expense(1, 'Beachside villa', 1200000, 'MEMBER', true, 0, 'Two nights near the beach'),
    expense(2, 'Sunset dinner', 240000, 'TRIP_WALLET', true, 1, 'Dinner at the waterfront'),
    expense(3, 'Airport transfers', 120000, 'TRIP_WALLET', true, 2, 'Return taxi booking'),
    expense(4, 'Island boat trip', 320000, 'TRIP_WALLET', false, 2, 'Planned for the last morning'),
  ],
  fund_transactions: [
    ...ids.map((member_id, index) => ({ id: `70000000-0000-4000-8000-00000000000${index}`, member_id, amount_paise: 200000, transaction_type: 'ADD' })),
    { id: '70000000-0000-4000-8000-000000000005', member_id: ids[0]!, amount_paise: 10000, transaction_type: 'REMOVE' },
  ].map(fund => ({ ...fund, trip_id: tripId, note: null, occurred_at: stamp, created_at: stamp, status: 'ACTIVE', created_by: ownerId, idempotency_key: fund.id })),
}
